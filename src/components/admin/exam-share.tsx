"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import { formatInZone } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

export interface ShareInfo {
  title: string;
  status: string;
  window: "draft" | "scheduled" | "active" | "expired" | "closed";
  timezone?: string;
  shareToken: string | null;
  path: string | null;
  accessCode: string | null;
  validFrom: string;
  validUntil: string;
  publishedAt: string | null;
}

const WINDOW: Record<ShareInfo["window"], { label: string; variant: "success" | "info" | "warning" | "danger" | "outline" }> = {
  active: { label: "Active", variant: "success" },
  scheduled: { label: "Scheduled", variant: "info" },
  expired: { label: "Expired", variant: "warning" },
  closed: { label: "Closed", variant: "danger" },
  draft: { label: "Draft", variant: "outline" },
};

function remaining(until: string) {
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return "Validity has ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  return d ? `${d} day${d === 1 ? "" : "s"} ${h} h left` : `${h} h ${Math.floor((ms % 3_600_000) / 60_000)} min left`;
}

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied.`);
  } catch {
    toast.error(`Could not copy automatically. Select the ${what.toLowerCase()} and copy it manually.`);
  }
}

function CopyRow({ icon: Icon, label, value, mono, accent, copyLabel, testId }: { icon: React.ElementType; label: string; value: string; mono?: boolean; accent?: boolean; copyLabel: string; testId: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="min-w-0">
      <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><Icon className={cn("size-4", accent ? "text-accent" : "text-muted-foreground")} aria-hidden /> {label}</p>
      <div className="flex min-w-0 gap-2">
        <output data-testid={testId} className={cn("flex min-h-10 min-w-0 flex-1 items-center overflow-x-auto whitespace-nowrap rounded-md border bg-subtle px-3 text-sm", mono && "font-mono tracking-wide", accent && "border-accent/40 bg-accent-soft text-base font-semibold text-accent-soft-foreground")}>{value}</output>
        <Button
          variant="outline"
          className="shrink-0"
          onClick={async () => {
            await copy(value, label.replace(/^Examination /, ""));
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          }}
        >
          {done ? <Check /> : <Copy />} {copyLabel}
        </Button>
      </div>
    </div>
  );
}

/** Link + access code + validity. Values come from MongoDB and never change after publishing. */
export function SharePanel({ info }: { info: ShareInfo }) {
  // Rendered only after the share data loads in the browser, so the full URL is available immediately
  // (never a bare path that would copy as an incomplete link).
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  if (!info.path) return <p className="text-sm text-muted-foreground">The link and access code are created when the exam is published.</p>;
  const url = `${origin}${info.path}`;
  const w = WINDOW[info.window];
  return (
    <div className="min-w-0 space-y-4">
      <CopyRow icon={Link2} label="Examination link" value={url} mono copyLabel="Copy link" testId="share-link" />
      {info.accessCode && <CopyRow icon={KeyRound} label="Examination access code" value={info.accessCode} mono accent copyLabel="Copy code" testId="share-code" />}
      <p className="text-xs text-muted-foreground">Students can open the link, or sign in and enter the code under <span className="font-medium text-foreground">Examinations → Enter exam code</span>. Both open the same exam with the same one-attempt rule.</p>
      <dl className="grid grid-cols-2 gap-3 rounded-md border p-3 text-sm">
        <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-0.5"><Badge variant={w.variant}>{w.label}</Badge></dd></div>
        <div><dt className="text-xs text-muted-foreground">Valid from</dt><dd className="mt-0.5 font-medium">{formatInZone(info.validFrom, info.timezone)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Valid until</dt><dd className="mt-0.5 font-medium">{formatInZone(info.validUntil, info.timezone)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">{info.window === "scheduled" ? "Opens in" : "Remaining validity"}</dt><dd className="mt-0.5 font-medium">{info.window === "closed" ? "Closed by the examination cell" : info.window === "scheduled" ? remaining(info.validFrom).replace(/ left$/, "") : remaining(info.validUntil)}</dd></div>
      </dl>
      <Button variant="ghost" size="sm" asChild><a href={info.path} target="_blank" rel="noreferrer"><ExternalLink /> Open the student exam page</a></Button>
    </div>
  );
}

export function ShareCard({ examId }: { examId: string }) {
  const { data, error, reload } = useApi<ShareInfo>(`/api/admin/exams/${examId}/share`);
  return (
    <Card>
      <CardHeader><div><CardTitle>Share this examination</CardTitle><CardDescription>Copy the link or the access code at any time — they stay the same for the life of the exam.</CardDescription></div></CardHeader>
      <CardContent>{error ? <ErrorState message={error.message} onRetry={() => reload()} /> : !data ? <Skeleton className="h-40" /> : <SharePanel info={data} />}</CardContent>
    </Card>
  );
}

export function ShareDialog({ examId, open, onOpenChange }: { examId: string | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data, error, reload } = useApi<ShareInfo>(open && examId ? `/api/admin/exams/${examId}/share` : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Share examination</DialogTitle>
          <DialogDescription>{data?.title ?? "Loading…"}</DialogDescription>
        </DialogHeader>
        <DialogBody>{error ? <ErrorState message={error.message} onRetry={() => reload()} /> : !data ? <Skeleton className="h-40" /> : <SharePanel info={data} />}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** Copies the link or code for an exam without opening the dialog (used in table menus). */
export async function copyExamIdentifier(examId: string, which: "link" | "code") {
  try {
    const r = await fetch(`/api/admin/exams/${examId}/share`, { cache: "no-store" });
    if (!r.ok) throw new Error();
    const info = (await r.json()) as ShareInfo;
    if (which === "link" && info.path) await copy(`${window.location.origin}${info.path}`, "Link");
    else if (which === "code" && info.accessCode) await copy(info.accessCode, "Code");
    else toast.error("Publish the exam first to get its link and code.");
  } catch {
    toast.error("Could not load the exam's link and code. Please try again.");
  }
}
