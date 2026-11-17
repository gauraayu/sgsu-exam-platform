import { handler, json, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { examMonitoring } from "@/services/results.service";

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Exam");
  return json(await examMonitoring(params.id));
});
