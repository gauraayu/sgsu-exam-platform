"use client";

import Link from "next/link";
import { AlarmClock, ArrowRight, Bell, BookOpenCheck, CalendarClock, CalendarX2, Clock, FileQuestion, History, PlayCircle, Trophy } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StatCard } from "@/components/layout/page-header";
import { AttemptStatusBadge, PassBadge } from "@/components/shared/status";
import { cn, formatDateTime, formatDuration, formatPercent } from "@/lib/utils";
import { formatDateAndTime, formatInZone } from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";

export interface StudentExam {
  id: string;
  title: string;
  description: string;
  category: string;
  totalQuestions: number;
  durationMinutes: number;
  totalMarks: number;
  startDate: string;
  endDate: string;
  shareToken: string;
  timezone?: string;
  lifecycle: "scheduled" | "active" | "expired" | "closed" | "archived" | "draft";
  state: "open" | "upcoming" | "ended";
  attemptStatus: string | null;
  attemptId: string | null;
}
export interface StudentAttempt {
  attemptId: string;
  examTitle: string;
  category: string;
  shareToken: string | null;
  totalQuestions: number;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  resultVisible: boolean;
  resultPending: boolean;
  result: { totalScore: number; maxScore: number; percentage: number; passed: boolean; correct: number; incorrect: number; unanswered: number } | null;
}

export interface StudentNotice {
  id: string;
  kind: "upcoming" | "available" | "closing_soon" | "expired";
  examTitle: string;
  token: string | null;
  message: string;
}

const NOTICE: Record<StudentNotice["kind"], { label: string; icon: React.ElementType; cls: string }> = {
  upcoming: { label: "Upcoming examination", icon: CalendarClock, cls: "bg-info-soft text-info" },
  available: { label: "Examination available", icon: PlayCircle, cls: "bg-success-soft text-success" },
  closing_soon: { label: "Examination closing soon", icon: AlarmClock, cls: "bg-warning-soft text-warning" },
  expired: { label: "Examination expired", icon: CalendarX2, cls: "bg-muted text-muted-foreground" },
};

