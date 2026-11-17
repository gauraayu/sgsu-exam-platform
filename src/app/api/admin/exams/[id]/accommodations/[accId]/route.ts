import { z } from "zod";
import { handler, json, parseBody, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { Accommodation } from "@/models";
import { decideAccommodation } from "@/services/attempt.service";

const schema = z.object({ approve: z.boolean(), note: z.string().max(1000).default("") });

export const PATCH = handler<{ id: string; accId: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id) || !isValidObjectId(params.accId)) throw notFound("Request");
  if (!(await Accommodation.exists({ _id: params.accId, examId: params.id }))) throw notFound("Request");
  const { approve, note } = await parseBody(req, schema);
  await decideAccommodation(params.accId, admin.id, approve, note);
  return json({ ok: true });
});
