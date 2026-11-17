import { handler, json, parseBody, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { replaceQuestionSchema } from "@/lib/validation/exams";
import { replaceExamQuestion } from "@/services/exam.service";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Exam");
  const { examQuestionId, replacementQuestionId } = await parseBody(req, replaceQuestionSchema);
  const eq = await replaceExamQuestion(params.id, examQuestionId, admin.id, replacementQuestionId);
  return json({ examQuestion: { ...eq, id: String(eq._id) } });
});
