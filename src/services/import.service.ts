import "server-only";
import type { Types } from "mongoose";
import { Question, ImportBatch } from "@/models";
import { imageExists } from "@/lib/assets";
import {
  applyMapping,
  findAmbiguousImages,
  normalizeQuestion,
  type FieldMapping,
  type MappedRecord,
  type NormalizedQuestion,
} from "@/lib/dataset/normalize";
import type { ParsedRow } from "@/lib/dataset/parse-files";
import type { SourceType, Subject } from "@/lib/constants";

export interface ImportInputFile {
  /** Logical file name, e.g. "physics/train.jsonl" or the uploaded file name. */
  file: string;
  rows: ParsedRow[];
  parseErrors: { line: number; message: string }[];
}

export interface ImportContext {
  sourceType: SourceType;
  mapping: FieldMapping;
  sourceLicense?: string;
  fallbackSubject?: Subject;
  /** Pre-computed ambiguous image set (local import computes it across all files of a subject). */
  ambiguousImages?: Set<string>;
  /** Reviewer overlay keyed by "<file>#<question id>#<occurrence>" (see src/data/curation.json). */
  curation?: CurationOverlay | null;
  /**
   * Curation policy: questions that can never be shown correctly (missing or unverifiable question images,
   * missing options, no usable answer key, placeholder text) are removed instead of imported for review.
   */
  removeUnusable?: boolean;
}

export interface CurationOverlay {
  reviewer?: string;
  answerKeys?: Record<string, { correctOption?: number; numericalAnswer?: string }>;
  difficulty?: Record<string, string>;
}

const REMOVAL_REASONS: Partial<Record<string, string>> = {
  missing_image_file: "Question image file is missing",
  image_reference_missing: "Question refers to an image that is not in the dataset",
  ambiguous_image: "Question image cannot be verified (file name shared by several source papers)",
  option_image_missing: "Options are images that are not in the dataset",
  incomplete_options: "Fewer than four options in the dataset",
  missing_answer_key: "No answer key and the question could not be solved reliably",
  invalid_answer_key: "Answer key does not match any option",
  missing_numerical_answer: "Numerical answer missing",
  invalid_numerical_answer: "Numerical answer is not a number",
};

export function removalReason(q: NormalizedQuestion): string | null {
  // Placeholder stems from the source papers ("…has four choices…", "INTEGER ANSWER TYPE", or a few words
  // with no actual question). Short but complete questions ("What is 25% of 400?", "Cat : Meow :: Dog : ?") are kept.
  const t = q.questionText.trim();
  const completeShortQuestion = /\?$|::|\b(find|calculate|what is|how many)\b/i.test(t) && !/\[IMAGE\]/i.test(t);
  if (/has four choices|INTEGER ANSWER TYPE/i.test(t) || t.length < 12 || (t.length < 25 && !completeShortQuestion)) return "Not a complete question (placeholder text)";
  for (const i of q.issues) if (REMOVAL_REASONS[i]) return REMOVAL_REASONS[i]!;
  return null;
}

type Classification = "new" | "unchanged" | "updatable" | "content_changed" | "duplicate_in_batch";

interface Candidate {
  file: string;
  line: number;
  sourceKey: string;
  question: NormalizedQuestion;
  classification: Classification;
  existingId?: Types.ObjectId;
  material?: boolean;
}

export interface ImportStats {
  filesDetected: number;
  totalRecords: number;
  validRecords: number;
  validMcqs: number;
  numericalQuestions: number;
  missingAnswerKeys: number;
  missingImages: number;
  ambiguousImages: number;
  unclassifiedDifficulty: number;
  withIssues: number;
  duplicates: number;
  alreadyImported: number;
  changedInSource: number;
  newRecords: number;
  rejected: number;
  removedByCuration: number;
  aiAnswerKeys: number;
  aiDifficulty: number;
  /** Imported but excluded from exams by the dataset's own review decision. */
  excludedForReview: number;
  pendingReview: number;
  successfullyImported: number;
  updated: number;
  failedImports: number;
}

export interface ImportAnalysis {
  stats: ImportStats;
  candidates: Candidate[];
  rejected: { file: string; line: number; message: string }[];
  removed: { file: string; line: number; message: string }[];
  removedReasons: Record<string, number>;
}

const ANSWER_ISSUES = new Set(["missing_answer_key", "invalid_answer_key", "missing_numerical_answer", "invalid_numerical_answer"]);

