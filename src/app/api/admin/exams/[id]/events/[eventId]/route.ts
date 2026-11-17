import { z } from "zod";
import { handler, json, parseBody, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { reviewIntegrityEvent } from "@/services/results.service";

const schema = z.object({ reviewStatus: z.enum(["reviewed", "dismissed", "flagged"]), note: z.string().max(500).default("") });

export const PATCH = handler<{ id: string; eventId: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id) || !isValidObjectId(params.eventId)) throw notFound("Event");
  const { reviewStatus, note } = await parseBody(req, schema);
  await reviewIntegrityEvent(params.id, params.eventId, admin.id, reviewStatus, note);
  return json({ ok: true });
});
