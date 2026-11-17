import { handler, json, parseBody } from "@/lib/api";
import { requireStudent } from "@/lib/auth";
import { saveAnswers } from "@/services/attempt.service";
import { answersPayloadSchema as schema } from "@/lib/validation/attempts";

/** Autosave endpoint. An empty list acts as a heartbeat for activity monitoring. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireStudent();
  const { answers } = await parseBody(req, schema);
  return json(await saveAnswers(params.id, user.id, answers));
});
