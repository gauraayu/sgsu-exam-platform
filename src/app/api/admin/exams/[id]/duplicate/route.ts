import { z } from "zod";
import { handler, json, parseBody, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { duplicateExam } from "@/services/exam.service";

const schema = z.object({ copyPaper: z.boolean().default(true) });

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Exam");
  const { copyPaper } = await parseBody(req, schema);
  const copy = await duplicateExam(params.id, admin.id, copyPaper);
  return json({ id: String(copy._id) }, 201);
});
