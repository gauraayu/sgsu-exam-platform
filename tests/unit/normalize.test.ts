import { describe, expect, it } from "vitest";
import {
  applyMapping,
  computeContentHash,
  findAmbiguousImages,
  LOCAL_DATASET_MAPPING,
  normalizeCorrectOption,
  normalizeDifficulty,
  normalizeNumericalAnswer,
  normalizeQuestion,
  normalizeQuestionType,
  normalizeSubject,
  parseBoolean,
  parseNullable,
  parseStringList,
  resolveImagePath,
  suggestMapping,
} from "@/lib/dataset/normalize";

const exists = (set: string[]) => (p: string) => set.includes(p);

describe("string-encoded value parsing", () => {
  it("converts None/null/empty to null", () => {
    expect(parseNullable("None")).toBeNull();
    expect(parseNullable(" null ")).toBeNull();
    expect(parseNullable("")).toBeNull();
    expect(parseNullable(null)).toBeNull();
    expect(parseNullable(NaN)).toBeNull();
    expect(parseNullable(" 4 ")).toBe("4");
    expect(parseNullable(3)).toBe("3");
  });
  it("parses booleans from strings", () => {
    expect(parseBoolean("True")).toBe(true);
    expect(parseBoolean("False")).toBe(false);
    expect(parseBoolean(true)).toBe(true);
    expect(parseBoolean("None")).toBeNull();
    expect(parseBoolean("maybe")).toBeNull();
  });
  it("parses Python-style list literals safely without eval", () => {
    expect(parseStringList("['images/image17.png']")).toEqual(["images/image17.png"]);
    expect(parseStringList(`['images/a.png', "images/b.png"]`)).toEqual(["images/a.png", "images/b.png"]);
    expect(parseStringList("[]")).toEqual([]);
    expect(parseStringList(["images/x.png", null, "None"])).toEqual(["images/x.png"]);
    expect(parseStringList("None")).toEqual([]);
    expect(parseStringList("a.png; b.png")).toEqual(["a.png", "b.png"]);
    // Code-like input is treated as data, never executed.
    expect(parseStringList("[__import__('os').system('x')]")).toEqual(["__import__('os').system('x')"]);
  });
});

describe("difficulty normalisation", () => {
  it.each([
    ["Easy", "Easy"],
    ["Moderate", "Medium"],
    ["Medium", "Medium"],
    ["Difficult", "Hard"],
    ["Hard", "Hard"],
    ["Tough", "Hard"],
    ["tough", "Hard"],
    ["Easy]", "Easy"],
    ["Moderate]", "Medium"],
  ])("%s → %s", (input, expected) => expect(normalizeDifficulty(input)).toBe(expected));
  it.each([[""], ["Easy / Moderate/ Tough"], ["Modertae"], ["Moderate/ Tough"], [null]])("does not guess for %s", (input) =>
    expect(normalizeDifficulty(input)).toBe("Unclassified"),
  );
});

describe("answer keys", () => {
  it("accepts numeric and letter forms", () => {
    expect(normalizeCorrectOption("1").value).toBe(1);
    expect(normalizeCorrectOption(4).value).toBe(4);
    expect(normalizeCorrectOption("B").value).toBe(2);
    expect(normalizeCorrectOption("(c)").value).toBe(3);
    expect(normalizeCorrectOption("option_4").value).toBe(4);
    expect(normalizeCorrectOption("Option D").value).toBe(4);
  });
  it("flags out-of-range keys as invalid, missing keys as missing", () => {
    expect(normalizeCorrectOption("5")).toEqual({ value: null, invalid: true });
    expect(normalizeCorrectOption("None")).toEqual({ value: null, invalid: false });
  });
  it("normalises numerical answers", () => {
    expect(normalizeNumericalAnswer("02")).toEqual({ value: "2", invalid: false });
    expect(normalizeNumericalAnswer("2.50")).toEqual({ value: "2.5", invalid: false });
    expect(normalizeNumericalAnswer("abc").invalid).toBe(true);
    expect(normalizeNumericalAnswer(null).value).toBeNull();
  });
  it("normalises subjects and types", () => {
    expect(normalizeSubject("maths")).toBe("Mathematics");
    expect(normalizeSubject("Biology")).toBeNull();
    expect(normalizeQuestionType("MCQ")).toBe("single_correct");
    expect(normalizeQuestionType("integer")).toBe("numerical");
  });
});

describe("image paths", () => {
  it("resolves dataset references to the subject folder", () => {
    expect(resolveImagePath("Physics", "images/image17.png")).toBe("/questions/physics/images/image17.png");
    expect(resolveImagePath("Chemistry", "image3.jpeg")).toBe("/questions/chemistry/images/image3.jpeg");
  });
  it("rejects traversal and non-image files", () => {
    expect(resolveImagePath("Physics", "../../src/data/physics/train.jsonl")).toBeNull();
    expect(resolveImagePath("Physics", "images/x.exe")).toBeNull();
  });
});

