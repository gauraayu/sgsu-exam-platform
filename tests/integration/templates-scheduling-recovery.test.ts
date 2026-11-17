import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestDb, teardownTestDb } from "../helpers/db";
import { createAdminUser, createStudentUser, seedVerifiedQuestions } from "../helpers/fixtures";
import { Attempt, Exam, ExamTemplate } from "@/models";
import { examConfigSchema, examScheduleSchema } from "@/lib/validation/exams";
import { examTemplateSchema } from "@/lib/validation/exam-templates";
import { createExam, generateExamPaper, publishExam, closeExam, updateExamSchedule } from "@/services/exam.service";
import { createTemplate, duplicateTemplate, listTemplates, setTemplateStatus, updateTemplate, getTemplate } from "@/services/exam-template.service";
import { startAttempt, saveAnswers, submitAttempt, syncAttempt, studentAvailability, getAttemptForStudent, recordIntegrityEvent } from "@/services/attempt.service";
import { listAvailableExamsForStudent, studentExamNotices } from "@/services/results.service";
import { registerExamVisit } from "@/models";
import { examLifecycle } from "@/lib/exam/lifecycle";
import { zonedInputToUtc } from "@/lib/timezone";

let adminId: string;

const PCM = {
  name: "PCM Entrance Assessment",
  description: "100-question PCM paper",
  category: "Entrance Assessment",
  totalQuestions: 30,
  subjectDistribution: [
    { subject: "Physics", count: 10 },
    { subject: "Chemistry", count: 10 },
    { subject: "Mathematics", count: 10 },
  ],
  duration: 120,
  markingScheme: { correct: 4, incorrect: 1, unanswered: 0, passingPercentage: 40 },
  schedulingDefaults: { startBehavior: "immediate", accessDurationMinutes: 600, expiryPolicy: "allow_finish", timezone: "Asia/Kolkata" },
};

function examFromTemplate(t: Awaited<ReturnType<typeof getTemplate>>, over: Record<string, unknown> = {}) {
  const start = new Date(Date.now() - 60_000);
  return examConfigSchema.parse({
    title: t.name,
    category: t.category,
    durationMinutes: t.duration,
    totalQuestions: t.totalQuestions,
    startDate: start.toISOString(),
    endDate: new Date(start.getTime() + t.schedulingDefaults!.accessDurationMinutes! * 60_000).toISOString(),
    subjectDistribution: t.subjectDistribution,
    marking: { correct: t.markingScheme!.correct, incorrect: t.markingScheme!.incorrect, unanswered: t.markingScheme!.unanswered },
    passingMarks: Math.round((t.totalQuestions * t.markingScheme!.correct * t.markingScheme!.passingPercentage!) / 100),
    templateId: t.id,
    ...over,
  });
}

async function publishedExam(over: Record<string, unknown> = {}) {
  const exam = await createExam(
    examConfigSchema.parse({
      title: "Schedule Test",
      durationMinutes: 60,
      totalQuestions: 30,
      startDate: new Date(Date.now() - 60_000).toISOString(),
      endDate: new Date(Date.now() + 86_400_000).toISOString(),
      subjectDistribution: [{ subject: "Physics", count: 10 }, { subject: "Chemistry", count: 10 }, { subject: "Mathematics", count: 10 }],
      ...over,
    }),
    adminId,
  );
  await generateExamPaper(String(exam._id), adminId);
  return publishExam(String(exam._id), adminId);
}

beforeAll(async () => {
  await setupTestDb("templates");
  adminId = String((await createAdminUser())._id);
  await seedVerifiedQuestions({ Physics: { Easy: 15, Medium: 15 }, Chemistry: { Easy: 15, Medium: 15 }, Mathematics: { Easy: 15, Medium: 15 } });
});
afterAll(teardownTestDb);
afterEach(() => vi.useRealTimers());

