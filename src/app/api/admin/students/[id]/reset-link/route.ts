import { handler, json, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { adminCreateResetLink } from "@/services/auth.service";

export const POST = handler<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Student");
  return json(await adminCreateResetLink(admin.id, params.id));
});
