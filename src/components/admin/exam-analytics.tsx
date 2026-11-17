"use client";

import { useApi } from "@/hooks/use-api";
import { formatPercent } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/layout/page-header";
import { ChartCard } from "@/components/charts/charts";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DifficultyBadge } from "@/components/shared/status";
import { MathText, previewText } from "@/components/question/math-text";
import { ExamNav } from "./exam-nav";

export interface ExamAnalyticsData {
  exam: { id: string; title: string; totalMarks: number; passingMarks: number };
  summary: { evaluated: number; averageScore: number | null; averagePercentage: number | null; medianPercentage: number | null; highestScore: number | null; lowestScore: number | null; passRate: number | null };
  scoreDistribution: { range: string; count: number }[];
  subjectPerformance: { subject: string; averagePercentage: number; accuracy: number }[];
  difficultyAccuracy: { difficulty: string; accuracy: number; attemptRate: number }[];
  questionStats: { number: number; subject: string; difficulty: string; preview: string; attempted: number; correct: number; accuracy: number | null }[];
}

export function ExamAnalyticsBody({ data }: { data: ExamAnalyticsData }) {
  const s = data.summary;
  const hardest = [...data.questionStats].filter((q) => q.accuracy !== null).sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0)).slice(0, 10);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Evaluated" value={s.evaluated} />
        <StatCard label="Average marks" value={s.averageScore ?? "—"} hint={`of ${data.exam.totalMarks}`} />
        <StatCard label="Average %" value={formatPercent(s.averagePercentage)} />
        <StatCard label="Median %" value={formatPercent(s.medianPercentage)} />
        <StatCard label="Highest" value={s.highestScore ?? "—"} />
        <StatCard label="Lowest" value={s.lowestScore ?? "—"} />
        <StatCard label="Pass rate" value={formatPercent(s.passRate)} tone="success" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Score distribution" description="Students by percentage band" data={data.scoreDistribution} xKey="range" series={[{ key: "count", label: "Students" }]} />
        <ChartCard title="Subject-wise performance" description="Average marks as % of maximum" data={data.subjectPerformance} xKey="subject" series={[{ key: "averagePercentage", label: "Average %" }]} unit="%" />
        <ChartCard title="Difficulty-wise accuracy" description="Correct ÷ attempted" data={data.difficultyAccuracy} xKey="difficulty" series={[{ key: "accuracy", label: "Accuracy" }]} unit="%" yMax={100} />
      </div>
      <Card>
        <CardHeader><div><CardTitle>Most difficult questions</CardTitle><CardDescription>Lowest accuracy among students who attempted them</CardDescription></div></CardHeader>
        {hardest.length ? (
          <Table>
            <THead><TR><TH>#</TH><TH>Question</TH><TH>Subject</TH><TH>Difficulty</TH><TH className="text-right">Attempted</TH><TH className="text-right">Correct</TH><TH className="text-right">Accuracy</TH></TR></THead>
            <TBody>{hardest.map((q) => <TR key={q.number}><TD className="font-semibold">Q{q.number}</TD><TD className="max-w-md"><MathText text={previewText(q.preview, 200)} className="line-clamp-1 whitespace-normal" /></TD><TD>{q.subject}</TD><TD><DifficultyBadge difficulty={q.difficulty} /></TD><TD className="text-right tabular-nums">{q.attempted}</TD><TD className="text-right tabular-nums">{q.correct}</TD><TD className="text-right tabular-nums">{formatPercent(q.accuracy)}</TD></TR>)}</TBody>
          </Table>
        ) : <p className="px-5 py-8 text-center text-sm text-muted-foreground">Question statistics appear after attempts are evaluated.</p>}
      </Card>
    </div>
  );
}

export function ExamAnalytics({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi<ExamAnalyticsData>(`/api/admin/exams/${id}/analytics`);
  return (
    <div className="space-y-5">
      <PageHeader title={data?.exam.title ?? "Exam analytics"} breadcrumbs={[{ label: "Exams", href: "/admin/exams" }, { label: data?.exam.title ?? "Exam", href: `/admin/exams/${id}` }, { label: "Analytics" }]}>
        <ExamNav id={id} active="analytics" published />
      </PageHeader>
      {loading && !data ? <Skeleton className="h-96" /> : error ? <Card><ErrorState message={error.message} onRetry={() => reload()} /></Card> : data && <ExamAnalyticsBody data={data} />}
    </div>
  );
}
