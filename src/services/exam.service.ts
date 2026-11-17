import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { Types, type QueryFilter } from "mongoose";
import { Exam, ExamQuestion, Question, Attempt, Result, ExamTemplate, audit } from "@/models";
import type { ExamDoc } from "@/models/Exam";
import type { QuestionDoc } from "@/models/Question";
import type { SubjectDistributionItem } from "@/models/types";
import { allocate, type Availability, type DifficultyCounts } from "@/lib/exam/allocation";
import { shuffle } from "@/lib/exam/shuffle";
import { AppError, badRequest, notFound } from "@/lib/errors";
import { escapeRegex } from "@/lib/api";
import { DIFFICULTIES, FINAL_ATTEMPT_STATUSES, SUBJECTS, type Difficulty, type SourceType } from "@/lib/constants";
import type { ExamConfigInput } from "@/lib/validation/exams";
import { finalizeAttempt } from "./attempt.service";
import type { ExamTemplateDoc } from "@/models/ExamTemplate";
import type { ExamScheduleInput } from "@/lib/validation/exams";
import { examLifecycle } from "@/lib/exam/lifecycle";
import { templateSnapshot } from "./exam-template.service";

/* -------------------------------------------------------------------------- */
/*  Eligibility                                                                */
/* -------------------------------------------------------------------------- */

interface PoolOptions {
  subject?: string;
  difficulty?: Difficulty | "Any";
  sources?: SourceType[];
  includeNumerical?: boolean;
  topics?: string[];
}

/** A question can appear in an exam unless it was rejected or archived, and only if it is complete with no open issues. */
export function eligibleFilter(o: PoolOptions): QueryFilter<QuestionDoc> {
  const f: QueryFilter<QuestionDoc> = {
    archived: false,
    verificationStatus: { $ne: "rejected" },
    issues: { $size: 0 },
    assetStatus: { $ne: "missing" },
    questionType: o.includeNumerical ? { $in: ["single_correct", "numerical"] } : "single_correct",
    difficulty: o.difficulty && o.difficulty !== "Any" ? o.difficulty : { $in: [...DIFFICULTIES] },
  };
  if (o.subject) f.subject = o.subject;
  if (o.sources?.length) f.sourceType = { $in: o.sources };
  if (o.topics?.length) f.topic = { $in: o.topics };
  return f;
}

export async function availabilityFor(config: Pick<ExamConfigInput, "subjectDistribution" | "selection">): Promise<Availability> {
  const availability: Availability = {};
  const subjects = config.subjectDistribution.length ? config.subjectDistribution : SUBJECTS.map((s) => ({ subject: s, topics: [] as string[] }));
  await Promise.all(
    subjects.map(async (s) => {
      const rows = await Question.aggregate<{ _id: Difficulty; n: number }>([
        {
          $match: eligibleFilter({
            subject: s.subject,
            sources: config.selection.sources,
            includeNumerical: config.selection.includeNumerical,
            topics: s.topics,
          }),
        },
        { $group: { _id: "$difficulty", n: { $sum: 1 } } },
      ]);
      availability[s.subject] = Object.fromEntries(DIFFICULTIES.map((d) => [d, rows.find((r) => r._id === d)?.n ?? 0]));
    }),
  );
  return availability;
}

/* -------------------------------------------------------------------------- */
/*  Draft CRUD                                                                 */
/* -------------------------------------------------------------------------- */

function configToDoc(input: ExamConfigInput) {
  const { hardEnd, templateId, ...rest } = input;
  void templateId; // linked only at creation, see createExam
  return {
    ...rest,
    hardEndAt: hardEnd ? input.endDate : null,
    selection: { ...input.selection, manualQuestionIds: input.selection.manualQuestionIds.map((id) => new Types.ObjectId(id)) },
    totalMarks: input.totalQuestions * input.marking.correct,
  };
}

