import { handler, json } from "@/lib/api";
import { requireStudent } from "@/lib/auth";
import { getStudentResult } from "@/services/results.service";

export const GET = handler<{ attemptId: string }>(async (_req, { params }) => {
  const user = await requireStudent();
  return json(await getStudentResult(params.attemptId, user.id));
});
