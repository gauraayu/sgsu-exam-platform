import { handler, json, parseBody } from "@/lib/api";
import { clearThrottle, clientIp, createSession, throttle } from "@/lib/auth";
import { loginSchema } from "@/lib/validation/auth";
import { authenticate } from "@/services/auth.service";

export const POST = handler(async (req) => {
  const input = await parseBody(req, loginSchema);
  const key = `login:${input.email}:${await clientIp()}`;
  await throttle(key, 10, 15 * 60);
  const user = await authenticate(input.email, input.password);
  await clearThrottle(key);
  await createSession(String(user._id), req.headers.get("user-agent") ?? "");
  return json({ user: { id: String(user._id), fullName: user.fullName, email: user.email, role: user.role, studentId: user.studentId ?? null } });
});
