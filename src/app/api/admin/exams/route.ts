import { handler, json, parseBody, parseQuery } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { examConfigSchema, examListQuerySchema } from "@/lib/validation/exams";
import { createExam, listExams } from "@/services/exam.service";

export const GET = handler(async (req) => {
  await requireAdmin();
  return json(await listExams(parseQuery(req, examListQuerySchema)));
});

export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const exam = await createExam(await parseBody(req, examConfigSchema), admin.id);
  return json({ id: String(exam._id) }, 201);
});
