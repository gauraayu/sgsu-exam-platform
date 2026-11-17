import { handler, json, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { setDefaultTemplate } from "@/services/exam-template.service";

export const POST = handler<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Template");
  return json({ template: await setDefaultTemplate(params.id, admin.id) });
});
