import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./auth";
import type { Role } from "./constants";

export function homeFor(role: Role) {
  return role === "ADMIN" ? "/admin" : "/student";
}

/** Server-side page guard used by layouts. Redirects instead of throwing. */
export async function requirePageUser(role?: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const path = (await headers()).get("x-pathname") ?? "/";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  if (role && user.role !== role) redirect(homeFor(user.role));
  return user;
}
