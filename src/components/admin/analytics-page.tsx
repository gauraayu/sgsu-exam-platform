"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { PageHeader } from "@/components/layout/page-header";
import { ChartCard } from "@/components/charts/charts";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { ExamAnalyticsBody, type ExamAnalyticsData } from "./exam-analytics";

interface Dash {
  participation: { date: string; started: number; completed: number }[];
  scoreDistribution: { range: string; count: number }[];
  subjectPerformance: { subject: string; averagePercentage: number; accuracy: number }[];
  difficultyAccuracy: { difficulty: string; accuracy: number }[];
  averageByExam: { exam: string; averagePercentage: number }[];
}

export function AnalyticsPage() {
  const dash = useApi<Dash>("/api/admin/dashboard");
  const exams = useApi<{ items: { id: string; title: string; status: string }[] }>("/api/admin/exams?status=all&pageSize=100");
  const [examId, setExamId] = useState("");
  const examData = useApi<ExamAnalyticsData>(examId ? `/api/admin/exams/${examId}/analytics` : null);
  const published = (exams.data?.items ?? []).filter((e) => e.status !== "draft");
  const shortDate = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description="Portal-wide performance trends and per-exam analysis, computed from evaluated attempts in MongoDB." breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Analytics" }]} />
      {dash.error ? <Card><ErrorState message={dash.error.message} onRetry={() => dash.reload()} /></Card> : !dash.data ? <Skeleton className="h-72" /> : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Exam completion trend" description="Completed attempts per day, last 30 days" type="line" data={dash.data.participation.map((p) => ({ ...p, date: shortDate(p.date) }))} xKey="date" series={[{ key: "started", label: "Started", slot: 1 }, { key: "completed", label: "Completed", slot: 2 }]} />
            <ChartCard title="Average score by exam" data={dash.data.averageByExam} xKey="exam" series={[{ key: "averagePercentage", label: "Average %" }]} unit="%" />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <ChartCard title="Overall score distribution" data={dash.data.scoreDistribution} xKey="range" series={[{ key: "count", label: "Students" }]} />
            <ChartCard title="Subject accuracy" description="Correct ÷ attempted" data={dash.data.subjectPerformance} xKey="subject" series={[{ key: "accuracy", label: "Accuracy" }]} unit="%" yMax={100} />
            <ChartCard title="Difficulty-wise accuracy" data={dash.data.difficultyAccuracy} xKey="difficulty" series={[{ key: "accuracy", label: "Accuracy" }]} unit="%" yMax={100} />
          </div>
        </>
      )}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Field label="Analyse a specific exam" htmlFor="exam-pick" className="w-full max-w-md">
            <Select id="exam-pick" value={examId} onChange={(e) => setExamId(e.target.value)}><option value="">Select an exam…</option>{published.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</Select>
          </Field>
        </CardContent>
      </Card>
      {examId ? (examData.loading && !examData.data ? <Skeleton className="h-80" /> : examData.error ? <Card><ErrorState message={examData.error.message} /></Card> : examData.data && <ExamAnalyticsBody data={examData.data} />) : <Card><EmptyState icon={BarChart3} title="Choose an exam" description="See score distribution, subject and difficulty performance, and the most difficult questions." /></Card>}
    </div>
  );
}
