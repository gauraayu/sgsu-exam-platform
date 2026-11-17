import { handler, json, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { attemptEvents } from "@/services/results.service";

export const GET = handler<{ id: string; attemptId: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!isValidObjectId(params.id) || !isValidObjectId(params.attemptId)) throw notFound("Attempt");
  return json({ events: await attemptEvents(params.id, params.attemptId) });
});
