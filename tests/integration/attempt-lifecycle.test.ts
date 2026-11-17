import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb, teardownTestDb } from "../helpers/db";
import { createAdminUser, createStudentUser, seedVerifiedQuestions } from "../helpers/fixtures";
import { Attempt, Exam, ExamQuestion, IntegrityEvent, Result, AuditLog, Accommodation } from "@/models";
import { examConfigSchema } from "@/lib/validation/exams";
import { createExam, generateExamPaper, publishExam, closeExam } from "@/services/exam.service";
import {
  startAttempt,
  getAttemptForStudent,
  saveAnswers,
  submitAttempt,
  finalizeOverdueAttempts,
  recordIntegrityEvent,
  adminResetAttempt,
  requestAccommodation,
  decideAccommodation,
} from "@/services/attempt.service";
import { getStudentResult, listExamResults, examMonitoring, examAnalytics } from "@/services/results.service";

let adminId: string;
const now = Date.now();

async function publishedExam(over: Record<string, unknown> = {}) {
  const exam = await createExam(
    examConfigSchema.parse({
      title: "Lifecycle Test",
      durationMinutes: 60,
      totalQuestions: 100,
      startDate: new Date(now - 60_000).toISOString(),
      endDate: new Date(now + 86_400_000).toISOString(),
      passingMarks: 120,
      subjectDistribution: [{ subject: "Physics", count: 35 }, { subject: "Chemistry", count: 35 }, { subject: "Mathematics", count: 30 }],
      ...over,
    }),
    adminId,
  );
  await generateExamPaper(String(exam._id), adminId);
  return publishExam(String(exam._id), adminId);
}

async function answerKey(attemptId: string): Promise<{ id: string; correct: number }[]> {
  const a = await Attempt.findById(attemptId).lean();
  const eqs = await ExamQuestion.find({ _id: { $in: a!.questionOrder.map((q: { examQuestionId: unknown }) => q.examQuestionId) } }).lean();
  const map = new Map(eqs.map((e) => [String(e._id), e.answerKeySnapshot!.correctOption!]));
  return a!.questionOrder.map((q: { examQuestionId: unknown }) => ({ id: String(q.examQuestionId), correct: map.get(String(q.examQuestionId))! }));
}

beforeAll(async () => {
  await setupTestDb("attempt");
  adminId = String((await createAdminUser())._id);
  await seedVerifiedQuestions({ Physics: { Easy: 20, Medium: 20 }, Chemistry: { Easy: 20, Medium: 20 }, Mathematics: { Easy: 20, Medium: 20 } });
});
afterAll(teardownTestDb);

