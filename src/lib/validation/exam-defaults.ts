import { z } from "zod";
import { RESULT_RELEASE_MODES, SUBJECTS } from "@/lib/constants";

const pct = z.coerce.number().int().min(0).max(100);
export const examDefaultsSchema = z
  .object({
    name: z.string().trim().min(1).max(120).default("Default examination settings"),
    examCategory: z.string().trim().max(100).default("Entrance Assessment"),
    titlePattern: z.string().trim().min(3, "Title pattern is required.").max(200).default("SGSU {subjects} Assessment"),
    totalQuestions: z.coerce.number().int().min(1).max(500),
    durationMinutes: z.coerce.number().int().min(1).max(600),
    difficultyPercent: z.object({ Easy: pct, Medium: pct, Hard: pct }),
    presets: z
      .array(z.object({ name: z.string().trim().min(1).max(80), counts: z.partialRecord(z.enum(SUBJECTS), z.coerce.number().int().min(0).max(500)) }))
      .max(20)
      .default([]),
    marking: z.object({ correct: z.coerce.number().min(0.25).max(100), incorrect: z.coerce.number().min(0).max(100), unanswered: z.coerce.number().min(-100).max(100) }),
    passingPercentage: pct,
    shuffleQuestions: z.boolean(),
    shuffleOptions: z.boolean(),
    includeNumerical: z.boolean().default(false),
    security: z.object({
      oneAttempt: z.boolean(),
      fullscreen: z.boolean(),
      tabSwitchWarnings: z.boolean(),
      fullscreenExitWarnings: z.boolean(),
      maxWarnings: z.coerce.number().int().min(1).max(20),
      terminateOnMaxWarnings: z.boolean(),
      camera: z.boolean(),
      microphone: z.boolean(),
      soundMonitoring: z.boolean(),
    }),
    resultRelease: z.enum(RESULT_RELEASE_MODES),
    allowAnswerReview: z.boolean(),
    defaultValidityDays: z.coerce.number().int().min(1, "Validity must be at least 1 day.").max(365),
  })
  .superRefine((v, ctx) => {
    const sum = v.difficultyPercent.Easy + v.difficultyPercent.Medium + v.difficultyPercent.Hard;
    if (sum !== 100) ctx.addIssue({ code: "custom", path: ["difficultyPercent"], message: `Difficulty percentages add up to ${sum}%; they must add up to 100%.` });
    v.presets.forEach((p, i) => {
      const total = Object.values(p.counts).reduce((a: number, n) => a + (n ?? 0), 0);
      if (total <= 0) ctx.addIssue({ code: "custom", path: ["presets", i], message: `Preset "${p.name}" needs at least one subject count.` });
    });
  });
export type ExamDefaultsInput = z.infer<typeof examDefaultsSchema>;

export const quickGenerateSchema = z.object({
  subjects: z.array(z.enum(SUBJECTS)).min(1, "Select at least one subject.").max(SUBJECTS.length),
});
