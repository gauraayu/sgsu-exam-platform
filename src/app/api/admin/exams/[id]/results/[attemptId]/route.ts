import { handler, json, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { adminAttemptDetail } from "@/services/results.service";

export const GET = handler<{ id: string; attemptId: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!isValidObjectId(params.id) || !isValidObjectId(params.attemptId)) throw notFound("Attempt");
  return json(await adminAttemptDetail(params.id, params.attemptId));
});