describe("exam templates", () => {
  it("persist, apply to new exams, and later edits never change earlier exams", async () => {
    const t = await createTemplate(examTemplateSchema.parse(PCM), adminId);
    expect(await ExamTemplate.countDocuments({ _id: t.id })).toBe(1);
    expect(t.selectedSubjects).toEqual(["Physics", "Chemistry", "Mathematics"]);

    const exam = await createExam(examFromTemplate(t), adminId);
    expect(String(exam.templateId)).toBe(t.id);
    expect(exam.durationMinutes).toBe(120);
    expect(exam.passingMarks).toBe(48);
    expect((exam.appliedTemplateSnapshot as { duration: number }).duration).toBe(120);

    await updateTemplate(t.id, examTemplateSchema.parse({ ...PCM, duration: 90, markingScheme: { ...PCM.markingScheme, correct: 2 } }), adminId);
    const after = await Exam.findById(exam._id).lean();
    expect(after!.durationMinutes).toBe(120);
    expect(after!.marking!.correct).toBe(4);
    expect((after!.appliedTemplateSnapshot as { duration: number }).duration).toBe(120);
    expect((await getTemplate(t.id)).duration).toBe(90);
  });

  it("duplicates, archives (no longer offered) and restores; only one default", async () => {
    const a = await createTemplate(examTemplateSchema.parse({ ...PCM, name: "Aptitude Assessment", isDefault: true }), adminId);
    const copy = await duplicateTemplate(a.id, adminId);
    expect(copy.name).toBe("Aptitude Assessment (Copy)");
    expect(copy.isDefault).toBe(false);

    await createTemplate(examTemplateSchema.parse({ ...PCM, name: "Semester Assessment", isDefault: true }), adminId);
    expect(await ExamTemplate.countDocuments({ isDefault: true })).toBe(1);

    await setTemplateStatus(copy.id, "archived", adminId);
    expect((await listTemplates("active")).map((x) => x.id)).not.toContain(copy.id);
    await expect(createExam(examFromTemplate(copy), adminId)).rejects.toThrow(/archived/);
    await setTemplateStatus(copy.id, "active", adminId);
    expect((await listTemplates("active")).map((x) => x.id)).toContain(copy.id);
  });

  it("rejects inconsistent templates", () => {
    expect(examTemplateSchema.safeParse({ ...PCM, totalQuestions: 40 }).success).toBe(false);
    expect(examTemplateSchema.safeParse({ ...PCM, subjectDistribution: [] }).success).toBe(false);
  });
});

describe("scheduling and availability (server clock)", () => {
  it("derives Scheduled → Active → Expired from server time; students cannot start early or late", async () => {
    const start = new Date(Date.now() + 2 * 3_600_000);
    const end = new Date(start.getTime() + 3_600_000);
    const exam = await publishedExam({ startDate: start.toISOString(), endDate: end.toISOString() });
    const s = String((await createStudentUser())._id);

    expect(examLifecycle(exam)).toBe("scheduled");
    const early = await studentAvailability(exam, s);
    expect(early.canStart).toBe(false);
    expect(early.message).toMatch(/^This examination is scheduled to begin on .+ at .+ IST\.$/);
    await expect(startAttempt(exam._id, s)).rejects.toThrow(/scheduled to begin/);

    // Controlled clock: jump to just after the start time.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(start.getTime() + 60_000));
    expect((await studentAvailability(exam, s)).lifecycle).toBe("active");
    const { attemptId } = await startAttempt(exam._id, s);

    // After the window: no new attempts, but the started attempt keeps its own deadline.
    vi.setSystemTime(new Date(end.getTime() + 60_000));
    const late = String((await createStudentUser())._id);
    expect((await studentAvailability(exam, late)).message).toBe("This examination is no longer accepting new attempts.");
    await expect(startAttempt(exam._id, late)).rejects.toThrow("This examination is no longer accepting new attempts.");
    const view = await getAttemptForStudent(attemptId, s);
    expect(view.status).toBe("in_progress");
    expect(new Date(view.deadlineAt).getTime()).toBe(start.getTime() + 60_000 + 60 * 60_000);
  });

  it("manual closure blocks new attempts with the administrator message", async () => {
    const exam = await publishedExam();
    await closeExam(String(exam._id), adminId);
    const closed = await Exam.findById(exam._id).lean();
    const s = String((await createStudentUser())._id);
    expect((await studentAvailability(closed!, s)).message).toBe("This examination has been closed by the administrator.");
    await expect(startAttempt(exam._id, s)).rejects.toThrow("This examination has been closed by the administrator.");
  });

  it("edits schedules with the right restrictions; link and code never change", async () => {
    const future = new Date(Date.now() + 86_400_000);
    const exam = await publishedExam({ startDate: future.toISOString(), endDate: new Date(future.getTime() + 3_600_000).toISOString() });
    const id = String(exam._id);
    const later = new Date(future.getTime() + 3_600_000);
    const r = await updateExamSchedule(id, examScheduleSchema.parse({ scheduleMode: "scheduled", startDate: later, endDate: new Date(later.getTime() + 7_200_000), timezone: "Asia/Kolkata", hardEnd: true }), adminId);
    expect(r.lifecycle).toBe("scheduled");
    expect(r.exam.shareToken).toBe(exam.shareToken);
    expect(r.exam.accessCode).toBe(exam.accessCode);
    expect(new Date(r.exam.hardEndAt!).getTime()).toBe(later.getTime() + 7_200_000);

    // Start immediately: opens now.
    const now = await updateExamSchedule(id, examScheduleSchema.parse({ scheduleMode: "immediate", accessValidityMinutes: 30, timezone: "Asia/Kolkata", hardEnd: false }), adminId);
    expect(now.lifecycle).toBe("active");
    expect(now.exam.hardEndAt).toBeNull();
    // Once open, the start cannot move.
    await expect(
      updateExamSchedule(id, examScheduleSchema.parse({ scheduleMode: "scheduled", startDate: new Date(Date.now() + 86_400_000), endDate: new Date(Date.now() + 2 * 86_400_000), timezone: "Asia/Kolkata" }), adminId),
    ).rejects.toThrow(/already opened/);
  });

  it("converts wall-clock times in the exam's timezone to UTC", () => {
    expect(zonedInputToUtc("2026-11-20T10:00", "Asia/Kolkata")).toBe("2026-11-20T04:30:00.000Z");
    expect(zonedInputToUtc("2026-11-20T10:00", "UTC")).toBe("2026-11-20T10:00:00.000Z");
    expect(zonedInputToUtc("2026-07-01T09:00", "Europe/London")).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedInputToUtc("2026-12-01T09:00", "America/New_York")).toBe("2026-12-01T14:00:00.000Z");
  });

  it("lists only exams the student opened by link or code, with notices", async () => {
    const soon = new Date(Date.now() + 3_600_000);
    const hidden = await publishedExam({ title: "Hidden exam" });
    const scheduled = await publishedExam({ title: "Upcoming exam", startDate: soon.toISOString(), endDate: new Date(soon.getTime() + 3_600_000).toISOString() });
    const s = String((await createStudentUser())._id);
    expect(await listAvailableExamsForStudent(s)).toHaveLength(0);
    await registerExamVisit(scheduled._id, s);
    const list = await listAvailableExamsForStudent(s);
    expect(list.map((e) => e.title)).toEqual(["Upcoming exam"]);
    expect(list.map((e) => e.title)).not.toContain(hidden.title);
    const notices = await studentExamNotices(s);
    expect(notices[0]).toMatchObject({ kind: "upcoming", examTitle: "Upcoming exam" });
  });
});

