import { handler, json, parseBody } from "@/lib/api";
import { clientIp, throttle } from "@/lib/auth";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPassword } from "@/services/auth.service";

export const POST = handler(async (req) => {
  await throttle(`reset:${await clientIp()}`, 20, 3600);
  const { token, password } = await parseBody(req, resetPasswordSchema);
  await resetPassword(token, password);
  return json({ ok: true });
});
