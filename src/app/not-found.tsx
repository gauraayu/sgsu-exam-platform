import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo height={32} />
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wider text-accent">Error 404</p>
        <h1 className="text-xl font-semibold">This page could not be found</h1>
        <p className="max-w-sm text-sm text-muted-foreground">The link may be incorrect, or the exam may no longer be available. Check the link shared by your examination cell.</p>
      </div>
      <Button asChild>
        <Link href="/">Go to the portal</Link>
      </Button>
    </div>
  );
}
