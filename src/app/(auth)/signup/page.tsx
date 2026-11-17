import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { homeFor } from "@/lib/guards";
import { safeNextPath } from "@/lib/validation/auth";
import { SignupForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(safeNextPath(next, homeFor(user.role)));
  return <SignupForm next={next ? safeNextPath(next, "") || undefined : undefined} />;
}
