import { z } from "zod";
import { ASSET_STATUSES, DIFFICULTY_VALUES, QUESTION_TYPES, SOURCE_TYPES, SUBJECTS, VERIFICATION_STATUSES } from "@/lib/constants";

const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.array(z.enum(values))])
    .optional()
    .transform((v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]));

export const questionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  subject: csv(SUBJECTS),
  difficulty: csv(DIFFICULTY_VALUES),
  questionType: csv(QUESTION_TYPES),
  sourceType: csv(SOURCE_TYPES),
  verificationStatus: csv(VERIFICATION_STATUSES),
  assetStatus: csv(ASSET_STATUSES),
  topic: z.string().trim().max(200).optional(),
  hasIssues: z.enum(["true", "false"]).optional(),
  archived: z.enum(["true", "false"]).optional(),
  sort: z.enum(["createdAt", "-createdAt", "subject", "difficulty", "originalQuestionId"]).default("-createdAt"),
});
export type QuestionListQuery = z.infer<typeof questionListQuerySchema>;

export const questionEditableSchema = z
  .object({
    subject: z.enum(SUBJECTS),
    chapter: z.string().trim().max(200).default(""),
    topic: z.string().trim().max(200).default(""),
    subtopic: z.string().trim().max(200).default(""),
    academicLevel: z.string().trim().max(60).default(""),
    difficulty: z.enum(DIFFICULTY_VALUES),
    questionType: z.enum(QUESTION_TYPES),
    questionText: z.string().trim().min(1, "Question text is required.").max(20000),
    options: z.array(z.string().max(5000)).max(4).default([]),
    correctOption: z.number().int().min(1).max(4).nullable().default(null),
    numericalAnswer: z.string().trim().max(50).nullable().default(null),
    numericalTolerance: z.number().min(0).max(1000).default(0),
    explanation: z.string().max(20000).default(""),
    questionImages: z.array(z.string().max(500)).max(10).default([]),
    solutionImages: z.array(z.string().max(500)).max(10).default([]),
    originalQuestionId: z.string().trim().max(100).default(""),
    originalSource: z.string().trim().max(300).default(""),
    sourceLicense: z.string().trim().max(300).default(""),
  })
  .superRefine((v, ctx) => {
    if (v.questionType === "single_correct" && v.options.length !== 4)
      ctx.addIssue({ code: "custom", path: ["options"], message: "Single-correct questions need exactly four options." });
  });
export type QuestionEditable = z.infer<typeof questionEditableSchema>;

export const questionPatchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), data: questionEditableSchema }),
  z.object({ action: z.literal("verify"), confirmImages: z.boolean().optional() }),
  z.object({ action: z.literal("reject"), reason: z.string().trim().min(3, "Give a short reason.").max(500) }),
  z.object({ action: z.literal("reset_review") }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("restore") }),
]);

export const bulkActionSchema = z.object({
  ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(500),
  action: z.enum(["verify", "reject", "archive", "restore", "reset_review"]),
  reason: z.string().trim().max(500).optional(),
});
