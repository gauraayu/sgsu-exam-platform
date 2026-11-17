import { z } from "zod";
import { RESULT_RELEASE_MODES, SOURCE_TYPES, SUBJECTS } from "@/lib/constants";
import { isValidTimezone } from "@/lib/timezone";

const count = z.coerce.number().int().min(0).max(500);
export const difficultyCountsSchema = z.object({ Easy: count, Medium: count, Hard: count });

export const securitySettingsSchema = z.object({
  fullscreen: z.boolean().default(true),
  tabSwitchWarnings: z.boolean().default(true),
  fullscreenExitWarnings: z.boolean().default(true),
  camera: z.boolean().default(false),
  microphone: z.boolean().default(false),
  soundMonitoring: z.boolean().default(false),
  soundThreshold: z.coerce.number().int().min(1).max(100).default(60),
  soundMinDurationMs: z.coerce.number().int().min(500).max(60000).default(3000),
  maxWarnings: z.coerce.number().int().min(1).max(20).default(3),
  terminateOnMaxWarnings: z.boolean().default(true),
  oneAttempt: z.boolean().default(true),
  autoFinalizeOnTimeout: z.boolean().default(true),
});

export const examSettingsSchema = z.object({
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(false),
  showTopic: z.boolean().default(false),
  resultRelease: z.enum(RESULT_RELEASE_MODES).default("immediate"),
  resultsReleased: z.boolean().default(false),
  allowAnswerReview: z.boolean().default(false),
  security: securitySettingsSchema.default(securitySettingsSchema.parse({})),
});

const isoDate = z.coerce.date({ message: "Enter a valid date and time." });

export const examDetailsSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200),
  description: z.string().trim().max(4000).default(""),
  category: z.string().trim().max(100).default("Entrance Assessment"),
  academicLevel: z.string().trim().max(60).default(""),
  durationMinutes: z.coerce.number().int().min(1, "Duration must be at least 1 minute.").max(600),
  totalQuestions: z.coerce.number().int().min(1, "At least one question is required.").max(500),
  startDate: isoDate,
  endDate: isoDate,
  passingMarks: z.coerce.number().min(0).default(0),
  instructions: z.string().trim().max(8000).default(""),
  /** Scheduling: start right after publishing (for `accessValidityMinutes`) or at a scheduled time. */
  scheduleMode: z.enum(["immediate", "scheduled"]).default("scheduled"),
  accessValidityMinutes: z.coerce.number().int().min(0).max(60 * 24 * 90).default(0),
  timezone: z.string().trim().max(60).refine(isValidTimezone, "Choose a valid time zone.").default("Asia/Kolkata"),
  /** When true, running attempts also end at the exam's end time. */
  hardEnd: z.boolean().default(false),
  templateId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
});

