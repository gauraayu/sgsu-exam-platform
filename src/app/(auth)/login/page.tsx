import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { homeFor } from "@/lib/guards";
import { safeNextPath } from "@/lib/validation/auth";
import { LoginForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const { next, expired } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(safeNextPath(next, homeFor(user.role)));
  return <LoginForm next={next ? safeNextPath(next, "") || undefined : undefined} expired={expired === "1"} />;
}
