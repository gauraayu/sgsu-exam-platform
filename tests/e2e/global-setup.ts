import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/** Starts every E2E run from an empty database with one administrator account. */
export default async function globalSetup() {
  const uri = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/sgsu_e2e";
  const conn = await mongoose.createConnection(uri).asPromise();
  await conn.dropDatabase();
  await conn.collection("users").createIndex({ email: 1 }, { unique: true });
  await conn.collection("users").insertOne({
    fullName: "E2E Examination Cell",
    email: "admin@e2e.sgsu",
    passwordHash: await bcrypt.hash("Admin@12345", 11),
    role: "ADMIN",
    status: "active",
    mobile: "",
    academicLevel: "",
    institutionName: "",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await conn.close();
}
