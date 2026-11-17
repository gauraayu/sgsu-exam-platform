import { handler, json, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { quickGenerateSchema } from "@/lib/validation/exam-defaults";
import { quickGenerateExam } from "@/services/exam-defaults.service";

export const maxDuration = 60;

/** Creates a draft exam from the saved defaults and generates its paper. Nothing is published. */
export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const { subjects } = await parseBody(req, quickGenerateSchema);
  return json(await quickGenerateExam(subjects, admin.id), 201);
});
