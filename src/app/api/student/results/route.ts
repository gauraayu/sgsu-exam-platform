import { handler, json } from "@/lib/api";
import { requireStudent } from "@/lib/auth";
import { listStudentAttempts } from "@/services/results.service";
import { finalizeOverdueAttempts } from "@/services/attempt.service";

export const GET = handler(async () => {
  const user = await requireStudent();
  await finalizeOverdueAttempts();
  return json({ attempts: await listStudentAttempts(user.id) });
});
