import { handler, json, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validation/auth";
import { changePassword } from "@/services/auth.service";

export const POST = handler(async (req) => {
  const user = await requireUser();
  const input = await parseBody(req, changePasswordSchema);
  await changePassword(user.id, input.currentPassword, input.password);
  return json({ ok: true });
});
