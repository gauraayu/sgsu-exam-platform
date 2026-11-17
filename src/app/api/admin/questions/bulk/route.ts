import { handler, json, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { bulkActionSchema } from "@/lib/validation/questions";
import { bulkAction } from "@/services/question.service";

export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const { ids, action, reason } = await parseBody(req, bulkActionSchema);
  return json(await bulkAction(ids, action, admin.id, reason));
});
