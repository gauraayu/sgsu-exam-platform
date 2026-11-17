"use client";

import Link from "next/link";
import { useState } from "react";
import { Ban, CheckCircle2, Copy, Download, FileSpreadsheet, FileText, KeyRound, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { api, ApiError, qs } from "@/lib/client-api";
import { ACADEMIC_LEVELS } from "@/lib/constants";
import { cn, formatDate, formatDateTime, formatPercent, formatRelative } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Alert, EmptyState, ErrorState } from "@/components/ui/states";
import { SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { AttemptStatusBadge, PassBadge } from "@/components/shared/status";

interface StudentRow { id: string; studentId: string; fullName: string; email: string; mobile: string; academicLevel: string; institutionName: string; createdAt: string; examsAttempted: number; averagePercentage: number | null; latestActivity: string | null; status: string }

export function StudentsList() {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("");
  const [sort, setSort] = useState("-createdAt");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const q = useDebounce(search, 300);
  const { data, error, loading, reload } = useApi<{ items: StudentRow[]; total: number; page: number; totalPages: number }>(`/api/admin/students${qs({ search: q, academicLevel: level, sort, page, pageSize })}`);
  const onSort = (s: string) => { setSort(s); setPage(1); };
  const exportUrl = (format: string) => `/api/admin/students/export${qs({ search: q, academicLevel: level, sort, format })}`;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Students"
        description="Every student who has registered. Accounts are permanent and reused across exams."
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Students" }]}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline"><Download /> Export</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild><a href={exportUrl("xlsx")}><FileSpreadsheet /> Excel (.xlsx)</a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={exportUrl("csv")}><FileText /> CSV</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <Card>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <div className="relative min-w-56 flex-1"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, email, student ID, mobile or institution" className="pl-8" aria-label="Search students" /></div>
          <Select value={level} onChange={(e) => { setLevel(e.target.value); setPage(1); }} className="w-44" aria-label="Academic level"><option value="">All levels</option>{ACADEMIC_LEVELS.map((l) => <option key={l}>{l}</option>)}</Select>
        </div>
        {loading && !data ? <TableSkeleton rows={8} cols={8} /> : error ? <ErrorState message={error.message} onRetry={() => reload()} /> : !data?.items.length ? <EmptyState icon={Users} title={q || level ? "No students match" : "No students registered yet"} description="Students register from an exam link or the sign-up page." /> : (
          <div className={cn(loading && "opacity-60")}>
            <Table>
              <THead>
                <TR>
                  <TH>Student ID</TH>
                  <SortableTH label="Name" field="name" sort={sort} onSort={onSort} />
                  <TH>Email</TH><TH>Mobile</TH><TH>Level</TH><TH>Institution</TH>
                  <SortableTH label="Registered" field="createdAt" sort={sort} onSort={onSort} />
                  <SortableTH label="Exams" field="exams" sort={sort === "-exams" ? "-exams" : ""} onSort={() => onSort("-exams")} className="text-right" />
                  <SortableTH label="Average" field="average" sort={sort === "-average" ? "-average" : ""} onSort={() => onSort("-average")} className="text-right" />
                  <SortableTH label="Latest activity" field="activity" sort={sort === "-activity" ? "-activity" : ""} onSort={() => onSort("-activity")} />
                </TR>
              </THead>
              <TBody>
                {data.items.map((s) => (
                  <TR key={s.id}>
                    <TD className="whitespace-nowrap font-mono text-xs">{s.studentId}</TD>
                    <TD><Link href={`/admin/students/${s.id}`} className="font-medium hover:text-primary dark:hover:text-primary-soft-foreground">{s.fullName}</Link>{s.status === "disabled" && <Badge variant="danger" className="ml-2">Disabled</Badge>}</TD>
                    <TD className="text-muted-foreground">{s.email}</TD>
                    <TD className="whitespace-nowrap text-muted-foreground">{s.mobile}</TD>
                    <TD className="whitespace-nowrap">{s.academicLevel}</TD>
                    <TD className="max-w-[200px] truncate text-muted-foreground">{s.institutionName}</TD>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(s.createdAt)}</TD>
                    <TD className="text-right tabular-nums">{s.examsAttempted}</TD>
                    <TD className="text-right tabular-nums">{formatPercent(s.averagePercentage)}</TD>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatRelative(s.latestActivity)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </div>
        )}
      </Card>
    </div>
  );
}

interface StudentDetailData {
  student: { id: string; studentId: string; fullName: string; email: string; mobile: string; academicLevel: string; institutionName: string; createdAt: string; lastLoginAt: string | null; status: string };
  history: { attemptId: string; examId: string; examTitle: string; status: string; startedAt: string; submittedAt: string | null; finalizationReason: string | null; result: { totalScore: number; maxScore: number; percentage: number; passed: boolean } | null }[];
}

export function StudentDetail({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi<StudentDetailData>(`/api/admin/students/${id}`);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  if (loading && !data) return <Skeleton className="h-96" />;
  if (error) return <Card><ErrorState message={error.message} onRetry={() => reload()} /></Card>;
  if (!data) return null;
  const s = data.student;
  async function resetLink() {
    setBusy(true);
    try {
      const r = await api<{ link: string }>(`/api/admin/students/${id}/reset-link`, { method: "POST" });
      setLink(r.link);
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  async function toggleStatus() {
    setBusy(true);
    try {
      await api(`/api/admin/students/${id}`, { method: "PATCH", json: { status: s.status === "active" ? "disabled" : "active" } });
      toast.success(s.status === "active" ? "Account disabled and signed out." : "Account enabled.");
      setConfirmStatus(false);
      await reload(true);
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title={<span className="flex items-center gap-3">{s.fullName}{s.status === "disabled" && <Badge variant="danger">Disabled</Badge>}</span>}
        description={<span className="font-mono">{s.studentId}</span>}
        breadcrumbs={[{ label: "Students", href: "/admin/students" }, { label: s.fullName }]}
        actions={
          <>
            <Button variant="outline" onClick={resetLink} loading={busy && !confirmStatus}><KeyRound /> Generate reset link</Button>
            <Button variant="ghost" onClick={() => setConfirmStatus(true)}>{s.status === "active" ? <><Ban /> Disable account</> : <><CheckCircle2 /> Enable account</>}</Button>
          </>
        }
      />
      {link && (
        <Alert variant="info" title="Password reset link (valid for 60 minutes)">
          <div className="mt-1 flex gap-2"><Input readOnly value={link} className="font-mono text-xs" /><Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard.writeText(link); toast.success("Link copied."); }}><Copy /> Copy</Button></div>
          <p className="mt-1">Share it with the student through a verified channel.</p>
        </Alert>
      )}
      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-[14.5px] sm:grid-cols-2 lg:grid-cols-4">
            {[["Email", s.email], ["Mobile", s.mobile], ["Academic level", s.academicLevel], ["Institution", s.institutionName], ["Registered", formatDateTime(s.createdAt)], ["Last sign-in", formatDateTime(s.lastLoginAt)], ["Exams attempted", data.history.length]].map(([k, v]) => <div key={k as string}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v || "—"}</dd></div>)}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Exam history & results</CardTitle></CardHeader>
        {!data.history.length ? <EmptyState title="No exam attempts yet" /> : (
          <Table>
            <THead><TR><TH>Exam</TH><TH>Started</TH><TH>Submitted</TH><TH>Status</TH><TH className="text-right">Score</TH><TH className="text-right">%</TH><TH>Result</TH><TH /></TR></THead>
            <TBody>
              {data.history.map((h) => (
                <TR key={h.attemptId}>
                  <TD className="font-medium">{h.examTitle}</TD>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(h.startedAt)}</TD>
                  <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(h.submittedAt)}</TD>
                  <TD><AttemptStatusBadge status={h.status} /></TD>
                  <TD className="text-right tabular-nums">{h.result ? `${h.result.totalScore}/${h.result.maxScore}` : "—"}</TD>
                  <TD className="text-right tabular-nums">{h.result ? formatPercent(h.result.percentage) : "—"}</TD>
                  <TD><PassBadge passed={h.result?.passed} /></TD>
                  <TD className="text-right"><Button asChild size="xs" variant="ghost"><Link href={`/admin/exams/${h.examId}/results`}>Exam results</Link></Button></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      <ConfirmDialog open={confirmStatus} onOpenChange={setConfirmStatus} title={s.status === "active" ? "Disable this account?" : "Enable this account?"} description={s.status === "active" ? "The student is signed out and cannot sign in until re-enabled. Their history is kept." : "The student can sign in again."} confirmLabel={s.status === "active" ? "Disable" : "Enable"} destructive={s.status === "active"} loading={busy} onConfirm={toggleStatus} />
    </div>
  );
}
