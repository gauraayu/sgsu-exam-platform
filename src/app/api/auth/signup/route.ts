import { handler, json, parseBody } from "@/lib/api";
import { clientIp, createSession, throttle } from "@/lib/auth";
import { signupSchema } from "@/lib/validation/auth";
import { registerStudent } from "@/services/auth.service";

export const POST = handler(async (req) => {
  await throttle(`signup:${await clientIp()}`, 20, 3600);
  const input = await parseBody(req, signupSchema);
  const user = await registerStudent(input);
  await createSession(String(user._id), req.headers.get("user-agent") ?? "");
  return json({ user: { id: String(user._id), fullName: user.fullName, email: user.email, role: user.role, studentId: user.studentId } }, 201);
});
