/**
 * Creates the initial administrator from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
 *   npm run seed:admin
 */
import "./_env";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { createAdmin } from "@/services/auth.service";
import { passwordSchema, emailSchema } from "@/lib/validation/auth";

async function main() {
  const email = emailSchema.parse(process.env.ADMIN_EMAIL);
  const password = passwordSchema.parse(process.env.ADMIN_PASSWORD);
  const fullName = process.env.ADMIN_NAME || "SGSU Examination Cell";
  await connectDB();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  const { created } = await createAdmin({ fullName, email, password });
  console.log(created ? `✔ Administrator ${email} created.` : `ℹ Administrator ${email} already exists (password unchanged).`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  await mongoose.disconnect();
  process.exit(1);
});