export async function createExam(input: ExamConfigInput, adminId: string) {
  let template: { templateId: Types.ObjectId; appliedTemplateSnapshot: unknown } | null = null;
  if (input.templateId) {
    const tpl = await ExamTemplate.findOne({ _id: input.templateId, status: "active" }).lean<ExamTemplateDoc>();
    if (!tpl) throw badRequest("This template is archived or no longer exists. Choose another template.");
    // The snapshot is a frozen copy: later edits to the template never reach this exam.
    template = { templateId: tpl._id, appliedTemplateSnapshot: templateSnapshot(tpl) };
  }
  const exam = await Exam.create({ ...configToDoc(input), ...(template ?? {}), createdBy: adminId, status: "draft" });
  await audit(adminId, "exam.create", "Exam", String(exam._id), template ? { templateId: String(template.templateId) } : undefined);
  return exam.toObject();
}

export async function updateDraftExam(id: string, input: ExamConfigInput, adminId: string) {
  const exam = await Exam.findById(id);
  if (!exam) throw notFound("Exam");
  if (exam.status !== "draft") throw new AppError("CONFLICT", "Only draft exams can be fully edited. Duplicate this exam to change its paper or marking scheme.");
  exam.set(configToDoc(input));
  await exam.save();
  await audit(adminId, "exam.update", "Exam", id);
  return exam.toObject();
}

export async function updatePublishedExam(id: string, patch: Record<string, unknown>, adminId: string) {
  const exam = await Exam.findById(id);
  if (!exam) throw notFound("Exam");
  const { settings, endDate, ...rest } = patch as { settings?: Record<string, unknown>; endDate?: Date };
  if (endDate && endDate <= exam.startDate) throw badRequest("End date must be after the start date.");
  exam.set(rest);
  if (endDate) {
    exam.endDate = endDate;
    if (exam.hardEndAt) exam.hardEndAt = endDate;
  }
  if (settings) for (const [k, v] of Object.entries(settings)) if (v !== undefined) exam.set(`settings.${k}`, v);
  await exam.save();
  await audit(adminId, "exam.update_published", "Exam", id, { fields: Object.keys(patch) });
  return exam.toObject();
}

export async function deleteDraftExam(id: string, adminId: string) {
  const exam = await Exam.findById(id);
  if (!exam) throw notFound("Exam");
  if (exam.status !== "draft") throw new AppError("CONFLICT", "Published exams cannot be deleted. Close or archive them instead.");
  await ExamQuestion.deleteMany({ examId: exam._id });
  await exam.deleteOne();
  await audit(adminId, "exam.delete", "Exam", id);
}

export async function archiveExam(id: string, adminId: string) {
  const exam = await Exam.findById(id);
  if (!exam) throw notFound("Exam");
  if (exam.status === "published") throw new AppError("CONFLICT", "Close the exam before archiving it.");
  exam.status = "archived";
  exam.archivedAt = new Date();
  await exam.save();
  await audit(adminId, "exam.archive", "Exam", id);
}

/* -------------------------------------------------------------------------- */
/*  Generation                                                                 */
/* -------------------------------------------------------------------------- */

type QuestionLean = Pick<
  QuestionDoc,
  | "_id"
  | "subject"
  | "topic"
  | "subtopic"
  | "difficulty"
  | "questionType"
  | "questionText"
  | "options"
  | "questionImages"
  | "originalQuestionId"
  | "correctOption"
  | "numericalAnswer"
  | "numericalTolerance"
  | "explanation"
  | "solutionImages"
>;

const SNAPSHOT_FIELDS =
  "subject topic subtopic difficulty questionType questionText options questionImages originalQuestionId correctOption numericalAnswer numericalTolerance explanation solutionImages";

function snapshot(q: QuestionLean) {
  return {
    questionId: q._id,
    questionSnapshot: {
      subject: q.subject,
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      questionType: q.questionType,
      questionText: q.questionText,
      // A numerical question is never shown with MCQ options.
      options: q.questionType === "single_correct" ? q.options : [],
      questionImages: q.questionImages,
      originalQuestionId: q.originalQuestionId,
    },
    answerKeySnapshot: {
      correctOption: q.correctOption ?? null,
      numericalAnswer: q.numericalAnswer ?? null,
      numericalTolerance: q.numericalTolerance ?? 0,
      explanation: q.explanation ?? "",
      solutionImages: q.solutionImages ?? [],
    },
  };
}

function orderBySubject<T extends { subject: string }>(items: T[]): T[] {
  const rank = (s: string) => {
    const i = (SUBJECTS as readonly string[]).indexOf(s);
    return i === -1 ? 99 : i;
  };
  return [...items].sort((a, b) => rank(a.subject) - rank(b.subject));
}