const base = {
  question_id: "P-20-Q7",
  question: "The current $I_{1}$ (in A) in the circuit is",
  question_images: "['images/image17.png']",
  option_1: "0.2",
  option_2: "0.4",
  option_3: "0.5",
  option_4: "0.25",
  correct_option: "1",
  numerical_answer: "None",
  solution: "Apply KVL",
  solution_images: "[]",
  subject: "Physics",
  topic: "Current Electricity",
  subtopic: "KVL",
  difficulty: "Easy",
  question_type: "single_correct",
  has_image: "True",
  exam: "JEE Main",
  source_paper: "P-20",
};

describe("normalizeQuestion", () => {
  it("normalises the representative string-encoded record", () => {
    const r = normalizeQuestion(applyMapping(base, LOCAL_DATASET_MAPPING), exists(["/questions/physics/images/image17.png"]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.question.correctOption).toBe(1);
    expect(r.question.numericalAnswer).toBeNull();
    expect(r.question.questionImages).toEqual(["/questions/physics/images/image17.png"]);
    expect(r.question.issues).toEqual([]);
    expect(r.question.assetStatus).toBe("ok");
  });
  it("flags missing image files and excludes them via assetStatus", () => {
    const r = normalizeQuestion(applyMapping(base, LOCAL_DATASET_MAPPING), exists([]));
    expect(r.ok && r.question.issues).toContain("missing_image_file");
    expect(r.ok && r.question.assetStatus).toBe("missing");
  });
  it("flags missing answer keys and incomplete options", () => {
    const r = normalizeQuestion(applyMapping({ ...base, correct_option: "None", option_4: "" , question_images: "[]"}, LOCAL_DATASET_MAPPING), exists([]));
    expect(r.ok && r.question.issues).toEqual(expect.arrayContaining(["missing_answer_key", "incomplete_options"]));
  });
  it("classifies numerical questions and never shows them as MCQs without options", () => {
    const r = normalizeQuestion(
      applyMapping({ ...base, question_type: "numerical", option_1: "None", option_2: "None", option_3: "None", option_4: "None", correct_option: "None", numerical_answer: "5", question_images: "[]" }, LOCAL_DATASET_MAPPING),
      exists([]),
    );
    expect(r.ok && r.question.questionType).toBe("numerical");
    expect(r.ok && r.question.options).toEqual([]);
    expect(r.ok && r.question.numericalAnswer).toBe("5");
    expect(r.ok && r.question.issues).toEqual([]);
  });
  it("rejects records without text or subject", () => {
    expect(normalizeQuestion(applyMapping({ ...base, question: "" }, LOCAL_DATASET_MAPPING), exists([])).ok).toBe(false);
    expect(normalizeQuestion(applyMapping({ ...base, subject: "Biology" }, LOCAL_DATASET_MAPPING), exists([])).ok).toBe(false);
  });
  it("flags [IMAGE] placeholders without a matching image", () => {
    const r = normalizeQuestion(applyMapping({ ...base, question: "See [IMAGE] and [IMAGE]", question_images: "['images/image17.png']" }, LOCAL_DATASET_MAPPING), exists(["/questions/physics/images/image17.png"]));
    expect(r.ok && r.question.issues).toContain("image_reference_missing");
  });
  it("detects image file names shared by different source papers", () => {
    const recs = [
      applyMapping(base, LOCAL_DATASET_MAPPING),
      applyMapping({ ...base, question: "Other", source_paper: "P-14" }, LOCAL_DATASET_MAPPING),
      applyMapping({ ...base, question: "Third", question_images: "['images/image99.png']" }, LOCAL_DATASET_MAPPING),
    ];
    const amb = findAmbiguousImages(recs);
    expect([...amb]).toEqual(["/questions/physics/images/image17.png"]);
    const r = normalizeQuestion(recs[0], () => true, { ambiguousImages: amb });
    expect(r.ok && r.question.issues).toContain("ambiguous_image");
  });
  it("produces identical hashes for whitespace/case variants", () => {
    const a = computeContentHash({ subject: "Physics", questionType: "single_correct", questionText: "What  is X?", options: ["a", "b", "c", "d"] });
    const b = computeContentHash({ subject: "Physics", questionType: "single_correct", questionText: "what is x?", options: ["A", "B", "C", "D"] });
    expect(a).toBe(b);
  });
});

describe("column mapping", () => {
  it("suggests mappings for differing column names", () => {
    const m = suggestMapping(["question_text", "option_a", "Option B", "option_c", "option_d", "answer", "Subject", "Difficulty Level"]);
    expect(m).toMatchObject({ questionText: "question_text", option1: "option_a", option2: "Option B", correctAnswer: "answer", subject: "Subject", difficulty: "Difficulty Level" });
  });
});
