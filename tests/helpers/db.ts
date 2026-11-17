import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import { connectDB, disconnectDB } from "@/lib/db";
import "@/models";

/** Connects to a fresh, uniquely named database on the real MongoDB test server. */
export async function setupTestDb(label: string) {
  const name = `sgsu_test_${label}_${randomBytes(3).toString("hex")}`;
  const base = process.env.MONGODB_TEST_URI ?? "mongodb://127.0.0.1:27017";
  await connectDB(`${base}/${name}`);
  // Build all indexes (unique constraints are relied upon by the code under test).
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  return name;
}

export async function teardownTestDb() {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await disconnectDB();
}
