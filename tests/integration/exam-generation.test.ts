import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { setupTestDb, teardownTestDb } from "../helpers/db";
import { createAdminUser, seedVerifiedQuestions } from "../helpers/fixtures";
import { Exam, ExamQuestion, Question } from "@/models";
import { examConfigSchema } from "@/lib/validation/exams";
import { createExam, generateExamPaper, publishExam, replaceExamQuestion, getExamForAdmin, duplicateExam } from "@/services/exam.service";

let adminId: string;
beforeAll(async () => {
  await setupTestDb("gen");
  adminId = String((await createAdminUser())._id);
  await seedVerifiedQuestions({
    Physics: { Easy: 15, Medium: 20, Hard: 10 },
    Chemistry: { Easy: 8, Medium: 8, Hard: 4 }, // only 20 Chemistry questions
    Mathematics: { Easy: 12, Medium: 20, Hard: 13 },
  });
  // Imported (pending) questions are usable; flagged questions must never be selected.
  await Question.create({ subject: "Physics", difficulty: "Easy", questionType: "single_correct", questionText: "pending q", options: ["a", "b", "c", "d"], correctOption: 1, sourceType: "manual", contentHash: "pending-1", verificationStatus: "pending" });
  await Question.create({ subject: "Physics", difficulty: "Easy", questionType: "single_correct", questionText: "missing asset q", options: ["a", "b", "c", "d"], correctOption: 1, sourceType: "manual", contentHash: "asset-1", verificationStatus: "verified", assetStatus: "missing", issues: ["missing_image_file"] });
});
afterAll(teardownTestDb);

const now = Date.now();
function config(over: Record<string, unknown>) {
  return examConfigSchema.parse({
    title: "SGSU PCM Entrance Assessment",
    durationMinutes: 120,
    totalQuestions: 10,
    startDate: new Date(now - 60_000).toISOString(),
    endDate: new Date(now + 86_400_000).toISOString(),
    passingMarks: 0,
    subjectDistribution: [{ subject: "Physics", count: 10 }],
    ...over,
  });
}

async function paperOf(examId: string) {
  const exam = await Exam.findById(examId).lean();
  return ExamQuestion.find({ examId, examVersion: exam!.version }).lean();
}

