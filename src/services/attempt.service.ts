import "server-only";
import { Types } from "mongoose";
import { Attempt, Exam, ExamQuestion, IntegrityEvent, Result, Accommodation, audit } from "@/models";
import type { ExamDoc } from "@/models/Exam";
import type { AttemptDoc } from "@/models/Attempt";
import type { QuestionOrderItem } from "@/models/types";
import { evaluate, type KeyedQuestion } from "@/lib/exam/scoring";
import { attemptDeadline, availabilityMessage, examLifecycle, type ExamLifecycle } from "@/lib/exam/lifecycle";
import { formatDateAndTime, formatInZone, UNIVERSITY_TIMEZONE } from "@/lib/timezone";
import { shuffle } from "@/lib/exam/shuffle";
import { AppError, forbidden, notFound } from "@/lib/errors";
import {
  FINAL_ATTEMPT_STATUSES,
  WARNING_EVENT_TYPES,
  type AttemptStatus,
  type FinalizationReason,
  type IntegrityEventType,
} from "@/lib/constants";

/** Network latency allowance for answers saved right at the deadline. */
export const DEADLINE_GRACE_MS = 5_000;
/** Two violation signals within this window (e.g. tab switch + fullscreen exit) count as one warning. */
export const WARNING_COALESCE_MS = 2_000;
const EVALUATION_STALE_MS = 30_000;

/* -------------------------------------------------------------------------- */
/*  Exam availability & effective security                                     */
/* -------------------------------------------------------------------------- */

export type ExamWindowState = "upcoming" | "open" | "ended" | "closed" | "draft";

export function examWindowState(exam: Pick<ExamDoc, "status" | "startDate" | "endDate">, now = new Date()): ExamWindowState {
  if (exam.status === "draft") return "draft";
  if (exam.status !== "published") return "closed";
  if (now < new Date(exam.startDate)) return "upcoming";
  if (now >= new Date(exam.endDate)) return "ended";
  return "open";
}

type SecuritySettings = NonNullable<NonNullable<ExamDoc["settings"]>["security"]>;

export function effectiveSecurity(
  security: SecuritySettings,
  accommodation?: { status: string; requestCamera: boolean; requestMicrophone: boolean; requestFullscreen: boolean } | null,
) {
  const s = { ...security };
  if (accommodation?.status === "approved") {
    if (accommodation.requestCamera) s.camera = false;
    if (accommodation.requestMicrophone) {
      s.microphone = false;
      s.soundMonitoring = false;
    }
    if (accommodation.requestFullscreen) {
      s.fullscreen = false;
      s.fullscreenExitWarnings = false;
    }
  }
  if (!s.microphone) s.soundMonitoring = false;
  if (!s.fullscreen) s.fullscreenExitWarnings = false;
  return s;
}

export function resultsVisible(exam: Pick<ExamDoc, "settings" | "endDate" | "status">, now = new Date()) {
  const mode = exam.settings?.resultRelease ?? "immediate";
  if (mode === "immediate") return true;
  if (mode === "after_end") return now >= new Date(exam.endDate) || exam.status === "closed";
  return !!exam.settings?.resultsReleased;
}

export function answerReviewVisible(exam: Pick<ExamDoc, "settings" | "endDate" | "status">, now = new Date()) {
  return resultsVisible(exam, now) && !!exam.settings?.allowAnswerReview;
}

/**
 * What a particular student may do with an exam right now. Used by the exam page, the code
 * lookup and GET /api/exams/[id]/availability, so the same rules and wording apply everywhere.
 * startAttempt enforces the same rules again, so calling the API directly cannot bypass them.
 */
