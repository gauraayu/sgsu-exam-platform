import { handler, json } from "@/lib/api";
import { requireStudent } from "@/lib/auth";
import { submitAttempt } from "@/services/attempt.service";

export const POST = handler<{ id: string }>(async (_req, { params }) => {
  const user = await requireStudent();
  return json(await submitAttempt(params.id, user.id));
});
