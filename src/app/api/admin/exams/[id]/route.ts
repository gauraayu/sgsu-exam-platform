import { handler, json, parseBody, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { Exam } from "@/models";
import { examConfigSchema, publishedExamPatchSchema } from "@/lib/validation/exams";
import { deleteDraftExam, getExamForAdmin, updateDraftExam, updatePublishedExam } from "@/services/exam.service";

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Exam");
  return json(await getExamForAdmin(params.id));
});

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Exam");
  const exam = await Exam.findById(params.id).select("status").lean();
  if (!exam) throw notFound("Exam");
  if (exam.status === "draft") await updateDraftExam(params.id, await parseBody(req, examConfigSchema), admin.id);
  else await updatePublishedExam(params.id, await parseBody(req, publishedExamPatchSchema), admin.id);
  return json(await getExamForAdmin(params.id));
});

export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Exam");
  await deleteDraftExam(params.id, admin.id);
  return json({ ok: true });
});
