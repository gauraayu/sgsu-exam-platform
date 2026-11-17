import "server-only";
import { Types, type PipelineStage } from "mongoose";
import { Attempt, Exam, ExamQuestion, IntegrityEvent, Result, User, Question, ExamRegistration, Accommodation } from "@/models";
import type { ExamDoc } from "@/models/Exam";
import type { QuestionOrderItem, QuestionResultItem } from "@/models/types";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { escapeRegex } from "@/lib/api";
import { FINAL_ATTEMPT_STATUSES, SUBJECTS } from "@/lib/constants";
import { answerReviewVisible, finalizeOverdueAttempts, resultsVisible, examWindowState } from "./attempt.service";
import { examLifecycle } from "@/lib/exam/lifecycle";
import { formatDateAndTime, formatInZone, UNIVERSITY_TIMEZONE } from "@/lib/timezone";

const ACTIVE_WINDOW_MS = 2 * 60_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/* -------------------------------------------------------------------------- */
/*  Student-facing                                                             */
/* -------------------------------------------------------------------------- */

export async function listStudentAttempts(studentId: string) {
  const attempts = await Attempt.find({ studentId, isCurrent: true }).sort({ startedAt: -1 }).lean();
  const exams = await Exam.find({ _id: { $in: attempts.map((a) => a.examId) } })
    .select("title category totalQuestions durationMinutes totalMarks settings endDate status shareToken")
    .lean<ExamDoc[]>();
  const results = await Result.find({ attemptId: { $in: attempts.map((a) => a._id) } })
    .select("attemptId totalScore maxScore percentage passed correctCount incorrectCount unansweredCount")
    .lean();
  const examMap = new Map(exams.map((e) => [String(e._id), e]));
  const resultMap = new Map(results.map((r) => [String(r.attemptId), r]));
  return attempts.map((a) => {
    const exam = examMap.get(String(a.examId));
    const visible = exam ? resultsVisible(exam) : false;
    const r = resultMap.get(String(a._id));
    return {
      attemptId: String(a._id),
      examId: String(a.examId),
      examTitle: exam?.title ?? "Exam",
      category: exam?.category ?? "",
      shareToken: exam?.shareToken ?? null,
      totalQuestions: exam?.totalQuestions ?? 0,
      status: a.status,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      deadlineAt: a.deadlineAt,
      finalizationReason: a.finalizationReason,
      resultVisible: visible && !!r,
      resultPending: !visible && (FINAL_ATTEMPT_STATUSES as string[]).includes(a.status),
      result: visible && r ? { totalScore: r.totalScore, maxScore: r.maxScore, percentage: r.percentage, passed: r.passed, correct: r.correctCount, incorrect: r.incorrectCount, unanswered: r.unansweredCount } : null,
    };
  });
}

export async function getStudentResult(attemptId: string, studentId: string) {
  if (!Types.ObjectId.isValid(attemptId)) throw notFound("Result");
  const attempt = await Attempt.findById(attemptId).lean();
  if (!attempt) throw notFound("Result");
  if (String(attempt.studentId) !== studentId) throw forbidden("You can only view your own results.");
  const exam = await Exam.findById(attempt.examId).lean<ExamDoc>();
  if (!exam) throw notFound("Exam");
  const student = await User.findById(studentId).select("fullName email studentId").lean();
  const base = {
    attemptId,
    status: attempt.status,
    finalizationReason: attempt.finalizationReason,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    student: { name: student?.fullName ?? "", studentId: student?.studentId ?? "" },
    exam: { id: String(exam._id), title: exam.title, totalQuestions: exam.totalQuestions, totalMarks: exam.totalMarks, passingMarks: exam.passingMarks, marking: exam.marking },
  };
  if (!(FINAL_ATTEMPT_STATUSES as string[]).includes(attempt.status)) return { ...base, visible: false as const, reason: "not_submitted" as const };
  if (!resultsVisible(exam)) {
    const mode = exam.settings?.resultRelease;
    return { ...base, visible: false as const, reason: "not_released" as const, releaseMode: mode, releaseAt: mode === "after_end" ? exam.endDate : null };
  }
  const result = await Result.findOne({ attemptId: attempt._id }).lean();
  if (!result) return { ...base, visible: false as const, reason: "evaluating" as const };

  let review = null;
  if (answerReviewVisible(exam)) {
    const order: QuestionOrderItem[] = attempt.questionOrder;
    const paper = await ExamQuestion.find({ _id: { $in: order.map((q) => q.examQuestionId) } }).lean();
    const byId = new Map(paper.map((p) => [String(p._id), p]));
    const outcomes = new Map((result.questionResults as QuestionResultItem[]).map((r) => [String(r.examQuestionId), r]));
    review = order.map((o, i) => {
      const p = byId.get(String(o.examQuestionId))!;
      const out = outcomes.get(String(o.examQuestionId));
      return {
        number: i + 1,
        id: String(p._id),
        subject: p.questionSnapshot!.subject,
        topic: p.questionSnapshot!.topic,
        questionType: p.questionSnapshot!.questionType,
        questionText: p.questionSnapshot!.questionText,
        questionImages: p.questionSnapshot!.questionImages,
        options: p.questionSnapshot!.options,
        selectedOption: out?.selectedOption ?? null,
        numericalValue: out?.numericalValue ?? null,
        isCorrect: out?.isCorrect ?? null,
        marks: out?.marks ?? 0,
        correctOption: p.answerKeySnapshot?.correctOption ?? null,
        numericalAnswer: p.answerKeySnapshot?.numericalAnswer ?? null,
        explanation: p.answerKeySnapshot?.explanation ?? "",
        solutionImages: p.answerKeySnapshot?.solutionImages ?? [],
      };
    });
  }
  return {
    ...base,
    visible: true as const,
    result: {
      totalQuestions: result.totalQuestions,
      attempted: result.attemptedCount,
      correct: result.correctCount,
      incorrect: result.incorrectCount,
      unanswered: result.unansweredCount,
      totalScore: result.totalScore,
      maxScore: result.maxScore,
      percentage: result.percentage,
      passed: result.passed,
      subjectScores: result.subjectScores,
      difficultyStats: result.difficultyStats,
    },
    review,
  };
}

