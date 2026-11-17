"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Search, Trophy } from "lucide-react";
import { SUBJECT_SHORT, type Subject } from "@/lib/constants";
import { useApi } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { qs } from "@/lib/client-api";
import { formatDateTime, formatPercent } from "@/lib/utils";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Sheet } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { AttemptStatusBadge, PassBadge } from "@/components/shared/status";
import { MathText, previewText } from "@/components/question/math-text";
import { ExamNav } from "./exam-nav";
import { cn } from "@/lib/utils";

interface ResultRow { attemptId: string; studentCode: string; name: string; email: string; attemptDate: string; submittedAt: string; attemptStatus: string; subjectScores: Record<string, number | null>; totalScore: number; maxScore: number; percentage: number; passed: boolean; warningCount: number }
interface ResultsResponse { exam: { id: string; title: string; totalMarks: number; passingMarks: number }; subjects: string[]; items: ResultRow[]; total: number; page: number; pageSize: number; totalPages: number }

export function ExamResults({ id }: { id: string }) {
  const [search, setSearch] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("-score");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detail, setDetail] = useState<string | null>(null);
  const q = useDebounce(search, 300);
  const filters = { search: q, outcome, status, sort };
  const { data, error, loading, reload } = useApi<ResultsResponse>(`/api/admin/exams/${id}/results${qs({ ...filters, page, pageSize })}`);
  const exportUrl = (format: string) => `/api/admin/exams/${id}/export${qs({ ...filters, format })}`;
  const onSort = (s: string) => { setSort(s); setPage(1); };

  return (
    <div className="space-y-5">
      <PageHeader
        title={data?.exam.title ?? "Exam results"}
        description={data ? `Total marks ${data.exam.totalMarks} · Passing marks ${data.exam.passingMarks}` : undefined}
        breadcrumbs={[{ label: "Exams", href: "/admin/exams" }, { label: data?.exam.title ?? "Exam", href: `/admin/exams/${id}` }, { label: "Results" }]}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline"><Download /> Export</Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem asChild><a href={exportUrl("xlsx")}><FileSpreadsheet /> Excel (.xlsx)</a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={exportUrl("csv")}><FileText /> CSV</a></DropdownMenuItem>
              <DropdownMenuItem asChild><a href={exportUrl("pdf")}><FileText /> PDF report</a></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        <ExamNav id={id} active="results" published />
      </PageHeader>
      <Card>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <div className="relative min-w-56 flex-1"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, email or student ID" className="pl-8" aria-label="Search results" /></div>
          <Select value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }} className="w-36" aria-label="Pass / fail"><option value="all">All outcomes</option><option value="passed">Passed</option><option value="failed">Failed</option></Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-44" aria-label="Attempt status"><option value="all">All statuses</option><option value="submitted">Submitted</option><option value="auto_submitted">Auto-submitted</option><option value="terminated">Terminated</option></Select>
        </div>
        {loading && !data ? <TableSkeleton rows={8} cols={10} /> : error ? <ErrorState message={error.message} onRetry={() => reload()} /> : !data?.items.length ? <EmptyState icon={Trophy} title={q || outcome !== "all" || status !== "all" ? "No results match" : "No results yet"} description="Results appear when students submit or their attempts are finalised." /> : (
          <div className={cn(loading && "opacity-60")}>
            <Table>
              <THead>
                <TR>
                  <SortableTH label="Student" field="name" sort={sort} onSort={onSort} />
                  <TH>Attempt date</TH>
                  <SortableTH label="Submitted" field="submitted" sort={sort} onSort={onSort} />
                  {data.subjects.map((sub) => <TH key={sub} className="text-right">{SUBJECT_SHORT[sub as Subject] ?? sub}</TH>)}
                  <SortableTH label="Final marks" field="score" sort={sort} onSort={onSort} className="text-right" />
                  <TH className="text-right">%</TH><TH>Result</TH><TH>Status</TH><TH />
                </TR>
              </THead>
              <TBody>
                {data.items.map((r) => (
                  <TR key={r.attemptId}>
                    <TD><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.email} · <span className="font-mono">{r.studentCode}</span></p></TD>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.attemptDate)}</TD>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.submittedAt)}</TD>
                    {data.subjects.map((sub) => <TD key={sub} className="text-right tabular-nums">{r.subjectScores[sub] ?? "—"}</TD>)}
                    <TD className="text-right font-semibold tabular-nums">{r.totalScore}<span className="font-normal text-muted-foreground">/{r.maxScore}</span></TD>
                    <TD className="text-right tabular-nums">{formatPercent(r.percentage)}</TD>
                    <TD><PassBadge passed={r.passed} /></TD>
                    <TD><AttemptStatusBadge status={r.attemptStatus} /></TD>
                    <TD className="text-right"><Button size="xs" variant="ghost" onClick={() => setDetail(r.attemptId)}>Details</Button></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </div>
        )}
      </Card>
      <AttemptDetailSheet examId={id} attemptId={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

interface AttemptDetail {
  student: { fullName: string; email: string; studentId: string; mobile: string; institutionName: string } | null;
  attempt: { status: string; startedAt: string; submittedAt: string; finalizationReason: string; warningCount: number };
  result: { totalScore: number; maxScore: number; percentage: number; correctCount: number; incorrectCount: number; unansweredCount: number; subjectScores: { subject: string; attempted: number; correct: number; incorrect: number; score: number; maxScore: number }[] } | null;
  questions: { number: number; subject: string; difficulty: string; questionType: string; questionText: string; selectedOption: number | null; numericalValue: string | null; correctOption: number | null; numericalAnswer: string | null; isCorrect: boolean | null; marks: number | null }[];
}

function AttemptDetailSheet({ examId, attemptId, onClose }: { examId: string; attemptId: string | null; onClose: () => void }) {
  const { data } = useApi<AttemptDetail>(attemptId ? `/api/admin/exams/${examId}/results/${attemptId}` : null);
  const d = data && attemptId ? data : null;
  return (
    <Sheet open={!!attemptId} onOpenChange={(o) => !o && onClose()} title={d?.student?.fullName ?? "Student result"} description={d?.student ? `${d.student.email} · ${d.student.studentId}` : undefined} width="max-w-3xl">
      {!d ? <Skeleton className="h-60" /> : (
        <div className="space-y-5 text-[14.5px]">
          {d.result && (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["Marks", `${d.result.totalScore}/${d.result.maxScore}`], ["Percentage", formatPercent(d.result.percentage)], ["Correct / Incorrect", `${d.result.correctCount} / ${d.result.incorrectCount}`], ["Unanswered", d.result.unansweredCount]].map(([k, v]) => <div key={k as string} className="rounded-md border p-2.5"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>)}
            </dl>
          )}
          {d.result && (
            <Table><THead><TR><TH>Subject</TH><TH className="text-right">Attempted</TH><TH className="text-right">Correct</TH><TH className="text-right">Incorrect</TH><TH className="text-right">Score</TH></TR></THead>
              <TBody>{d.result.subjectScores.map((s) => <TR key={s.subject}><TD>{s.subject}</TD><TD className="text-right">{s.attempted}</TD><TD className="text-right">{s.correct}</TD><TD className="text-right">{s.incorrect}</TD><TD className="text-right font-medium">{s.score}/{s.maxScore}</TD></TR>)}</TBody></Table>
          )}
          <div>
            <p className="mb-2 font-medium">Responses</p>
            <ol className="divide-y rounded-md border">
              {d.questions.map((q) => (
                <li key={q.number} className="flex items-start gap-3 px-3 py-2">
                  <span className="w-8 shrink-0 font-semibold text-muted-foreground">Q{q.number}</span>
                  <MathText text={previewText(q.questionText, 110)} className="line-clamp-1 flex-1 whitespace-normal" />
                  <span className="shrink-0 font-mono text-xs">{q.questionType === "numerical" ? `${q.numericalValue ?? "—"} / ${q.numericalAnswer}` : `${q.selectedOption ? "ABCD"[q.selectedOption - 1] : "—"} / ${q.correctOption ? "ABCD"[q.correctOption - 1] : "?"}`}</span>
                  <Badge variant={q.isCorrect ? "success" : q.isCorrect === false ? "danger" : "default"} className="shrink-0">{q.marks ?? 0}</Badge>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </Sheet>
  );
}