export async function studentAvailability(exam: Pick<ExamDoc, "_id" | "status" | "startDate" | "endDate" | "timezone" | "hardEndAt" | "durationMinutes">, studentId: string | null, now = new Date()) {
  const lifecycle: ExamLifecycle = examLifecycle(exam, now);
  const tz = exam.timezone || UNIVERSITY_TIMEZONE;
  const attempt = studentId ? await Attempt.findOne({ examId: exam._id, studentId, isCurrent: true }).select("status deadlineAt").lean() : null;
  const inProgress = attempt?.status === "in_progress";
  const completed = !!attempt && (FINAL_ATTEMPT_STATUSES as string[]).includes(attempt.status);
  return {
    lifecycle,
    canStart: lifecycle === "active" && !attempt,
    canResume: inProgress,
    completed,
    message: inProgress || completed ? null : availabilityMessage(lifecycle, formatDateAndTime(exam.startDate, tz)),
    attempt: attempt ? { id: String(attempt._id), status: attempt.status, deadlineAt: attempt.deadlineAt } : null,
    schedule: {
      startDate: exam.startDate,
      endDate: exam.endDate,
      timezone: tz,
      startLabel: formatInZone(exam.startDate, tz),
      endLabel: formatInZone(exam.endDate, tz),
      hardEnd: !!exam.hardEndAt,
      durationMinutes: exam.durationMinutes,
    },
    serverNow: now,
  };
}

/* -------------------------------------------------------------------------- */
/*  Start / resume                                                             */
/* -------------------------------------------------------------------------- */

async function buildQuestionOrder(exam: ExamDoc) {
  const paper = await ExamQuestion.find({ examId: exam._id, examVersion: exam.version })
    .sort({ displayOrder: 1 })
    .select("_id questionSnapshot.subject questionSnapshot.questionType questionSnapshot.options")
    .lean();
  let ordered = paper;
  if (exam.settings?.shuffleQuestions) {
    // Shuffle within subject sections so the paper keeps its Physics → Chemistry → Mathematics structure.
    const groups = new Map<string, typeof paper>();
    for (const q of paper) {
      const s = q.questionSnapshot!.subject!;
      groups.set(s, [...(groups.get(s) ?? []), q]);
    }
    ordered = [...groups.values()].flatMap((g) => shuffle(g));
  }
  return ordered.map((q) => ({
    examQuestionId: q._id,
    optionOrder:
      exam.settings?.shuffleOptions && q.questionSnapshot!.questionType === "single_correct"
        ? shuffle((q.questionSnapshot!.options ?? []).map((_: string, i: number) => i + 1))
        : [],
  }));
}

