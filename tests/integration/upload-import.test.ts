import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { setupTestDb, teardownTestDb } from "../helpers/db";
import { createAdminUser, seedVerifiedQuestions } from "../helpers/fixtures";
import { Question, ImportBatch } from "@/models";
import { parseByFormat } from "@/lib/dataset/parse-files";
import { suggestMapping } from "@/lib/dataset/normalize";
import { analyzeImport, commitImport } from "@/services/import.service";

let adminId: Types.ObjectId;
beforeAll(async () => {
  await setupTestDb("upload");
  adminId = (await createAdminUser())._id;
  await seedVerifiedQuestions({ Physics: { Easy: 5 } });
});
afterAll(teardownTestDb);

const CSV = `question_text,option_a,option_b,option_c,option_d,answer,subject,difficulty_level,chapter
"What is the SI unit of force?",Newton,Joule,Watt,Pascal,A,Physics,Easy,Laws of Motion
"pH of pure water at 25°C is",7,1,14,0,A,Chemistry,Moderate,Equilibrium
"No subject row",1,2,3,4,B,,Easy,
"Missing key",1,2,3,4,,Mathematics,Hard,Algebra
`;

describe("admin CSV / JSON / JSONL upload", () => {
  it("maps custom CSV columns, validates and saves without touching existing questions", async () => {
    const parsed = parseByFormat("csv", CSV);
    const mapping = suggestMapping(parsed.columns);
    expect(mapping).toMatchObject({ questionText: "question_text", option1: "option_a", correctAnswer: "answer", difficulty: "difficulty_level", chapter: "chapter" });
    const inputs = [{ file: "bank.csv", rows: parsed.rows, parseErrors: parsed.errors }];
    const preview = await analyzeImport(inputs, { sourceType: "csv_upload", mapping });
    expect(preview.stats).toMatchObject({ totalRecords: 4, validRecords: 3, rejected: 1, missingAnswerKeys: 1 });

    const before = await Question.countDocuments();
    const r = await commitImport(inputs, { sourceType: "csv_upload", mapping }, { userId: adminId, filename: "bank.csv" });
    expect(r.stats.successfullyImported).toBe(3);
    expect(await Question.countDocuments()).toBe(before + 3);
    const q = await Question.findOne({ questionText: /SI unit of force/ }).lean();
    expect(q).toMatchObject({ subject: "Physics", correctOption: 1, difficulty: "Easy", sourceType: "csv_upload", sourceFile: "bank.csv", verificationStatus: "pending", chapter: "Laws of Motion" });
    expect((await Question.findOne({ questionText: /pH of pure water/ }).lean())!.difficulty).toBe("Medium");
    const batch = await ImportBatch.findById(r.batchId).lean();
    expect(batch).toMatchObject({ sourceType: "csv_upload", importedCount: 3, rejectedRecords: 1 });
  });

  it("supports a default subject for files without a subject column", async () => {
    const parsed = parseByFormat("csv", "question,o1,o2,o3,o4,key\nDefault subject question?,a,b,c,d,2\n");
    const mapping = { questionText: "question", option1: "o1", option2: "o2", option3: "o3", option4: "o4", correctAnswer: "key" };
    const r = await commitImport([{ file: "x.csv", rows: parsed.rows, parseErrors: [] }], { sourceType: "csv_upload", mapping, fallbackSubject: "Mathematics" }, { userId: adminId });
    expect(r.stats.successfullyImported).toBe(1);
    expect((await Question.findOne({ questionText: "Default subject question?" }).lean())!.subject).toBe("Mathematics");
  });

  it("imports JSON arrays and JSONL, and skips duplicates of already-imported content", async () => {
    const json = JSON.stringify([{ question: "What is the SI unit of force?", option_1: "Newton", option_2: "Joule", option_3: "Watt", option_4: "Pascal", correct_option: 1, subject: "Physics" }, { question: "JSON only?", option_1: "a", option_2: "b", option_3: "c", option_4: "d", correct_option: 4, subject: "Chemistry", difficulty: "Hard" }]);
    const p1 = parseByFormat("json", json);
    const r1 = await commitImport([{ file: "q.json", rows: p1.rows, parseErrors: p1.errors }], { sourceType: "json_upload", mapping: suggestMapping(p1.columns) }, { userId: adminId });
    expect(r1.stats.successfullyImported).toBe(1);
    expect(r1.stats.alreadyImported).toBe(1);

    const jsonl = '{"question":"Numerical JSONL?","numerical_answer":"12","subject":"Physics","question_type":"numerical","difficulty":"Easy"}\n\n{broken\n';
    const p2 = parseByFormat("jsonl", jsonl);
    const r2 = await commitImport([{ file: "q.jsonl", rows: p2.rows, parseErrors: p2.errors }], { sourceType: "jsonl_upload", mapping: suggestMapping(p2.columns) }, { userId: adminId });
    expect(r2.stats).toMatchObject({ successfullyImported: 1, rejected: 1, numericalQuestions: 1 });
    expect((await Question.findOne({ questionText: "Numerical JSONL?" }).lean())!.numericalAnswer).toBe("12");
  });

  it("can skip flagged records on request", async () => {
    const parsed = parseByFormat("csv", "question,subject,answer\nFlagged only?,Physics,A\n");
    const r = await commitImport([{ file: "f.csv", rows: parsed.rows, parseErrors: [] }], { sourceType: "csv_upload", mapping: { questionText: "question", subject: "subject", correctAnswer: "answer" } }, { userId: adminId, skipFlagged: true });
    expect(r.stats.successfullyImported).toBe(0);
    expect(r.stats.skippedFlagged).toBe(1);
  });
});