/**
 * Generates (or regenerates) the draft paper for an exam from usable questions in MongoDB.
 * Each generation creates a new exam version; the previous draft version is discarded.
 */
export async function generateExamPaper(id: string, adminId: string) {
  const exam = await Exam.findById(id);
  if (!exam) throw notFound("Exam");
  if (exam.status !== "draft") throw new AppError("CONFLICT", "The paper of a published exam is frozen. Duplicate the exam to create a new paper.");

  let selected: QuestionLean[] = [];
  const sources = (exam.selection?.sources ?? []) as SourceType[];
  const includeNumerical = !!exam.selection?.includeNumerical;

  if (exam.selection?.mode === "manual") {
    const ids = exam.selection.manualQuestionIds ?? [];
    if (ids.length !== exam.totalQuestions) throw badRequest(`Select exactly ${exam.totalQuestions} questions for manual selection.`);
    const found = await Question.find({ _id: { $in: ids }, ...eligibleFilter({ includeNumerical: true }) })
      .select(SNAPSHOT_FIELDS)
      .lean<QuestionLean[]>();
    if (found.length !== ids.length) {
      const ok = new Set(found.map((f) => String(f._id)));
      const bad = (ids as Types.ObjectId[]).map(String).filter((i) => !ok.has(i));
      throw new AppError("INSUFFICIENT_QUESTIONS", `${bad.length} selected question(s) were rejected, are archived or have open issues.`, { problems: bad });
    }
    const byId = new Map(found.map((f) => [String(f._id), f]));
    selected = (ids as Types.ObjectId[]).map((i) => byId.get(String(i))!);
  } else {
    const subjects = (exam.subjectDistribution as SubjectDistributionItem[]).filter((s) => s.count > 0);
    if (!subjects.length) throw badRequest("Set at least one subject with a question count.");
    const config = {
      subjectDistribution: subjects.map((s) => ({ subject: s.subject as (typeof SUBJECTS)[number], count: s.count, difficulty: null, topics: s.topics ?? [] })),
      selection: { mode: "random" as const, sources, includeNumerical, manualQuestionIds: [] },
    };
    const availability = await availabilityFor(config);
    const overall = exam.difficultyDistribution
      ? ({ Easy: exam.difficultyDistribution.Easy, Medium: exam.difficultyDistribution.Medium, Hard: exam.difficultyDistribution.Hard } as DifficultyCounts)
      : null;
    const plan = allocate(
      subjects.map((s) => ({
        subject: s.subject,
        count: s.count,
        difficulty: s.difficulty ? { Easy: s.difficulty.Easy, Medium: s.difficulty.Medium, Hard: s.difficulty.Hard } : null,
      })),
      overall,
      availability,
    );
    if (!plan.ok) throw new AppError("INSUFFICIENT_QUESTIONS", plan.problems[0], { problems: plan.problems, availability });

    const chosenIds: Types.ObjectId[] = [];
    for (const s of subjects) {
      const cells = plan.plan[s.subject];
      for (const [difficulty, n] of Object.entries(cells)) {
        if (!n) continue;
        const pool = await Question.find(
          eligibleFilter({ subject: s.subject, difficulty: difficulty as Difficulty | "Any", sources, includeNumerical, topics: s.topics ?? [] }),
        )
          .select("_id")
          .lean();
        if (pool.length < n) throw new AppError("INSUFFICIENT_QUESTIONS", `Only ${pool.length} usable ${s.subject} questions are available for the selected filters.`);
        chosenIds.push(...shuffle(pool.map((p) => p._id)).slice(0, n));
      }
    }
    const docs = await Question.find({ _id: { $in: chosenIds } }).select(SNAPSHOT_FIELDS).lean<QuestionLean[]>();
    selected = orderBySubject(shuffle(docs));
  }

  if (new Set(selected.map((s) => String(s._id))).size !== selected.length) throw new AppError("INTERNAL_ERROR", "Duplicate question selected.");

  const version = (exam.version ?? 0) + 1;
  await ExamQuestion.insertMany(selected.map((q, i) => ({ examId: exam._id, examVersion: version, displayOrder: i + 1, ...snapshot(q) })));
  await ExamQuestion.deleteMany({ examId: exam._id, examVersion: { $ne: version } });
  exam.version = version;
  exam.generatedAt = new Date();
  exam.totalMarks = exam.totalQuestions * (exam.marking?.correct ?? 4);
  await exam.save();
  await audit(adminId, "exam.generate", "Exam", id, { version, count: selected.length });
  return { version, count: selected.length };
}

