import { handler, json } from "@/lib/api";
import { requireStudent } from "@/lib/auth";
import { getAttemptForStudent } from "@/services/attempt.service";

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  const user = await requireStudent();
  return json(await getAttemptForStudent(params.id, user.id));
});