describe("answer recovery", () => {
  async function started() {
    const exam = await publishedExam();
    const s = String((await createStudentUser())._id);
    const { attemptId } = await startAttempt(exam._id, s);
    const a = await Attempt.findById(attemptId).lean();
    return { s, attemptId, q: a!.questionOrder.map((x: { examQuestionId: unknown }) => String(x.examQuestionId)) };
  }

  it("ignores stale and out-of-order updates; retries are idempotent", async () => {
    const { s, attemptId, q } = await started();
    await saveAnswers(attemptId, s, [{ examQuestionId: q[0], selectedOption: 2, seq: 5 }]);
    // An older request arriving late must not overwrite the newer answer.
    const late = await saveAnswers(attemptId, s, [{ examQuestionId: q[0], selectedOption: 1, seq: 3 }]);
    expect(late.applied).toEqual([]);
    expect(late.stale[q[0]].selectedOption).toBe(2);
    // The same request replayed (lost acknowledgement) changes nothing.
    const replay = await saveAnswers(attemptId, s, [{ examQuestionId: q[0], selectedOption: 2, seq: 5 }]);
    expect(replay.applied).toEqual([]);
    const a = await Attempt.findById(attemptId).lean();
    expect((a!.answers as unknown as Record<string, { selectedOption: number }>)[q[0]].selectedOption).toBe(2);
  });

  it("concurrent rapid saves keep the newest answer per question", async () => {
    const { s, attemptId, q } = await started();
    const writes = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2].map((opt, i) => ({ examQuestionId: q[1], selectedOption: opt, seq: i + 1 }));
    // Deliberately send them in reverse order and all at once.
    await Promise.all([...writes].reverse().map((w) => saveAnswers(attemptId, s, [w])));
    const a = await Attempt.findById(attemptId).lean();
    const ans = (a!.answers as unknown as Record<string, { selectedOption: number; seq: number }>)[q[1]];
    expect(ans.seq).toBe(10);
    expect(ans.selectedOption).toBe(2);
  });

  it("sync applies queued answers, keeps warnings, and rejects changes after the attempt ended", async () => {
    const { s, attemptId, q } = await started();
    await recordIntegrityEvent(attemptId, s, { eventType: "tab_hidden", clientEventId: "w-1" });
    const r = await syncAttempt(attemptId, s, [{ examQuestionId: q[2], selectedOption: 3, seq: 1 }]);
    expect(r.applied).toEqual([q[2]]);
    expect(r.answers[q[2]].selectedOption).toBe(3);
    expect(r.warningCount).toBe(1);

    const first = await submitAttempt(attemptId, s);
    const second = await submitAttempt(attemptId, s); // retried submit
    expect(second.alreadyFinalized).toBe(true);
    expect(first.status).toBe(second.status);
    const after = await syncAttempt(attemptId, s, [{ examQuestionId: q[3], selectedOption: 1, seq: 2 }]);
    expect(after.status).toBe("submitted");
    expect(after.rejected).toEqual([q[3]]);
    expect(after.answers[q[3]]).toBeUndefined();
  });

  it("another student cannot sync someone else's attempt", async () => {
    const { attemptId, q } = await started();
    const other = String((await createStudentUser())._id);
    await expect(syncAttempt(attemptId, other, [{ examQuestionId: q[0], selectedOption: 1, seq: 1 }])).rejects.toThrow(/another student/);
  });
});