/** Replaces a single question in a draft paper with a random (or specified) eligible alternative. */
export async function replaceExamQuestion(examId: string, examQuestionId: string, adminId: string, replacementQuestionId?: string) {
  const exam = await Exam.findById(examId);
  if (!exam) throw notFound("Exam");
  if (exam.status !== "draft") throw new AppError("CONFLICT", "Questions can only be replaced while the exam is a draft.");
  const eq = await ExamQuestion.findOne({ _id: examQuestionId, examId: exam._id, examVersion: exam.version });
  if (!eq) throw notFound("Exam question");
  const inPaper = (await ExamQuestion.find({ examId: exam._id, examVersion: exam.version }).select("questionId").lean()).map((q) => q.questionId);

  const subject = eq.questionSnapshot!.subject!;
  const difficulty = eq.questionSnapshot!.difficulty as Difficulty;
  const constrainedDifficulty =
    !!exam.difficultyDistribution || (exam.subjectDistribution as SubjectDistributionItem[]).some((s) => s.subject === subject && s.difficulty);
  const base = eligibleFilter({
    subject,
    difficulty: constrainedDifficulty ? difficulty : "Any",
    sources: (exam.selection?.sources ?? []) as SourceType[],
    includeNumerical: !!exam.selection?.includeNumerical || eq.questionSnapshot!.questionType === "numerical",
  });

  let replacement: QuestionLean | null = null;
  if (replacementQuestionId) {
    replacement = await Question.findOne({ ...base, _id: new Types.ObjectId(replacementQuestionId) })
      .select(SNAPSHOT_FIELDS)
      .lean<QuestionLean>();
    if (!replacement)
      throw badRequest(
        `The chosen question must be a usable ${subject}${constrainedDifficulty ? ` ${difficulty}` : ""} question without open issues.`,
      );
    if (inPaper.some((id) => id.equals(replacement!._id))) throw badRequest("That question is already in this paper.");
  } else {
    const pool = await Question.find({ ...base, _id: { $nin: inPaper } }).select("_id").lean();
    if (!pool.length)
      throw new AppError("INSUFFICIENT_QUESTIONS", `No other usable ${subject}${constrainedDifficulty ? ` ${difficulty}` : ""} questions are available.`);
    const pick = shuffle(pool)[0];
    replacement = await Question.findById(pick._id).select(SNAPSHOT_FIELDS).lean<QuestionLean>();
  }

  const snap = snapshot(replacement!);
  eq.set({ questionId: snap.questionId, questionSnapshot: snap.questionSnapshot, answerKeySnapshot: snap.answerKeySnapshot });
  await eq.save();
  await audit(adminId, "exam.replace_question", "Exam", examId, { examQuestionId, newQuestionId: String(replacement!._id) });
  return eq.toObject();
}

/* -------------------------------------------------------------------------- */
/*  Publishing & lifecycle                                                     */
/* -------------------------------------------------------------------------- */

function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32)
      .replace(/-+$/, "") || "exam"
  );
}
const TOKEN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
/** Unambiguous characters (no 0/O, 1/I/L) so codes can be read aloud and typed easily. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newAccessCode() {
  // crypto.randomInt is uniform (no modulo bias): 31^6 ≈ 887 million codes.
  return `SGSU-${Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("")}`;
}
export function normalizeAccessCode(input: string) {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = s.startsWith("SGSU") ? s.slice(4) : s;
  return body.length === 6 ? `SGSU-${body}` : null;
}

/** Gives a published exam (including ones published before access codes existed) a permanent code. */
export async function ensureAccessCode(examId: Types.ObjectId | string): Promise<string | null> {
  for (let i = 0; i < 5; i++) {
    const exam = await Exam.findById(examId).select("accessCode status").lean();
    if (!exam) return null;
    if (exam.accessCode) return exam.accessCode;
    if (exam.status === "draft") return null;
    try {
      const r = await Exam.findOneAndUpdate({ _id: examId, accessCode: { $exists: false } }, { $set: { accessCode: newAccessCode() } }, { returnDocument: "after" }).lean();
      if (r?.accessCode) return r.accessCode;
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }
  throw new AppError("INTERNAL_ERROR", "Could not create a unique access code. Please try again.");
}

function randomSuffix(len = 6) {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => TOKEN_ALPHABET[b % TOKEN_ALPHABET.length]).join("");
}

