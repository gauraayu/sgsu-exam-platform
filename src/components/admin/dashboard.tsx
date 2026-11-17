"use client";

import Link from "next/link";
import { Activity, BadgeCheck, ClipboardList, FileQuestion, PlusCircle, Target, Upload, Users } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { PageHeader, StatCard } from "@/components/layout/page-header";
import { SUBJECTS } from "@/lib/constants";
import { ChartCard } from "@/components/charts/charts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ExamStatusBadge } from "@/components/shared/status";
import { formatDuration, formatPercent, formatRelative } from "@/lib/utils";

interface Dashboard {
  cards: { students: number; questions: number; exams: number; activeExams: number; completedExams: number; publishedExams: number; draftExams: number; attempts: number; averageScore: number | null; passPercentage: number | null };
  participation: { date: string; started: number; completed: number }[];
  scoreDistribution: { range: string; count: number }[];
  subjectPerformance: { subject: string; averagePercentage: number; accuracy: number }[];
  difficultyAccuracy: { difficulty: string; accuracy: number }[];
  averageByExam: { exam: string; averagePercentage: number }[];
  recentExams: { id: string; title: string; totalQuestions: number; durationMinutes: number; status: string; participants?: number; completed?: number; avgPercentage?: number | null }[];
  recentStudents: { id: string; fullName: string; email: string; studentId: string; institutionName: string; createdAt: string }[];
}

