import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDb, teardownTestDb } from "../helpers/db";
import { User, Session, PasswordResetToken } from "@/models";
import { registerStudent, authenticate, requestPasswordReset, resetPassword, adminCreateResetLink, createAdmin } from "@/services/auth.service";
import { hashToken } from "@/lib/auth";
import { signupSchema } from "@/lib/validation/auth";

beforeAll(() => setupTestDb("auth"));
afterAll(teardownTestDb);

const input = signupSchema.parse({
  fullName: "Riya Sharma",
  email: "Riya.Sharma@Example.com",
  mobile: "9876543210",
  password: "Exam@2026",
  confirmPassword: "Exam@2026",
  academicLevel: "Class 12",
  institutionName: "Delhi Public School, Bhopal",
});

describe("student registration & login", () => {
  it("validates signup input", () => {
    expect(() => signupSchema.parse({ ...input, confirmPassword: "nope" })).toThrow(/do not match/);
    expect(() => signupSchema.parse({ ...input, password: "short", confirmPassword: "short" })).toThrow();
    expect(() => signupSchema.parse({ ...input, email: "bad" })).toThrow(/valid email/);
  });

  it("registers permanently with a hashed password and unique student ID", async () => {
    const u = await registerStudent(input);
    const stored = await User.findById(u._id).select("+passwordHash").lean();
    expect(stored!.email).toBe("riya.sharma@example.com");
    expect(stored!.passwordHash).toMatch(/^\$2[aby]\$11\$/);
    expect(stored!.passwordHash).not.toContain("Exam@2026");
    expect(stored!.studentId).toMatch(/^SGSU\d{4}\d{5}$/);
    const u2 = await registerStudent({ ...input, email: "other@example.com" });
    expect(u2.studentId).not.toBe(u.studentId);
  });

  it("rejects duplicate emails (case-insensitive), including concurrent signups", async () => {
    await expect(registerStudent({ ...input, email: "RIYA.sharma@example.com" })).rejects.toThrow(/already exists/);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => registerStudent({ ...input, email: "race@example.com" })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await User.countDocuments({ email: "race@example.com" })).toBe(1);
  });

  it("authenticates with correct credentials only", async () => {
    await expect(authenticate("riya.sharma@example.com", "Exam@2026")).resolves.toBeTruthy();
    await expect(authenticate("riya.sharma@example.com", "wrong")).rejects.toThrow("Incorrect email or password.");
    await expect(authenticate("nobody@example.com", "Exam@2026")).rejects.toThrow("Incorrect email or password.");
    await User.updateOne({ email: "other@example.com" }, { $set: { status: "disabled" } });
    await expect(authenticate("other@example.com", "Exam@2026")).rejects.toThrow(/disabled/);
  });

  it("resets passwords with a single-use token and revokes sessions", async () => {
    const u = await User.findOne({ email: "riya.sharma@example.com" });
    await Session.create({ tokenHash: "x".repeat(64), userId: u!._id, expiresAt: new Date(Date.now() + 1e6) });
    expect(await requestPasswordReset("nobody@example.com")).toEqual({ delivered: false });
    await requestPasswordReset("riya.sharma@example.com");
    expect(await PasswordResetToken.countDocuments({ userId: u!._id })).toBe(1);

    const admin = (await createAdmin({ fullName: "A", email: "a@sgsu.ac.in", password: "Admin@12345" })).user;
    const { link } = await adminCreateResetLink(String(admin._id), String(u!._id));
    const token = new URL(link).searchParams.get("token")!;
    expect(await PasswordResetToken.exists({ tokenHash: hashToken(token) })).toBeTruthy();
    await resetPassword(token, "NewPass@2026");
    await expect(resetPassword(token, "Another@2026")).rejects.toThrow(/invalid or has expired/);
    await expect(authenticate("riya.sharma@example.com", "NewPass@2026")).resolves.toBeTruthy();
    expect(await Session.countDocuments({ userId: u!._id })).toBe(0);
  });
});
