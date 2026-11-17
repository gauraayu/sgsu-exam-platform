import { handler, json, parseBody, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { questionPatchSchema } from "@/lib/validation/questions";
import { getQuestion, setArchived, setReviewStatus, updateQuestion, verifyQuestion } from "@/services/question.service";

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Question");
  return json({ question: await getQuestion(params.id) });
});

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Question");
  const body = await parseBody(req, questionPatchSchema);
  switch (body.action) {
    case "update":
      await updateQuestion(params.id, body.data, admin.id);
      break;
    case "verify":
      await verifyQuestion(params.id, admin.id, body.confirmImages);
      break;
    case "reject":
      await setReviewStatus(params.id, admin.id, "rejected", body.reason);
      break;
    case "reset_review":
      await setReviewStatus(params.id, admin.id, "pending");
      break;
    case "archive":
      await setArchived(params.id, admin.id, true);
      break;
    case "restore":
      await setArchived(params.id, admin.id, false);
      break;
  }
  return json({ question: await getQuestion(params.id) });
});

/** Soft delete: questions are archived so that exam history and snapshots stay intact. */
export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Question");
  await setArchived(params.id, admin.id, true);
  return json({ ok: true });
});
