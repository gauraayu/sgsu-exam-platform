import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Types } from "mongoose";
import { setupTestDb, teardownTestDb } from "../helpers/db";
import { createAdminUser } from "../helpers/fixtures";
import { Question, ImportBatch } from "@/models";
import { LOCAL_DATASET_MAPPING } from "@/lib/dataset/normalize";

let adminId: Types.ObjectId;
const GENERATED = ["physics/sgsu_generated.jsonl", "chemistry/sgsu_generated.jsonl", "mathematics/sgsu_generated.jsonl", "physics/sgsu_generated_2.jsonl", "chemistry/sgsu_generated_2.jsonl", "mathematics/sgsu_generated_2.jsonl"];
const ALL = ["physics/train.jsonl", "physics/test.jsonl", "chemistry/train.jsonl", "chemistry/test.jsonl", "mathematics/train.jsonl", "mathematics/test.jsonl"];

async function svc() {
  const local = await import("@/services/local-dataset.service");
  const imp = await import("@/services/import.service");
  return { ...local, ...imp };
}

beforeAll(async () => {
  await setupTestDb("local");
  adminId = (await createAdminUser())._id;
});
afterAll(teardownTestDb);

describe("local JSONL dataset import (real provided files)", () => {
  it("detects all subject files", async () => {
    const { listLocalDatasets } = await svc();
    const listing = await listLocalDatasets();
    expect(listing.subjects.map((s) => [s.subject, s.present, s.files.length])).toEqual([
      ["Physics", true, 4],
      ["Chemistry", true, 4],
      ["Mathematics", true, 4],
      ["Quantitative Aptitude", true, 2],
      ["Logical Reasoning", true, 2],
      ["Verbal Ability", true, 1],
    ]);
    const files = listing.subjects.flatMap((s) => s.files);
    const pcm = listing.subjects.slice(0, 3).flatMap((s) => s.files);
    expect(pcm.filter((f) => !f.filename.startsWith("sgsu_")).reduce((a, f) => a + f.recordCount, 0)).toBe(2307);
    expect(pcm.filter((f) => f.filename.startsWith("sgsu_")).map((f) => f.recordCount)).toEqual([520, 160, 520, 160, 520, 160]);
    expect(files.filter((f) => f.filename === "aptitude_platform.jsonl").map((f) => f.recordCount)).toEqual([279, 275]);
    expect(listing.subjects.slice(3).map((s) => s.files.find((f) => f.filename === "sgsu_generated.jsonl")?.recordCount)).toEqual([200, 200, 145]);
  });

  it("previews without writing", async () => {
    const { loadLocalFiles, analyzeImport } = await svc();
    const { inputs, ambiguousImages } = loadLocalFiles(ALL);
    const a = await analyzeImport(inputs, { sourceType: "local_dataset", mapping: LOCAL_DATASET_MAPPING, ambiguousImages });
    expect(a.stats.totalRecords).toBe(2307);
    expect(a.stats.rejected).toBe(8); // records with empty question text
    expect(a.stats.validRecords).toBe(2299);
    expect(a.stats.numericalQuestions).toBe(518);
    expect(a.stats.duplicates).toBeGreaterThan(0);
    expect(a.stats.missingAnswerKeys).toBeGreaterThan(0);
    expect(a.stats.missingImages).toBeGreaterThan(0);
    expect(a.stats.ambiguousImages).toBeGreaterThan(0);
    expect(await Question.countDocuments()).toBe(0);
  });

  it("imports valid records as Pending Review and is idempotent", async () => {
    const { loadLocalFiles, commitImport } = await svc();
    const run = () => {
      const { inputs, ambiguousImages } = loadLocalFiles(ALL);
      return commitImport(inputs, { sourceType: "local_dataset", mapping: LOCAL_DATASET_MAPPING, ambiguousImages }, { userId: adminId });
    };
    const first = await run();
    const inserted = first.stats.successfullyImported;
    expect(inserted).toBe(2299 - first.stats.duplicates);
    expect(await Question.countDocuments()).toBe(inserted);
    expect(await Question.countDocuments({ verificationStatus: { $ne: "pending" } })).toBe(0);
    expect(await Question.countDocuments({ subject: "Physics" })).toBeGreaterThan(700);

    const second = await run();
    expect(second.stats.successfullyImported).toBe(0);
    expect(second.stats.alreadyImported).toBe(inserted);
    expect(await Question.countDocuments()).toBe(inserted);
    expect(await ImportBatch.countDocuments()).toBe(2);
  });

  it("stores normalised fields correctly", async () => {
    const q = await Question.findOne({ originalQuestionId: "P-20-Q7", sourceFile: "physics/train.jsonl" }).lean();
    expect(q).toBeTruthy();
    expect(q!.correctOption).toBe(1);
    expect(q!.options).toHaveLength(4);
    expect(q!.questionImages).toEqual(["/questions/physics/images/image17.png"]);
    expect(q!.difficulty).toBe("Easy");
    // image17.png is referenced by 18 different physics papers → cannot be trusted automatically
    expect(q!.issues).toContain("ambiguous_image");
    expect(q!.assetStatus).toBe("missing");
    const numerical = await Question.findOne({ questionType: "numerical" }).lean();
    expect(numerical!.correctOption).toBeNull();
  });

  it("flags genuinely missing image files (chemistry image12.png is absent from the dataset)", async () => {
    const q = await Question.findOne({ questionImages: "/questions/chemistry/images/image12.png" }).lean();
    expect(q!.issues).toContain("missing_image_file");
    expect(q!.missingAssets.join()).toContain("image12.png");
  });

  it("does not guess unclassified difficulties", async () => {
    const n = await Question.countDocuments({ difficulty: "Unclassified" });
    expect(n).toBeGreaterThan(200);
    const bad = await Question.countDocuments({ difficulty: "Unclassified", issues: { $ne: "unclassified_difficulty" } });
    expect(bad).toBe(0);
  });

  it("curation policy: removes unusable questions, applies AI keys/difficulty, and imports generated questions", async () => {
    const { loadLocalFiles, commitImport, readCuration } = await svc();
    await Question.deleteMany({});
    const { inputs, ambiguousImages } = loadLocalFiles([...ALL, ...GENERATED]);
    const r = await commitImport(inputs, { sourceType: "local_dataset", mapping: LOCAL_DATASET_MAPPING, ambiguousImages, curation: readCuration(), removeUnusable: true }, { userId: adminId });
    expect(r.stats.removedByCuration).toBeGreaterThan(1000);
    expect(r.stats.aiAnswerKeys).toBe(22);
    expect(r.stats.aiDifficulty).toBe(263);
    // Nothing unusable survives: no missing/unverifiable figures, no keyless MCQs, no unclassified difficulty.
    expect(await Question.countDocuments({ issues: { $in: ["ambiguous_image", "missing_image_file", "image_reference_missing", "missing_answer_key", "incomplete_options", "unclassified_difficulty"] } })).toBe(0);
    expect(await Question.countDocuments({ originalQuestionId: "P-20-Q7", sourceFile: "physics/train.jsonl" })).toBe(0);
    for (const subject of ["Physics", "Chemistry", "Mathematics"]) {
      expect(await Question.countDocuments({ subject, sourceFile: /sgsu_generated\.jsonl/ })).toBe(520);
      expect(await Question.countDocuments({ subject, sourceFile: /sgsu_generated_2/ })).toBe(160);
      expect(await Question.countDocuments({ subject, sourceFile: /sgsu_generated_2/, difficulty: "Hard" })).toBe(110);
    }
    expect(await Question.countDocuments({ curationNotes: /AI reviewer/ })).toBeGreaterThanOrEqual(22);
  });

  it("imports the aptitude datasets: unverifiable source answers stay in the bank but out of exams", async () => {
    const { loadLocalFiles, commitImport, readCuration } = await svc();
    const APT = ["quantitative-aptitude/aptitude_platform.jsonl", "logical-reasoning/aptitude_platform.jsonl", "quantitative-aptitude/sgsu_generated.jsonl", "logical-reasoning/sgsu_generated.jsonl", "verbal-ability/sgsu_generated.jsonl"];
    const { inputs, ambiguousImages } = loadLocalFiles(APT);
    const r = await commitImport(inputs, { sourceType: "local_dataset", mapping: LOCAL_DATASET_MAPPING, ambiguousImages, curation: readCuration(), removeUnusable: true }, { userId: adminId });
    expect(r.stats.excludedForReview).toBe(162);
    const excluded = await Question.find({ sourceFile: /aptitude_platform/, verificationStatus: "rejected" }).lean();
    expect(excluded).toHaveLength(162);
    expect(excluded.every((q) => q.rejectionReason.startsWith("Kept out of exams:"))).toBe(true);
    expect(await Question.countDocuments({ sourceFile: /aptitude_platform/, verificationStatus: { $ne: "rejected" } })).toBe(392);
    for (const [subject, n] of [["Quantitative Aptitude", 200], ["Logical Reasoning", 200], ["Verbal Ability", 145]] as const) {
      expect(await Question.countDocuments({ subject, sourceFile: /sgsu_generated/, issues: { $size: 0 } })).toBe(n);
    }
    // No "$" currency sign survives unescaped (it would be read as LaTeX).
    const withDollar = await Question.find({ sourceFile: /aptitude_platform/, questionText: /(^|[^\\])\$/ }).countDocuments();
    expect(withDollar).toBe(0);
  });

  it("rejects unknown or traversal file ids", async () => {
    const { loadLocalFiles } = await svc();
    expect(() => loadLocalFiles(["biology/train.jsonl"])).toThrow();
    expect(() => loadLocalFiles(["physics/../../.env.local"])).toThrow();
  });
});