export async function publishExam(id: string, adminId: string) {
  const exam = await Exam.findById(id);
  if (!exam) throw notFound("Exam");
  if (exam.status !== "draft") throw new AppError("CONFLICT", "This exam has already been published.");
  if (!exam.version) throw badRequest("Generate and review the question paper before publishing.");
  if (exam.scheduleMode === "immediate") {
    // "Start immediately": the access window opens now and lasts the configured validity.
    const now = new Date();
    const validity = exam.accessValidityMinutes || Math.max(5, Math.round((exam.endDate.getTime() - exam.startDate.getTime()) / 60_000));
    exam.startDate = now;
    exam.endDate = new Date(now.getTime() + validity * 60_000);
    if (exam.hardEndAt) exam.hardEndAt = exam.endDate;
  }
  if (exam.endDate <= new Date()) throw badRequest("The exam end date is in the past. Update the schedule before publishing.");

  const paper = await ExamQuestion.find({ examId: exam._id, examVersion: exam.version }).select("questionId").lean();
  if (paper.length !== exam.totalQuestions)
    throw badRequest(`The paper has ${paper.length} questions but the exam requires ${exam.totalQuestions}. Regenerate the paper.`);
  const stillEligible = await Question.countDocuments({ _id: { $in: paper.map((p) => p.questionId) }, ...eligibleFilter({ includeNumerical: true }) });
  if (stillEligible !== paper.length)
    throw badRequest(`${paper.length - stillEligible} question(s) in this paper are no longer usable (rejected, archived or with open issues). Replace them before publishing.`);

  for (let i = 0; i < 5; i++) {
    exam.shareToken = `${slugify(exam.title)}-${randomSuffix()}`;
    // Link and code are created once, here, and never regenerated afterwards.
    if (!exam.accessCode) exam.accessCode = newAccessCode();
    exam.status = "published";
    exam.publishedAt = new Date();
    try {
      await exam.save();
      await audit(adminId, "exam.publish", "Exam", id, { shareToken: exam.shareToken, accessCode: exam.accessCode });
      return exam.toObject();
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      exam.accessCode = undefined; // collision on either key: draw both again
    }
  }
  throw new AppError("INTERNAL_ERROR", "Could not generate a unique exam link. Please try again.");
}

export async function closeExam(id: string, adminId: string) {
  const exam = await Exam.findById(id);
  if (!exam) throw notFound("Exam");
  if (exam.status !== "published") throw new AppError("CONFLICT", "Only published exams can be closed.");
  exam.status = "closed";
  exam.closedAt = new Date();
  await exam.save();
  const active = await Attempt.find({ examId: exam._id, status: "in_progress", isCurrent: true }).select("_id").lean();
  for (const a of active) await finalizeAttempt(String(a._id), "exam_closed");
  await audit(adminId, "exam.close", "Exam", id, { finalizedAttempts: active.length });
  return { finalizedAttempts: active.length };
}

