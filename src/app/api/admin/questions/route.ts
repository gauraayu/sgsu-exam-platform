import { handler, json, parseBody, parseQuery } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { questionEditableSchema, questionListQuerySchema } from "@/lib/validation/questions";
import { createManualQuestion, listQuestions } from "@/services/question.service";

export const GET = handler(async (req) => {
  await requireAdmin();
  return json(await listQuestions(parseQuery(req, questionListQuerySchema)));
});

export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const data = await parseBody(req, questionEditableSchema);
  const q = await createManualQuestion(data, admin.id);
  return json({ id: String(q._id) }, 201);
});
