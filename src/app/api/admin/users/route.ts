import { z } from "zod";
import { handler, json, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { User, audit } from "@/models";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";
import { createAdmin } from "@/services/auth.service";
import { conflict } from "@/lib/errors";

export const GET = handler(async () => {
  await requireAdmin();
  const admins = await User.find({ role: "ADMIN" }).select("fullName email createdAt lastLoginAt status").sort({ createdAt: 1 }).lean();
  return json({ admins: admins.map((a) => ({ ...a, id: String(a._id) })) });
});

const schema = z.object({ fullName: z.string().trim().min(2).max(120), email: emailSchema, password: passwordSchema });

export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, schema);
  const { user, created } = await createAdmin(input);
  if (!created) throw conflict("An administrator with this email already exists.");
  await audit(admin.id, "admin.create", "User", String(user._id));
  return json({ id: String(user._id) }, 201);
});
