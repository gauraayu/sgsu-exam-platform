import { z } from "zod";
import { handler, json, parseBody, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { Attempt } from "@/models";
import { adminResetAttempt } from "@/services/attempt.service";

const schema = z.object({ reason: z.string().trim().min(5, "Record a reason for the reset (at least 5 characters).").max(500) });

export const POST = handler<{ id: string; attemptId: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id) || !isValidObjectId(params.attemptId)) throw notFound("Attempt");
  const { reason } = await parseBody(req, schema);
  if (!(await Attempt.exists({ _id: params.attemptId, examId: params.id }))) throw notFound("Attempt");
  return json(await adminResetAttempt(params.attemptId, admin.id, reason));
});