export async function duplicateExam(id: string, adminId: string, copyPaper = true) {
  const source = await Exam.findById(id).lean();
  if (!source) throw notFound("Exam");
  const now = Date.now();
  const durationWindow = Math.max(new Date(source.endDate).getTime() - new Date(source.startDate).getTime(), 86_400_000);
  const { _id, shareToken, accessCode, createdAt, updatedAt, publishedAt, closedAt, archivedAt, ...rest } = source as ExamDoc & { createdAt: Date; updatedAt: Date };
  void archivedAt;
  void shareToken;
  void accessCode;
  void createdAt;
  void updatedAt;
  void publishedAt;
  void closedAt;
  const copy = await Exam.create({
    ...rest,
    title: `${source.title} (Copy)`.slice(0, 200),
    status: "draft",
    version: copyPaper ? 1 : 0,
    generatedAt: copyPaper ? new Date() : null,
    startDate: new Date(Math.max(now, new Date(source.startDate).getTime())),
    endDate: new Date(Math.max(now, new Date(source.startDate).getTime()) + durationWindow),
    hardEndAt: source.hardEndAt ? new Date(Math.max(now, new Date(source.startDate).getTime()) + durationWindow) : null,
    duplicatedFrom: _id,
    createdBy: adminId,
    settings: { ...source.settings, resultsReleased: false },
  });
  if (copyPaper && source.version) {
    const paper = await ExamQuestion.find({ examId: _id, examVersion: source.version }).lean();
    await ExamQuestion.insertMany(
      paper.map((p) => ({
        examId: copy._id,
        examVersion: 1,
        questionId: p.questionId,
        displayOrder: p.displayOrder,
        questionSnapshot: p.questionSnapshot,
        answerKeySnapshot: p.answerKeySnapshot,
      })),
    );
  } else if (copyPaper) {
    copy.version = 0;
    copy.generatedAt = null;
    await copy.save();
  }
  await audit(adminId, "exam.duplicate", "Exam", String(copy._id), { from: id });
  return copy.toObject();
}

/* -------------------------------------------------------------------------- */
/*  Queries                                                                    */
/* -------------------------------------------------------------------------- */

export async function examParticipationStats(examIds: Types.ObjectId[]) {
  const [attempts, results] = await Promise.all([
    Attempt.aggregate<{ _id: Types.ObjectId; participants: number; completed: number; active: number }>([
      { $match: { examId: { $in: examIds }, isCurrent: true } },
      {
        $group: {
          _id: "$examId",
          participants: { $sum: 1 },
          completed: { $sum: { $cond: [{ $in: ["$status", FINAL_ATTEMPT_STATUSES] }, 1, 0] } },
          active: { $sum: { $cond: [{ $eq: ["$status", "in_progress"] }, 1, 0] } },
        },
      },
    ]),
    Result.aggregate<{ _id: Types.ObjectId; avgScore: number; avgPct: number; passed: number; n: number }>([
      { $match: { examId: { $in: examIds }, superseded: false } },
      { $group: { _id: "$examId", avgScore: { $avg: "$totalScore" }, avgPct: { $avg: "$percentage" }, passed: { $sum: { $cond: ["$passed", 1, 0] } }, n: { $sum: 1 } } },
    ]),
  ]);
  const map = new Map<string, { participants: number; completed: number; active: number; avgScore: number | null; avgPercentage: number | null; passRate: number | null }>();
  for (const id of examIds) map.set(String(id), { participants: 0, completed: 0, active: 0, avgScore: null, avgPercentage: null, passRate: null });
  for (const a of attempts) Object.assign(map.get(String(a._id))!, { participants: a.participants, completed: a.completed, active: a.active });
  for (const r of results)
    Object.assign(map.get(String(r._id))!, {
      avgScore: Math.round(r.avgScore * 100) / 100,
      avgPercentage: Math.round(r.avgPct * 100) / 100,
      passRate: r.n ? Math.round((r.passed / r.n) * 10000) / 100 : null,
    });
  return map;
}

