import { handler, json, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { ImportBatch } from "@/models";

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Import batch");
  const b = await ImportBatch.findById(params.id).populate("importedBy", "fullName email").lean();
  if (!b) throw notFound("Import batch");
  return json({ batch: { ...b, id: String(b._id) } });
});
