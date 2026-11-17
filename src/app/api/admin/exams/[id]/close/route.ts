import { handler, json, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { closeExam } from "@/services/exam.service";

export const maxDuration = 60;

export const POST = handler<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Exam");
  const result = await closeExam(params.id, admin.id);
  return json({ ok: true, result: result ?? null });
});
