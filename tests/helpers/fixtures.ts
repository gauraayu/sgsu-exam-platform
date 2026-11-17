import { Types } from "mongoose";
import { Question, User } from "@/models";
import { hashPassword } from "@/lib/auth";
import { computeContentHash } from "@/lib/dataset/normalize";
import type { Difficulty, Subject } from "@/lib/constants";

let counter = 0;

export async function createAdminUser(email = `admin${++counter}@test.sgsu`) {
  return User.create({ fullName: "Test Admin", email, passwordHash: await hashPassword("Admin@12345"), role: "ADMIN" });
}

export async function createStudentUser(email?: string) {
  const n = ++counter;
  return User.create({
    fullName: `Student ${n}`,
    email: email ?? `student${n}@test.sgsu`,
    mobile: "9876543210",
    passwordHash: await hashPassword("Student@123"),
    role: "STUDENT",
    studentId: `SGSUTEST${String(n).padStart(5, "0")}`,
    academicLevel: "Class 12",
    institutionName: "Test School",
  });
}

/** Inserts verified single-correct questions with a known answer key (correct option = 1 + i % 4). */
export async function seedVerifiedQuestions(spec: Partial<Record<Subject, Partial<Record<Difficulty, number>>>>, opts: { numerical?: number } = {}) {
  const docs = [];
  for (const [subject, diffs] of Object.entries(spec) as [Subject, Partial<Record<Difficulty, number>>][]) {
    for (const [difficulty, n] of Object.entries(diffs) as [Difficulty, number][]) {
      for (let i = 0; i < n; i++) {
        const questionText = `${subject} ${difficulty} fixture question #${++counter}: evaluate $x^${i}$`;
        const options = ["A", "B", "C", "D"].map((l) => `${l}-${counter}`);
        docs.push({
          originalQuestionId: `FX-${counter}`,
          subject,
          difficulty,
          questionType: "single_correct",
          questionText,
          options,
          correctOption: (counter % 4) + 1,
          explanation: `Because fixture ${counter}`,
          sourceType: "manual",
          contentHash: computeContentHash({ subject, questionType: "single_correct", questionText, options }),
          verificationStatus: "verified",
          assetStatus: "none",
          issues: [],
        });
      }
    }
  }
  for (let i = 0; i < (opts.numerical ?? 0); i++) {
    const questionText = `Numerical fixture #${++counter}`;
    docs.push({
      subject: "Physics",
      difficulty: "Medium",
      questionType: "numerical",
      questionText,
      options: [],
      numericalAnswer: String(counter % 10),
      sourceType: "manual",
      contentHash: computeContentHash({ subject: "Physics", questionType: "numerical", questionText, options: [] }),
      verificationStatus: "verified",
      assetStatus: "none",
      issues: [],
    });
  }
  await Question.insertMany(docs);
  return docs.length;
}

export const oid = () => new Types.ObjectId();
