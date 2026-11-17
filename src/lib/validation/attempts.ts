import { z } from "zod";

export const answerUpdateSchema = z.object({
  examQuestionId: z.string().regex(/^[a-f\d]{24}$/i),
  selectedOption: z.number().int().min(1).max(4).nullable().optional(),
  numericalValue: z.string().max(20).nullable().optional(),
  markedForReview: z.boolean().optional(),
  visited: z.boolean().optional(),
  /** Client mutation sequence; newer sequences win, older ones are ignored. */
  seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
});

export const answersPayloadSchema = z.object({ answers: z.array(answerUpdateSchema).max(500) });
