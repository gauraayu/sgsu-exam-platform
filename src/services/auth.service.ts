import "server-only";
import { Types } from "mongoose";
import { User, Session, PasswordResetToken, nextSequence, audit } from "@/models";
import { generateToken, hashPassword, hashToken, verifyPassword } from "@/lib/auth";
import { AppError, conflict } from "@/lib/errors";
import { env } from "@/lib/env";
import { sendMail } from "@/lib/mailer";
import type { SignupInput } from "@/lib/validation/auth";

const RESET_TTL_MINUTES = 60;
let dummyHash: Promise<string> | null = null;
/** Hash used to keep response timing similar for unknown emails and wrong passwords. */
const getDummyHash = () => (dummyHash ??= hashPassword(generateToken(12)));

export async function generateStudentId(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`studentId-${year}`);
  return `SGSU${year}${String(seq).padStart(5, "0")}`;
}

export async function registerStudent(input: SignupInput) {
  const exists = await User.exists({ email: input.email });
  if (exists) throw conflict("An account with this email already exists. Please sign in instead.");
  const passwordHash = await hashPassword(input.password);
  const studentId = await generateStudentId();
  try {
    const user = await User.create({
      fullName: input.fullName,
      email: input.email,
      mobile: input.mobile,
      passwordHash,
      role: "STUDENT",
      studentId,
      academicLevel: input.academicLevel,
      institutionName: input.institutionName,
      lastLoginAt: new Date(),
      lastActivityAt: new Date(),
    });
    return user;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw conflict("An account with this email already exists. Please sign in instead.");
    throw err;
  }
}

/** Verifies credentials. The same generic error is used for unknown emails and wrong passwords. */
export async function authenticate(email: string, password: string) {
  const user = await User.findOne({ email }).select("+passwordHash");
  const invalid = new AppError("UNAUTHENTICATED", "Incorrect email or password.");
  if (!user) {
    await verifyPassword(password, await getDummyHash());
    throw invalid;
  }
  if (!(await verifyPassword(password, user.passwordHash))) throw invalid;
  if (user.status !== "active") throw new AppError("FORBIDDEN", "This account has been disabled. Please contact the examination cell.");
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date(), lastActivityAt: new Date() } });
  return user;
}

async function createResetToken(userId: Types.ObjectId, createdBy: Types.ObjectId | null = null) {
  const token = generateToken();
  await PasswordResetToken.create({
    tokenHash: hashToken(token),
    userId,
    createdBy,
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
  });
  return `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

/** Always resolves without revealing whether the email exists. */
export async function requestPasswordReset(email: string): Promise<{ delivered: boolean }> {
  const user = await User.findOne({ email, status: "active" }).lean();
  if (!user) return { delivered: false };
  const link = await createResetToken(user._id);
  const delivered = await sendMail(
    user.email,
    "Reset your SGSU Smart Assessment Portal password",
    `Hello ${user.fullName},\n\nUse the link below to reset your password. It expires in ${RESET_TTL_MINUTES} minutes.\n\n${link}\n\nIf you did not request this, you can ignore this email.\n\nSGSU Examination Cell`,
  );
  return { delivered };
}

/** Admin-issued reset link (used when SMTP is not configured or a student cannot receive email). */
export async function adminCreateResetLink(adminId: string, userId: string) {
  const user = await User.findById(userId).lean();
  if (!user) throw new AppError("NOT_FOUND", "User not found.");
  const link = await createResetToken(user._id, new Types.ObjectId(adminId));
  await audit(adminId, "user.reset_link_created", "User", userId);
  return { link, expiresInMinutes: RESET_TTL_MINUTES };
}

export async function resetPassword(token: string, password: string) {
  const record = await PasswordResetToken.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!record) throw new AppError("BAD_REQUEST", "This reset link is invalid or has expired. Please request a new one.");
  await User.updateOne({ _id: record.userId }, { $set: { passwordHash: await hashPassword(password) } });
  // Sign out everywhere after a password reset.
  await Session.deleteMany({ userId: record.userId });
  return { userId: String(record.userId) };
}

export async function changePassword(userId: string, currentPassword: string, password: string) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw new AppError("NOT_FOUND", "User not found.");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw new AppError("BAD_REQUEST", "Current password is incorrect.");
  user.passwordHash = await hashPassword(password);
  await user.save();
}

export async function createAdmin(input: { fullName: string; email: string; password: string; mobile?: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== "ADMIN") throw conflict("A student account already uses this email.");
    return { user: existing, created: false };
  }
  const user = await User.create({
    fullName: input.fullName,
    email,
    mobile: input.mobile ?? "",
    passwordHash: await hashPassword(input.password),
    role: "ADMIN",
  });
  return { user, created: true };
}