export const examConfigSchema = examDetailsSchema
  .extend({
    subjectDistribution: z
      .array(
        z.object({
          subject: z.enum(SUBJECTS),
          count,
          difficulty: difficultyCountsSchema.nullable().default(null),
          topics: z.array(z.string().max(200)).max(200).default([]),
        }),
      )
      .default([]),
    difficultyDistribution: difficultyCountsSchema.nullable().default(null),
    selection: z
      .object({
        mode: z.enum(["random", "manual"]).default("random"),
        sources: z.array(z.enum(SOURCE_TYPES)).default([]),
        includeNumerical: z.boolean().default(false),
        manualQuestionIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(500).default([]),
      })
      .default({ mode: "random", sources: [], includeNumerical: false, manualQuestionIds: [] }),
    marking: z
      .object({
        correct: z.coerce.number().min(0.25).max(100).default(4),
        incorrect: z.coerce.number().min(0).max(100).default(1),
        unanswered: z.coerce.number().min(-100).max(100).default(0),
      })
      .default({ correct: 4, incorrect: 1, unanswered: 0 }),
    settings: examSettingsSchema.default(examSettingsSchema.parse({})),
  })
  .superRefine((v, ctx) => {
    if (v.scheduleMode === "immediate" && v.accessValidityMinutes < 5)
      ctx.addIssue({ code: "custom", path: ["accessValidityMinutes"], message: "Access validity must be at least 5 minutes." });
    if (v.endDate <= v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be after the start date." });
    if (v.selection.mode === "random") {
      const subjectTotal = v.subjectDistribution.reduce((a, s) => a + s.count, 0);
      if (subjectTotal !== v.totalQuestions)
        ctx.addIssue({ code: "custom", path: ["subjectDistribution"], message: `Subject counts add up to ${subjectTotal}, but the exam has ${v.totalQuestions} questions.` });
      v.subjectDistribution.forEach((s, i) => {
        if (s.difficulty) {
          const t = s.difficulty.Easy + s.difficulty.Medium + s.difficulty.Hard;
          if (t !== s.count)
            ctx.addIssue({ code: "custom", path: ["subjectDistribution", i, "difficulty"], message: `${s.subject} difficulty split adds up to ${t}, expected ${s.count}.` });
        }
      });
      if (v.difficultyDistribution) {
        const d = v.difficultyDistribution;
        const t = d.Easy + d.Medium + d.Hard;
        if (t !== v.totalQuestions)
          ctx.addIssue({ code: "custom", path: ["difficultyDistribution"], message: `Difficulty counts add up to ${t}, but the exam has ${v.totalQuestions} questions.` });
      }
    } else if (v.selection.manualQuestionIds.length !== v.totalQuestions) {
      ctx.addIssue({
        code: "custom",
        path: ["selection", "manualQuestionIds"],
        message: `Select exactly ${v.totalQuestions} questions (currently ${v.selection.manualQuestionIds.length}).`,
      });
    }
    const maxMarks = v.totalQuestions * v.marking.correct;
    if (v.passingMarks > maxMarks) ctx.addIssue({ code: "custom", path: ["passingMarks"], message: `Passing marks cannot exceed the total marks (${maxMarks}).` });
  });
export type ExamConfigInput = z.infer<typeof examConfigSchema>;

/** Fields that may still change after an exam is published. */
export const publishedExamPatchSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  instructions: z.string().trim().max(8000).optional(),
  category: z.string().trim().max(100).optional(),
  endDate: isoDate.optional(),
  settings: z
    .object({
      resultRelease: z.enum(RESULT_RELEASE_MODES).optional(),
      resultsReleased: z.boolean().optional(),
      allowAnswerReview: z.boolean().optional(),
      showTopic: z.boolean().optional(),
    })
    .optional(),
});

/** Schedule edits. Allowed on drafts and on published exams (with restrictions enforced by the service). */
export const examScheduleSchema = z
  .object({
    scheduleMode: z.enum(["immediate", "scheduled"]),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    accessValidityMinutes: z.coerce.number().int().min(5).max(60 * 24 * 90).optional(),
    timezone: z.string().trim().max(60).refine(isValidTimezone, "Choose a valid time zone."),
    hardEnd: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.scheduleMode === "scheduled") {
      if (!v.startDate || !v.endDate) ctx.addIssue({ code: "custom", path: ["startDate"], message: "Enter both a start and an end time." });
      else if (v.endDate <= v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End time must be after the start time." });
    } else if (!v.accessValidityMinutes) ctx.addIssue({ code: "custom", path: ["accessValidityMinutes"], message: "Enter how long the exam stays open." });
  });
export type ExamScheduleInput = z.infer<typeof examScheduleSchema>;

export const replaceQuestionSchema = z.object({
  examQuestionId: z.string().regex(/^[a-f\d]{24}$/i),
  replacementQuestionId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

export const examListQuerySchema = z.object({
  status: z.enum(["draft", "published", "scheduled", "active", "expired", "closed", "archived", "all"]).default("all"),
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});
