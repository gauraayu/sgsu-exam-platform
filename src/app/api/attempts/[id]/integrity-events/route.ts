import { z } from "zod";
import { handler, json, parseBody } from "@/lib/api";
import { requireStudent } from "@/lib/auth";
import { INTEGRITY_EVENT_TYPES } from "@/lib/constants";
import { recordIntegrityEvent } from "@/services/attempt.service";

const schema = z.object({
  clientEventId: z.string().min(8).max(64).regex(/^[\w-]+$/),
  eventType: z.enum(INTEGRITY_EVENT_TYPES),
  occurredAt: z.coerce.date().optional(),
  metadata: z
    .record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean(), z.null()]))
    .refine((m) => Object.keys(m).length <= 12, "Too many metadata fields.")
    .optional(),
});

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireStudent();
  const input = await parseBody(req, schema);
  return json(await recordIntegrityEvent(params.id, user.id, input));
});