/** Exams a student can see on their dashboard: open/upcoming published exams plus their own attempts. */
/**
 * Exams are never advertised to students. A student only sees an exam after opening it through
 * its link or access code (recorded as an ExamRegistration) or after starting an attempt.
 */
export async function listAvailableExamsForStudent(studentId: string, now = new Date()) {
  const [regs, attempts] = await Promise.all([
    ExamRegistration.find({ studentId }).select("examId").lean(),
    Attempt.find({ studentId, isCurrent: true }).select("examId status").lean(),
  ]);
  const ids = [...new Set([...regs, ...attempts].map((r) => String(r.examId)))];
  if (!ids.length) return [];
  const exams = await Exam.find({ _id: { $in: ids }, status: { $in: ["published", "closed"] }, endDate: { $gt: new Date(now.getTime() - 3 * 86_400_000) } })
    .sort({ startDate: 1 })
    .select("title description category totalQuestions durationMinutes startDate endDate timezone status shareToken totalMarks academicLevel")
    .lean();
  const attemptMap = new Map(attempts.map((a) => [String(a.examId), a]));
  return exams
    .map((e) => {
      const lifecycle = examLifecycle(e, now);
      const att = attemptMap.get(String(e._id));
      return {
        id: String(e._id),
        title: e.title,
        description: e.description,
        category: e.category,
        academicLevel: e.academicLevel,
        totalQuestions: e.totalQuestions,
        durationMinutes: e.durationMinutes,
        totalMarks: e.totalMarks,
        startDate: e.startDate,
        endDate: e.endDate,
        timezone: e.timezone || UNIVERSITY_TIMEZONE,
        shareToken: e.shareToken,
        lifecycle,
        state: examWindowState(e, now),
        attemptStatus: att?.status ?? null,
        attemptId: att ? String(att._id) : null,
      };
    })
    // Expired/closed exams stay listed only while the student has something to see there.
    .filter((e) => e.lifecycle === "active" || e.lifecycle === "scheduled" || e.attemptStatus);
}

export type StudentNotice = { id: string; kind: "upcoming" | "available" | "closing_soon" | "expired"; examTitle: string; token: string | null; message: string; at: Date };