describe("missing subjects, invalid rows and change detection (temporary data dir)", () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sgsu-data-"));
    fs.mkdirSync(path.join(dir, "physics"));
    const rec = (id: string, q: string, ans: string) =>
      JSON.stringify({ question_id: id, question: q, question_images: "[]", option_1: "1", option_2: "2", option_3: "3", option_4: "4", correct_option: ans, numerical_answer: "None", solution: "", solution_images: "[]", subject: "Physics", topic: "T", subtopic: "", difficulty: "Easy", question_type: "single_correct", has_image: "False", exam: "JEE", source_paper: "X" });
    fs.writeFileSync(path.join(dir, "physics", "train.jsonl"), [rec("A1", "Alpha question?", "1"), "", "{not json", rec("A2", "Beta question?", "2")].join("\n"));
    process.env.SGSU_DATA_DIR = dir;
  });
  afterAll(() => {
    delete process.env.SGSU_DATA_DIR;
  });

  it("reports subjects without files as not present and handles invalid rows", async () => {
    const { vi } = await import("vitest");
    vi.resetModules();
    const local = await import("@/services/local-dataset.service");
    const imp = await import("@/services/import.service");
    const listing = await local.listLocalDatasets();
    expect(listing.subjects.find((s) => s.subject === "Chemistry")!.present).toBe(false);
    expect(listing.subjects.find((s) => s.subject === "Physics")!.files[0].recordCount).toBe(3);

    const before = await Question.countDocuments();
    const { inputs, ambiguousImages } = local.loadLocalFiles(["physics/train.jsonl"]);
    const r = await imp.commitImport(inputs, { sourceType: "local_dataset", mapping: LOCAL_DATASET_MAPPING, ambiguousImages }, { userId: adminId });
    expect(r.stats.rejected).toBe(1);
    expect(r.stats.successfullyImported).toBe(2);
    expect(await Question.countDocuments()).toBe(before + 2);

    // Verify one question, then change its answer key in the source file.
    await Question.updateOne({ originalQuestionId: "A1", sourceFile: "physics/train.jsonl", sourceType: "local_dataset", questionText: "Alpha question?" }, { $set: { verificationStatus: "verified" } });
    const txt = fs.readFileSync(path.join(dir, "physics", "train.jsonl"), "utf8").replace('"correct_option":"1"', '"correct_option":"3"');
    fs.writeFileSync(path.join(dir, "physics", "train.jsonl"), txt);

    const again = local.loadLocalFiles(["physics/train.jsonl"]);
    const noUpdate = await imp.commitImport(again.inputs, { sourceType: "local_dataset", mapping: LOCAL_DATASET_MAPPING }, { userId: adminId });
    expect(noUpdate.stats.changedInSource).toBe(1);
    expect(noUpdate.stats.updated).toBe(0);
    let q = await Question.findOne({ questionText: "Alpha question?" }).lean();
    expect(q!.correctOption).toBe(1);
    expect(q!.verificationStatus).toBe("verified");

    const withUpdate = await imp.commitImport(again.inputs, { sourceType: "local_dataset", mapping: LOCAL_DATASET_MAPPING }, { userId: adminId, updateExisting: true });
    expect(withUpdate.stats.updated).toBe(1);
    q = await Question.findOne({ questionText: "Alpha question?" }).lean();
    expect(q!.correctOption).toBe(3);
    expect(q!.verificationStatus).toBe("pending"); // material change resets verification
    vi.resetModules();
  });
});
