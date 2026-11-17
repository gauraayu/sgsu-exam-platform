import { z } from "zod";
import { handler, json, parseBody } from "@/lib/api";
import { requireStudent } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { getExamByToken } from "@/services/exam.service";
import { startAttempt } from "@/services/attempt.service";

const schema = z.object({ acknowledged: z.literal(true, { message: "Please confirm that you have read the instructions." }) });

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const user = await requireStudent();
  await parseBody(req, schema);
  const exam = await getExamByToken(params.id);
  if (!exam) throw notFound("Exam");
  // startAttempt enforces the schedule and closure with the same wording students see on the page.
  const r = await startAttempt(exam._id, user.id, req.headers.get("user-agent") ?? "");
  return json(r, r.resumed ? 200 : 201);
});