export function NoticesCard({ notices }: { notices: StudentNotice[] }) {
  if (!notices.length) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="size-4 text-muted-foreground" aria-hidden /> Examination notices</CardTitle></CardHeader>
      <ul className="divide-y" aria-label="Examination notices" data-testid="notices">
        {notices.map((n) => {
          const k = NOTICE[n.kind];
          const body = (
            <>
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", k.cls)}><k.icon className="size-4" aria-hidden /></span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-muted-foreground">{k.label}</span>
                <span className="block truncate text-[14.5px] font-medium">{n.examTitle}</span>
                <span className="block text-sm text-muted-foreground">{n.message}</span>
              </span>
            </>
          );
          return (
            <li key={n.id}>
              {n.token && n.kind !== "expired" ? <Link href={`/exam/${n.token}`} className="flex items-start gap-3 px-5 py-3 hover:bg-muted/40">{body}</Link> : <div className="flex items-start gap-3 px-5 py-3">{body}</div>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

const LIFE_BADGE: Record<StudentExam["lifecycle"], { label: string; variant: "success" | "info" | "warning" | "default" }> = {
  active: { label: "Open now", variant: "success" },
  scheduled: { label: "Scheduled", variant: "info" },
  expired: { label: "Expired", variant: "warning" },
  closed: { label: "Closed", variant: "default" },
  archived: { label: "Archived", variant: "default" },
  draft: { label: "Draft", variant: "default" },
};

function ExamCard({ exam }: { exam: StudentExam }) {
  const done = exam.attemptStatus && exam.attemptStatus !== "in_progress";
  const lb = LIFE_BADGE[exam.lifecycle] ?? LIFE_BADGE.active;
  const start = formatDateAndTime(exam.startDate, exam.timezone);
  return (
    <div className="flex flex-col rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{exam.title}</p>
          <p className="text-xs text-muted-foreground">{exam.category}</p>
        </div>
        {exam.attemptStatus ? <AttemptStatusBadge status={exam.attemptStatus} /> : <Badge variant={lb.variant}>{lb.label}</Badge>}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1"><FileQuestion className="size-3.5" />{exam.totalQuestions} Qs</div>
        <div className="flex items-center gap-1"><Clock className="size-3.5" />{formatDuration(exam.durationMinutes)}</div>
        <div>{exam.totalMarks} marks</div>
      </dl>
      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <CalendarClock className="size-3.5" />
        {exam.lifecycle === "scheduled"
          ? `Begins on ${start.date} at ${start.time}`
          : exam.lifecycle === "active"
            ? `New attempts until ${formatInZone(exam.endDate, exam.timezone)}`
            : exam.lifecycle === "closed"
              ? "Closed by the administrator"
              : "No longer accepting new attempts"}
      </p>
      <div className="mt-4 flex justify-end">
        {done ? (
          <Button asChild variant="outline" size="sm"><Link href={`/student/results/${exam.attemptId}`}>View result</Link></Button>
        ) : (
          <Button asChild size="sm" variant={exam.state === "open" ? "default" : "outline"}>
            <Link href={`/exam/${exam.shareToken}`}>
              {exam.attemptStatus === "in_progress" ? "Resume" : exam.lifecycle === "active" ? "Start examination" : "View details"} <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

export function StudentDashboard({ name }: { name: string }) {
  const exams = useApi<{ exams: StudentExam[]; notices: StudentNotice[] }>("/api/student/exams");
  const results = useApi<{ attempts: StudentAttempt[] }>("/api/student/results");
  const attempts = results.data?.attempts ?? [];
  const completed = attempts.filter((a) => a.status !== "in_progress");
  const visible = completed.filter((a) => a.result);
  const avg = visible.length ? visible.reduce((s, a) => s + a.result!.percentage, 0) / visible.length : null;
  const inProgress = attempts.find((a) => a.status === "in_progress");
  const available = (exams.data?.exams ?? []).filter((e) => !e.attemptStatus || e.attemptStatus === "in_progress");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[24px] font-semibold tracking-tight sm:text-2xl">Welcome, {name.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Your assessments, results and history in one place.</p>
      </div>
      {inProgress && inProgress.shareToken && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/30 bg-info-soft px-4 py-3">
          <p className="text-sm"><span className="font-medium">{inProgress.examTitle}</span> is in progress. Your timer is running.</p>
          <Button asChild size="sm"><Link href={`/exam/${inProgress.shareToken}`}><PlayCircle /> Resume exam</Link></Button>
        </div>
      )}
      <NoticesCard notices={exams.data?.notices ?? []} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {results.loading || exams.loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)
        ) : (
          <>
            <StatCard label="In progress" value={available.filter((e) => e.attemptStatus === "in_progress").length} icon={BookOpenCheck} tone="primary" href="/student/exams" />
            <StatCard label="Results available" value={visible.length} icon={CalendarClock} href="/student/results" />
            <StatCard label="Completed" value={completed.length} icon={History} href="/student/history" />
            <StatCard label="Average score" value={formatPercent(avg)} icon={Trophy} tone="accent" href="/student/results" />
          </>
        )}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Your active examinations</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/student/exams">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {exams.loading ? <Skeleton className="h-32" /> : exams.error ? <ErrorState message={exams.error.message} onRetry={() => exams.reload()} /> : available.length ? (
              <div className="grid gap-3 md:grid-cols-2">{available.slice(0, 4).map((e) => <ExamCard key={e.id} exam={e} />)}</div>
            ) : (
              <EmptyState icon={BookOpenCheck} title="No active examination" description="Open the exam link shared by the examination cell, or enter the exam code, to begin." action={<Button asChild size="sm"><Link href="/student/exams">Enter exam code</Link></Button>} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent results</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/student/results">All results</Link></Button>
          </CardHeader>
          {results.loading ? <TableSkeleton rows={4} cols={3} /> : <RecentResults attempts={completed.slice(0, 5)} />}
        </Card>
      </div>
    </div>
  );
}

function RecentResults({ attempts }: { attempts: StudentAttempt[] }) {
  if (!attempts.length) return <EmptyState icon={Trophy} title="No results yet" description="Results appear here after you submit an exam." />;
  return (
    <ul className="divide-y">
      {attempts.map((a) => (
        <li key={a.attemptId}>
          <Link href={`/student/results/${a.attemptId}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/40">
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-medium">{a.examTitle}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(a.submittedAt ?? a.startedAt)}</p>
            </div>
            {a.result ? (
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">{a.result.totalScore}/{a.result.maxScore}</p>
                <PassBadge passed={a.result.passed} />
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">{a.resultPending ? "Result not released" : "—"}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StudentExamsList() {
  const { data, error, loading, reload } = useApi<{ exams: StudentExam[] }>("/api/student/exams");
  if (loading) return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>;
  if (error) return <Card><ErrorState message={error.message} onRetry={() => reload()} /></Card>;
  if (!data?.exams.length)
    return <Card><EmptyState icon={BookOpenCheck} title="No examinations yet" description="Exams are not listed publicly. Enter the exam code above or open the exam link you received — the exam will then appear here." /></Card>;
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{data.exams.map((e) => <ExamCard key={e.id} exam={e} />)}</div>;
}

export function StudentAttemptsTable({ mode }: { mode: "results" | "history" }) {
  const { data, error, loading, reload } = useApi<{ attempts: StudentAttempt[] }>("/api/student/results");
  if (loading) return <Card><TableSkeleton /></Card>;
  if (error) return <Card><ErrorState message={error.message} onRetry={() => reload()} /></Card>;
  const rows = (data?.attempts ?? []).filter((a) => mode === "history" || a.status !== "in_progress");
  if (!rows.length) return <Card><EmptyState icon={mode === "results" ? Trophy : History} title={mode === "results" ? "No results yet" : "No exam attempts yet"} description="Your submitted exams will be listed here." /></Card>;
  return (
    <Card>
      <Table>
        <THead>
          <TR>
            <TH>Exam</TH>
            <TH>Started</TH>
            <TH>Submitted</TH>
            <TH>Status</TH>
            {mode === "results" && <TH className="text-right">Correct / Incorrect / Blank</TH>}
            <TH className="text-right">Score</TH>
            <TH className="text-right">Percentage</TH>
            <TH>Result</TH>
            <TH><span className="sr-only">Actions</span></TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((a) => (
            <TR key={a.attemptId}>
              <TD className="font-medium">{a.examTitle}</TD>
              <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.startedAt)}</TD>
              <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.submittedAt)}</TD>
              <TD><AttemptStatusBadge status={a.status} /></TD>
              {mode === "results" && <TD className="text-right tabular-nums">{a.result ? `${a.result.correct} / ${a.result.incorrect} / ${a.result.unanswered}` : "—"}</TD>}
              <TD className="text-right tabular-nums">{a.result ? `${a.result.totalScore}/${a.result.maxScore}` : a.resultPending ? <span className="text-xs text-muted-foreground">Not released</span> : "—"}</TD>
              <TD className="text-right tabular-nums">{a.result ? formatPercent(a.result.percentage) : "—"}</TD>
              <TD><PassBadge passed={a.result?.passed} /></TD>
              <TD className="text-right">
                {a.status === "in_progress" && a.shareToken ? (
                  <Button asChild size="xs"><Link href={`/exam/${a.shareToken}`}>Resume</Link></Button>
                ) : (
                  <Button asChild variant="ghost" size="xs"><Link href={`/student/results/${a.attemptId}`}>Details</Link></Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
