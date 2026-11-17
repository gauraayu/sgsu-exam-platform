import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { Session, User, Throttle } from "@/models";
import { AppError } from "./errors";
import { env } from "./env";
import { SESSION_COOKIE, SESSION_TTL_DAYS, type Role } from "./constants";
import { connectDB } from "./db";

const BCRYPT_COST = 11;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}
export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
/** Tokens are stored only as keyed hashes, so a database leak does not expose live sessions. */
export function hashToken(token: string) {
  return createHmac("sha256", env.authSecret).update(token).digest("hex");
}

export interface SessionUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  studentId: string | null;
  academicLevel: string;
  institutionName: string;
  mobile: string;
}

export async function createSession(userId: string, userAgent = "") {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  await Session.create({ tokenHash: hashToken(token), userId, expiresAt, userAgent: userAgent.slice(0, 300) });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return { token, expiresAt };
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
  jar.delete(SESSION_COOKIE);
}

/** Returns the signed-in user, or null. Safe to call from server components, layouts and route handlers. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  await connectDB();
  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session) return null;
  const user = await User.findById(session.userId).lean();
  if (!user || user.status !== "active") return null;

  // Sliding activity tracking, written at most once every 5 minutes.
  const now = Date.now();
  if (!session.lastSeenAt || now - new Date(session.lastSeenAt).getTime() > 5 * 60_000) {
    await Promise.all([
      Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date(now) } }),
      User.updateOne({ _id: user._id }, { $set: { lastActivityAt: new Date(now) } }),
    ]);
  }
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    role: user.role as Role,
    studentId: user.studentId ?? null,
    academicLevel: user.academicLevel ?? "",
    institutionName: user.institutionName ?? "",
    mobile: user.mobile ?? "",
  };
}

export async function requireUser(role?: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  if (role && user.role !== role) throw new AppError("FORBIDDEN", "You do not have permission to access this resource.");
  return user;
}
export const requireAdmin = () => requireUser("ADMIN");
export const requireStudent = () => requireUser("STUDENT");

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "local").trim();
}

/**
 * Fixed-window throttle stored in MongoDB (works across serverless instances).
 * Throws RATE_LIMITED when the limit is exceeded.
 */
export async function throttle(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const doc = await Throttle.findOneAndUpdate(
    { key, expiresAt: { $gt: now } },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + windowSeconds * 1000) } },
    { upsert: true, returnDocument: "after" },
  ).catch(async (err) => {
    // An expired document with the same key may still exist until the TTL monitor removes it.
    if ((err as { code?: number }).code === 11000) {
      await Throttle.deleteOne({ key, expiresAt: { $lte: now } });
      return Throttle.findOneAndUpdate(
        { key },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now.getTime() + windowSeconds * 1000) } },
        { upsert: true, returnDocument: "after" },
      );
    }
    throw err;
  });
  if (doc && doc.count > limit) {
    const retry = Math.max(1, Math.ceil((new Date(doc.expiresAt).getTime() - now.getTime()) / 1000));
    throw new AppError("RATE_LIMITED", `Too many attempts. Please try again in ${Math.ceil(retry / 60)} minute(s).`);
  }
}
export async function clearThrottle(key: string) {
  await Throttle.deleteOne({ key });
}