export async function startAttempt(examId: Types.ObjectId | string, studentId: string, userAgent = "") {
  const exam = await Exam.findById(examId).lean<ExamDoc>();
  if (!exam) throw notFound("Exam");
  const now = new Date();
  const state = examWindowState(exam, now);

  const existing = await Attempt.findOne({ examId: exam._id, studentId, isCurrent: true }).lean<AttemptDoc>();
  if (existing) {
    if (existing.status === "in_progress" || existing.status === "evaluating") {
      if (existing.status === "in_progress" && now.getTime() > new Date(existing.deadlineAt).getTime() + DEADLINE_GRACE_MS) {
        if (exam.settings?.security?.autoFinalizeOnTimeout !== false) await finalizeAttempt(String(existing._id), "time_expired");
      }
      return { attemptId: String(existing._id), resumed: true };
    }
    if (exam.settings?.security?.oneAttempt !== false) {
      throw new AppError("CONFLICT", "You have already completed this exam. Each student may attempt it only once.", { attemptId: String(existing._id) });
    }
    // Multiple attempts permitted: retire the finished attempt before starting a new one.
    await Attempt.updateOne({ _id: existing._id, isCurrent: true }, { $set: { isCurrent: false } });
    await Result.updateOne({ attemptId: existing._id }, { $set: { superseded: true } });
  }

  if (state !== "open") {
    const lifecycle = examLifecycle(exam, now);
    throw new AppError("EXAM_NOT_AVAILABLE", availabilityMessage(lifecycle, formatDateAndTime(exam.startDate, exam.timezone || UNIVERSITY_TIMEZONE)) ?? "This examination is not available.", { lifecycle });
  }
  if (!exam.version) throw new AppError("EXAM_NOT_AVAILABLE", "This exam has no published paper.");

  // Each attempt gets its own server-side deadline, fixed now and never recalculated on reload.
  const deadline = attemptDeadline(now, exam.durationMinutes, exam.hardEndAt);
  try {
    const attempt = await Attempt.create({
      examId: exam._id,
      examVersion: exam.version,
      studentId,
      startedAt: now,
      deadlineAt: deadline,
      status: "in_progress",
      isCurrent: true,
      questionOrder: await buildQuestionOrder(exam),
      userAgent: userAgent.slice(0, 300),
      lastActivityAt: now,
    });
    return { attemptId: String(attempt._id), resumed: false };
  } catch (err) {
    // Concurrent start requests: the partial unique index guarantees a single current attempt.
    if ((err as { code?: number }).code === 11000) {
      const winner = await Attempt.findOne({ examId: exam._id, studentId, isCurrent: true }).select("_id").lean();
      if (winner) return { attemptId: String(winner._id), resumed: true };
    }
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/*  Student view of an attempt (never includes answer keys)                    */
/* -------------------------------------------------------------------------- */

async function loadOwnedAttempt(attemptId: string, studentId: string) {
  if (!Types.ObjectId.isValid(attemptId)) throw notFound("Attempt");
  const attempt = await Attempt.findById(attemptId);
  if (!attempt) throw notFound("Attempt");
  if (String(attempt.studentId) !== studentId) throw forbidden("This attempt belongs to another student.");
  return attempt;
}

export async function getAttemptForStudent(attemptId: string, studentId: string) {
  let attempt = await loadOwnedAttempt(attemptId, studentId);
  const exam = await Exam.findById(attempt.examId).lean<ExamDoc>();
  if (!exam) throw notFound("Exam");
  const now = new Date();

  if (attempt.status === "in_progress" && now.getTime() > attempt.deadlineAt.getTime() + DEADLINE_GRACE_MS && exam.settings?.security?.autoFinalizeOnTimeout !== false) {
    await finalizeAttempt(attemptId, "time_expired");
    attempt = await loadOwnedAttempt(attemptId, studentId);
  } else if (attempt.status === "evaluating" && attempt.evaluatingSince && now.getTime() - attempt.evaluatingSince.getTime() > EVALUATION_STALE_MS) {
    await finalizeAttempt(attemptId, (attempt.finalizationReason as FinalizationReason) ?? "student_submitted");
    attempt = await loadOwnedAttempt(attemptId, studentId);
  }

  const accommodation = await Accommodation.findOne({ examId: exam._id, studentId }).lean();
  const security = effectiveSecurity(exam.settings!.security!, accommodation);
  const base = {
    id: String(attempt._id),
    studentId: String(attempt.studentId),
    status: attempt.status as AttemptStatus,
    startedAt: attempt.startedAt,
    deadlineAt: attempt.deadlineAt,
    submittedAt: attempt.submittedAt,
    serverNow: now,
    serverRevision: attempt.serverRevision ?? 0,
    lastSavedAt: attempt.lastSavedAt,
    warningCount: attempt.warningCount,
    finalizationReason: attempt.finalizationReason,
    exam: {
      id: String(exam._id),
      title: exam.title,
      shareToken: exam.shareToken,
      durationMinutes: exam.durationMinutes,
      totalQuestions: exam.totalQuestions,
      marking: exam.marking,
      showTopic: !!exam.settings?.showTopic,
      security,
      autoFinalizeOnTimeout: exam.settings?.security?.autoFinalizeOnTimeout !== false,
    },
  };
  if (attempt.status !== "in_progress") return { ...base, questions: [], answers: {} };

  const order: QuestionOrderItem[] = attempt.questionOrder;
  const ids = order.map((q) => q.examQuestionId);
  // Only the student-facing snapshot is selected; answerKeySnapshot is never read here.
  const paper = await ExamQuestion.find({ _id: { $in: ids } })
    .select("questionSnapshot")
    .lean();
  const byId = new Map(paper.map((p) => [String(p._id), p.questionSnapshot!]));
  const questions = order.map((o, idx) => {
    const snap = byId.get(String(o.examQuestionId))!;
    const optionOrder: number[] = o.optionOrder?.length ? o.optionOrder : (snap.options ?? []).map((_: string, i: number) => i + 1);
    return {
      id: String(o.examQuestionId),
      number: idx + 1,
      subject: snap.subject,
      topic: exam.settings?.showTopic ? snap.topic : undefined,
      questionType: snap.questionType,
      questionText: snap.questionText,
      questionImages: snap.questionImages ?? [],
      // Option ids are the original 1-based indices; the display order may be shuffled per attempt.
      options: snap.questionType === "single_correct" ? optionOrder.map((originalIndex) => ({ id: originalIndex, text: snap.options![originalIndex - 1] })) : [],
    };
  });
  const answers: Record<string, ServerAnswer> = {};
  for (const [k, v] of attempt.answers ?? new Map()) answers[k] = toServerAnswer(v);
  return { ...base, questions, answers };
}

/* -------------------------------------------------------------------------- */
/*  Autosave                                                                   */
/* -------------------------------------------------------------------------- */

export interface AnswerUpdate {
  examQuestionId: string;
  selectedOption?: number | null;
  numericalValue?: string | null;
  markedForReview?: boolean;
  visited?: boolean;
  /** Client mutation sequence (monotonic per attempt). Updates older than the stored one are ignored. */
  seq?: number;
}

export interface ServerAnswer {
  selectedOption: number | null;
  numericalValue: string | null;
  markedForReview: boolean;
  visited: boolean;
  seq: number;
}

function toServerAnswer(v: { selectedOption?: number | null; numericalValue?: string | null; markedForReview?: boolean | null; visited?: boolean | null; seq?: number | null }): ServerAnswer {
  return { selectedOption: v.selectedOption ?? null, numericalValue: v.numericalValue ?? null, markedForReview: !!v.markedForReview, visited: v.visited !== false, seq: v.seq ?? 0 };
}

/**
 * Saves answers idempotently. Each update carries the client's mutation sequence; an update whose
 * sequence is not newer than the stored one (a retry, or a request that arrived out of order) is
 * not applied, and the server's value is returned instead. Writes use optimistic concurrency on
 * `serverRevision`, so two requests racing cannot interleave and lose the newer change.
 */
export async function saveAnswers(attemptId: string, studentId: string, updates: AnswerUpdate[]) {
  for (let tries = 0; ; tries++) {
    try {
      return await saveAnswersOnce(attemptId, studentId, updates);
    } catch (err) {
      if (err instanceof RevisionConflict && tries < 6) continue;
      if (err instanceof RevisionConflict) throw new AppError("CONFLICT", "Too many simultaneous saves. Please try again.");
      throw err;
    }
  }
}

class RevisionConflict extends Error {}

async function saveAnswersOnce(attemptId: string, studentId: string, updates: AnswerUpdate[]) {
  const attempt = await loadOwnedAttempt(attemptId, studentId);
  const now = new Date();
  if (attempt.status !== "in_progress") throw new AppError("ATTEMPT_CLOSED", "This attempt has already been submitted.", { status: attempt.status });
  if (now.getTime() > attempt.deadlineAt.getTime() + DEADLINE_GRACE_MS) {
    const exam = await Exam.findById(attempt.examId).select("settings.security.autoFinalizeOnTimeout").lean();
    if (exam?.settings?.security?.autoFinalizeOnTimeout !== false) await finalizeAttempt(attemptId, "time_expired");
    throw new AppError("ATTEMPT_CLOSED", "Time is up. Your saved answers have been submitted.", { status: "auto_submitted" });
  }

  const valid = new Set((attempt.questionOrder as QuestionOrderItem[]).map((q) => String(q.examQuestionId)));
  const types = new Map(
    (await ExamQuestion.find({ _id: { $in: updates.map((u) => u.examQuestionId).filter((id) => valid.has(id)) } }).select("questionSnapshot.questionType questionSnapshot.options").lean()).map(
      (q) => [String(q._id), q.questionSnapshot!],
    ),
  );

  const $set: Record<string, unknown> = { lastActivityAt: now };
  const applied: string[] = [];
  const stale: Record<string, ServerAnswer> = {};
  // Within one request the newest sequence for each question wins.
  const latest = new Map<string, AnswerUpdate>();
  for (const u of updates) {
    const cur = latest.get(u.examQuestionId);
    if (!cur || (u.seq ?? 0) >= (cur.seq ?? 0)) latest.set(u.examQuestionId, u);
  }
  for (const u of latest.values()) {
    const snap = types.get(u.examQuestionId);
    if (!valid.has(u.examQuestionId) || !snap) throw new AppError("BAD_REQUEST", "Answer refers to a question that is not part of this attempt.");
    const prev = attempt.answers?.get(u.examQuestionId);
    if (u.seq !== undefined && prev && (prev.seq ?? 0) >= u.seq) {
      stale[u.examQuestionId] = toServerAnswer(prev);
      continue;
    }
    let selectedOption = u.selectedOption === undefined ? (prev?.selectedOption ?? null) : u.selectedOption;
    let numericalValue = u.numericalValue === undefined ? (prev?.numericalValue ?? null) : u.numericalValue;
    if (snap.questionType === "single_correct") {
      numericalValue = null;
      if (selectedOption !== null && (selectedOption < 1 || selectedOption > (snap.options?.length ?? 0)))
        throw new AppError("BAD_REQUEST", "Selected option is out of range.");
    } else {
      selectedOption = null;
      if (numericalValue !== null) {
        numericalValue = numericalValue.trim();
        if (numericalValue === "") numericalValue = null;
        else if (!/^[-+]?(\d+(\.\d*)?|\.\d+)$/.test(numericalValue) || numericalValue.length > 20)
          throw new AppError("BAD_REQUEST", "Enter a valid number.");
      }
    }
    $set[`answers.${u.examQuestionId}`] = {
      selectedOption,
      numericalValue,
      markedForReview: u.markedForReview ?? prev?.markedForReview ?? false,
      visited: u.visited ?? true,
      savedAt: now,
      seq: u.seq ?? prev?.seq ?? 0,
    };
    applied.push(u.examQuestionId);
  }

  const revision = attempt.serverRevision ?? 0;
  if (!applied.length) {
    // Heartbeat or nothing new: refresh activity without touching answers.
    await Attempt.updateOne({ _id: attempt._id, status: "in_progress" }, { $set: { lastActivityAt: now } });
    return { savedAt: now, count: 0, applied, stale, serverRevision: revision };
  }
  $set.lastSavedAt = now;
  // The status/deadline condition makes the write atomic with respect to submission; the revision
  // condition makes it atomic with respect to other saves for the same attempt.
  const res = await Attempt.updateOne(
    {
      _id: attempt._id,
      status: "in_progress",
      deadlineAt: { $gt: new Date(now.getTime() - DEADLINE_GRACE_MS) },
      ...(revision ? { serverRevision: revision } : { $or: [{ serverRevision: 0 }, { serverRevision: { $exists: false } }] }),
    },
    { $set, $inc: { serverRevision: 1 } },
  );
  if (res.matchedCount === 0) {
    const fresh = await Attempt.findById(attempt._id).select("status deadlineAt serverRevision").lean();
    if (fresh && fresh.status === "in_progress" && new Date(fresh.deadlineAt).getTime() > now.getTime() - DEADLINE_GRACE_MS) throw new RevisionConflict();
    throw new AppError("ATTEMPT_CLOSED", "This attempt is no longer accepting answers.", { status: fresh?.status });
  }
  return { savedAt: now, count: applied.length, applied, stale, serverRevision: revision + 1 };
}

/**
 * Reconnection endpoint: applies any queued changes (with the same stale-update protection) and
 * returns the authoritative state — status, deadline, saved answers and warning count.
 * Queued changes for an attempt that has already ended are reported as rejected, never applied.
 */
export async function syncAttempt(attemptId: string, studentId: string, updates: AnswerUpdate[]) {
  let save: Awaited<ReturnType<typeof saveAnswers>> | null = null;
  let rejected: string[] = [];
  let reason: string | null = null;
  try {
    save = await saveAnswers(attemptId, studentId, updates);
  } catch (err) {
    if (!(err instanceof AppError) || err.code !== "ATTEMPT_CLOSED") throw err;
    rejected = updates.map((u) => u.examQuestionId);
    reason = err.message;
  }
  const attempt = await loadOwnedAttempt(attemptId, studentId);
  const answers: Record<string, ServerAnswer> = {};
  for (const [k, v] of attempt.answers ?? new Map()) answers[k] = toServerAnswer(v);
  return {
    status: attempt.status as AttemptStatus,
    deadlineAt: attempt.deadlineAt,
    serverNow: new Date(),
    serverRevision: attempt.serverRevision ?? 0,
    lastSavedAt: attempt.lastSavedAt,
    warningCount: attempt.warningCount,
    answers,
    applied: save?.applied ?? [],
    stale: save?.stale ?? {},
    rejected,
    rejectedReason: reason,
  };
}

/* -------------------------------------------------------------------------- */
/*  Finalisation & evaluation (idempotent)                                     */
/* -------------------------------------------------------------------------- */

const STATUS_FOR_REASON: Record<FinalizationReason, AttemptStatus> = {
  student_submitted: "submitted",
  time_expired: "auto_submitted",
  exam_closed: "auto_submitted",
  admin_finalized: "auto_submitted",
  max_warnings: "terminated",
};

async function evaluateAndStore(attempt: AttemptDoc) {
  const exam = await Exam.findById(attempt.examId).select("marking passingMarks").lean();
  if (!exam) throw notFound("Exam");
  const paper = await ExamQuestion.find({ _id: { $in: attempt.questionOrder.map((q) => q.examQuestionId) } })
    .select("questionSnapshot.subject questionSnapshot.difficulty questionSnapshot.questionType answerKeySnapshot")
    .lean();
  const byId = new Map(paper.map((p) => [String(p._id), p]));
  const keyed: KeyedQuestion[] = attempt.questionOrder.map((o) => {
    const p = byId.get(String(o.examQuestionId))!;
    return {
      id: String(p._id),
      subject: p.questionSnapshot!.subject!,
      difficulty: p.questionSnapshot!.difficulty!,
      questionType: p.questionSnapshot!.questionType!,
      correctOption: p.answerKeySnapshot?.correctOption ?? null,
      numericalAnswer: p.answerKeySnapshot?.numericalAnswer ?? null,
      numericalTolerance: p.answerKeySnapshot?.numericalTolerance ?? 0,
    };
  });
  const answers = (attempt.answers instanceof Map ? attempt.answers : new Map(Object.entries(attempt.answers ?? {}))) as Map<string, { selectedOption?: number | null; numericalValue?: string | null }>;
  const evaluation = evaluate(keyed, answers, exam.marking ?? { correct: 4, incorrect: 1, unanswered: 0 }, exam.passingMarks ?? 0);
  try {
    await Result.updateOne(
      { attemptId: attempt._id },
      {
        $setOnInsert: {
          attemptId: attempt._id,
          examId: attempt.examId,
          studentId: attempt.studentId,
          ...evaluation,
          questionResults: evaluation.questionResults.map((r) => ({ ...r, examQuestionId: new Types.ObjectId(r.examQuestionId) })),
          finalizationReason: attempt.finalizationReason,
          evaluatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err; // a concurrent evaluation already stored it
  }
}

/**
 * Finalises an attempt exactly once. Concurrent or repeated calls (double-clicks, retries,
 * the timer and the cron job racing) all converge on a single Result document.
 */
export async function finalizeAttempt(attemptId: string, reason: FinalizationReason) {
  const now = new Date();
  let claimed = await Attempt.findOneAndUpdate(
    { _id: attemptId, status: "in_progress" },
    { $set: { status: "evaluating", evaluatingSince: now, finalizationReason: reason } },
    { returnDocument: "after" },
  ).lean<AttemptDoc>();

  if (!claimed) {
    const current = await Attempt.findById(attemptId).lean<AttemptDoc>();
    if (!current) throw notFound("Attempt");
    if ((FINAL_ATTEMPT_STATUSES as string[]).includes(current.status) || current.status === "reset") return { status: current.status, alreadyFinalized: true };
    if (current.status === "evaluating") {
      const stale = !current.evaluatingSince || now.getTime() - new Date(current.evaluatingSince).getTime() > EVALUATION_STALE_MS;
      if (!stale) {
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 200));
          const again = await Attempt.findById(attemptId).select("status").lean();
          if (again && again.status !== "evaluating") return { status: again.status, alreadyFinalized: true };
        }
        return { status: "evaluating" as AttemptStatus, alreadyFinalized: true };
      }
      claimed = await Attempt.findOneAndUpdate(
        { _id: attemptId, status: "evaluating", evaluatingSince: current.evaluatingSince },
        { $set: { evaluatingSince: now } },
        { returnDocument: "after" },
      ).lean<AttemptDoc>();
      if (!claimed) return { status: "evaluating" as AttemptStatus, alreadyFinalized: true };
    } else {
      return { status: current.status, alreadyFinalized: true };
    }
  }

  const effectiveReason = (claimed.finalizationReason as FinalizationReason) ?? reason;
  const submittedAt = effectiveReason === "time_expired" ? new Date(Math.min(now.getTime(), new Date(claimed.deadlineAt).getTime())) : now;
  await evaluateAndStore(claimed);
  const finalStatus = STATUS_FOR_REASON[effectiveReason];
  await Attempt.updateOne({ _id: claimed._id, status: "evaluating" }, { $set: { status: finalStatus, submittedAt, evaluatingSince: null } });
  return { status: finalStatus, alreadyFinalized: false };
}

export async function submitAttempt(attemptId: string, studentId: string) {
  const attempt = await loadOwnedAttempt(attemptId, studentId);
  if (attempt.status !== "in_progress" && attempt.status !== "evaluating") return { status: attempt.status as AttemptStatus, alreadyFinalized: true };
  return finalizeAttempt(attemptId, "student_submitted");
}

/** Finalises attempts whose time has run out (called lazily by reads and by the scheduled job). */
export async function finalizeOverdueAttempts(examId?: string, limit = 200) {
  const filter: Record<string, unknown> = { status: "in_progress", deadlineAt: { $lt: new Date(Date.now() - DEADLINE_GRACE_MS) } };
  if (examId) filter.examId = new Types.ObjectId(examId);
  const overdue = await Attempt.find(filter).select("_id examId").limit(limit).lean();
  if (!overdue.length) return 0;
  const exams = await Exam.find({ _id: { $in: [...new Set(overdue.map((o) => String(o.examId)))] } })
    .select("settings.security.autoFinalizeOnTimeout")
    .lean();
  const auto = new Set(exams.filter((e) => e.settings?.security?.autoFinalizeOnTimeout !== false).map((e) => String(e._id)));
  let n = 0;
  for (const a of overdue) {
    if (!auto.has(String(a.examId))) continue;
    const r = await finalizeAttempt(String(a._id), "time_expired");
    if (!r.alreadyFinalized) n++;
  }
  return n;
}

/* -------------------------------------------------------------------------- */
/*  Integrity events                                                           */
/* -------------------------------------------------------------------------- */

export interface IntegrityEventInput {
  clientEventId: string;
  eventType: IntegrityEventType;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}

export async function recordIntegrityEvent(attemptId: string, studentId: string, input: IntegrityEventInput) {
  const attempt = await loadOwnedAttempt(attemptId, studentId);
  const exam = await Exam.findById(attempt.examId).select("settings.security").lean<ExamDoc>();
  if (!exam) throw notFound("Exam");
  const accommodation = await Accommodation.findOne({ examId: attempt.examId, studentId }).lean();
  const security = effectiveSecurity(exam.settings!.security!, accommodation);
  const now = new Date();
  const occurredAt = input.occurredAt && Math.abs(input.occurredAt.getTime() - now.getTime()) < 10 * 60_000 ? input.occurredAt : now;

  const state = () => ({ warningCount: attempt.warningCount, maxWarnings: security.maxWarnings, status: attempt.status as AttemptStatus });
  if (attempt.status !== "in_progress") return { ...state(), counted: false, duplicate: false, finalized: false };

  const warningEligible =
    (WARNING_EVENT_TYPES as string[]).includes(input.eventType) &&
    ((input.eventType === "fullscreen_exit" && security.fullscreen && security.fullscreenExitWarnings) ||
      (input.eventType === "tab_hidden" && security.tabSwitchWarnings));

  let event;
  try {
    event = await IntegrityEvent.create({
      attemptId: attempt._id,
      examId: attempt.examId,
      studentId: attempt.studentId,
      eventType: input.eventType,
      clientEventId: input.clientEventId,
      timestamp: occurredAt,
      metadata: input.metadata ?? {},
      // Permission problems, disconnections and sound levels are informational, never proof of misconduct.
      reviewStatus: warningEligible ? "pending" : "informational",
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return { ...state(), counted: false, duplicate: true, finalized: false };
    throw err;
  }

  if (!warningEligible) return { ...state(), counted: false, duplicate: false, finalized: false };

  // Atomic increment with a coalescing window so one browser action is never counted twice.
  const updated = await Attempt.findOneAndUpdate(
    {
      _id: attempt._id,
      status: "in_progress",
      $or: [{ lastWarningAt: null }, { lastWarningAt: { $lt: new Date(now.getTime() - WARNING_COALESCE_MS) } }],
    },
    { $inc: { warningCount: 1 }, $set: { lastWarningAt: now } },
    { returnDocument: "after" },
  ).lean<AttemptDoc>();

  if (!updated) {
    await IntegrityEvent.updateOne({ _id: event._id }, { $set: { reviewStatus: "informational", "metadata.coalesced": true } });
    const fresh = await Attempt.findById(attempt._id).select("warningCount status").lean();
    return { warningCount: fresh?.warningCount ?? attempt.warningCount, maxWarnings: security.maxWarnings, status: (fresh?.status ?? attempt.status) as AttemptStatus, counted: false, duplicate: false, finalized: false };
  }

  await IntegrityEvent.updateOne({ _id: event._id }, { $set: { countedAsWarning: true, warningNumber: updated.warningCount } });
  let finalized = false;
  let status = updated.status as AttemptStatus;
  if (security.terminateOnMaxWarnings && updated.warningCount >= security.maxWarnings) {
    const r = await finalizeAttempt(String(attempt._id), "max_warnings");
    finalized = true;
    status = r.status as AttemptStatus;
  }
  return { warningCount: updated.warningCount, maxWarnings: security.maxWarnings, status, counted: true, duplicate: false, finalized };
}

/* -------------------------------------------------------------------------- */
/*  Admin actions                                                              */
/* -------------------------------------------------------------------------- */

export async function adminResetAttempt(attemptId: string, adminId: string, reason: string) {
  const attempt = await Attempt.findById(attemptId);
  if (!attempt || !attempt.isCurrent) throw notFound("Attempt");
  if (attempt.status === "in_progress" || attempt.status === "evaluating")
    throw new AppError("CONFLICT", "Finalise the active attempt before resetting it.");
  const previousStatus = attempt.status;
  attempt.isCurrent = false;
  attempt.resetBy = new Types.ObjectId(adminId);
  attempt.resetAt = new Date();
  attempt.resetReason = reason;
  await attempt.save();
  await Result.updateOne({ attemptId: attempt._id }, { $set: { superseded: true } });
  await audit(adminId, "attempt.reset", "Attempt", attemptId, { reason, previousStatus, examId: String(attempt.examId), studentId: String(attempt.studentId) });
  return { ok: true };
}

export async function adminFinalizeAttempt(attemptId: string, adminId: string) {
  const r = await finalizeAttempt(attemptId, "admin_finalized");
  await audit(adminId, "attempt.finalize", "Attempt", attemptId, r);
  return r;
}

/* -------------------------------------------------------------------------- */
/*  Accommodations                                                             */
/* -------------------------------------------------------------------------- */

export async function requestAccommodation(
  examId: Types.ObjectId,
  studentId: string,
  input: { reason: string; camera: boolean; microphone: boolean; fullscreen: boolean },
) {
  const existing = await Accommodation.findOne({ examId, studentId });
  if (existing && existing.status !== "pending") throw new AppError("CONFLICT", `Your request has already been ${existing.status}.`);
  const doc = await Accommodation.findOneAndUpdate(
    { examId, studentId },
    { $set: { reason: input.reason, requestCamera: input.camera, requestMicrophone: input.microphone, requestFullscreen: input.fullscreen, status: "pending" } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return doc;
}

export async function decideAccommodation(id: string, adminId: string, approve: boolean, note = "") {
  const doc = await Accommodation.findByIdAndUpdate(
    id,
    { $set: { status: approve ? "approved" : "rejected", adminNote: note, decidedBy: adminId, decidedAt: new Date() } },
    { returnDocument: "after" },
  ).lean();
  if (!doc) throw notFound("Accommodation request");
  await audit(adminId, `accommodation.${approve ? "approve" : "reject"}`, "Accommodation", id, { examId: String(doc.examId), studentId: String(doc.studentId) });
  return doc;
}