describe("exam generator", () => {
  it.each([5, 10, 50])("generates a %i-question exam with exact counts and no duplicates", async (n) => {
    const p = Math.ceil(n / 3), c = Math.floor(n / 3), m = n - p - c;
    const exam = await createExam(config({ totalQuestions: n, subjectDistribution: [{ subject: "Physics", count: p }, { subject: "Chemistry", count: c }, { subject: "Mathematics", count: m }] }), adminId);
    await generateExamPaper(String(exam._id), adminId);
    const paper = await paperOf(String(exam._id));
    expect(paper).toHaveLength(n);
    expect(new Set(paper.map((q) => String(q.questionId))).size).toBe(n);
    const count = (s: string) => paper.filter((q) => q.questionSnapshot!.subject === s).length;
    expect([count("Physics"), count("Chemistry"), count("Mathematics")]).toEqual([p, c, m]);
    const ids = paper.map((q) => q.questionId);
    expect(await Question.countDocuments({ _id: { $in: ids }, verificationStatus: { $ne: "rejected" }, issues: { $size: 0 } })).toBe(n);
  });

  it("generates a 100-question exam with exact subject AND difficulty distributions", async () => {
    // Pool: P 45, C 20, M 45 = 110. Request P 45 / C 20 / M 35 with Easy 30 / Medium 45 / Hard 25.
    const exam = await createExam(
      config({
        totalQuestions: 100,
        subjectDistribution: [{ subject: "Physics", count: 45 }, { subject: "Chemistry", count: 20 }, { subject: "Mathematics", count: 35 }],
        difficultyDistribution: { Easy: 30, Medium: 45, Hard: 25 },
      }),
      adminId,
    );
    await generateExamPaper(String(exam._id), adminId);
    const paper = await paperOf(String(exam._id));
    expect(paper).toHaveLength(100);
    const d = (x: string) => paper.filter((q) => q.questionSnapshot!.difficulty === x).length;
    expect([d("Easy"), d("Medium"), d("Hard")]).toEqual([30, 45, 25]);
    expect(paper.filter((q) => q.questionSnapshot!.subject === "Chemistry")).toHaveLength(20);
    // Grouped by subject in Physics → Chemistry → Mathematics order.
    const order = paper.sort((a, b) => a.displayOrder - b.displayOrder).map((q) => q.questionSnapshot!.subject);
    expect(order.indexOf("Chemistry")).toBe(45);
    expect(order.indexOf("Mathematics")).toBe(65);
  });

  it("honours subject-specific difficulty selection", async () => {
    const exam = await createExam(config({ totalQuestions: 6, subjectDistribution: [{ subject: "Physics", count: 6, difficulty: { Easy: 1, Medium: 2, Hard: 3 } }] }), adminId);
    await generateExamPaper(String(exam._id), adminId);
    const paper = await paperOf(String(exam._id));
    expect(paper.filter((q) => q.questionSnapshot!.difficulty === "Hard")).toHaveLength(3);
  });

  it("refuses to fabricate questions when the pool is insufficient", async () => {
    const exam = await createExam(config({ totalQuestions: 35, subjectDistribution: [{ subject: "Chemistry", count: 35 }] }), adminId);
    await expect(generateExamPaper(String(exam._id), adminId)).rejects.toThrow(
      "Only 20 usable Chemistry questions are available for the selected filters. Please add more questions or adjust the distribution.",
    );
    expect(await ExamQuestion.countDocuments({ examId: exam._id })).toBe(0);
  });

  it("rejects mismatched totals at validation time", () => {
    expect(() => config({ totalQuestions: 10, subjectDistribution: [{ subject: "Physics", count: 7 }] })).toThrow(/add up to 7/);
    expect(() => config({ totalQuestions: 10, difficultyDistribution: { Easy: 1, Medium: 1, Hard: 1 } })).toThrow(/add up to 3/);
  });

  it("replaces a question with another of the same subject/difficulty, regenerates, publishes and freezes the paper", async () => {
    const exam = await createExam(config({ totalQuestions: 5, difficultyDistribution: { Easy: 5, Medium: 0, Hard: 0 }, subjectDistribution: [{ subject: "Physics", count: 5 }] }), adminId);
    const id = String(exam._id);
    await generateExamPaper(id, adminId);
    const [first] = await paperOf(id);
    const replaced = await replaceExamQuestion(id, String(first._id), adminId);
    expect(String(replaced.questionId)).not.toBe(String(first.questionId));
    expect(replaced.questionSnapshot!.difficulty).toBe("Easy");
    const ids = (await paperOf(id)).map((q) => String(q.questionId));
    expect(new Set(ids).size).toBe(5);

    await generateExamPaper(id, adminId); // regenerate draft
    expect((await Exam.findById(id).lean())!.version).toBe(2);
    expect(await ExamQuestion.countDocuments({ examId: exam._id })).toBe(5);

    const published = await publishExam(id, adminId);
    expect(published.shareToken).toMatch(/^sgsu-pcm-entrance-assessment-[a-z0-9]{6}$/);
    await expect(generateExamPaper(id, adminId)).rejects.toThrow(/frozen/);
    await expect(replaceExamQuestion(id, String(first._id), adminId)).rejects.toThrow(/draft/);
    const detail = await getExamForAdmin(id);
    expect(detail.paper[0].answerKeySnapshot!.correctOption).toBeGreaterThan(0); // admin sees answers

    const copy = await duplicateExam(id, adminId);
    expect(copy.status).toBe("draft");
    expect(copy.shareToken).toBeUndefined();
    expect(await ExamQuestion.countDocuments({ examId: copy._id })).toBe(5);
  });

  it("blocks publishing when a selected question is rejected after generation", async () => {
    const exam = await createExam(config({ totalQuestions: 3, subjectDistribution: [{ subject: "Mathematics", count: 3 }] }), adminId);
    await generateExamPaper(String(exam._id), adminId);
    const [q] = await paperOf(String(exam._id));
    await Question.updateOne({ _id: q.questionId }, { $set: { verificationStatus: "rejected" } });
    await expect(publishExam(String(exam._id), adminId)).rejects.toThrow(/no longer usable/);
    await Question.updateOne({ _id: q.questionId }, { $set: { verificationStatus: "verified" } });
  });

  it("supports numerical questions only when enabled", async () => {
    await seedVerifiedQuestions({}, { numerical: 5 });
    // The whole pool (46 MCQ + 5 numerical) is requested, so every numerical question must be picked.
    const exam = await createExam(config({ totalQuestions: 51, subjectDistribution: [{ subject: "Physics", count: 51 }], selection: { includeNumerical: true } }), adminId);
    await generateExamPaper(String(exam._id), adminId);
    const paper = await paperOf(String(exam._id));
    const num = paper.filter((q) => q.questionSnapshot!.questionType === "numerical");
    expect(num).toHaveLength(5);
    for (const q of num) expect(q.questionSnapshot!.options).toEqual([]);
    const off = await createExam(config({ totalQuestions: 50, subjectDistribution: [{ subject: "Physics", count: 50 }] }), adminId);
    await expect(generateExamPaper(String(off._id), adminId)).rejects.toThrow(/Only 46 usable Physics/);
  });

  it("uses imported questions without a review step, but never rejected or archived ones", async () => {
    await Question.updateMany({ subject: "Chemistry" }, { $set: { verificationStatus: "pending" } });
    const exam = await createExam(config({ totalQuestions: 10, subjectDistribution: [{ subject: "Chemistry", count: 10 }] }), adminId);
    await generateExamPaper(String(exam._id), adminId);
    expect(await paperOf(String(exam._id))).toHaveLength(10);
    const total = await Question.countDocuments({ subject: "Chemistry", issues: { $size: 0 }, assetStatus: { $ne: "missing" }, archived: false, questionType: "single_correct" });
    await Question.updateMany({ subject: "Chemistry" }, { $set: { verificationStatus: "rejected" } });
    const blocked = await createExam(config({ totalQuestions: 10, subjectDistribution: [{ subject: "Chemistry", count: 10 }] }), adminId);
    await expect(generateExamPaper(String(blocked._id), adminId)).rejects.toThrow(/Only 0 usable Chemistry/);
    await Question.updateMany({ subject: "Chemistry" }, { $set: { verificationStatus: "verified" } });
    expect(total).toBeGreaterThanOrEqual(10);
  });

  it("supports manual selection", async () => {
    const qs = await Question.find({ subject: "Mathematics", verificationStatus: "verified" }).limit(4).lean();
    const exam = await createExam(config({ totalQuestions: 4, subjectDistribution: [], selection: { mode: "manual", manualQuestionIds: qs.map((q) => String(q._id)) } }), adminId);
    await generateExamPaper(String(exam._id), adminId);
    expect((await paperOf(String(exam._id))).map((p) => String(p.questionId)).sort()).toEqual(qs.map((q) => String(q._id)).sort());
    void Types;
  });
});