export function AdminDashboard() {
  const { data, error, loading, reload } = useApi<Dashboard>("/api/admin/dashboard");
  const qstats = useApi<{ total: number; bySubject: Record<string, number>; breakdown: { subject: string; difficulty: string; count: number }[] }>("/api/admin/questions/stats");
  const header = (
    <PageHeader
      title="Examination Dashboard"
      description="Manage assessments, monitor participation, and review student performance."
      actions={
        <>
          <Button asChild variant="outline"><Link href="/admin/import/local"><Upload /> Import questions</Link></Button>
          <Button asChild><Link href="/admin/exams/new"><PlusCircle /> Create examination</Link></Button>
        </>
      }
    />
  );
  if (error) return <>{header}<Card><ErrorState message={error.message} onRetry={() => reload()} /></Card></>;
  const c = data?.cards;
  const shortDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <div className="space-y-6">
      {header}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {loading || !c ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)
        ) : (
          <>
            <StatCard label="Registered students" value={c.students.toLocaleString("en-IN")} icon={Users} tone="primary" href="/admin/students" />
            <StatCard label="Questions in bank" value={c.questions.toLocaleString("en-IN")} icon={FileQuestion} href="/admin/questions" />
            <StatCard label="Total exams" value={c.exams} hint={`${c.draftExams} draft · ${c.publishedExams} published`} icon={ClipboardList} href="/admin/exams" />
            <StatCard label="Active exams" value={c.activeExams} hint="Open right now" icon={Activity} tone="success" />
            <StatCard label="Completed exams" value={c.completedExams} hint="Closed by an admin" icon={BadgeCheck} />
            <StatCard label="Total attempts" value={c.attempts.toLocaleString("en-IN")} icon={Target} />
            <StatCard label="Average score" value={formatPercent(c.averageScore)} hint="Across evaluated attempts" icon={Target} tone="accent" />
            <StatCard label="Pass percentage" value={formatPercent(c.passPercentage)} icon={BadgeCheck} tone="success" />
          </>
        )}
      </div>

      {loading || !data ? (
        <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <ChartCard title="Exam participation" description="Attempts started and completed per day, last 30 days" type="line" data={data.participation.map((p) => ({ ...p, date: shortDate(p.date) }))} xKey="date" series={[{ key: "started", label: "Started", slot: 1 }, { key: "completed", label: "Completed", slot: 2 }]} emptyText="No attempts in the last 30 days" />
            <ChartCard title="Score distribution" description="Students by percentage band" data={data.scoreDistribution} xKey="range" series={[{ key: "count", label: "Students" }]} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Subject-wise performance" description="Average marks as % of maximum" data={data.subjectPerformance} xKey="subject" series={[{ key: "averagePercentage", label: "Average %" }]} unit="%" />
            <ChartCard title="Difficulty-wise accuracy" description="Correct ÷ attempted" data={data.difficultyAccuracy} xKey="difficulty" series={[{ key: "accuracy", label: "Accuracy" }]} unit="%" yMax={100} />
            <ChartCard title="Average score by exam" description="Most recently evaluated exams" data={data.averageByExam} xKey="exam" series={[{ key: "averagePercentage", label: "Average %" }]} unit="%" />
          </div>
        </>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_1.6fr]">
        <Card>
          <CardHeader><CardTitle>Quick actions</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {[
              { href: "/admin/exams/new", icon: PlusCircle, label: "Create new examination", text: "Quick Generate or custom" },
              { href: "/admin/import/local", icon: Upload, label: "Import questions", text: "Local, file or API" },
              { href: "/admin/students", icon: Users, label: "View students", text: "Registered accounts" },
              { href: "/admin/exams?status=active", icon: Activity, label: "Active examinations", text: "Share, monitor, results" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-accent/50 hover:bg-accent-soft/40 focus-visible:outline-2 focus-visible:outline-ring">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent-soft text-accent-soft-foreground"><a.icon className="size-[18px]" aria-hidden /></span>
                <span><span className="block text-[14.5px] font-medium">{a.label}</span><span className="block text-xs text-muted-foreground">{a.text}</span></span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Question bank overview</CardTitle><Button asChild variant="ghost" size="sm"><Link href="/admin/questions">Open question bank</Link></Button></CardHeader>
          <CardContent>
            {!qstats.data ? <Skeleton className="h-40" /> : (
              <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {SUBJECTS.map((sub) => {
                  const rows = qstats.data!.breakdown.filter((b) => b.subject === sub);
                  const d = (k: string) => rows.filter((b) => b.difficulty === k).reduce((a, b) => a + b.count, 0);
                  const n = qstats.data!.bySubject[sub] ?? 0;
                  return (
                    <li key={sub}>
                      <Link href={`/admin/questions?subject=${encodeURIComponent(sub)}`} className="block rounded-md p-1 hover:bg-muted/50">
                        <span className="flex items-baseline justify-between gap-2"><span className="text-[14.5px] font-medium">{sub}</span><span className="text-sm font-semibold tabular-nums">{n.toLocaleString("en-IN")}</span></span>
                        <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                          {n > 0 && (["Easy", "Medium", "Hard"] as const).map((k) => <span key={k} className={k === "Easy" ? "bg-success" : k === "Medium" ? "bg-warning" : "bg-danger"} style={{ width: `${(d(k) / n) * 100}%` }} />)}
                        </span>
                        <span className="mt-1 flex gap-3 text-xs tabular-nums"><span className="text-success">Easy {d("Easy")}</span><span className="text-warning">Medium {d("Medium")}</span><span className="text-danger">Hard {d("Hard")}</span></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Recent exams</CardTitle><Button asChild variant="ghost" size="sm"><Link href="/admin/exams">All exams</Link></Button></CardHeader>
          {loading || !data ? <TableSkeleton rows={5} /> : data.recentExams.length ? (
            <Table>
              <THead><TR><TH>Exam</TH><TH className="text-right">Questions</TH><TH>Duration</TH><TH className="text-right">Participants</TH><TH className="text-right">Completed</TH><TH className="text-right">Avg score</TH><TH>Status</TH><TH /></TR></THead>
              <TBody>
                {data.recentExams.map((e) => (
                  <TR key={e.id}>
                    <TD className="max-w-[220px] truncate font-medium">{e.title}</TD>
                    <TD className="text-right tabular-nums">{e.totalQuestions}</TD>
                    <TD className="whitespace-nowrap">{formatDuration(e.durationMinutes)}</TD>
                    <TD className="text-right tabular-nums">{e.participants ?? 0}</TD>
                    <TD className="text-right tabular-nums">{e.completed ?? 0}</TD>
                    <TD className="text-right tabular-nums">{formatPercent(e.avgPercentage)}</TD>
                    <TD><ExamStatusBadge status={e.status} /></TD>
                    <TD className="text-right"><Button asChild variant="ghost" size="xs"><Link href={`/admin/exams/${e.id}`}>Open</Link></Button></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : <EmptyState icon={ClipboardList} title="No exams yet" description="Import and verify questions, then create your first exam." action={<Button asChild size="sm"><Link href="/admin/exams/new">Create exam</Link></Button>} />}
        </Card>
        <Card>
          <CardHeader><CardTitle>Recent registrations</CardTitle><Button asChild variant="ghost" size="sm"><Link href="/admin/students">All students</Link></Button></CardHeader>
          {loading || !data ? <TableSkeleton rows={5} cols={2} /> : data.recentStudents.length ? (
            <ul className="divide-y">
              {data.recentStudents.map((s) => (
                <li key={s.id}>
                  <Link href={`/admin/students/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-muted/40">
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-medium">{s.fullName}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.institutionName || s.email}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(s.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={Users} title="No students yet" description="Students appear here after they sign up from an exam link." />}
        </Card>
      </div>
    </div>
  );
}
