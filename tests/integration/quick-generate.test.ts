import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb, teardownTestDb } from "../helpers/db";
import { createAdminUser, seedVerifiedQuestions } from "../helpers/fixtures";
import { Exam, ExamDefaultConfiguration, ExamQuestion } from "@/models";
import { getDefaultConfiguration, quickGenerateExam, saveDefaultConfiguration } from "@/services/exam-defaults.service";
import { duplicateExam, ensureAccessCode, getExamByAccessCode, getExamByToken, publishExam } from "@/services/exam.service";
import type { ExamDefaultsInput } from "@/lib/validation/exam-defaults";

let adminId: string;
beforeAll(async () => {
  await setupTestDb("quick");
  adminId = String((await createAdminUser())._id);
  await seedVerifiedQuestions({
    Physics: { Easy: 20, Medium: 25, Hard: 15 },
    Chemistry: { Easy: 20, Medium: 25, Hard: 15 },
    Mathematics: { Easy: 20, Medium: 25, Hard: 15 },
    "Quantitative Aptitude": { Easy: 10, Medium: 10, Hard: 5 },
  });
});
afterAll(teardownTestDb);

const paperOf = async (id: string) => {
  const e = await Exam.findById(id).lean();
  return ExamQuestion.find({ examId: id, examVersion: e!.version }).lean();
};

describe("default examination settings", () => {
  it("are created once with the documented starting values and persist edits", async () => {
    const c = await getDefaultConfiguration();
    expect(c).toMatchObject({ totalQuestions: 100, durationMinutes: 120, difficultyPercent: { Easy: 30, Medium: 45, Hard: 25 }, passingPercentage: 40, defaultValidityDays: 7 });
    expect(c.presets.find((p) => p.name === "PCM")?.counts).toEqual({ Physics: 35, Chemistry: 35, Mathematics: 30 });
    expect(await ExamDefaultConfiguration.countDocuments()).toBe(1);
    await getDefaultConfiguration();
    expect(await ExamDefaultConfiguration.countDocuments()).toBe(1);
  });
});

describe("Quick Generate", () => {
  let firstId: string;
  it("creates a draft with exact subject and difficulty distributions from the saved defaults", async () => {
    const cfg = await getDefaultConfiguration();
    const { id: cid, updatedAt, createdAt, ...rest } = cfg;
    void cid; void updatedAt; void createdAt;
    await saveDefaultConfiguration({ ...(rest as ExamDefaultsInput), totalQuestions: 60, durationMinutes: 90 }, adminId);

    const r = await quickGenerateExam(["Mathematics", "Physics", "Chemistry"], adminId);
    firstId = r.id;
    expect(r.title).toBe("SGSU PCM Entrance Assessment");
    const exam = await Exam.findById(r.id).lean();
    expect(exam).toMatchObject({ status: "draft", generationMode: "quick", totalQuestions: 60, durationMinutes: 90, selectedSubjects: ["Physics", "Chemistry", "Mathematics"] });
    expect(exam!.appliedConfigurationSnapshot).toMatchObject({ totalQuestions: 60, durationMinutes: 90 });
    expect(+exam!.endDate - +exam!.startDate).toBe(7 * 86_400_000);
    expect(exam!.passingMarks).toBe(96); // 40% of 60 × 4
    const paper = await paperOf(r.id);
    expect(paper).toHaveLength(60);
    const by = (k: "subject" | "difficulty") => paper.reduce<Record<string, number>>((a, p) => ((a[p.questionSnapshot![k]!] = (a[p.questionSnapshot![k]!] ?? 0) + 1), a), {});
    expect(by("subject")).toEqual({ Physics: 21, Chemistry: 21, Mathematics: 18 });
    expect(by("difficulty")).toEqual({ Easy: 18, Medium: 27, Hard: 15 });
    expect(new Set(paper.map((p) => String(p.questionId))).size).toBe(60);
  });

  it("gives a second exam with the same subjects a distinct title", async () => {
    const r = await quickGenerateExam(["Physics", "Chemistry", "Mathematics"], adminId);
    expect(r.title).toMatch(/^SGSU PCM Entrance Assessment · \d{1,2} \w{3} \d{4}$/);
  });

  it("uses changed defaults for new exams and leaves existing exams unchanged", async () => {
    const cfg = await getDefaultConfiguration();
    const { id, updatedAt, createdAt, ...rest } = cfg;
    void id; void updatedAt; void createdAt;
    await saveDefaultConfiguration({ ...(rest as ExamDefaultsInput), totalQuestions: 30, durationMinutes: 45, marking: { correct: 2, incorrect: 0.5, unanswered: 0 } }, adminId);
    const r = await quickGenerateExam(["Physics"], adminId);
    const fresh = await Exam.findById(r.id).lean();
    expect(fresh).toMatchObject({ totalQuestions: 30, durationMinutes: 45, marking: { correct: 2, incorrect: 0.5 } });
    expect((await paperOf(r.id)).every((p) => p.questionSnapshot!.subject === "Physics")).toBe(true);
    const old = await Exam.findById(firstId).lean();
    expect(old).toMatchObject({ totalQuestions: 60, durationMinutes: 90, marking: { correct: 4, incorrect: 1 } });
  });

  it("reports the exact shortage and keeps nothing when the bank is too small", async () => {
    const before = await Exam.countDocuments();
    await expect(quickGenerateExam(["Quantitative Aptitude"], adminId)).rejects.toThrow(/Only 25 usable Quantitative Aptitude questions/);
    expect(await Exam.countDocuments()).toBe(before);
  });
});

describe("exam link and access code", () => {
  it("are created once at publish, resolve to the same exam, and never change", async () => {
    const r = await quickGenerateExam(["Chemistry"], adminId);
    const pub = await publishExam(r.id, adminId);
    expect(pub.accessCode).toMatch(/^SGSU-[A-Z2-9]{6}$/);
    expect(pub.shareToken).toBeTruthy();
    const byCode = await getExamByAccessCode(pub.accessCode!.toLowerCase().replace("-", " "));
    const byToken = await getExamByToken(pub.shareToken!);
    expect(String(byCode!._id)).toBe(r.id);
    expect(String(byToken!._id)).toBe(r.id);
    // reading again (share modal, refresh, re-login) returns the same code
    expect(await ensureAccessCode(r.id)).toBe(pub.accessCode);
    expect(await ensureAccessCode(r.id)).toBe(pub.accessCode);
    // a duplicate is a new draft without the original's link or code
    const copy = await duplicateExam(r.id, adminId);
    expect(copy.accessCode).toBeUndefined();
    expect(copy.shareToken).toBeUndefined();
    expect(await getExamByAccessCode("SGSU-AAAAAA")).toBeNull();
  });

  it("backfills a code (once) for exams published before codes existed", async () => {
    const r = await quickGenerateExam(["Mathematics"], adminId);
    await publishExam(r.id, adminId);
    await Exam.updateOne({ _id: r.id }, { $unset: { accessCode: 1 } });
    const c1 = await ensureAccessCode(r.id);
    const c2 = await ensureAccessCode(r.id);
    expect(c1).toMatch(/^SGSU-/);
    expect(c2).toBe(c1);
  });
});
