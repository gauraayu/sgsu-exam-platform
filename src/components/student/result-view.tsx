"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, XCircle, MinusCircle } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AttemptStatusBadge, PassBadge } from "@/components/shared/status";
import { QuestionContent, OPTION_LETTERS } from "@/components/question/question-content";
import { MathText } from "@/components/question/math-text";
import { cn, formatDateTime, formatPercent } from "@/lib/utils";

interface ResultPayload {
  attemptId: string;
  status: string;
  finalizationReason: string | null;
  startedAt: string;
  submittedAt: string | null;
  student: { name: string; studentId: string };
  exam: { title: string; totalQuestions: number; totalMarks: number; passingMarks: number };
  visible: boolean;
  reason?: string;
  releaseMode?: string;
  releaseAt?: string | null;
  result?: {
    totalQuestions: number;
    attempted: number;
    correct: number;
    incorrect: number;
    unanswered: number;
    totalScore: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    subjectScores: { subject: string; total: number; attempted: number; correct: number; incorrect: number; unanswered: number; score: number; maxScore: number }[];
  };
  review?: {
    number: number;
    id: string;
    subject: string;
    questionType: string;
    questionText: string;
    questionImages: string[];
    options: string[];
    selectedOption: number | null;
    numericalValue: string | null;
    isCorrect: boolean | null;
    marks: number;
    correctOption: number | null;
    numericalAnswer: string | null;
    explanation: string;
    solutionImages: string[];
  }[] | null;
}

const REASON: Record<string, string> = {
  student_submitted: "Submitted by you",
  time_expired: "Submitted automatically when time ran out",
  max_warnings: "Submitted automatically after the warning limit was reached",
  exam_closed: "Submitted automatically when the exam was closed",
  admin_finalized: "Finalised by the examination cell",
};