/** In-app notices built from the stored schedule of exams this student has opened. */
export async function studentExamNotices(studentId: string, now = new Date()): Promise<StudentNotice[]> {
  const regs = await ExamRegistration.find({ studentId }).select("examId").lean();
  if (!regs.length) return [];
  const exams = await Exam.find({ _id: { $in: regs.map((r) => r.examId) }, status: "published", endDate: { $gt: new Date(now.getTime() - 3 * 86_400_000) } })
    .select("title startDate endDate timezone status shareToken")
    .lean();
  const attempts = await Attempt.find({ studentId, isCurrent: true, examId: { $in: exams.map((e) => e._id) } }).select("examId status").lean();
  const byExam = new Map(attempts.map((a) => [String(a.examId), a.status]));
  const out: StudentNotice[] = [];
  for (const e of exams) {
    const tz = e.timezone || UNIVERSITY_TIMEZONE;
    const status = byExam.get(String(e._id));
    const finished = !!status && status !== "in_progress";
    const lc = examLifecycle(e, now);
    const base = { examTitle: e.title, token: e.shareToken ?? null };
    if (lc === "scheduled" && e.startDate.getTime() - now.getTime() < 7 * 86_400_000) {
      const { date, time } = formatDateAndTime(e.startDate, tz);
      out.push({ ...base, id: `${e._id}:upcoming`, kind: "upcoming", message: `Begins on ${date} at ${time}.`, at: e.startDate });
    } else if (lc === "active" && !finished) {
      const closingSoon = e.endDate.getTime() - now.getTime() <= 60 * 60_000;
      if (closingSoon) out.push({ ...base, id: `${e._id}:closing`, kind: "closing_soon", message: `Stops accepting new attempts at ${formatInZone(e.endDate, tz, { timeStyle: "short" })}.`, at: e.endDate });
      else if (!status) out.push({ ...base, id: `${e._id}:available`, kind: "available", message: `Open now until ${formatInZone(e.endDate, tz)}.`, at: e.startDate });
    } else if (lc === "expired" && !status) {
      out.push({ ...base, id: `${e._id}:expired`, kind: "expired", message: "This examination is no longer accepting new attempts.", at: e.endDate });
    }
  }
  const rank = { closing_soon: 0, available: 1, upcoming: 2, expired: 3 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || a.at.getTime() - b.at.getTime());
}

/* -------------------------------------------------------------------------- */
/*  Admin: exam results                                                        */
/* -------------------------------------------------------------------------- */

export interface ResultsQuery {
  search?: string;
  outcome?: "passed" | "failed" | "all";
  status?: string;
  sort?: string;
  page: number;
  pageSize: number;
}

const SORTS: Record<string, Record<string, 1 | -1>> = {
  "-score": { totalScore: -1, _id: 1 },
  score: { totalScore: 1, _id: 1 },
  name: { "student.fullName": 1, _id: 1 },
  "-name": { "student.fullName": -1, _id: 1 },
  "-submitted": { "attempt.submittedAt": -1, _id: 1 },
  submitted: { "attempt.submittedAt": 1, _id: 1 },
};

function resultsPipeline(examId: Types.ObjectId, q: Omit<ResultsQuery, "page" | "pageSize">): PipelineStage[] {
  const match: Record<string, unknown> = {};
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    match.$or = [{ "student.fullName": rx }, { "student.email": rx }, { "student.studentId": rx }];
  }
  if (q.outcome === "passed") match.passed = true;
  if (q.outcome === "failed") match.passed = false;
  if (q.status && q.status !== "all") match["attempt.status"] = q.status;
  return [
    { $match: { examId, superseded: false } },
    { $lookup: { from: "users", localField: "studentId", foreignField: "_id", as: "student", pipeline: [{ $project: { fullName: 1, email: 1, studentId: 1 } }] } },
    { $unwind: "$student" },
    { $lookup: { from: "attempts", localField: "attemptId", foreignField: "_id", as: "attempt", pipeline: [{ $project: { status: 1, startedAt: 1, submittedAt: 1, warningCount: 1, finalizationReason: 1 } }] } },
    { $unwind: "$attempt" },
    { $match: match },
  ];
}

function shapeResultRow(r: Record<string, unknown> & { subjectScores: { subject: string; score: number; maxScore: number }[] }) {
  const subjects: Record<string, number | null> = Object.fromEntries(SUBJECTS.map((s) => [s, r.subjectScores.find((x) => x.subject === s)?.score ?? null]));
  const student = r.student as { _id: Types.ObjectId; fullName: string; email: string; studentId: string };
  const attempt = r.attempt as { _id: Types.ObjectId; status: string; startedAt: Date; submittedAt: Date; warningCount: number; finalizationReason: string };
  return {
    attemptId: String(attempt._id),
    studentId: String(student._id),
    studentCode: student.studentId,
    name: student.fullName,
    email: student.email,
    attemptDate: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    attemptStatus: attempt.status,
    finalizationReason: attempt.finalizationReason,
    warningCount: attempt.warningCount,
    /** Marks per subject (null when the subject is not part of the paper). */
    subjectScores: subjects,
    totalScore: r.totalScore as number,
    maxScore: r.maxScore as number,
    percentage: r.percentage as number,
    passed: r.passed as boolean,
    correct: r.correctCount as number,
    incorrect: r.incorrectCount as number,
    unanswered: r.unansweredCount as number,
  };
}
export type ResultRow = ReturnType<typeof shapeResultRow>;

