import { createHash } from "node:crypto";
import {
  SUBJECTS,
  SUBJECT_SLUGS,
  type DifficultyValue,
  type QuestionIssue,
  type QuestionType,
  type Subject,
  type AssetStatus,
} from "@/lib/constants";

/* -------------------------------------------------------------------------- */
/*  Primitive coercions for string-encoded dataset values                     */
/* -------------------------------------------------------------------------- */

const NULL_TOKENS = new Set(["", "none", "null", "nan", "undefined", "n/a", "na"]);

/** Converts "None" / "null" / "" / NaN to null and trims strings. */
export function parseNullable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
  if (typeof value === "boolean") return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return NULL_TOKENS.has(trimmed.toLowerCase()) ? null : trimmed;
}

export function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const s = parseNullable(value);
  if (s === null) return null;
  const lower = s.toLowerCase();
  if (["true", "yes", "y", "1"].includes(lower)) return true;
  if (["false", "no", "n", "0"].includes(lower)) return false;
  return null;
}

/**
 * Safely parses a list of strings. Accepts real arrays, JSON arrays, Python-style
 * list literals such as "['images/a.png', 'images/b.png']" and ";"/","-separated strings.
 * Never evaluates code.
 */
export function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => parseNullable(v)).filter((v): v is string => !!v);
  const s = parseNullable(value);
  if (s === null) return [];
  if (s.startsWith("[") && s.endsWith("]")) {
    const parsed = parseQuotedListLiteral(s);
    if (parsed) return parsed;
    // Unquoted list e.g. [a.png, b.png]
    return s
      .slice(1, -1)
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return s
    .split(/[;,|]/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Tokenizer for ['a', "b"] list literals containing only string items. Returns null if not of that shape. */
function parseQuotedListLiteral(input: string): string[] | null {
  const items: string[] = [];
  let i = 1;
  const end = input.length - 1;
  const skipWs = () => {
    while (i < end && /\s/.test(input[i])) i++;
  };
  skipWs();
  if (i === end) return [];
  while (i < end) {
    skipWs();
    const quote = input[i];
    if (quote !== "'" && quote !== '"') return null;
    i++;
    let item = "";
    while (i < end && input[i] !== quote) {
      if (input[i] === "\\" && i + 1 < end) {
        item += input[i + 1];
        i += 2;
        continue;
      }
      item += input[i++];
    }
    if (input[i] !== quote) return null;
    i++;
    items.push(item.trim());
    skipWs();
    if (i < end) {
      if (input[i] !== ",") return null;
      i++;
      skipWs();
    }
  }
  return items.filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/*  Domain normalisation                                                       */
/* -------------------------------------------------------------------------- */

const DIFFICULTY_SYNONYMS: Record<string, DifficultyValue> = {
  easy: "Easy",
  simple: "Easy",
  moderate: "Medium",
  medium: "Medium",
  average: "Medium",
  difficult: "Hard",
  hard: "Hard",
  tough: "Hard",
  basic: "Easy",
  beginner: "Easy",
  intermediate: "Medium",
  advance: "Hard",
  advanced: "Hard",
};

/**
 * Maps difficulty labels via an explicit synonym table. Combined labels ("Easy / Moderate / Tough"),
 * misspellings and blanks are NOT guessed — they become "Unclassified" and require Admin review.
 */
export function normalizeDifficulty(value: unknown): DifficultyValue {
  const s = parseNullable(value);
  if (!s) return "Unclassified";
  const cleaned = s
    .toLowerCase()
    .replace(/^[\s[\](){}.,;:'"-]+|[\s[\](){}.,;:'"-]+$/g, "")
    .trim();
  return DIFFICULTY_SYNONYMS[cleaned] ?? "Unclassified";
}

const SUBJECT_SYNONYMS: Record<string, Subject> = {
  physics: "Physics",
  phy: "Physics",
  chemistry: "Chemistry",
  chem: "Chemistry",
  mathematics: "Mathematics",
  maths: "Mathematics",
  math: "Mathematics",
  "quantitative aptitude": "Quantitative Aptitude",
  "quantitative-aptitude": "Quantitative Aptitude",
  quantitative: "Quantitative Aptitude",
  quant: "Quantitative Aptitude",
  aptitude: "Quantitative Aptitude",
  "numerical ability": "Quantitative Aptitude",
  "logical reasoning": "Logical Reasoning",
  "logical-reasoning": "Logical Reasoning",
  reasoning: "Logical Reasoning",
  logical: "Logical Reasoning",
  "verbal ability": "Verbal Ability",
  "verbal-ability": "Verbal Ability",
  verbal: "Verbal Ability",
  english: "Verbal Ability",
};

export function normalizeSubject(value: unknown): Subject | null {
  const s = parseNullable(value);
  if (!s) return null;
  return SUBJECT_SYNONYMS[s.toLowerCase()] ?? null;
}

export function normalizeQuestionType(value: unknown): QuestionType | null {
  const s = parseNullable(value)?.toLowerCase().replace(/[\s-]+/g, "_");
  if (!s) return null;
  if (["single_correct", "single", "mcq", "single_correct_mcq", "scq", "objective"].includes(s)) return "single_correct";
  if (["numerical", "numeric", "integer", "integer_type", "numerical_answer", "nat"].includes(s)) return "numerical";
  return null;
}

/** Normalises text for display: unify newlines, trim trailing whitespace per line. */
export function normalizeText(value: unknown): string {
  const s = parseNullable(value) ?? "";
  return s
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

/** Normalised form used for duplicate detection. */
export function canonicalText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

const LETTER_TO_INDEX: Record<string, number> = { a: 1, b: 2, c: 3, d: 4 };

/**
 * Parses a correct answer in any of these forms: 1–4, "1", "A"–"D", "(B)", "option_3", "Option C".
 * Returns { value } with a 1-based index, or { value: null, invalid } when present but unusable.
 */
export function normalizeCorrectOption(value: unknown, optionCount = 4): { value: number | null; invalid: boolean } {
  const s = parseNullable(value);
  if (s === null) return { value: null, invalid: false };
  const cleaned = s.toLowerCase().replace(/^\(?\s*(option[\s_-]*)?/, "").replace(/\)?\s*$/, "").trim();
  let n: number | null = null;
  if (/^\d+(\.0+)?$/.test(cleaned)) n = Number.parseInt(cleaned, 10);
  else if (cleaned.length === 1 && LETTER_TO_INDEX[cleaned]) n = LETTER_TO_INDEX[cleaned];
  if (n === null || n < 1 || n > optionCount) return { value: null, invalid: true };
  return { value: n, invalid: false };
}

/** Numerical answers are kept as normalised strings; returns invalid when not a finite number. */
export function normalizeNumericalAnswer(value: unknown): { value: string | null; invalid: boolean } {
  const s = parseNullable(value);
  if (s === null) return { value: null, invalid: false };
  const cleaned = s.replace(/,/g, "").replace(/\s+/g, "");
  if (!/^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/.test(cleaned)) return { value: s, invalid: true };
  return { value: String(Number(cleaned)), invalid: false };
}

/* -------------------------------------------------------------------------- */
/*  Image paths                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Resolves a dataset image reference to a browser path under /questions/{subject}/images/.
 * Absolute https URLs are kept as-is (only possible for upload/API sources). Path traversal is rejected.
 */
export function resolveImagePath(subject: Subject, ref: string): string | null {
  const trimmed = ref.trim();
  if (!trimmed) return null;
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  const clean = trimmed.replace(/\\/g, "/").replace(/^\.?\//, "");
  if (clean.split("/").some((seg) => seg === ".." || seg === "")) return null;
  const slug = SUBJECT_SLUGS[subject];
  if (clean.startsWith(`questions/${slug}/images/`)) return `/${clean}`;
  const filename = clean.split("/").pop()!;
  if (!/^[\w.\-() ]+\.(png|jpe?g|gif|webp|svg)$/i.test(filename)) return null;
  return `/questions/${slug}/images/${filename}`;
}

export function countImagePlaceholders(text: string): number {
  return (text.match(/\[IMAGE\]/g) ?? []).length;
}

/* -------------------------------------------------------------------------- */
/*  Field mapping                                                              */
/* -------------------------------------------------------------------------- */

export const TARGET_FIELDS = [
  "originalQuestionId",
  "questionText",
  "option1",
  "option2",
  "option3",
  "option4",
  "correctAnswer",
  "numericalAnswer",
  "explanation",
  "subject",
  "chapter",
  "topic",
  "subtopic",
  "difficulty",
  "questionType",
  "questionImages",
  "solutionImages",
  "academicLevel",
  "sourceExam",
  "originalSource",
] as const;
export type TargetField = (typeof TARGET_FIELDS)[number];
export type FieldMapping = Partial<Record<TargetField, string>>;

export const TARGET_FIELD_LABELS: Record<TargetField, string> = {
  originalQuestionId: "Question ID",
  questionText: "Question text",
  option1: "Option 1 (A)",
  option2: "Option 2 (B)",
  option3: "Option 3 (C)",
  option4: "Option 4 (D)",
  correctAnswer: "Correct answer",
  numericalAnswer: "Numerical answer",
  explanation: "Explanation / solution",
  subject: "Subject",
  chapter: "Chapter",
  topic: "Topic",
  subtopic: "Subtopic",
  difficulty: "Difficulty",
  questionType: "Question type",
  questionImages: "Question images",
  solutionImages: "Solution images",
  academicLevel: "Academic level",
  sourceExam: "Source exam",
  originalSource: "Original source",
};

export const REQUIRED_TARGET_FIELDS: TargetField[] = ["questionText", "subject"];

const FIELD_SYNONYMS: Record<TargetField, string[]> = {
  originalQuestionId: ["question_id", "questionid", "id", "qid", "question_no", "ques_id"],
  questionText: ["question", "question_text", "questiontext", "text", "problem", "stem", "ques"],
  option1: ["option_1", "option1", "option_a", "optiona", "a", "opt1", "opt_a", "choice_1", "choice_a"],
  option2: ["option_2", "option2", "option_b", "optionb", "b", "opt2", "opt_b", "choice_2", "choice_b"],
  option3: ["option_3", "option3", "option_c", "optionc", "c", "opt3", "opt_c", "choice_3", "choice_c"],
  option4: ["option_4", "option4", "option_d", "optiond", "d", "opt4", "opt_d", "choice_4", "choice_d"],
  correctAnswer: ["correct_option", "correctoption", "answer", "correct_answer", "correct", "key", "answer_key", "ans"],
  numericalAnswer: ["numerical_answer", "numericalanswer", "numeric_answer", "integer_answer", "value_answer"],
  explanation: ["solution", "explanation", "rationale", "solution_text"],
  subject: ["subject", "subject_name"],
  chapter: ["chapter", "unit"],
  topic: ["topic", "topic_name"],
  subtopic: ["subtopic", "sub_topic", "concept"],
  difficulty: ["difficulty", "difficulty_level", "level"],
  questionType: ["question_type", "questiontype", "type"],
  questionImages: ["question_images", "questionimages", "images", "question_image"],
  solutionImages: ["solution_images", "solutionimages", "solution_image"],
  academicLevel: ["academic_level", "grade", "class"],
  sourceExam: ["exam", "source_exam", "exam_name"],
  originalSource: ["source_paper", "source", "paper", "original_source", "reference"],
};

/** Suggests a mapping from available column names to target fields using known synonyms. */
export function suggestMapping(columns: string[]): FieldMapping {
  const byKey = new Map(columns.map((c) => [c.toLowerCase().replace(/[\s-]+/g, "_"), c]));
  const used = new Set<string>();
  const mapping: FieldMapping = {};
  for (const field of TARGET_FIELDS) {
    for (const syn of FIELD_SYNONYMS[field]) {
      const col = byKey.get(syn);
      if (col && !used.has(col)) {
        mapping[field] = col;
        used.add(col);
        break;
      }
    }
  }
  return mapping;
}

export type MappedRecord = Partial<Record<TargetField, unknown>>;

export function applyMapping(raw: Record<string, unknown>, mapping: FieldMapping): MappedRecord {
  const out: MappedRecord = {};
  for (const field of TARGET_FIELDS) {
    const col = mapping[field];
    if (col && Object.prototype.hasOwnProperty.call(raw, col)) out[field] = raw[col];
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Full record normalisation                                                  */
/* -------------------------------------------------------------------------- */

export interface NormalizedQuestion {
  originalQuestionId: string;
  subject: Subject;
  chapter: string;
  topic: string;
  subtopic: string;
  academicLevel: string;
  difficulty: DifficultyValue;
  originalDifficulty: string;
  questionType: QuestionType;
  questionText: string;
  options: string[];
  correctOption: number | null;
  numericalAnswer: string | null;
  explanation: string;
  questionImages: string[];
  solutionImages: string[];
  sourceExam: string;
  originalSource: string;
  contentHash: string;
  issues: QuestionIssue[];
  assetStatus: AssetStatus;
  missingAssets: string[];
  curationNotes: string[];
  /** Set by the importer when the dataset marks the question as not usable until reviewed. */
  exclusionReason?: string;
}

export type NormalizeResult = { ok: true; question: NormalizedQuestion } | { ok: false; error: string };

export type ImageExists = (browserPath: string) => boolean;

export function computeContentHash(q: Pick<NormalizedQuestion, "subject" | "questionType" | "questionText" | "options">) {
  const payload = [q.subject, q.questionType, canonicalText(q.questionText), ...q.options.map(canonicalText)].join("␞");
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Converts a mapped raw record into a normalised question with validation issues.
 * Structural problems (no text, unknown subject) reject the record; content problems
 * (missing answer key, missing images, unclassified difficulty) are kept as issues
 * so that an Admin can review and fix them. Questions with issues can never be verified.
 */
export interface NormalizeOptions {
  fallbackSubject?: Subject;
  /** Browser image paths known to be shared by different source papers (see findAmbiguousImages). */
  ambiguousImages?: Set<string>;
  /** Drop ambiguous *solution* figures instead of flagging the question (the text solution is kept). */
  stripAmbiguousSolutionImages?: boolean;
}

export function normalizeQuestion(rec: MappedRecord, imageExists: ImageExists, opts: NormalizeOptions = {}): NormalizeResult {
  const fallbackSubject = opts.fallbackSubject;
  const subject = normalizeSubject(rec.subject) ?? fallbackSubject ?? null;
  if (!subject) return { ok: false, error: `Unknown or missing subject "${String(rec.subject ?? "")}"` };

  const questionText = normalizeText(rec.questionText);
  if (!questionText) return { ok: false, error: "Question text is empty" };

  const rawOptions = [rec.option1, rec.option2, rec.option3, rec.option4].map((o) => normalizeText(o));
  const presentOptions = rawOptions.filter((o) => o.length > 0).length;
  const numerical = normalizeNumericalAnswer(rec.numericalAnswer);
  const correct = normalizeCorrectOption(rec.correctAnswer, 4);

  let questionType = normalizeQuestionType(rec.questionType);
  if (!questionType) {
    if (presentOptions > 0 || correct.value !== null) questionType = "single_correct";
    else if (numerical.value !== null) questionType = "numerical";
    else return { ok: false, error: "Cannot determine question type (no options and no numerical answer)" };
  }

  const issues = new Set<QuestionIssue>();
  const options = questionType === "single_correct" ? rawOptions : rawOptions.filter(Boolean).length ? rawOptions : [];

  if (questionType === "single_correct") {
    if (presentOptions < 4) issues.add("incomplete_options");
    if (correct.invalid) issues.add("invalid_answer_key");
    else if (correct.value === null) issues.add("missing_answer_key");
    else if (!rawOptions[correct.value - 1]) issues.add("invalid_answer_key");
    if (rawOptions.some((o) => o.includes("[IMAGE]"))) issues.add("option_image_missing");
  } else {
    if (numerical.value === null) issues.add("missing_numerical_answer");
    else if (numerical.invalid) issues.add("invalid_numerical_answer");
  }

  const difficulty = normalizeDifficulty(rec.difficulty);
  if (difficulty === "Unclassified") issues.add("unclassified_difficulty");

  // Images
  const missingAssets: string[] = [];
  const resolveAll = (refs: string[], kind: "question" | "solution") =>
    refs
      .map((ref) => {
        const p = resolveImagePath(subject, ref);
        if (!p) {
          missingAssets.push(`${kind}:${ref}`);
          return null;
        }
        if (!p.startsWith("https://") && !imageExists(p)) missingAssets.push(`${kind}:${p}`);
        return p;
      })
      .filter((p): p is string => !!p);

  const questionImages = resolveAll(parseStringList(rec.questionImages), "question");
  let solutionImages = resolveAll(parseStringList(rec.solutionImages), "solution");
  const notes: string[] = [];
  if (opts.stripAmbiguousSolutionImages && opts.ambiguousImages) {
    const kept = solutionImages.filter((p) => !opts.ambiguousImages!.has(p));
    if (kept.length !== solutionImages.length) notes.push(`Removed ${solutionImages.length - kept.length} unverifiable solution figure(s)`);
    solutionImages = kept;
  }
  const questionAssetsMissing = missingAssets.some((m) => m.startsWith("question:"));
  if (opts.ambiguousImages && (opts.stripAmbiguousSolutionImages ? questionImages : [...questionImages, ...solutionImages]).some((p) => opts.ambiguousImages!.has(p))) issues.add("ambiguous_image");
  if (questionAssetsMissing) issues.add("missing_image_file");
  if (countImagePlaceholders(questionText) > questionImages.length) issues.add("image_reference_missing");

  let assetStatus: AssetStatus = questionImages.length ? "ok" : "none";
  if (questionAssetsMissing || issues.has("image_reference_missing") || issues.has("option_image_missing") || issues.has("ambiguous_image"))
    assetStatus = "missing";

  const base = {
    subject,
    questionType,
    questionText,
    options,
  };

  return {
    ok: true,
    question: {
      originalQuestionId: parseNullable(rec.originalQuestionId) ?? "",
      subject,
      chapter: normalizeText(rec.chapter),
      topic: normalizeText(rec.topic),
      subtopic: normalizeText(rec.subtopic),
      academicLevel: normalizeText(rec.academicLevel),
      difficulty,
      originalDifficulty: parseNullable(rec.difficulty) ?? "",
      questionType,
      questionText,
      options,
      correctOption: questionType === "single_correct" && !issues.has("invalid_answer_key") ? correct.value : null,
      numericalAnswer: questionType === "numerical" ? numerical.value : null,
      explanation: normalizeText(rec.explanation),
      questionImages,
      solutionImages,
      sourceExam: normalizeText(rec.sourceExam),
      originalSource: normalizeText(rec.originalSource),
      contentHash: computeContentHash(base),
      issues: [...issues],
      assetStatus,
      missingAssets: missingAssets.filter((m) => !(opts.stripAmbiguousSolutionImages && m.startsWith("solution:") && !solutionImages.some((s) => m.endsWith(s)))),
      curationNotes: notes,
    },
  };
}

/** Re-validates an edited question (used by Admin edits). */
export function revalidate(
  q: Omit<NormalizedQuestion, "issues" | "assetStatus" | "missingAssets" | "contentHash" | "originalDifficulty" | "curationNotes"> & { originalDifficulty?: string },
  imageExists: ImageExists,
  opts: NormalizeOptions = {},
): NormalizeResult {
  return normalizeQuestion(
    {
      originalQuestionId: q.originalQuestionId,
      questionText: q.questionText,
      option1: q.options[0],
      option2: q.options[1],
      option3: q.options[2],
      option4: q.options[3],
      correctAnswer: q.correctOption,
      numericalAnswer: q.numericalAnswer,
      explanation: q.explanation,
      subject: q.subject,
      chapter: q.chapter,
      topic: q.topic,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      questionType: q.questionType,
      questionImages: q.questionImages,
      solutionImages: q.solutionImages,
      academicLevel: q.academicLevel,
      sourceExam: q.sourceExam,
      originalSource: q.originalSource,
    },
    imageExists,
    opts,
  );
}

/**
 * Finds image paths referenced by records from more than one source paper. Source documents
 * number their images independently (image1, image2, …), so when they are flattened into one
 * folder per subject the same file name can refer to different diagrams.
 */
export function findAmbiguousImages(records: MappedRecord[], fallbackSubject?: Subject): Set<string> {
  const owners = new Map<string, Set<string>>();
  for (const rec of records) {
    const subject = normalizeSubject(rec.subject) ?? fallbackSubject;
    const source = parseNullable(rec.originalSource);
    if (!subject || !source) continue;
    for (const ref of [...parseStringList(rec.questionImages), ...parseStringList(rec.solutionImages)]) {
      const p = resolveImagePath(subject, ref);
      if (!p || p.startsWith("https://")) continue;
      if (!owners.has(p)) owners.set(p, new Set());
      owners.get(p)!.add(source);
    }
  }
  return new Set([...owners].filter(([, sources]) => sources.size > 1).map(([p]) => p));
}

export const LOCAL_DATASET_MAPPING: FieldMapping = {
  originalQuestionId: "question_id",
  questionText: "question",
  option1: "option_1",
  option2: "option_2",
  option3: "option_3",
  option4: "option_4",
  correctAnswer: "correct_option",
  numericalAnswer: "numerical_answer",
  explanation: "solution",
  subject: "subject",
  topic: "topic",
  subtopic: "subtopic",
  difficulty: "difficulty",
  questionType: "question_type",
  questionImages: "question_images",
  solutionImages: "solution_images",
  sourceExam: "exam",
  originalSource: "source_paper",
};

export function isSubject(value: string): value is Subject {
  return (SUBJECTS as readonly string[]).includes(value);
}
