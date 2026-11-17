import { handler, json, parseBody } from "@/lib/api";
import { requireStudent } from "@/lib/auth";
import { profileUpdateSchema } from "@/lib/validation/auth";
import { User } from "@/models";

export const GET = handler(async () => json({ user: await requireStudent() }));

export const PATCH = handler(async (req) => {
  const user = await requireStudent();
  const input = await parseBody(req, profileUpdateSchema);
  await User.updateOne({ _id: user.id }, { $set: input });
  return json({ ok: true });
});
