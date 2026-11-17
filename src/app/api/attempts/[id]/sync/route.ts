import { handler, json, parseBody } from "@/lib/api";
import { requireStudent } from "@/lib/auth";
import { syncAttempt } from "@/services/attempt.service";
import { answersPayloadSchema } from "@/lib/validation/attempts";

/**
 * Called after a reconnection or a page reload. Requires a valid session (so it also proves the
 * backend is reachable), applies queued answers that are still newer than the server's, and
 * returns the authoritative attempt state.
 */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireStudent();
  const { answers } = await parseBody(req, answersPayloadSchema);
  return json(await syncAttempt(params.id, user.id, answers));
});
