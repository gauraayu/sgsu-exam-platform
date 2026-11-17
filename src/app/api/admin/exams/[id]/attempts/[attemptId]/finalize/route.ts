import { handler, json, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { Attempt } from "@/models";
import { adminFinalizeAttempt } from "@/services/attempt.service";

export const POST = handler<{ id: string; attemptId: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id) || !isValidObjectId(params.attemptId)) throw notFound("Attempt");
  if (!(await Attempt.exists({ _id: params.attemptId, examId: params.id }))) throw notFound("Attempt");
  return json(await adminFinalizeAttempt(params.attemptId, admin.id));
});