function emptyStats(files: number): ImportStats {
  return {
    filesDetected: files,
    totalRecords: 0,
    validRecords: 0,
    validMcqs: 0,
    numericalQuestions: 0,
    missingAnswerKeys: 0,
    missingImages: 0,
    ambiguousImages: 0,
    unclassifiedDifficulty: 0,
    withIssues: 0,
    duplicates: 0,
    alreadyImported: 0,
    changedInSource: 0,
    newRecords: 0,
    rejected: 0,
    removedByCuration: 0,
    aiAnswerKeys: 0,
    aiDifficulty: 0,
    excludedForReview: 0,
    pendingReview: 0,
    successfullyImported: 0,
    updated: 0,
    failedImports: 0,
  };
}

/** Parses, validates and classifies records against MongoDB without writing anything. */
export async function analyzeImport(inputs: ImportInputFile[], ctx: ImportContext): Promise<ImportAnalysis> {
  const stats = emptyStats(inputs.length);
  const rejected: ImportAnalysis["rejected"] = [];
  const removed: ImportAnalysis["removed"] = [];
  const removedReasons: Record<string, number> = {};
  const mappedByFile = inputs.map((f) => ({ ...f, mapped: f.rows.map((r) => ({ line: r.line, raw: r.data, rec: applyMapping(r.data, ctx.mapping) })) }));
  const ambiguous = ctx.ambiguousImages ?? findAmbiguousImages(mappedByFile.flatMap((f) => f.mapped.map((m) => m.rec as MappedRecord)), ctx.fallbackSubject);

  const candidates: Candidate[] = [];
  const seenHashes = new Set<string>();

  for (const f of mappedByFile) {
    stats.totalRecords += f.rows.length + f.parseErrors.length;
    for (const e of f.parseErrors) rejected.push({ file: f.file, line: e.line, message: e.message });
    const occurrences = new Map<string, number>();
    const nopts = { fallbackSubject: ctx.fallbackSubject, ambiguousImages: ambiguous, stripAmbiguousSolutionImages: !!ctx.removeUnusable };
    for (const { line, rec, raw } of f.mapped) {
      let result = normalizeQuestion(rec, imageExists, nopts);
      if (!result.ok) {
        rejected.push({ file: f.file, line, message: result.error });
        continue;
      }
      let q = result.question;
      const idPart = q.originalQuestionId || `line-${line}`;
      const occ = (occurrences.get(idPart) ?? 0) + 1;
      occurrences.set(idPart, occ);
      const sourceKey = `${ctx.sourceType}:${f.file}#${idPart}#${occ}`;

      // Apply reviewer overlay (AI-solved answer keys and AI-assigned difficulty levels).
      const overlayKey = `${f.file}#${idPart}#${occ}`;
      const key = ctx.curation?.answerKeys?.[overlayKey];
      const diff = ctx.curation?.difficulty?.[overlayKey];
      if (key || diff) {
        const patched = { ...rec };
        if (key?.correctOption !== undefined) patched.correctAnswer = key.correctOption;
        if (key?.numericalAnswer !== undefined) patched.numericalAnswer = key.numericalAnswer;
        if (diff) patched.difficulty = diff;
        result = normalizeQuestion(patched, imageExists, nopts);
        if (result.ok) {
          q = result.question;
          q.originalDifficulty = String(rec.difficulty ?? "");
          if (key) {
            q.curationNotes.push(`Answer key solved by AI reviewer${ctx.curation?.reviewer ? ` (${ctx.curation.reviewer})` : ""} — please confirm`);
            stats.aiAnswerKeys++;
          }
          if (diff) {
            q.curationNotes.push(`Difficulty assigned by AI reviewer (${diff}) — original label "${String(rec.difficulty ?? "") || "blank"}"`);
            stats.aiDifficulty++;
          }
        }
      }

      // Dataset-level review decision (e.g. external sets whose answer could not be verified):
      // the question stays in the bank, visible with its reason, but is excluded from exams.
      if (typeof raw.review_exclusion === "string" && raw.review_exclusion.trim()) {
        q.exclusionReason = raw.review_exclusion.trim().slice(0, 500);
        stats.excludedForReview++;
      }

      if (ctx.removeUnusable) {
        const reason = removalReason(q);
        if (reason) {
          removed.push({ file: f.file, line, message: `${q.originalQuestionId || "Question"}: ${reason}` });
          removedReasons[reason] = (removedReasons[reason] ?? 0) + 1;
          stats.removedByCuration++;
          continue;
        }
      }

      stats.validRecords++;
      if (q.questionType === "numerical") stats.numericalQuestions++;
      else if (!q.issues.includes("incomplete_options") && !q.issues.some((i) => ANSWER_ISSUES.has(i))) stats.validMcqs++;
      if (q.issues.some((i) => ANSWER_ISSUES.has(i))) stats.missingAnswerKeys++;
      if (q.issues.includes("missing_image_file") || q.issues.includes("image_reference_missing") || q.issues.includes("option_image_missing"))
        stats.missingImages++;
      if (q.issues.includes("ambiguous_image")) stats.ambiguousImages++;
      if (q.issues.includes("unclassified_difficulty")) stats.unclassifiedDifficulty++;
      if (q.issues.length) stats.withIssues++;

      if (seenHashes.has(q.contentHash)) {
        stats.duplicates++;
        candidates.push({ file: f.file, line, sourceKey, question: q, classification: "duplicate_in_batch" });
        continue;
      }
      seenHashes.add(q.contentHash);
      candidates.push({ file: f.file, line, sourceKey, question: q, classification: "new" });
    }
  }
  stats.rejected = rejected.length;

  // Compare with existing records (by content hash first, then by stable source key).
  const live = candidates.filter((c) => c.classification === "new");
  const hashes = live.map((c) => c.question.contentHash);
  const keys = live.map((c) => c.sourceKey);
  const [byHash, byKey] = await Promise.all([
    Question.find({ contentHash: { $in: hashes } })
      .select("contentHash correctOption numericalAnswer explanation questionImages solutionImages topic subtopic")
      .lean(),
    Question.find({ sourceKey: { $in: keys } })
      .select("sourceKey contentHash")
      .lean(),
  ]);
  const hashMap = new Map(byHash.map((d) => [d.contentHash, d]));
  const keyMap = new Map(byKey.map((d) => [d.sourceKey, d]));

  for (const c of live) {
    const existing = hashMap.get(c.question.contentHash);
    if (existing) {
      c.existingId = existing._id;
      const answerChanged =
        (existing.correctOption ?? null) !== c.question.correctOption || (existing.numericalAnswer ?? null) !== c.question.numericalAnswer;
      const imagesChanged =
        JSON.stringify(existing.questionImages) !== JSON.stringify(c.question.questionImages) ||
        JSON.stringify(existing.solutionImages) !== JSON.stringify(c.question.solutionImages);
      const otherChanged =
        (existing.explanation ?? "") !== c.question.explanation || existing.topic !== c.question.topic || existing.subtopic !== c.question.subtopic;
      if (answerChanged || imagesChanged || otherChanged) {
        c.classification = "updatable";
        c.material = answerChanged || imagesChanged;
        stats.changedInSource++;
      } else {
        c.classification = "unchanged";
      }
      stats.alreadyImported++;
      continue;
    }
    const sameSource = keyMap.get(c.sourceKey);
    if (sameSource) {
      c.existingId = sameSource._id;
      c.classification = "content_changed";
      c.material = true;
      stats.changedInSource++;
      stats.alreadyImported++;
      continue;
    }
    stats.newRecords++;
  }

  return { stats, candidates, rejected, removed, removedReasons };
}

