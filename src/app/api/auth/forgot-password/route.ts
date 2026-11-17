import { handler, json, parseBody } from "@/lib/api";
import { clientIp, throttle } from "@/lib/auth";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/services/auth.service";

export const POST = handler(async (req) => {
  const { email } = await parseBody(req, forgotPasswordSchema);
  await throttle(`forgot:${await clientIp()}`, 10, 3600);
  await requestPasswordReset(email);
  // Same response whether or not the account exists.
  return json({ ok: true, message: "If an account exists for this email, a password reset link has been sent." });
});
