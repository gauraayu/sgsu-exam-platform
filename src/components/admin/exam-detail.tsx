"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, Lock, Pencil, RefreshCw, Replace, Rocket, Sparkles, Trash2, CopyPlus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/client-api";
import { formatDateTime, formatDuration, formatPercent } from "@/lib/utils";
import { formatInZone } from "@/lib/timezone";
import { PageHeader, StatCard } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, EmptyState, ErrorState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { ExamStatusBadge, DifficultyBadge } from "@/components/shared/status";
import { ShareCard } from "./exam-share";
import { ScheduleCard, type ScheduleExam } from "./exam-schedule";
import { QuestionPreview } from "./question-preview";
import { ExamNav } from "./exam-nav";

interface PaperItem {
  id: string;
  displayOrder: number;
  questionId: string;
  questionSnapshot: { subject: string; topic: string; difficulty: string; questionType: string; questionText: string; options: string[]; questionImages: string[]; originalQuestionId: string };
  answerKeySnapshot: { correctOption: number | null; numericalAnswer: string | null; explanation: string; solutionImages: string[] };
}
interface Detail {
  exam: {
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    durationMinutes: number;
    totalQuestions: number;
    totalMarks: number;
    passingMarks: number;
    startDate: string;
    endDate: string;
    lifecycle: ScheduleExam["lifecycle"];
    timezone?: string;
    scheduleMode?: "immediate" | "scheduled";
    accessValidityMinutes?: number;
    hardEndAt?: string | null;
    templateId?: string | null;
    appliedTemplateSnapshot?: { name?: string } | null;
    shareToken?: string;
    version: number;
    generatedAt?: string;
    publishedAt?: string;
    marking: { correct: number; incorrect: number; unanswered: number };
    subjectDistribution: { subject: string; count: number; difficulty: Record<string, number> | null; topics: string[] }[];
    difficultyDistribution: Record<string, number> | null;
    selection: { mode: string; sources: string[]; includeNumerical: boolean };
    settings: { resultRelease: string; resultsReleased: boolean; allowAnswerReview: boolean; shuffleQuestions: boolean; shuffleOptions: boolean; security: Record<string, boolean | number> };
  };
  paper: PaperItem[];
  distribution: { subjects: Record<string, number>; difficulties: Record<string, number> };
  stats?: { participants: number; completed: number; active: number; avgPercentage: number | null; passRate: number | null };
  serverNow: string;
}

