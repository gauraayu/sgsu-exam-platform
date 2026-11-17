"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { BarChart3, ClipboardList, CopyPlus, Eye, KeyRound, Link2, MonitorDot, MoreHorizontal, PlusCircle, Search, Share2, Trophy, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { api, ApiError, qs } from "@/lib/client-api";
import { formatDateTime, formatDuration, formatPercent } from "@/lib/utils";
import { formatInZone } from "@/lib/timezone";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { ExamStatusBadge } from "@/components/shared/status";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { SUBJECT_SHORT, type Subject } from "@/lib/constants";
import { ShareDialog, copyExamIdentifier } from "./exam-share";
import { cn } from "@/lib/utils";

interface ExamRow {
  id: string;
  title: string;
  category: string;
  status: string;
  totalQuestions: number;
  durationMinutes: number;
  startDate: string;
  endDate: string;
  lifecycle?: string;
  timezone?: string;
  shareToken?: string;
  accessCode?: string;
  subjectDistribution?: { subject: string; count: number }[];
  generationMode?: "quick" | "custom";
  publishedAt?: string | null;
  participants: number;
  completed: number;
  active: number;
  avgPercentage: number | null;
}

const TABS = [["all", "All"], ["active", "Active"], ["scheduled", "Scheduled"], ["draft", "Drafts"], ["published", "Published"], ["expired", "Expired"], ["closed", "Closed"], ["archived", "Archived"]] as const;
type Tab = (typeof TABS)[number][0];

