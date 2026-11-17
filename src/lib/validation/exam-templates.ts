import { z } from "zod";
import { RESULT_RELEASE_MODES, SOURCE_TYPES, SUBJECTS } from "@/lib/constants";
import { isValidTimezone } from "@/lib/timezone";
import { difficultyCountsSchema, securitySettingsSchema } from "./exams";

const count = z.coerce.number().int().min(0).max(500);

export const examTemplateSchema = z
  .object({
    name: z.string().trim().min(3, "Template name must be at least 3 characters.").max(120),
    description: z.string().trim().max(2000).default(""),
    category: z.string().trim().max(100).default("Entrance Assessment"),
    academicLevel: z.string().trim().max(60).default(""),
    totalQuestions: z.coerce.number().int().min(1, "At least one question is required.").max(500),
    subjectDistribution: z
      .array(z.object({ subject: z.enum(SUBJECTS), count, difficulty: difficultyCountsSchema.nullable().default(null), topics: z.array(z.string().max(200)).max(200).default([]) }))
      .min(1, "Select at least one subject."),
    difficultyDistribution: difficultyCountsSchema.nullable().default(null),
    questionSettings: z
      .object({
        shuffleQuestions: z.boolean().default(true),
        shuffleOptions: z.boolean().default(false),
        showTopic: z.boolean().default(false),
        includeNumerical: z.boolean().default(false),
        sources: z.array(z.enum(SOURCE_TYPES)).default([]),
      })
      .default({ shuffleQuestions: true, shuffleOptions: false, showTopic: false, includeNumerical: false, sources: [] }),
    markingScheme: z
      .object({
        correct: z.coerce.number().min(0.25).max(100).default(4),
        incorrect: z.coerce.number().min(0).max(100).default(1),
        unanswered: z.coerce.number().min(-100).max(100).default(0),
        passingPercentage: z.coerce.number().min(0).max(100).default(0),
      })
      .default({ correct: 4, incorrect: 1, unanswered: 0, passingPercentage: 0 }),
    duration: z.coerce.number().int().min(1, "Duration must be at least 1 minute.").max(600),
    instructions: z.string().trim().max(8000).default(""),
    securitySettings: securitySettingsSchema.default(securitySettingsSchema.parse({})),
    resultSettings: z
      .object({ resultRelease: z.enum(RESULT_RELEASE_MODES).default("immediate"), allowAnswerReview: z.boolean().default(false) })
      .default({ resultRelease: "immediate", allowAnswerReview: false }),
    schedulingDefaults: z
      .object({
        startBehavior: z.enum(["immediate", "scheduled"]).default("immediate"),
        accessDurationMinutes: z.coerce.number().int().min(5, "Access duration must be at least 5 minutes.").max(60 * 24 * 90).default(1440),
        expiryPolicy: z.enum(["allow_finish", "hard_end"]).default("allow_finish"),
        timezone: z.string().trim().max(60).refine(isValidTimezone, "Choose a valid time zone.").default("Asia/Kolkata"),
      })
      .default({ startBehavior: "immediate", accessDurationMinutes: 1440, expiryPolicy: "allow_finish", timezone: "Asia/Kolkata" }),
    isDefault: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    const subjects = v.subjectDistribution.map((s) => s.subject);
    if (new Set(subjects).size !== subjects.length) ctx.addIssue({ code: "custom", path: ["subjectDistribution"], message: "Each subject can appear only once." });
    const total = v.subjectDistribution.reduce((a, s) => a + s.count, 0);
    if (total !== v.totalQuestions) ctx.addIssue({ code: "custom", path: ["subjectDistribution"], message: `Subject counts add up to ${total}, but the template has ${v.totalQuestions} questions.` });
    v.subjectDistribution.forEach((s, i) => {
      if (s.difficulty && s.difficulty.Easy + s.difficulty.Medium + s.difficulty.Hard !== s.count)
        ctx.addIssue({ code: "custom", path: ["subjectDistribution", i, "difficulty"], message: `${s.subject} difficulty split must add up to ${s.count}.` });
    });
    if (v.difficultyDistribution) {
      const d = v.difficultyDistribution;
      if (d.Easy + d.Medium + d.Hard !== v.totalQuestions)
        ctx.addIssue({ code: "custom", path: ["difficultyDistribution"], message: `Difficulty counts must add up to ${v.totalQuestions}.` });
    }
  });
export type ExamTemplateInput = z.infer<typeof examTemplateSchema>;

export const templateListQuerySchema = z.object({ status: z.enum(["active", "archived", "all"]).default("active") });