export function ResultView({ attemptId }: { attemptId: string }) {
  const { data, error, loading, reload } = useApi<ResultPayload>(`/api/student/results/${attemptId}`);
  const crumbs = [{ label: "Results", href: "/student/results" }, { label: data?.exam.title ?? "Result" }];
  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-40" /><Skeleton className="h-60" /></div>;
  if (error) return <><PageHeader title="Result" breadcrumbs={crumbs} /><Card><ErrorState message={error.message} onRetry={() => reload()} /></Card></>;
  if (!data) return null;

  const meta = (
    <dl className="grid gap-3 text-[14.5px] sm:grid-cols-2 lg:grid-cols-4">
      <div><dt className="text-xs text-muted-foreground">Student</dt><dd className="font-medium">{data.student.name} <span className="font-mono text-xs text-muted-foreground">{data.student.studentId}</span></dd></div>
      <div><dt className="text-xs text-muted-foreground">Exam date</dt><dd className="font-medium">{formatDateTime(data.startedAt)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Submitted</dt><dd className="font-medium">{formatDateTime(data.submittedAt)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="flex items-center gap-2"><AttemptStatusBadge status={data.status} /><span className="text-xs text-muted-foreground">{data.finalizationReason ? REASON[data.finalizationReason] : ""}</span></dd></div>
    </dl>
  );

  if (!data.visible || !data.result) {
    return (
      <>
        <PageHeader title={data.exam.title} breadcrumbs={crumbs} />
        <Card><CardContent className="space-y-4">
          {meta}
          <Alert variant="info" icon={Clock3} title={data.reason === "not_submitted" ? "This attempt has not been submitted yet" : "Your result has not been released yet"}>
            {data.reason === "not_released"
              ? data.releaseMode === "after_end" && data.releaseAt
                ? `Results will be available after the exam closes on ${formatDateTime(data.releaseAt)}.`
                : "The examination cell will release results soon. Your submission has been recorded."
              : data.reason === "evaluating"
                ? "Your answers are being evaluated. Refresh in a moment."
                : "Return to the exam to continue."}
          </Alert>
        </CardContent></Card>
      </>
    );
  }

  const r = data.result;
  return (
    <div className="space-y-6">
      <PageHeader title={data.exam.title} description="Result summary" breadcrumbs={crumbs} />
      <Card><CardContent className="space-y-5">
        {meta}
        <div className="grid gap-4 border-t pt-5 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
          <div className="rounded-lg border bg-subtle p-4 text-center">
            <p className="text-xs text-muted-foreground">Marks obtained</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{r.totalScore}<span className="text-lg text-muted-foreground">/{r.maxScore}</span></p>
            <p className="mt-1 text-sm font-medium tabular-nums">{formatPercent(r.percentage)}</p>
            <div className="mt-2"><PassBadge passed={r.passed} /></div>
            <p className="mt-2 text-xs text-muted-foreground">Passing marks: {data.exam.passingMarks}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              ["Total questions", r.totalQuestions, ""],
              ["Attempted", r.attempted, ""],
              ["Unanswered", r.unanswered, "text-muted-foreground"],
              ["Correct", r.correct, "text-success"],
              ["Incorrect", r.incorrect, "text-danger"],
              ["Accuracy", formatPercent(r.attempted ? (r.correct / r.attempted) * 100 : 0), ""],
            ].map(([l, v, c]) => (
              <div key={l as string} className="rounded-md border p-3">
                <dt className="text-xs text-muted-foreground">{l}</dt>
                <dd className={cn("text-xl font-semibold tabular-nums", c as string)}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </CardContent></Card>

      <Card>
        <CardHeader><CardTitle>Subject-wise performance</CardTitle></CardHeader>
        <Table>
          <THead><TR><TH>Subject</TH><TH className="text-right">Questions</TH><TH className="text-right">Attempted</TH><TH className="text-right">Correct</TH><TH className="text-right">Incorrect</TH><TH className="text-right">Score</TH><TH className="w-48">Percentage</TH></TR></THead>
          <TBody>
            {r.subjectScores.map((s) => {
              const pct = s.maxScore ? (s.score / s.maxScore) * 100 : 0;
              return (
                <TR key={s.subject}>
                  <TD className="font-medium">{s.subject}</TD>
                  <TD className="text-right tabular-nums">{s.total}</TD>
                  <TD className="text-right tabular-nums">{s.attempted}</TD>
                  <TD className="text-right tabular-nums text-success">{s.correct}</TD>
                  <TD className="text-right tabular-nums text-danger">{s.incorrect}</TD>
                  <TD className="text-right font-medium tabular-nums">{s.score}/{s.maxScore}</TD>
                  <TD><div className="flex items-center gap-2"><Progress value={Math.max(0, pct)} className="flex-1" /><span className="w-12 text-right text-xs tabular-nums">{formatPercent(pct)}</span></div></TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      {data.review ? (
        <Card>
          <CardHeader><CardTitle>Answer review</CardTitle><Badge variant="outline">{data.review.length} questions</Badge></CardHeader>
          <CardContent className="space-y-4">
            {data.review.map((q) => (
              <div key={q.id} className="rounded-lg border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold">Q{q.number}</span>
                  <Badge variant="primary">{q.subject}</Badge>
                  {q.isCorrect === true && <Badge variant="success"><CheckCircle2 /> Correct (+{q.marks})</Badge>}
                  {q.isCorrect === false && <Badge variant="danger"><XCircle /> Incorrect ({q.marks})</Badge>}
                  {q.isCorrect === null && <Badge><MinusCircle /> Not answered</Badge>}
                </div>
                <QuestionContent text={q.questionText} images={q.questionImages} />
                {q.questionType === "single_correct" ? (
                  <ul className="mt-3 space-y-1.5">
                    {q.options.map((o, i) => {
                      const correct = q.correctOption === i + 1;
                      const chosen = q.selectedOption === i + 1;
                      return (
                        <li key={i} className={cn("flex gap-2 rounded-md border px-3 py-2 text-sm", correct && "border-success/50 bg-success-soft", chosen && !correct && "border-danger/40 bg-danger-soft")}>
                          <span className="font-semibold">{OPTION_LETTERS[i]}.</span>
                          <MathText text={o} className="flex-1" />
                          {correct && <span className="text-xs font-medium text-success">Correct answer</span>}
                          {chosen && <span className="text-xs font-medium text-muted-foreground">Your answer</span>}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm">Your answer: <span className="font-mono">{q.numericalValue ?? "—"}</span> · Correct answer: <span className="font-mono font-semibold">{q.numericalAnswer}</span></p>
                )}
                {(q.explanation || q.solutionImages.length > 0) && (
                  <div className="mt-3 rounded-md bg-subtle p-3">
                    <p className="mb-1 text-xs font-semibold text-muted-foreground">Explanation</p>
                    <QuestionContent text={q.explanation} images={q.solutionImages} className="text-sm" label="Solution figure" />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <p className="text-center text-xs text-muted-foreground">Detailed answer review is not enabled for this exam.</p>
      )}
      <div className="flex justify-center"><Button asChild variant="outline"><Link href="/student/results">Back to results</Link></Button></div>
    </div>
  );
}