export function ExamDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, loading, reload } = useApi<Detail>(`/api/admin/exams/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "publish" | "close" | "delete" | "regenerate" | "archive">(null);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [showAnswers, setShowAnswers] = useState(true);

  async function action(name: string, fn: () => Promise<unknown>, success: string) {
    setBusy(name);
    setProblems(null);
    try {
      await fn();
      toast.success(success);
      setConfirm(null);
      await reload(true);
    } catch (e) {
      const err = e as ApiError;
      const det = err.details as { problems?: string[] } | undefined;
      if (det?.problems?.length && err.code === "INSUFFICIENT_QUESTIONS") setProblems(det.problems.filter((p) => !/^[a-f\d]{24}$/i.test(p)).length ? det.problems.filter((p) => !/^[a-f\d]{24}$/i.test(p)) : [err.message]);
      else toast.error(err.message);
      setConfirm(null);
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) return <div className="space-y-4"><Skeleton className="h-12 w-96" /><Skeleton className="h-40" /><Skeleton className="h-96" /></div>;
  if (error) return <Card><ErrorState message={error.message} onRetry={() => reload()} /></Card>;
  if (!data) return null;
  const { exam, paper } = data;
  const draft = exam.status === "draft";
  const published = exam.status !== "draft";

  return (
    <div className="space-y-5">
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{exam.title} <span data-testid="exam-lifecycle"><ExamStatusBadge status={exam.lifecycle} /></span></span>}
        description={exam.description || undefined}
        breadcrumbs={[{ label: "Exams", href: "/admin/exams" }, { label: exam.title }]}
        actions={
          <>
            {draft && <Button variant="outline" asChild><Link href={`/admin/exams/${id}/edit`}><Pencil /> Edit configuration</Link></Button>}
            {draft && <Button variant="ghost" onClick={() => setConfirm("delete")}><Trash2 /> Delete</Button>}
            {!draft && <Button variant="outline" loading={busy === "dup"} onClick={async () => { setBusy("dup"); try { const r = await api<{ id: string }>(`/api/admin/exams/${id}/duplicate`, { method: "POST", json: { copyPaper: true } }); toast.success("Duplicated as a new draft."); router.push(`/admin/exams/${r.id}`); } catch (e) { toast.error((e as ApiError).message); setBusy(null); } }}><CopyPlus /> Duplicate</Button>}
            {exam.status === "published" && <Button variant="outline" onClick={() => setConfirm("close")}><Lock /> Close exam</Button>}
            {exam.status === "closed" && <Button variant="ghost" onClick={() => setConfirm("archive")}><Archive /> Archive</Button>}
            {draft && paper.length > 0 && <Button onClick={() => setConfirm("publish")}><Rocket /> Publish</Button>}
          </>
        }
      >
        <ExamNav id={id} active="overview" published={published} />
      </PageHeader>

      {(published || exam.status === "closed") && exam.shareToken && <ShareCard examId={id} />}
      <ScheduleCard exam={exam} participants={data.stats?.participants ?? 0} serverNow={data.serverNow} onChanged={() => void reload(true)} />
      {exam.appliedTemplateSnapshot?.name && <p className="text-sm text-muted-foreground">Created from the template <span className="font-medium text-foreground">{exam.appliedTemplateSnapshot.name}</span>. Later changes to that template do not affect this examination.</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <StatCard label="Questions" value={exam.totalQuestions} />
        <StatCard label="Duration" value={formatDuration(exam.durationMinutes)} />
        <StatCard label="Total / passing" value={`${exam.totalMarks} / ${exam.passingMarks}`} />
        <StatCard label="Marking" value={`+${exam.marking.correct} / −${exam.marking.incorrect}`} />
        <StatCard label="Participants" value={data.stats?.participants ?? 0} hint={data.stats?.active ? `${data.stats.active} active now` : undefined} />
        <StatCard label="Average score" value={formatPercent(data.stats?.avgPercentage)} hint={data.stats?.passRate != null ? `Pass rate ${formatPercent(data.stats.passRate)}` : undefined} />
      </div>

      <Card>
        <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-[14.5px] sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Subject distribution</dt><dd className="font-medium">{exam.selection.mode === "manual" ? "Manual selection" : exam.subjectDistribution.map((s) => `${s.subject} ${s.count}${s.difficulty ? ` (E${s.difficulty.Easy}/M${s.difficulty.Medium}/H${s.difficulty.Hard})` : ""}`).join(" · ")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Difficulty distribution</dt><dd className="font-medium">{exam.difficultyDistribution ? `Easy ${exam.difficultyDistribution.Easy} · Medium ${exam.difficultyDistribution.Medium} · Hard ${exam.difficultyDistribution.Hard}` : "Any"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Sources</dt><dd className="font-medium">{exam.selection.sources.length ? exam.selection.sources.join(", ") : "All sources"}{exam.selection.includeNumerical ? " · incl. numerical" : ""}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Results</dt><dd className="font-medium">{{ immediate: "Released immediately", after_end: "After exam closes", manual: exam.settings.resultsReleased ? "Released by admin" : "Awaiting admin release" }[exam.settings.resultRelease]}{exam.settings.allowAnswerReview ? " · answer review on" : ""}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Shuffling</dt><dd className="font-medium">{exam.settings.shuffleQuestions ? "Questions" : "No question shuffle"}{exam.settings.shuffleOptions ? " · options" : ""}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Security</dt><dd className="flex flex-wrap gap-1 pt-0.5">
              {(["fullscreen", "tabSwitchWarnings", "camera", "microphone", "soundMonitoring", "oneAttempt"] as const).map((k) => exam.settings.security[k] ? <Badge key={k} variant="outline">{{ fullscreen: "Fullscreen", tabSwitchWarnings: "Tab warnings", camera: "Camera", microphone: "Microphone", soundMonitoring: "Sound level", oneAttempt: "One attempt" }[k]}</Badge> : null)}
              <Badge variant="outline">Max {String(exam.settings.security.maxWarnings)} warnings</Badge>
            </dd></div>
          </dl>
          {exam.status === "published" && exam.settings.resultRelease === "manual" && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4 text-[14.5px]">
              <span>Results are {exam.settings.resultsReleased ? "visible to students." : "hidden from students."}</span>
              <Button size="sm" variant={exam.settings.resultsReleased ? "outline" : "accent"} loading={busy === "release"} onClick={() => action("release", () => api(`/api/admin/exams/${id}`, { method: "PATCH", json: { settings: { resultsReleased: !exam.settings.resultsReleased } } }), exam.settings.resultsReleased ? "Results hidden." : "Results released to students.")}>
                {exam.settings.resultsReleased ? "Hide results" : "Release results"}
              </Button>
            </div>
          )}
          {exam.status === "closed" && exam.settings.resultRelease === "manual" && !exam.settings.resultsReleased && (
            <div className="mt-4 border-t pt-4"><Button size="sm" variant="accent" loading={busy === "release"} onClick={() => action("release", () => api(`/api/admin/exams/${id}`, { method: "PATCH", json: { settings: { resultsReleased: true } } }), "Results released to students.")}>Release results</Button></div>
          )}
        </CardContent>
      </Card>

      {problems && (
        <Alert variant="danger" icon={AlertTriangle} title="The paper could not be generated">
          <ul className="list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="mt-1">Questions are never fabricated. Verify more questions in the Question Bank or adjust the distribution.</p>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Question paper {exam.version ? <span className="font-normal text-muted-foreground">· version {exam.version}</span> : null}</CardTitle>
            <CardDescription>{paper.length ? `${paper.length} questions · generated ${formatDateTime(exam.generatedAt)}${published ? " · frozen after publishing" : ""}` : "No paper generated yet."}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {paper.length > 0 && <Button variant="ghost" size="sm" onClick={() => setShowAnswers((v) => !v)}>{showAnswers ? "Hide answers" : "Show answers"}</Button>}
            {draft && (paper.length ? (
              <Button variant="outline" size="sm" onClick={() => setConfirm("regenerate")}><RefreshCw /> Regenerate</Button>
            ) : (
              <Button size="sm" loading={busy === "generate"} onClick={() => action("generate", () => api(`/api/admin/exams/${id}/generate`, { method: "POST" }), "Paper generated.")}><Sparkles /> Generate paper</Button>
            ))}
          </div>
        </CardHeader>
        {paper.length > 0 && (
          <div className="flex flex-wrap gap-4 border-b px-5 py-3 text-[14.5px]">
            <span className="text-muted-foreground">Subjects:</span>
            {Object.entries(data.distribution.subjects).map(([k, v]) => <span key={k}><span className="font-medium">{k}</span> {v}</span>)}
            <span className="text-muted-foreground">Difficulty:</span>
            {Object.entries(data.distribution.difficulties).map(([k, v]) => <span key={k}><span className="font-medium">{k}</span> {v}</span>)}
          </div>
        )}
        {!paper.length ? (
          <EmptyState icon={Sparkles} title="Generate the paper to preview it" description="Questions are drawn at random from the question bank according to your distribution. You can replace individual questions before publishing." />
        ) : (
          <ol className="divide-y">
            {paper.map((p) => (
              <li key={p.id} className="grid gap-3 px-5 py-4 md:grid-cols-[48px_minmax(0,1fr)]">
                <div className="text-sm font-semibold text-muted-foreground">Q{p.displayOrder}</div>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="primary">{p.questionSnapshot.subject}</Badge>
                    <DifficultyBadge difficulty={p.questionSnapshot.difficulty} />
                    {p.questionSnapshot.topic && <Badge variant="outline">{p.questionSnapshot.topic}</Badge>}
                    <span className="font-mono text-xs text-muted-foreground">{p.questionSnapshot.originalQuestionId}</span>
                    {draft && <ReplaceButton examId={id} examQuestionId={p.id} onDone={() => reload(true)} />}
                  </div>
                  <QuestionPreview
                    questionText={p.questionSnapshot.questionText}
                    questionImages={p.questionSnapshot.questionImages}
                    options={p.questionSnapshot.options}
                    questionType={p.questionSnapshot.questionType}
                    correctOption={p.answerKeySnapshot.correctOption}
                    numericalAnswer={p.answerKeySnapshot.numericalAnswer}
                    explanation={showAnswers ? p.answerKeySnapshot.explanation : undefined}
                    solutionImages={showAnswers ? p.answerKeySnapshot.solutionImages : []}
                    showAnswer={showAnswers}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <ConfirmDialog open={confirm === "publish"} onOpenChange={(o) => !o && setConfirm(null)} title="Publish this exam?" description={`Publishing freezes the question paper and marking scheme and creates the exam link and access code. ${exam.scheduleMode === "immediate" ? "The exam opens for students immediately." : new Date(exam.startDate).getTime() > new Date(data.serverNow).getTime() ? `It will show as Scheduled and open automatically at ${formatInZone(exam.startDate, exam.timezone)}.` : "Students can start within the exam window."}`} confirmLabel="Publish exam" loading={busy === "publish"} onConfirm={() => action("publish", () => api(`/api/admin/exams/${id}/publish`, { method: "POST" }), "Examination published successfully. You can now share the link and access code.")} />
      <ConfirmDialog open={confirm === "regenerate"} onOpenChange={(o) => !o && setConfirm(null)} title="Regenerate the paper?" description="A completely new random paper will replace the current draft, including any replaced questions." confirmLabel="Regenerate" loading={busy === "generate"} onConfirm={() => action("generate", () => api(`/api/admin/exams/${id}/generate`, { method: "POST" }), "New paper generated.")} />
      <ConfirmDialog open={confirm === "close"} onOpenChange={(o) => !o && setConfirm(null)} title="Close this exam now?" description={`New attempts will be blocked and ${data.stats?.active ?? 0} active attempt(s) will be submitted automatically with their saved answers.`} confirmLabel="Close exam" destructive loading={busy === "close"} onConfirm={() => action("close", () => api(`/api/admin/exams/${id}/close`, { method: "POST" }), "Exam closed.")} />
      <ConfirmDialog open={confirm === "archive"} onOpenChange={(o) => !o && setConfirm(null)} title="Archive this exam?" description="Archived exams are hidden from the default list. Results and history are kept." confirmLabel="Archive" loading={busy === "archive"} onConfirm={() => action("archive", () => api(`/api/admin/exams/${id}/archive`, { method: "POST" }), "Exam archived.")} />
      <ConfirmDialog open={confirm === "delete"} onOpenChange={(o) => !o && setConfirm(null)} title="Delete this draft?" description="The draft and its generated paper will be removed. Questions in the bank are not affected." confirmLabel="Delete draft" destructive loading={busy === "delete"} onConfirm={async () => { setBusy("delete"); try { await api(`/api/admin/exams/${id}`, { method: "DELETE" }); toast.success("Draft deleted."); router.push("/admin/exams"); } catch (e) { toast.error((e as ApiError).message); setBusy(null); } }} />
    </div>
  );
}

function ReplaceButton({ examId, examQuestionId, onDone }: { examId: string; examQuestionId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [specific, setSpecific] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      await api(`/api/admin/exams/${examId}/replace-question`, { method: "POST", json: { examQuestionId, replacementQuestionId: specific.trim() || undefined } });
      toast.success("Question replaced.");
      setOpen(false);
      setSpecific("");
      onDone();
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setOpen(true)}><Replace /> Replace</Button>
      <ConfirmDialog open={open} onOpenChange={setOpen} title="Replace this question" description="By default a random question of the same subject (and difficulty, when a difficulty split applies) is chosen. You can also enter a specific question's internal ID from the Question Bank." confirmLabel="Replace" loading={busy} onConfirm={go}>
        <Field label="Specific question ID (optional)" htmlFor="rep-id"><Input id="rep-id" value={specific} onChange={(e) => setSpecific(e.target.value)} placeholder="24-character ID" className="font-mono text-xs" /></Field>
      </ConfirmDialog>
    </>
  );
}