describe("student attempt lifecycle", () => {
  it("starts once, resumes on reopen, and survives concurrent start requests", async () => {
    const exam = await publishedExam();
    const s = String((await createStudentUser())._id);
    const results = await Promise.all(Array.from({ length: 10 }, () => startAttempt(exam._id, s)));
    expect(new Set(results.map((r) => r.attemptId)).size).toBe(1);
    expect(await Attempt.countDocuments({ examId: exam._id, studentId: s })).toBe(1);
    const again = await startAttempt(exam._id, s);
    expect(again).toEqual({ attemptId: results[0].attemptId, resumed: true });
  });

  it("never exposes the answer key to the student before release", async () => {
    const exam = await publishedExam();
    const s = String((await createStudentUser())._id);
    const { attemptId } = await startAttempt(exam._id, s);
    const view = await getAttemptForStudent(attemptId, s);
    expect(view.questions).toHaveLength(100);
    const body = JSON.stringify(view);
    for (const forbidden of ["correctOption", "answerKeySnapshot", "numericalAnswer", "explanation", "solutionImages"]) expect(body).not.toContain(forbidden);
    // Another student cannot open it
    const other = String((await createStudentUser())._id);
    await expect(getAttemptForStudent(attemptId, other)).rejects.toThrow(/another student/);
  });

  it("autosaves, restores after reload, and does not reset the server timer", async () => {
    const exam = await publishedExam();
    const s = String((await createStudentUser())._id);
    const { attemptId } = await startAttempt(exam._id, s);
    const first = await getAttemptForStudent(attemptId, s);
    const [q1, q2] = first.questions;
    await saveAnswers(attemptId, s, [{ examQuestionId: q1.id, selectedOption: 2 }, { examQuestionId: q2.id, selectedOption: 3, markedForReview: true }]);
    await saveAnswers(attemptId, s, [{ examQuestionId: q2.id, selectedOption: null }]); // clear response, keep review mark
    const reloaded = await getAttemptForStudent(attemptId, s);
    expect(reloaded.answers[q1.id]).toMatchObject({ selectedOption: 2, markedForReview: false });
    expect(reloaded.answers[q2.id]).toMatchObject({ selectedOption: null, markedForReview: true });
    expect(new Date(reloaded.deadlineAt).getTime()).toBe(new Date(first.deadlineAt).getTime());
    await expect(saveAnswers(attemptId, s, [{ examQuestionId: "0123456789abcdef01234567", selectedOption: 1 }])).rejects.toThrow(/not part of this attempt/);
    await expect(saveAnswers(attemptId, s, [{ examQuestionId: q1.id, selectedOption: 9 }])).rejects.toThrow(/out of range/);
  });

  it("scores exactly (70 correct / 20 wrong / 10 blank → 260/400) and handles concurrent submits idempotently", async () => {
    const exam = await publishedExam();
    const s = String((await createStudentUser())._id);
    const { attemptId } = await startAttempt(exam._id, s);
    const key = await answerKey(attemptId);
    const updates = key.slice(0, 90).map((k, i) => ({ examQuestionId: k.id, selectedOption: i < 70 ? k.correct : (k.correct % 4) + 1 }));
    await saveAnswers(attemptId, s, updates);
    const submits = await Promise.all(Array.from({ length: 6 }, () => submitAttempt(attemptId, s)));
    expect(submits.filter((r) => !r.alreadyFinalized)).toHaveLength(1);
    expect(await Result.countDocuments({ attemptId })).toBe(1);
    const r = await Result.findOne({ attemptId }).lean();
    expect(r).toMatchObject({ correctCount: 70, incorrectCount: 20, unansweredCount: 10, totalScore: 260, maxScore: 400, percentage: 65, passed: true });
    expect(r!.subjectScores.map((x: { subject: string; total: number }) => [x.subject, x.total])).toEqual([["Physics", 35], ["Chemistry", 35], ["Mathematics", 30]]);
    expect((await Attempt.findById(attemptId).lean())!.status).toBe("submitted");
    await expect(saveAnswers(attemptId, s, updates.slice(0, 1))).rejects.toThrow(/already been submitted/);

    // One attempt per exam: cannot start again, even "after logout".
    await expect(startAttempt(exam._id, s)).rejects.toThrow(/already completed/);
    // The same student can take a different exam.
    const other = await publishedExam();
    await expect(startAttempt(other._id, s)).resolves.toMatchObject({ resumed: false });

    const result = await getStudentResult(attemptId, s);
    expect(result.visible).toBe(true);
    if (result.visible) expect(result.review).toBeNull(); // answer review disabled by default
  });

  it("applies custom negative marking", async () => {
    const exam = await publishedExam({ marking: { correct: 3, incorrect: 0.5, unanswered: 0 }, passingMarks: 0 });
    const s = String((await createStudentUser())._id);
    const { attemptId } = await startAttempt(exam._id, s);
    const key = await answerKey(attemptId);
    await saveAnswers(attemptId, s, [
      ...key.slice(0, 10).map((k) => ({ examQuestionId: k.id, selectedOption: k.correct })),
      ...key.slice(10, 14).map((k) => ({ examQuestionId: k.id, selectedOption: (k.correct % 4) + 1 })),
    ]);
    await submitAttempt(attemptId, s);
    expect((await Result.findOne({ attemptId }).lean())!.totalScore).toBe(28); // 10*3 − 4*0.5
  });

  it("auto-submits on timeout with saved answers", async () => {
    const exam = await publishedExam();
    const s = String((await createStudentUser())._id);
    const { attemptId } = await startAttempt(exam._id, s);
    const key = await answerKey(attemptId);
    await saveAnswers(attemptId, s, [{ examQuestionId: key[0].id, selectedOption: key[0].correct }]);
    await Attempt.updateOne({ _id: attemptId }, { $set: { deadlineAt: new Date(Date.now() - 60_000) } });
    await expect(saveAnswers(attemptId, s, [{ examQuestionId: key[1].id, selectedOption: 1 }])).rejects.toThrow(/Time is up/);
    const a = await Attempt.findById(attemptId).lean();
    expect(a).toMatchObject({ status: "auto_submitted", finalizationReason: "time_expired" });
    expect((await Result.findOne({ attemptId }).lean())!.correctCount).toBe(1);
    expect(await finalizeOverdueAttempts()).toBe(0);
  });

  it("finalises overdue attempts via the scheduled job", async () => {
    const exam = await publishedExam();
    const s = String((await createStudentUser())._id);
    const { attemptId } = await startAttempt(exam._id, s);
    await Attempt.updateOne({ _id: attemptId }, { $set: { deadlineAt: new Date(Date.now() - 60_000) } });
    expect(await finalizeOverdueAttempts()).toBe(1);
    expect(await Result.countDocuments({ attemptId })).toBe(1);
  });

  it("counts warnings, deduplicates events and terminates on the third confirmed violation", async () => {
    const exam = await publishedExam();
    const s = String((await createStudentUser())._id);
    const { attemptId } = await startAttempt(exam._id, s);
    const ev = (id: string, eventType: "fullscreen_exit" | "tab_hidden" | "sound_level" | "camera_denied" | "network_offline") =>
      recordIntegrityEvent(attemptId, s, { clientEventId: id, eventType });
    const allowNextWarning = () => Attempt.updateOne({ _id: attemptId }, { $set: { lastWarningAt: new Date(Date.now() - 10_000) } });

    const w1 = await ev("evt-00000001", "fullscreen_exit");
    expect(w1).toMatchObject({ counted: true, warningCount: 1, maxWarnings: 3 });
    expect(await ev("evt-00000001", "fullscreen_exit")).toMatchObject({ duplicate: true, warningCount: 1 }); // retried delivery
    expect(await ev("evt-00000002", "tab_hidden")).toMatchObject({ counted: false, warningCount: 1 }); // same browser action, coalesced
    // Informational events never count.
    for (const [i, t] of (["sound_level", "camera_denied", "network_offline"] as const).entries()) expect(await ev(`info-0000000${i}`, t)).toMatchObject({ counted: false });
    expect(await IntegrityEvent.countDocuments({ attemptId, reviewStatus: "informational" })).toBe(4);

    await allowNextWarning();
    expect(await ev("evt-00000003", "tab_hidden")).toMatchObject({ counted: true, warningCount: 2, finalized: false });
    await allowNextWarning();
    expect(await ev("evt-00000004", "fullscreen_exit")).toMatchObject({ counted: true, warningCount: 3, finalized: true, status: "terminated" });
    const a = await Attempt.findById(attemptId).lean();
    expect(a).toMatchObject({ status: "terminated", finalizationReason: "max_warnings", warningCount: 3 });
    expect(await Result.countDocuments({ attemptId })).toBe(1);
    expect(await ev("evt-00000005", "fullscreen_exit")).toMatchObject({ counted: false, status: "terminated" });
  });

  it("does not count warnings when the policy is disabled or the student has an approved accommodation", async () => {
    const exam = await publishedExam({ settings: { security: { fullscreen: false, tabSwitchWarnings: false } } });
    const s = String((await createStudentUser())._id);
    const { attemptId } = await startAttempt(exam._id, s);
    expect(await recordIntegrityEvent(attemptId, s, { clientEventId: "x-00000001", eventType: "tab_hidden" })).toMatchObject({ counted: false, warningCount: 0 });

    const camExam = await publishedExam({ settings: { security: { camera: true, fullscreen: true } } });
    const s2 = String((await createStudentUser())._id);
    const acc = await requestAccommodation(camExam._id, s2, { reason: "No working webcam on my laptop", camera: true, microphone: false, fullscreen: true });
    await decideAccommodation(String(acc!._id), adminId, true);
    const { attemptId: a2 } = await startAttempt(camExam._id, s2);
    const view = await getAttemptForStudent(a2, s2);
    expect(view.exam.security).toMatchObject({ camera: false, fullscreen: false, fullscreenExitWarnings: false });
    expect(await recordIntegrityEvent(a2, s2, { clientEventId: "y-00000001", eventType: "fullscreen_exit" })).toMatchObject({ counted: false });
    expect(await Accommodation.countDocuments()).toBe(1);
  });

  it("lets an admin reset an attempt with an audit record", async () => {
    const exam = await publishedExam();
    const s = String((await createStudentUser())._id);
    const { attemptId } = await startAttempt(exam._id, s);
    await expect(adminResetAttempt(attemptId, adminId, "Power failure")).rejects.toThrow(/Finalise/);
    await submitAttempt(attemptId, s);
    await adminResetAttempt(attemptId, adminId, "Power failure at centre");
    expect(await AuditLog.countDocuments({ action: "attempt.reset", targetId: attemptId })).toBe(1);
    expect((await Result.findOne({ attemptId }).lean())!.superseded).toBe(true);
    const fresh = await startAttempt(exam._id, s);
    expect(fresh.attemptId).not.toBe(attemptId);
    expect(await Attempt.countDocuments({ examId: exam._id, studentId: s })).toBe(2);
    expect(await Attempt.countDocuments({ examId: exam._id, studentId: s, isCurrent: true })).toBe(1);
  });

  it("closing an exam auto-submits active attempts; results, monitoring and analytics reflect real data", async () => {
    const exam = await publishedExam({ settings: { resultRelease: "manual", allowAnswerReview: true } });
    const students = await Promise.all([createStudentUser(), createStudentUser(), createStudentUser()]);
    const ids = students.map((s) => String(s._id));
    const attempts = await Promise.all(ids.map((s) => startAttempt(exam._id, s)));
    const key = await answerKey(attempts[0].attemptId);
    await saveAnswers(attempts[0].attemptId, ids[0], key.slice(0, 50).map((k) => ({ examQuestionId: k.id, selectedOption: k.correct })));
    await submitAttempt(attempts[0].attemptId, ids[0]);

    const mon = await examMonitoring(String(exam._id));
    expect(mon.summary).toMatchObject({ started: 3, completed: 1 });
    expect(mon.summary.active + mon.summary.disconnected).toBe(2);

    const hidden = await getStudentResult(attempts[0].attemptId, ids[0]);
    expect(hidden).toMatchObject({ visible: false, reason: "not_released" });

    const { finalizedAttempts } = await closeExam(String(exam._id), adminId);
    expect(finalizedAttempts).toBe(2);
    expect(await Attempt.countDocuments({ examId: exam._id, status: "auto_submitted", finalizationReason: "exam_closed" })).toBe(2);

    await Exam.updateOne({ _id: exam._id }, { $set: { "settings.resultsReleased": true } });
    const shown = await getStudentResult(attempts[0].attemptId, ids[0]);
    expect(shown.visible).toBe(true);
    if (shown.visible) {
      expect(shown.result.totalScore).toBe(200);
      expect(shown.review).toHaveLength(100);
      expect(shown.review![0].correctOption).toBeGreaterThan(0);
    }
    await expect(getStudentResult(attempts[0].attemptId, ids[1])).rejects.toThrow(/own results/);

    const list = await listExamResults(String(exam._id), { page: 1, pageSize: 10, sort: "-score" });
    expect(list.total).toBe(3);
    expect(list.items[0]).toMatchObject({ totalScore: 200, passed: true });
    const passed = await listExamResults(String(exam._id), { page: 1, pageSize: 10, outcome: "passed" });
    expect(passed.total).toBe(1);

    const analytics = await examAnalytics(String(exam._id));
    expect(analytics.summary.evaluated).toBe(3);
    expect(analytics.scoreDistribution.reduce((a, b) => a + b.count, 0)).toBe(3);
    expect(analytics.questionStats).toHaveLength(100);
  });

  it("rejects starts outside the exam window", async () => {
    const future = await createExam(
      examConfigSchema.parse({ title: "Future", durationMinutes: 30, totalQuestions: 5, startDate: new Date(now + 3_600_000).toISOString(), endDate: new Date(now + 7_200_000).toISOString(), subjectDistribution: [{ subject: "Physics", count: 5 }] }),
      adminId,
    );
    await generateExamPaper(String(future._id), adminId);
    await publishExam(String(future._id), adminId);
    const s = String((await createStudentUser())._id);
    await expect(startAttempt(future._id, s)).rejects.toThrow(/This examination is scheduled to begin on .+ at .+\./);
  });

  it("caps the deadline at the exam end time when a hard end is configured", async () => {
    const exam = await publishedExam({ endDate: new Date(Date.now() + 10 * 60_000).toISOString(), hardEnd: true });
    const s = String((await createStudentUser())._id);
    const { attemptId } = await startAttempt(exam._id, s);
    const a = await Attempt.findById(attemptId).lean();
    expect(new Date(a!.deadlineAt).getTime()).toBeLessThanOrEqual(new Date(exam.endDate).getTime());
  });

  it("without a hard end, a started attempt keeps its full duration past the window end", async () => {
    const exam = await publishedExam({ endDate: new Date(Date.now() + 10 * 60_000).toISOString() });
    const s = String((await createStudentUser())._id);
    const before = Date.now();
    const { attemptId } = await startAttempt(exam._id, s);
    const a = await Attempt.findById(attemptId).lean();
    expect(new Date(a!.deadlineAt).getTime()).toBeGreaterThanOrEqual(before + 60 * 60_000 - 1000);
    expect(new Date(a!.deadlineAt).getTime()).toBeGreaterThan(new Date(exam.endDate).getTime());
  });
});
