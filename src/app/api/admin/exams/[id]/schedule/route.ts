import { handler, json, parseBody, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { examScheduleSchema } from "@/lib/validation/exams";
import { getExamForAdmin, updateExamSchedule } from "@/services/exam.service";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Exam");
  await updateExamSchedule(params.id, await parseBody(req, examScheduleSchema), admin.id);
  return json(await getExamForAdmin(params.id));
});