function toDocument(q: NormalizedQuestion, c: Candidate, ctx: ImportContext, batchId: Types.ObjectId, userId: Types.ObjectId) {
  return {
    ...q,
    sourceType: ctx.sourceType,
    sourceFile: c.file,
    sourceKey: c.sourceKey,
    sourceLicense: ctx.sourceLicense ?? "",
    verificationStatus: q.exclusionReason ? "rejected" : "pending",
    rejectionReason: q.exclusionReason ?? "",
    importBatchId: batchId,
    createdBy: userId,
  };
}

export interface CommitOptions {
  userId: Types.ObjectId;
  /** Update records whose content changed in the source. Off by default. */
  updateExisting?: boolean;
  /** Skip records that have validation issues instead of importing them for review. */
  skipFlagged?: boolean;
  filename?: string;
  sourceUrl?: string;
}

/** Writes an analysed import to MongoDB. Idempotent: re-running with the same input inserts nothing new. */
export async function commitImport(inputs: ImportInputFile[], ctx: ImportContext, opts: CommitOptions) {
  const analysis = await analyzeImport(inputs, ctx);
  const { stats, candidates, rejected, removed } = analysis;
  const batch = await ImportBatch.create({
    sourceType: ctx.sourceType,
    filename: opts.filename ?? inputs.map((i) => i.file).join(", "),
    files: inputs.map((i) => i.file),
    sourceUrl: opts.sourceUrl ?? "",
    importedBy: opts.userId,
    mapping: ctx.mapping,
    status: "completed",
  });

  const toInsert = candidates.filter((c) => c.classification === "new" && !(opts.skipFlagged && c.question.issues.length));
  const skippedFlagged = candidates.filter((c) => c.classification === "new" && opts.skipFlagged && c.question.issues.length).length;
  let inserted = 0;
  let failed = 0;
  const failures: { file: string; line: number; message: string }[] = [];

  const CHUNK = 500;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    try {
      const res = await Question.insertMany(
        chunk.map((c) => toDocument(c.question, c, ctx, batch._id, opts.userId)),
        { ordered: false, rawResult: true },
      );
      inserted += res.insertedCount;
    } catch (err: unknown) {
      // Bulk write errors: duplicates raced in by a concurrent import are counted as already imported.
      type WriteErr = { code?: number; index: number; errmsg?: string };
      const e = err as { insertedDocs?: unknown[]; result?: { insertedCount?: number }; writeErrors?: WriteErr | WriteErr[] };
      if (!e.writeErrors) throw err;
      inserted += e.result?.insertedCount ?? e.insertedDocs?.length ?? 0;
      const writeErrors = Array.isArray(e.writeErrors) ? e.writeErrors : [e.writeErrors];
      for (const we of writeErrors) {
        if (we.code === 11000) stats.alreadyImported++;
        else {
          failed++;
          const c = chunk[we.index];
          if (c) failures.push({ file: c.file, line: c.line, message: we.errmsg ?? "Insert failed" });
        }
      }
    }
  }

  let updated = 0;
  if (opts.updateExisting) {
    for (const c of candidates.filter((x) => x.classification === "updatable" || x.classification === "content_changed")) {
      const q = c.question;
      const set: Record<string, unknown> = {
        questionText: q.questionText,
        options: q.options,
        correctOption: q.correctOption,
        numericalAnswer: q.numericalAnswer,
        explanation: q.explanation,
        questionImages: q.questionImages,
        solutionImages: q.solutionImages,
        topic: q.topic,
        subtopic: q.subtopic,
        issues: q.issues,
        curationNotes: q.curationNotes,
        difficulty: q.difficulty,
        assetStatus: q.assetStatus,
        missingAssets: q.missingAssets,
        contentHash: q.contentHash,
        importBatchId: batch._id,
      };
      // Material changes (answer key, images or the question itself) invalidate a previous verification.
      if (c.material) Object.assign(set, { verificationStatus: "pending", verifiedAt: null, verifiedBy: null });
      try {
        const r = await Question.updateOne({ _id: c.existingId }, { $set: set });
        updated += r.modifiedCount;
      } catch (err) {
        failed++;
        failures.push({ file: c.file, line: c.line, message: (err as Error).message.slice(0, 200) });
      }
    }
  }

  stats.successfullyImported = inserted;
  stats.pendingReview = inserted;
  stats.updated = updated;
  stats.failedImports = failed + rejected.length;

  const errorSamples = [...rejected, ...failures, ...removed.map((r) => ({ ...r, message: `Removed by curation — ${r.message}` }))].slice(0, 500);
  await ImportBatch.updateOne(
    { _id: batch._id },
    {
      $set: {
        totalRecords: stats.totalRecords,
        validRecords: stats.validRecords,
        rejectedRecords: stats.rejected,
        duplicateRecords: stats.duplicates,
        alreadyImported: stats.alreadyImported,
        updatedCount: updated,
        importedCount: inserted,
        failedCount: stats.failedImports,
        mcqCount: stats.validMcqs,
        numericalCount: stats.numericalQuestions,
        missingAnswerKeys: stats.missingAnswerKeys,
        missingImages: stats.missingImages,
        pendingReview: inserted,
        errorSamples,
        status: failed > 0 ? "partial" : "completed",
      },
    },
  );

  return { batchId: String(batch._id), stats: { ...stats, skippedFlagged }, errors: errorSamples.slice(0, 50) };
}

/** Lightweight preview payload for the UI. */
export function previewPayload(analysis: ImportAnalysis) {
  const samples = analysis.candidates
    .filter((c) => c.classification !== "duplicate_in_batch")
    .slice(0, 25)
    .map((c) => ({
      file: c.file,
      line: c.line,
      status: c.classification,
      originalQuestionId: c.question.originalQuestionId,
      subject: c.question.subject,
      topic: c.question.topic,
      difficulty: c.question.difficulty,
      questionType: c.question.questionType,
      questionText: c.question.questionText.slice(0, 300),
      options: c.question.options.map((o) => o.slice(0, 120)),
      correctOption: c.question.correctOption,
      numericalAnswer: c.question.numericalAnswer,
      questionImages: c.question.questionImages,
      issues: c.question.issues,
    }));
  const issueCounts: Record<string, number> = {};
  for (const c of analysis.candidates) for (const i of c.question.issues) issueCounts[i] = (issueCounts[i] ?? 0) + 1;
  return { stats: analysis.stats, samples, issueCounts, rejected: analysis.rejected.slice(0, 50), removed: analysis.removed.slice(0, 100), removedReasons: analysis.removedReasons };
}