export async function listExams(q: { status: string; search?: string; page: number; pageSize: number }) {
  const now = new Date();
  // "active" = published and inside its validity window; "expired" = published but the window has ended.
  const filter: QueryFilter<ExamDoc> =
    q.status === "all"
      ? { status: { $ne: "archived" } }
      : q.status === "active"
        ? { status: "published", startDate: { $lte: now }, endDate: { $gt: now } }
        : q.status === "scheduled"
        ? { status: "published", startDate: { $gt: now } }
        : q.status === "expired"
          ? { status: "published", endDate: { $lte: now } }
          : { status: q.status as ExamDoc["status"] };
  if (q.search) filter.title = new RegExp(escapeRegex(q.search), "i");
  const [items, total] = await Promise.all([
    Exam.find(filter)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.pageSize)
      .limit(q.pageSize)
      .select("title category status totalQuestions durationMinutes startDate endDate timezone scheduleMode hardEndAt templateId shareToken accessCode subjectDistribution selectedSubjects generationMode totalMarks createdAt publishedAt version")
      .lean(),
    Exam.countDocuments(filter),
  ]);
  const stats = await examParticipationStats(items.map((i) => i._id));
  return {
    items: items.map((i) => ({ ...i, id: String(i._id), _id: undefined, lifecycle: examLifecycle(i, now), ...stats.get(String(i._id)) })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

/** Full admin view of an exam including its current paper and answer keys. */
export async function getExamForAdmin(id: string) {
  const exam = await Exam.findById(id).lean();
  if (!exam) throw notFound("Exam");
  const paper = exam.version
    ? await ExamQuestion.find({ examId: exam._id, examVersion: exam.version }).sort({ displayOrder: 1 }).lean()
    : [];
  const subjectCounts: Record<string, number> = {};
  const difficultyCounts: Record<string, number> = {};
  for (const p of paper) {
    const s = p.questionSnapshot!.subject!;
    const d = p.questionSnapshot!.difficulty!;
    subjectCounts[s] = (subjectCounts[s] ?? 0) + 1;
    difficultyCounts[d] = (difficultyCounts[d] ?? 0) + 1;
  }
  const stats = (await examParticipationStats([exam._id])).get(String(exam._id));
  const now = new Date();
  return {
    exam: { ...exam, id: String(exam._id), lifecycle: examLifecycle(exam, now) },
    serverNow: now,
    paper: paper.map((p) => ({ ...p, id: String(p._id) })),
    distribution: { subjects: subjectCounts, difficulties: difficultyCounts },
    stats,
  };
}

export async function getExamByAccessCode(code: string) {
  const normalized = normalizeAccessCode(code);
  if (!normalized) return null;
  return Exam.findOne({ accessCode: normalized, status: { $in: ["published", "closed"] } }).lean();
}

export async function getExamByToken(token: string) {
  if (!/^[a-z0-9-]{3,60}$/.test(token)) return null;
  return Exam.findOne({ shareToken: token, status: { $in: ["published", "closed"] } }).lean();
}

/* -------------------------------------------------------------------------- */
/*  Scheduling                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Changes an exam's access window. Drafts can change freely. For published exams the start time
 * can only move while the exam has not opened yet; once open, only the end time and the policy
 * for new attempts can change. Running attempts keep the deadline they were given at start.
 */
export async function updateExamSchedule(id: string, input: ExamScheduleInput, adminId: string, now: Date = new Date()) {
  const exam = await Exam.findById(id);
  if (!exam) throw notFound("Exam");
  if (exam.status === "closed" || exam.status === "archived")
    throw new AppError("CONFLICT", "This examination has been closed. Duplicate it to schedule it again.");
  const opened = exam.status === "published" && exam.startDate.getTime() <= now.getTime();

  let start: Date;
  let end: Date;
  if (input.scheduleMode === "immediate") {
    const validity = input.accessValidityMinutes!;
    if (exam.status === "draft") {
      // Opens at publication; keep a provisional window so the draft is valid.
      start = now;
      end = new Date(now.getTime() + validity * 60_000);
    } else {
      start = opened ? exam.startDate : now;
      end = new Date(now.getTime() + validity * 60_000);
    }
    exam.accessValidityMinutes = validity;
  } else {
    start = input.startDate!;
    end = input.endDate!;
    if (opened && start.getTime() !== exam.startDate.getTime())
      throw new AppError("CONFLICT", "This examination has already opened, so its start time can no longer change. You can still change the end time.");
    if (exam.status === "published" && !opened && start.getTime() < now.getTime() - 60_000)
      throw badRequest("The new start time is in the past. Choose a future time, or use Start immediately.");
  }
  if (end <= start) throw badRequest("End time must be after the start time.");
  if (exam.status === "published" && end.getTime() <= now.getTime())
    throw badRequest("The end time is in the past. To stop new attempts now, use Close Examination.");

  exam.scheduleMode = input.scheduleMode;
  exam.startDate = start;
  exam.endDate = end;
  exam.timezone = input.timezone;
  exam.hardEndAt = input.hardEnd ? end : null;
  await exam.save();
  await audit(adminId, "exam.schedule", "Exam", id, { scheduleMode: input.scheduleMode, startDate: start, endDate: end, timezone: input.timezone, hardEnd: input.hardEnd });
  return { exam: exam.toObject(), lifecycle: examLifecycle(exam, now) };
}
