import { z } from "zod";
import { handler, json, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { SOURCE_TYPES, SUBJECTS } from "@/lib/constants";
import { availabilityFor } from "@/services/exam.service";

const schema = z.object({
  subjectDistribution: z.array(z.object({ subject: z.enum(SUBJECTS), count: z.number().int().min(0), topics: z.array(z.string()).default([]), difficulty: z.null().default(null) })).default([]),
  selection: z.object({ mode: z.literal("random").default("random"), sources: z.array(z.enum(SOURCE_TYPES)).default([]), includeNumerical: z.boolean().default(false), manualQuestionIds: z.array(z.string()).default([]) }),
});

/** Usable, complete question counts per subject and difficulty for the selected filters. */
export const POST = handler(async (req) => {
  await requireAdmin();
  const body = await parseBody(req, schema);
  const subjects = body.subjectDistribution.length ? body.subjectDistribution : SUBJECTS.map((s) => ({ subject: s, count: 0, topics: [], difficulty: null }));
  return json({ availability: await availabilityFor({ subjectDistribution: subjects, selection: body.selection }) });
});