export function ExamsList() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialTab = sp.get("status");
  const [status, setStatusRaw] = useState<Tab>(TABS.some(([v]) => v === initialTab) ? (initialTab as Tab) : "all");
  const setStatus = (v: Tab) => {
    setStatusRaw(v);
    router.replace(v === "all" ? "/admin/exams" : `/admin/exams?status=${v}`, { scroll: false });
  };
  const [shareId, setShareId] = useState<string | null>(null);
  const [closing, setClosing] = useState<ExamRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounce(search, 300);
  const { data, error, loading, reload } = useApi<{ items: ExamRow[]; total: number; page: number; pageSize: number; totalPages: number }>(`/api/admin/exams${qs({ status, search: q, page })}`);

  async function closeExam() {
    if (!closing) return;
    setBusy(true);
    try {
      await api(`/api/admin/exams/${closing.id}/close`, { method: "POST" });
      toast.success("Examination closed. No new attempts can start.");
      setClosing(null);
      void reload(true);
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  async function duplicate(id: string) {
    try {
      const r = await api<{ id: string }>(`/api/admin/exams/${id}/duplicate`, { method: "POST", json: { copyPaper: true } });
      toast.success("Exam duplicated as a draft.");
      router.push(`/admin/exams/${r.id}`);
    } catch (e) {
      toast.error((e as ApiError).message);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="All Examinations" description="Create, publish, share and monitor examinations. Each published exam keeps the same link and access code for its whole life." breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "All Examinations" }]} actions={<Button asChild><Link href="/admin/exams/new"><PlusCircle /> Create examination</Link></Button>} />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 pt-2">
          <div className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
            {TABS.map(([v, l]) => (
              <button key={v} role="tab" aria-selected={status === v} onClick={() => { setStatus(v as Tab); setPage(1); }} className={cn("h-9 border-b-2 px-3 text-[14.5px] font-medium", status === v ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>{l}</button>
            ))}
          </div>
          <div className="relative mb-2 w-full sm:w-64"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search exams" className="h-8 pl-8" aria-label="Search exams" /></div>
        </div>
        {loading && !data ? <TableSkeleton rows={6} cols={8} /> : error ? <ErrorState message={error.message} onRetry={() => reload()} /> : !data?.items.length ? (
          <EmptyState icon={ClipboardList} title={q || status !== "all" ? "No exams match" : "No exams yet"} description="Create a draft, generate its paper from the question bank, then publish it to get a shareable link." action={<Button asChild size="sm"><Link href="/admin/exams/new">Create exam</Link></Button>} />
        ) : (
          <>
            <Table>
              <THead><TR><TH>Examination</TH><TH>Subjects</TH><TH className="text-right">Questions</TH><TH>Duration</TH><TH>Published</TH><TH>Valid until</TH><TH>Access code</TH><TH className="text-right">Participants</TH><TH>Status</TH><TH><span className="sr-only">Actions</span></TH></TR></THead>
              <TBody>
                {data.items.map((e) => (
                  <TR key={e.id}>
                    <TD className="max-w-[260px]">
                      <Link href={`/admin/exams/${e.id}`} className="block truncate font-medium hover:text-primary dark:hover:text-primary-soft-foreground">{e.title}</Link>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{e.generationMode === "quick" && <Badge variant="outline" className="h-5 px-1.5 text-[11px]"><Zap className="size-3" /> Quick</Badge>}{e.category}</span>
                    </TD>
                    <TD className="max-w-[180px] text-xs text-muted-foreground">{(e.subjectDistribution ?? []).map((d) => `${SUBJECT_SHORT[d.subject as Subject] ?? d.subject} ${d.count}`).join(" · ") || "Manual"}</TD>
                    <TD className="text-right tabular-nums">{e.totalQuestions}</TD>
                    <TD className="whitespace-nowrap">{formatDuration(e.durationMinutes)}</TD>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{e.publishedAt ? formatDateTime(e.publishedAt) : "—"}</TD>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground" title={e.lifecycle === "scheduled" ? `Opens ${formatInZone(e.startDate, e.timezone)}` : undefined}>{e.status === "draft" ? "—" : formatInZone(e.endDate, e.timezone)}{e.lifecycle === "scheduled" && <span className="block text-[11px]">opens {formatInZone(e.startDate, e.timezone, { dateStyle: "medium", timeStyle: "short" })}</span>}</TD>
                    <TD className="whitespace-nowrap font-mono text-xs">{e.accessCode ? <span className="rounded bg-accent-soft px-1.5 py-0.5 text-accent-soft-foreground">{e.accessCode}</span> : e.status === "draft" ? <span className="font-sans text-muted-foreground">After publishing</span> : "—"}</TD>
                    <TD className="text-right tabular-nums">{e.participants}{e.active ? <span className="ml-1 text-xs text-success">({e.active} live)</span> : null}<span className="block text-xs text-muted-foreground">{e.completed} done · avg {formatPercent(e.avgPercentage)}</span></TD>
                    <TD><ExamStatusBadge status={e.lifecycle ?? e.status} /></TD>
                    <TD className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Exam actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => router.push(`/admin/exams/${e.id}`)}><Eye /> View examination</DropdownMenuItem>
                          {e.shareToken && (
                            <>
                              <DropdownMenuItem onSelect={() => setShareId(e.id)}><Share2 /> Share examination</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => copyExamIdentifier(e.id, "link")}><Link2 /> Copy link</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => copyExamIdentifier(e.id, "code")}><KeyRound /> Copy exam code</DropdownMenuItem>
                            </>
                          )}
                          {e.status !== "draft" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => router.push(`/admin/exams/${e.id}/monitor`)}><MonitorDot /> View participants</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => router.push(`/admin/exams/${e.id}/results`)}><Trophy /> View results</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => router.push(`/admin/exams/${e.id}/analytics`)}><BarChart3 /> Analytics</DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => duplicate(e.id)}><CopyPlus /> Duplicate examination</DropdownMenuItem>
                          {e.status === "published" && <DropdownMenuItem onSelect={() => setClosing(e)} className="text-danger"><XCircle /> Close examination</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={setPage} />
          </>
        )}
      </Card>
      <ShareDialog examId={shareId} open={!!shareId} onOpenChange={(o) => !o && setShareId(null)} />
      <ConfirmDialog
        open={!!closing}
        onOpenChange={(o) => !o && setClosing(null)}
        title={`Close “${closing?.title ?? ""}”?`}
        description="No new attempts can start. Attempts in progress are submitted now with their saved answers. Results and the link/code history are kept."
        confirmLabel="Close examination"
        destructive
        loading={busy}
        onConfirm={closeExam}
      />
    </div>
  );
}
