import "server-only";
import { Types } from "mongoose";
import { Exam, ExamDefaultConfiguration, ExamQuestion, audit } from "@/models";
import { AppError } from "@/lib/errors";
import { examConfigSchema } from "@/lib/validation/exams";
import { examDefaultsSchema, type ExamDefaultsInput } from "@/lib/validation/exam-defaults";
import { DEFAULT_PRESETS, canonicalSubjects, formatTitle, planDifficulty, planSubjects, type QuickPreset } from "@/lib/exam/quick";
import { createExam, generateExamPaper } from "./exam.service";

function plain(doc: Record<string, unknown>) {
  const presets = ((doc.presets as { name: string; counts: Map<string, number> | Record<string, number> }[]) ?? []).map((p) => ({
    name: p.name,
    counts: p.counts instanceof Map ? Object.fromEntries(p.counts) : p.counts,
  }));
  return { ...doc, id: String(doc._id), _id: undefined, presets } as unknown as ExamDefaultsInput & { id: string; updatedAt?: Date; createdAt?: Date };
}

/** The saved default configuration; created with the documented starting values the first time. */
export async function getDefaultConfiguration() {
  let doc = await ExamDefaultConfiguration.findOne({ isDefault: true }).lean();
  if (!doc) {
    try {
      await ExamDefaultConfiguration.create({ isDefault: true, presets: DEFAULT_PRESETS });
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err; // created concurrently
    }
    doc = await ExamDefaultConfiguration.findOne({ isDefault: true }).lean();
  }
  return plain(doc as unknown as Record<string, unknown>);
}

export async function saveDefaultConfiguration(input: ExamDefaultsInput, adminId: string) {
  const current = await getDefaultConfiguration();
  // Only validated fields are written (callers may pass a full document read from the API).
  const clean = examDefaultsSchema.parse(input);
  const doc = await ExamDefaultConfiguration.findOneAndUpdate(
    { _id: current.id },
    { $set: { ...clean, updatedBy: new Types.ObjectId(adminId) } },
    { returnDocument: "after" },
  ).lean();
  await audit(adminId, "exam_defaults.update", "ExamDefaultConfiguration", current.id);
  return plain(doc as unknown as Record<string, unknown>);
}

async function uniqueTitle(base: string, now: Date) {
  if (!(await Exam.exists({ title: base }))) return base;
  const dated = `${base} · ${now.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}`.slice(0, 200);
  if (!(await Exam.exists({ title: dated }))) return dated;
  for (let i = 2; i < 100; i++) {
    const t = `${dated} (${i})`.slice(0, 200);
    if (!(await Exam.exists({ title: t }))) return t;
  }
  return `${dated} (${Date.now() % 10000})`;
}

/**
 * Quick Generate: builds a complete exam from the saved defaults and the chosen subjects, saves it
 * as a draft and generates its paper. If the bank cannot supply the required questions, nothing is
 * kept and the exact shortage is reported.
 */
export async function quickGenerateExam(subjects: string[], adminId: string) {
  const cfg = await getDefaultConfiguration();
  const sel = canonicalSubjects(subjects);
  const total = cfg.totalQuestions;
  const { counts, preset } = planSubjects(total, sel, cfg.presets as QuickPreset[]);
  const difficulty = planDifficulty(total, cfg.difficultyPercent);
  const now = new Date();
  now.setSeconds(0, 0);
  const title = await uniqueTitle(formatTitle(cfg.titlePattern, sel, now), now);
  const totalMarks = total * cfg.marking.correct;

  const input = examConfigSchema.parse({
    title,
    description: `Generated with Quick Generate from the saved default settings${preset ? ` (${preset} distribution)` : ""}.`,
    category: cfg.examCategory,
    durationMinutes: cfg.durationMinutes,
    totalQuestions: total,
    startDate: now,
    endDate: new Date(now.getTime() + cfg.defaultValidityDays * 86_400_000),
    passingMarks: Math.round((cfg.passingPercentage / 100) * totalMarks * 100) / 100,
    subjectDistribution: sel.map((s) => ({ subject: s, count: counts[s], difficulty: null, topics: [] })),
    difficultyDistribution: difficulty,
    selection: { mode: "random", sources: [], includeNumerical: cfg.includeNumerical, manualQuestionIds: [] },
    marking: cfg.marking,
    settings: {
      shuffleQuestions: cfg.shuffleQuestions,
      shuffleOptions: cfg.shuffleOptions,
      showTopic: false,
      resultRelease: cfg.resultRelease,
      resultsReleased: false,
      allowAnswerReview: cfg.allowAnswerReview,
      security: { ...cfg.security, autoFinalizeOnTimeout: true },
    },
  });

  const exam = await createExam(input, adminId);
  const snapshot = { ...cfg, id: undefined, appliedAt: new Date(), subjectCounts: counts, difficultyCounts: difficulty, preset };
  await Exam.updateOne(
    { _id: exam._id },
    { $set: { generationMode: "quick", selectedSubjects: sel, defaultConfigurationId: new Types.ObjectId(cfg.id), appliedConfigurationSnapshot: snapshot } },
  );
  try {
    await generateExamPaper(String(exam._id), adminId);
  } catch (err) {
    // Do not leave a half-made draft behind: report the shortage and let the admin adjust.
    await ExamQuestion.deleteMany({ examId: exam._id });
    await Exam.deleteOne({ _id: exam._id });
    if (err instanceof AppError) throw new AppError(err.code, err.message, { ...(typeof err.details === "object" ? err.details : {}), plan: { subjects: counts, difficulty, total } });
    throw err;
  }
  await audit(adminId, "exam.quick_generate", "Exam", String(exam._id), { subjects: sel, counts, difficulty });
  return { id: String(exam._id), title, counts, difficulty };
}