export async function listExamResults(examId: string, q: ResultsQuery) {
  const exam = await Exam.findById(examId).select("title totalMarks passingMarks totalQuestions status subjectDistribution").lean();
  if (!exam) throw notFound("Exam");
  await finalizeOverdueAttempts(examId);
  const pipeline = resultsPipeline(exam._id, q);
  const [agg] = await Result.aggregate([
    ...pipeline,
    {
      $facet: {
        items: [{ $sort: SORTS[q.sort ?? "-score"] ?? SORTS["-score"] }, { $skip: (q.page - 1) * q.pageSize }, { $limit: q.pageSize }],
        total: [{ $count: "n" }],
      },
    },
  ]);
  const total = agg.total[0]?.n ?? 0;
  return {
    exam: { id: String(exam._id), title: exam.title, totalMarks: exam.totalMarks, passingMarks: exam.passingMarks, totalQuestions: exam.totalQuestions, status: exam.status },
    subjects: await examSubjects(exam._id, exam.subjectDistribution),
    items: agg.items.map(shapeResultRow),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

export async function allExamResultRows(examId: string, q: Omit<ResultsQuery, "page" | "pageSize">) {
  const exam = await Exam.findById(examId).lean<ExamDoc>();
  if (!exam) throw notFound("Exam");
  const rows = await Result.aggregate([...resultsPipeline(exam._id, q), { $sort: SORTS[q.sort ?? "-score"] ?? SORTS["-score"] }]);
  return { exam, rows: rows.map(shapeResultRow), subjects: await examSubjects(exam._id, exam.subjectDistribution) };
}

/** Subjects that appear in an exam (from its distribution, or from the generated paper for manual selections), in canonical order. */
async function examSubjects(examId: Types.ObjectId, distribution?: { subject: string }[]): Promise<string[]> {
  let present = new Set((distribution ?? []).map((d) => d.subject));
  if (!present.size) present = new Set(await ExamQuestion.distinct("questionSnapshot.subject", { examId }));
  return SUBJECTS.filter((s) => present.has(s));
}

/** Full detail of one attempt for an Admin, including answers and integrity events. */
export async function adminAttemptDetail(examId: string, attemptId: string) {
  const attempt = await Attempt.findOne({ _id: attemptId, examId }).lean();
  if (!attempt) throw notFound("Attempt");
  const [student, result, events, paper] = await Promise.all([
    User.findById(attempt.studentId).select("fullName email studentId mobile institutionName academicLevel").lean(),
    Result.findOne({ attemptId: attempt._id }).lean(),
    IntegrityEvent.find({ attemptId: attempt._id }).sort({ timestamp: 1 }).lean(),
    ExamQuestion.find({ _id: { $in: (attempt.questionOrder as QuestionOrderItem[]).map((q) => q.examQuestionId) } }).lean(),
  ]);
  const byId = new Map(paper.map((p) => [String(p._id), p]));
  const outcomes = new Map(((result?.questionResults ?? []) as QuestionResultItem[]).map((r) => [String(r.examQuestionId), r]));
  return {
    attempt: { ...attempt, id: String(attempt._id), answers: undefined },
    student,
    result,
    events: events.map((e) => ({ ...e, id: String(e._id) })),
    questions: (attempt.questionOrder as QuestionOrderItem[]).map((o, i) => {
      const p = byId.get(String(o.examQuestionId))!;
      const a = attempt.answers ? (attempt.answers as unknown as Record<string, { selectedOption: number | null; numericalValue: string | null; markedForReview: boolean }>)[String(o.examQuestionId)] : undefined;
      const out = outcomes.get(String(o.examQuestionId));
      return {
        number: i + 1,
        subject: p.questionSnapshot!.subject,
        difficulty: p.questionSnapshot!.difficulty,
        questionType: p.questionSnapshot!.questionType,
        questionText: p.questionSnapshot!.questionText,
        options: p.questionSnapshot!.options,
        selectedOption: out?.selectedOption ?? a?.selectedOption ?? null,
        numericalValue: out?.numericalValue ?? a?.numericalValue ?? null,
        markedForReview: a?.markedForReview ?? false,
        correctOption: p.answerKeySnapshot?.correctOption ?? null,
        numericalAnswer: p.answerKeySnapshot?.numericalAnswer ?? null,
        isCorrect: out?.isCorrect ?? null,
        marks: out?.marks ?? null,
      };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/*  Admin: analytics                                                           */
/* -------------------------------------------------------------------------- */

function histogram(values: number[], buckets = 10) {
  const out = Array.from({ length: buckets }, (_, i) => ({ range: `${i * (100 / buckets)}–${(i + 1) * (100 / buckets)}%`, count: 0 }));
  for (const v of values) {
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor(v / (100 / buckets))));
    out[idx].count++;
  }
  return out;
}

export async function examAnalytics(examId: string) {
  const exam = await Exam.findById(examId).lean<ExamDoc>();
  if (!exam) throw notFound("Exam");
  await finalizeOverdueAttempts(examId);
  const results = await Result.find({ examId: exam._id, superseded: false }).select("percentage totalScore passed subjectScores difficultyStats questionResults").lean();
  const n = results.length;
  const subjectAgg = new Map<string, { score: number; max: number; correct: number; attempted: number; total: number }>();
  const diffAgg = new Map<string, { correct: number; attempted: number; total: number }>();
  const qAgg = new Map<string, { correct: number; attempted: number; total: number }>();
  for (const r of results) {
    for (const s of r.subjectScores) {
      const a = subjectAgg.get(s.subject!) ?? { score: 0, max: 0, correct: 0, attempted: 0, total: 0 };
      a.score += s.score ?? 0;
      a.max += s.maxScore ?? 0;
      a.correct += s.correct ?? 0;
      a.attempted += s.attempted ?? 0;
      a.total += s.total ?? 0;
      subjectAgg.set(s.subject!, a);
    }
    for (const d of r.difficultyStats) {
      const a = diffAgg.get(d.difficulty!) ?? { correct: 0, attempted: 0, total: 0 };
      a.correct += d.correct ?? 0;
      a.attempted += d.attempted ?? 0;
      a.total += d.total ?? 0;
      diffAgg.set(d.difficulty!, a);
    }
    for (const q of r.questionResults) {
      const k = String(q.examQuestionId);
      const a = qAgg.get(k) ?? { correct: 0, attempted: 0, total: 0 };
      a.total++;
      if (q.isCorrect !== null) a.attempted++;
      if (q.isCorrect) a.correct++;
      qAgg.set(k, a);
    }
  }
  const paper = await ExamQuestion.find({ examId: exam._id, examVersion: exam.version }).select("displayOrder questionSnapshot.subject questionSnapshot.questionText questionSnapshot.difficulty").sort({ displayOrder: 1 }).lean();
  const questionStats = paper.map((p) => {
    const a = qAgg.get(String(p._id)) ?? { correct: 0, attempted: 0, total: 0 };
    return {
      number: p.displayOrder,
      subject: p.questionSnapshot!.subject,
      difficulty: p.questionSnapshot!.difficulty,
      preview: (p.questionSnapshot!.questionText ?? "").slice(0, 140),
      attempted: a.attempted,
      correct: a.correct,
      accuracy: a.attempted ? round2((a.correct / a.attempted) * 100) : null,
    };
  });
  const attemptsByStatus = await Attempt.aggregate<{ _id: string; n: number }>([
    { $match: { examId: exam._id, isCurrent: true } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  const pcts = results.map((r) => r.percentage);
  const sorted = [...pcts].sort((a, b) => a - b);
  return {
    exam: { id: String(exam._id), title: exam.title, totalMarks: exam.totalMarks, passingMarks: exam.passingMarks },
    summary: {
      evaluated: n,
      averageScore: n ? round2(results.reduce((a, r) => a + r.totalScore, 0) / n) : null,
      averagePercentage: n ? round2(pcts.reduce((a, b) => a + b, 0) / n) : null,
      medianPercentage: n ? round2(n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2) : null,
      highestScore: n ? Math.max(...results.map((r) => r.totalScore)) : null,
      lowestScore: n ? Math.min(...results.map((r) => r.totalScore)) : null,
      passRate: n ? round2((results.filter((r) => r.passed).length / n) * 100) : null,
    },
    attemptsByStatus: Object.fromEntries(attemptsByStatus.map((a) => [a._id, a.n])),
    scoreDistribution: histogram(pcts),
    subjectPerformance: [...subjectAgg].map(([subject, a]) => ({
      subject,
      averagePercentage: a.max ? round2((a.score / a.max) * 100) : 0,
      accuracy: a.attempted ? round2((a.correct / a.attempted) * 100) : 0,
    })),
    difficultyAccuracy: ["Easy", "Medium", "Hard"].filter((d) => diffAgg.has(d)).map((d) => {
      const a = diffAgg.get(d)!;
      return { difficulty: d, accuracy: a.attempted ? round2((a.correct / a.attempted) * 100) : 0, attemptRate: a.total ? round2((a.attempted / a.total) * 100) : 0 };
    }),
    questionStats,
  };
}

export async function dashboardStats() {
  await finalizeOverdueAttempts();
  const now = new Date();
  const since = new Date(now.getTime() - 29 * 86_400_000);
  since.setHours(0, 0, 0, 0);
  const [students, questions, examsByStatus, activeExams, attempts, resultAgg, recentExams, recentStudents, participation, completions, subjectPerf, diffPerf, pctList] =
    await Promise.all([
      User.countDocuments({ role: "STUDENT" }),
      Question.countDocuments({ archived: false }),
      Exam.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Exam.countDocuments({ status: "published", startDate: { $lte: now }, endDate: { $gt: now } }),
      Attempt.countDocuments({ isCurrent: true }),
      Result.aggregate<{ avg: number; passed: number; n: number }>([
        { $match: { superseded: false } },
        { $group: { _id: null, avg: { $avg: "$percentage" }, passed: { $sum: { $cond: ["$passed", 1, 0] } }, n: { $sum: 1 } } },
      ]),
      Exam.find({ status: { $ne: "archived" } }).sort({ createdAt: -1 }).limit(6).select("title totalQuestions durationMinutes status startDate endDate").lean(),
      User.find({ role: "STUDENT" }).sort({ createdAt: -1 }).limit(6).select("fullName email studentId institutionName createdAt").lean(),
      Attempt.aggregate<{ _id: string; n: number }>([
        { $match: { startedAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt", timezone: "Asia/Kolkata" } }, n: { $sum: 1 } } },
      ]),
      Attempt.aggregate<{ _id: string; n: number }>([
        { $match: { submittedAt: { $gte: since }, status: { $in: FINAL_ATTEMPT_STATUSES } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$submittedAt", timezone: "Asia/Kolkata" } }, n: { $sum: 1 } } },
      ]),
      Result.aggregate<{ _id: string; score: number; max: number; correct: number; attempted: number }>([
        { $match: { superseded: false } },
        { $unwind: "$subjectScores" },
        { $group: { _id: "$subjectScores.subject", score: { $sum: "$subjectScores.score" }, max: { $sum: "$subjectScores.maxScore" }, correct: { $sum: "$subjectScores.correct" }, attempted: { $sum: "$subjectScores.attempted" } } },
      ]),
      Result.aggregate<{ _id: string; correct: number; attempted: number }>([
        { $match: { superseded: false } },
        { $unwind: "$difficultyStats" },
        { $group: { _id: "$difficultyStats.difficulty", correct: { $sum: "$difficultyStats.correct" }, attempted: { $sum: "$difficultyStats.attempted" } } },
      ]),
      Result.find({ superseded: false }).select("percentage").lean(),
    ]);

  const statusMap = Object.fromEntries(examsByStatus.map((e) => [e._id, e.n]));
  const r = resultAgg[0];
  const days: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(since.getTime() + i * 86_400_000);
    days.push(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  }
  const pMap = new Map(participation.map((p) => [p._id, p.n]));
  const cMap = new Map(completions.map((p) => [p._id, p.n]));

  const recentIds = recentExams.map((e) => e._id);
  const { examParticipationStats } = await import("./exam.service");
  const examStats = await examParticipationStats(recentIds);
  const avgByExam = await Result.aggregate<{ _id: Types.ObjectId; avg: number }>([
    { $match: { superseded: false } },
    { $group: { _id: "$examId", avg: { $avg: "$percentage" }, last: { $max: "$createdAt" } } },
    { $sort: { last: -1 } },
    { $limit: 8 },
  ]);
  const avgExamTitles = new Map(
    (await Exam.find({ _id: { $in: avgByExam.map((a) => a._id) } }).select("title").lean()).map((e) => [String(e._id), e.title]),
  );

  return {
    cards: {
      students,
      questions,
      exams: Object.values(statusMap).reduce((a, b) => a + b, 0),
      activeExams,
      completedExams: statusMap.closed ?? 0,
      publishedExams: statusMap.published ?? 0,
      draftExams: statusMap.draft ?? 0,
      attempts,
      averageScore: r ? round2(r.avg) : null,
      passPercentage: r && r.n ? round2((r.passed / r.n) * 100) : null,
    },
    participation: days.map((d) => ({ date: d, started: pMap.get(d) ?? 0, completed: cMap.get(d) ?? 0 })),
    scoreDistribution: histogram(pctList.map((p) => p.percentage)),
    subjectPerformance: SUBJECTS.map((s) => {
      const a = subjectPerf.find((x) => x._id === s);
      return { subject: s, averagePercentage: a && a.max ? round2((a.score / a.max) * 100) : 0, accuracy: a && a.attempted ? round2((a.correct / a.attempted) * 100) : 0 };
    }),
    difficultyAccuracy: ["Easy", "Medium", "Hard"].map((d) => {
      const a = diffPerf.find((x) => x._id === d);
      return { difficulty: d, accuracy: a && a.attempted ? round2((a.correct / a.attempted) * 100) : 0 };
    }),
    averageByExam: avgByExam.map((a) => ({ exam: avgExamTitles.get(String(a._id)) ?? "Exam", averagePercentage: round2(a.avg) })).reverse(),
    recentExams: recentExams.map((e) => ({ ...e, id: String(e._id), _id: undefined, ...examStats.get(String(e._id)) })),
    recentStudents: recentStudents.map((s) => ({ ...s, id: String(s._id), _id: undefined })),
  };
}

/* -------------------------------------------------------------------------- */
/*  Admin: monitoring                                                          */
/* -------------------------------------------------------------------------- */

export async function examMonitoring(examId: string) {
  const exam = await Exam.findById(examId).select("title status startDate endDate durationMinutes totalQuestions settings.security shareToken").lean();
  if (!exam) throw notFound("Exam");
  await finalizeOverdueAttempts(examId);
  const now = Date.now();
  const [registrations, attempts, eventCounts, accommodations] = await Promise.all([
    ExamRegistration.countDocuments({ examId: exam._id }),
    Attempt.find({ examId: exam._id, isCurrent: true }).select("-answers.savedAt").lean(),
    IntegrityEvent.aggregate<{ _id: { attemptId: Types.ObjectId; type: string }; n: number }>([
      { $match: { examId: exam._id } },
      { $group: { _id: { attemptId: "$attemptId", type: "$eventType" }, n: { $sum: 1 } } },
    ]),
    Accommodation.find({ examId: exam._id }).sort({ createdAt: -1 }).populate("studentId", "fullName email studentId").lean(),
  ]);
  const students = new Map(
    (await User.find({ _id: { $in: attempts.map((a) => a.studentId) } }).select("fullName email studentId").lean()).map((u) => [String(u._id), u]),
  );
  const eventsByAttempt = new Map<string, Record<string, number>>();
  for (const e of eventCounts) {
    const k = String(e._id.attemptId);
    eventsByAttempt.set(k, { ...(eventsByAttempt.get(k) ?? {}), [e._id.type]: e.n });
  }
  const rows = attempts.map((a) => {
    const s = students.get(String(a.studentId));
    const answers = a.answers ? Object.values(a.answers as unknown as Record<string, { selectedOption: number | null; numericalValue: string | null }>) : [];
    const answered = answers.filter((x) => x.selectedOption !== null || (x.numericalValue !== null && x.numericalValue !== "")).length;
    const last = new Date(a.lastActivityAt ?? a.startedAt).getTime();
    let liveStatus: string = a.status;
    if (a.status === "in_progress") {
      if (now > new Date(a.deadlineAt).getTime()) liveStatus = "time_expired";
      else liveStatus = now - last <= ACTIVE_WINDOW_MS ? "active" : "disconnected";
    }
    return {
      attemptId: String(a._id),
      studentId: String(a.studentId),
      name: s?.fullName ?? "Unknown",
      email: s?.email ?? "",
      studentCode: s?.studentId ?? "",
      startedAt: a.startedAt,
      deadlineAt: a.deadlineAt,
      submittedAt: a.submittedAt,
      status: a.status,
      liveStatus,
      finalizationReason: a.finalizationReason,
      answeredCount: answered,
      lastActivityAt: a.lastActivityAt,
      warningCount: a.warningCount,
      events: eventsByAttempt.get(String(a._id)) ?? {},
    };
  });
  const count = (fn: (r: (typeof rows)[number]) => boolean) => rows.filter(fn).length;
  return {
    exam: { ...exam, id: String(exam._id) },
    summary: {
      registered: Math.max(registrations, rows.length),
      started: rows.length,
      active: count((r) => r.liveStatus === "active"),
      disconnected: count((r) => r.liveStatus === "disconnected"),
      awaitingFinalization: count((r) => r.liveStatus === "time_expired"),
      completed: count((r) => r.status === "submitted"),
      autoSubmitted: count((r) => r.status === "auto_submitted"),
      terminated: count((r) => r.status === "terminated"),
    },
    rows,
    accommodations: accommodations.map((a) => ({ ...a, id: String(a._id) })),
  };
}

export async function attemptEvents(examId: string, attemptId: string) {
  const attempt = await Attempt.findOne({ _id: attemptId, examId }).select("_id").lean();
  if (!attempt) throw notFound("Attempt");
  return (await IntegrityEvent.find({ attemptId: attempt._id }).sort({ timestamp: 1 }).lean()).map((e) => ({ ...e, id: String(e._id) }));
}

export async function reviewIntegrityEvent(examId: string, eventId: string, adminId: string, status: "reviewed" | "dismissed" | "flagged", note = "") {
  const e = await IntegrityEvent.findOneAndUpdate(
    { _id: eventId, examId },
    { $set: { reviewStatus: status, reviewNote: note, reviewedBy: adminId } },
    { returnDocument: "after" },
  ).lean();
  if (!e) throw notFound("Event");
  return e;
}

/* -------------------------------------------------------------------------- */
/*  Admin: students                                                            */
/* -------------------------------------------------------------------------- */

export interface StudentQuery {
  search?: string;
  academicLevel?: string;
  sort?: string;
  page: number;
  pageSize: number;
}

function studentPipeline(q: Omit<StudentQuery, "page" | "pageSize">): PipelineStage[] {
  const match: Record<string, unknown> = { role: "STUDENT" };
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    match.$or = [{ fullName: rx }, { email: rx }, { studentId: rx }, { institutionName: rx }, { mobile: rx }];
  }
  if (q.academicLevel) match.academicLevel = q.academicLevel;
  return [
    { $match: match },
    {
      $lookup: {
        from: "results",
        localField: "_id",
        foreignField: "studentId",
        as: "results",
        pipeline: [{ $match: { superseded: false } }, { $project: { percentage: 1 } }],
      },
    },
    {
      $lookup: {
        from: "attempts",
        localField: "_id",
        foreignField: "studentId",
        as: "attempts",
        pipeline: [{ $match: { isCurrent: true } }, { $project: { lastActivityAt: 1 } }],
      },
    },
    {
      $project: {
        studentId: 1,
        fullName: 1,
        email: 1,
        mobile: 1,
        academicLevel: 1,
        institutionName: 1,
        createdAt: 1,
        status: 1,
        examsAttempted: { $size: "$attempts" },
        averagePercentage: { $avg: "$results.percentage" },
        latestActivity: { $max: [{ $max: "$attempts.lastActivityAt" }, "$lastActivityAt", "$lastLoginAt"] },
      },
    },
  ];
}

const STUDENT_SORTS: Record<string, Record<string, 1 | -1>> = {
  "-createdAt": { createdAt: -1, _id: 1 },
  createdAt: { createdAt: 1, _id: 1 },
  name: { fullName: 1, _id: 1 },
  "-exams": { examsAttempted: -1, _id: 1 },
  "-average": { averagePercentage: -1, _id: 1 },
  "-activity": { latestActivity: -1, _id: 1 },
};

export async function listStudents(q: StudentQuery) {
  const [agg] = await User.aggregate([
    ...studentPipeline(q),
    {
      $facet: {
        items: [{ $sort: STUDENT_SORTS[q.sort ?? "-createdAt"] ?? STUDENT_SORTS["-createdAt"] }, { $skip: (q.page - 1) * q.pageSize }, { $limit: q.pageSize }],
        total: [{ $count: "n" }],
      },
    },
  ]);
  const total = agg.total[0]?.n ?? 0;
  return {
    items: agg.items.map((s: Record<string, unknown>) => ({
      ...s,
      id: String(s._id),
      _id: undefined,
      averagePercentage: s.averagePercentage === null || s.averagePercentage === undefined ? null : round2(s.averagePercentage as number),
    })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

export async function allStudentRows(q: Omit<StudentQuery, "page" | "pageSize">) {
  const rows = await User.aggregate([...studentPipeline(q), { $sort: STUDENT_SORTS[q.sort ?? "-createdAt"] ?? STUDENT_SORTS["-createdAt"] }]);
  return rows.map((s) => ({ ...s, averagePercentage: s.averagePercentage == null ? null : round2(s.averagePercentage) }));
}

export async function getStudentProfileForAdmin(id: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound("Student");
  const student = await User.findOne({ _id: id, role: "STUDENT" }).lean();
  if (!student) throw notFound("Student");
  const history = await listStudentAttempts(id);
  // Admins always see scores, regardless of the student-facing release setting.
  const results = await Result.find({ studentId: student._id, superseded: false }).select("attemptId totalScore maxScore percentage passed").lean();
  const rmap = new Map(results.map((r) => [String(r.attemptId), r]));
  return {
    student: { ...student, id: String(student._id) },
    history: history.map((h) => {
      const r = rmap.get(h.attemptId);
      return { ...h, result: r ? { totalScore: r.totalScore, maxScore: r.maxScore, percentage: r.percentage, passed: r.passed } : null };
    }),
  };
}

export async function setStudentStatus(id: string, status: "active" | "disabled") {
  const u = await User.findOneAndUpdate({ _id: id, role: "STUDENT" }, { $set: { status } }, { returnDocument: "after" }).lean();
  if (!u) throw new AppError("NOT_FOUND", "Student not found.");
  return u;
}
