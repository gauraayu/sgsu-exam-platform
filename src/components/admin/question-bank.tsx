"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, Eye, FileQuestion, ImageOff, LibraryBig, MoreHorizontal, Pencil, PlusCircle, RotateCcw, Search, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { api, ApiError, qs } from "@/lib/client-api";
import { QUESTION_ISSUES, QUESTION_TYPE_LABELS, SOURCE_LABELS, SOURCE_TYPES, SUBJECT_SHORT, SUBJECTS, type QuestionIssue, type Subject } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Alert, EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { DifficultyBadge, VerificationBadge } from "@/components/shared/status";
import { Field } from "@/components/ui/label";
import { MathText, previewText } from "@/components/question/math-text";
import { QuestionPreview } from "./question-preview";

interface Stats {
  total: number;
  bySubject: Record<string, number>;
  validMcqs: number;
  numerical: number;
  verified: number;
  pending: number;
  rejected: number;
  missingImages: number;
  withIssues: number;
  eligible: { subject: string; difficulty: string; type: string; count: number }[];
  breakdown: { subject: string; topic: string; difficulty: string; count: number }[];
}

const DIFF_STYLE: Record<string, { label: string; text: string; bar: string; ring: string }> = {
  Easy: { label: "Easy", text: "text-success", bar: "bg-success", ring: "ring-success/40" },
  Medium: { label: "Medium", text: "text-warning", bar: "bg-warning", ring: "ring-warning/40" },
  Hard: { label: "Hard", text: "text-danger", bar: "bg-danger", ring: "ring-danger/40" },
  Unclassified: { label: "Unclassified", text: "text-muted-foreground", bar: "bg-muted-foreground", ring: "ring-border" },
};
interface Row {
  id: string;
  originalQuestionId: string;
  subject: string;
  topic: string;
  difficulty: string;
  questionType: "single_correct" | "numerical";
  questionText: string;
  sourceType: keyof typeof SOURCE_LABELS;
  sourceFile: string;
  verificationStatus: string;
  assetStatus: string;
  issues: string[];
  archived: boolean;
}
interface ListResponse {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface FullQuestion extends Row {
  subtopic: string;
  chapter: string;
  options: string[];
  correctOption: number | null;
  numericalAnswer: string | null;
  explanation: string;
  questionImages: string[];
  solutionImages: string[];
  originalSource: string;
  sourceLicense: string;
  sourceExam: string;
  originalDifficulty: string;
  missingAssets: string[];
  curationNotes?: string[];
  issueLabels: string[];
  rejectionReason: string;
  verifiedAt: string | null;
  verifiedBy?: { fullName: string } | null;
  createdAt: string;
  updatedAt: string;
}

const FILTERS = ["subject", "topic", "difficulty", "questionType", "sourceType", "verificationStatus", "assetStatus", "hasIssues", "archived"] as const;

export function QuestionBank() {
  const router = useRouter();
  const sp = useSearchParams();
  const [search, setSearch] = useState(sp.get("search") ?? "");
  const debounced = useDebounce(search, 350);
  const [filters, setFilters] = useState<Record<string, string>>(() => Object.fromEntries(FILTERS.map((f) => [f, sp.get(f) ?? ""])));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<null | "reject" | "archive">(null);
  const [bulkReason, setBulkReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [topicSearch, setTopicSearch] = useState("");

  const url = `/api/admin/questions${qs({ ...filters, search: debounced, page, pageSize })}`;
  const list = useApi<ListResponse>(url);
  const stats = useApi<Stats>("/api/admin/questions/stats");

  useEffect(() => {
    const params = qs({ ...filters, search: debounced });
    router.replace(`/admin/questions${params}`, { scroll: false });
  }, [filters, debounced, router]);

  const setFilter = (k: string, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
    setSelected(new Set());
  };
  const activeFilters = Object.values(filters).filter(Boolean).length + (debounced ? 1 : 0);
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const refresh = () => {
    void list.reload(true);
    void stats.reload(true);
  };

  async function runBulk() {
    if (!bulk) return;
    setBusy(true);
    try {
      const r = await api<{ updated: number; skipped: number; skippedReason?: string }>("/api/admin/questions/bulk", { method: "POST", json: { ids: [...selected], action: bulk, reason: bulkReason || undefined } });
      toast.success(`${r.updated} question(s) updated.${r.skipped ? ` ${r.skipped} skipped — ${r.skippedReason}` : ""}`);
      setSelected(new Set());
      setBulk(null);
      setBulkReason("");
      refresh();
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const s = stats.data;
  const subjectSel = filters.subject ?? "";
  const scoped = (s?.breakdown ?? []).filter((b) => !subjectSel || b.subject === subjectSel);
  const diffCounts = scoped.reduce<Record<string, number>>((acc, b) => ((acc[b.difficulty] = (acc[b.difficulty] ?? 0) + b.count), acc), {});
  const scopedTotal = Object.values(diffCounts).reduce((a, n) => a + n, 0);
  const topicMap = new Map<string, Record<string, number>>();
  for (const b of scoped) {
    if (!b.topic) continue;
    const t = topicMap.get(b.topic) ?? {};
    t[b.difficulty] = (t[b.difficulty] ?? 0) + b.count;
    topicMap.set(b.topic, t);
  }
  const topicList = [...topicMap.entries()]
    .map(([topic, d]) => ({ topic, d, n: Object.values(d).reduce((a, x) => a + x, 0) }))
    .filter((t) => !topicSearch || t.topic.toLowerCase().includes(topicSearch.toLowerCase()))
    .sort((x, y) => y.n - x.n || x.topic.localeCompare(y.topic));
  const usable = s ? s.eligible.reduce((a, e) => a + e.count, 0) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Question Bank"
        description="Manage, import, review and organise examination questions. Every active question without an open issue can be used in exams."
        breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Question Bank" }]}
        actions={
          <>
            <Button asChild variant="outline"><Link href="/admin/questions/new"><PlusCircle /> Add question</Link></Button>
            <Button asChild><Link href="/admin/import/local"><Upload /> Import questions</Link></Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!s ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[78px]" />) : (
          <>
            <StatCard label="Total questions" value={s.total.toLocaleString("en-IN")} />
            <StatCard label="Usable in exams" value={usable.toLocaleString("en-IN")} tone="success" />
            <StatCard label="Kept out of exams (rejected)" value={s.rejected.toLocaleString("en-IN")} tone="danger" />
            <StatCard label="Need attention (open issues)" value={s.withIssues.toLocaleString("en-IN")} tone="warning" />
          </>
        )}
      </div>

      <Card>
        <div className="flex gap-1 overflow-x-auto border-b px-3 pt-3" role="tablist" aria-label="Subject">
          {[["", "All subjects", s?.total], ...SUBJECTS.map((x) => [x, SUBJECT_SHORT[x], s?.bySubject[x]] as const)].map(([val, label, n]) => {
            const active = subjectSel === val;
            return (
              <button
                key={label as string}
                role="tab"
                aria-label={`${(val as string) || "All subjects"}${typeof n === "number" ? ` (${n})` : ""}`}
                title={(val as string) || "All subjects"}
                aria-selected={active}
                onClick={() => { setFilters((f) => ({ ...f, subject: val as string, topic: "", difficulty: "" })); setPage(1); setSelected(new Set()); }}
                className={cn("-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring", active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
              >
                {label}
                {typeof n === "number" && <span className={cn("rounded-full px-2 py-0.5 text-xs tabular-nums", active ? "bg-primary-soft text-primary" : "bg-muted")}>{n.toLocaleString("en-IN")}</span>}
              </button>
            );
          })}
        </div>

        {/* Difficulty summary: click a level to filter, click again to clear. */}
        <div className="grid gap-3 border-b p-3 sm:grid-cols-3" aria-label="Questions by difficulty">
          {(["Easy", "Medium", "Hard"] as const).map((d) => {
            const n = diffCounts[d] ?? 0;
            const st = DIFF_STYLE[d];
            const active = filters.difficulty === d;
            return (
              <button
                key={d}
                onClick={() => setFilter("difficulty", active ? "" : d)}
                aria-pressed={active}
                className={cn("rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring", active && `ring-2 ${st.ring}`)}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn("text-sm font-semibold", st.text)}>{st.label}</span>
                  <span className="text-sm tabular-nums text-muted-foreground"><span className="font-semibold text-foreground">{n.toLocaleString("en-IN")}</span>{scopedTotal ? ` · ${Math.round((n / scopedTotal) * 100)}%` : ""}</span>
                </span>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted"><span className={cn("block h-full rounded-full", st.bar)} style={{ width: `${scopedTotal ? (n / scopedTotal) * 100 : 0}%` }} /></span>
              </button>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Topic browser */}
          <aside className="border-b lg:border-b-0 lg:border-r" aria-label="Topics">
            <div className="p-3 pb-2">
              <p className="mb-2 text-sm font-semibold">Topics{subjectSel ? ` · ${SUBJECT_SHORT[subjectSel as Subject] ?? subjectSel}` : ""}</p>
              <Input value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} placeholder="Find a topic" className="h-8" aria-label="Find a topic" />
            </div>
            <ul className="max-h-[260px] overflow-y-auto px-2 pb-3 lg:max-h-[640px]">
              <li>
                <button onClick={() => setFilter("topic", "")} className={cn("flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", !filters.topic && "bg-primary-soft font-medium text-primary")}>
                  <span>All topics</span><span className="tabular-nums text-xs text-muted-foreground">{scopedTotal.toLocaleString("en-IN")}</span>
                </button>
              </li>
              {topicList.map((t) => (
                <li key={t.topic}>
                  <button
                    onClick={() => setFilter("topic", filters.topic === t.topic ? "" : t.topic)}
                    title={`Easy ${t.d.Easy ?? 0} · Medium ${t.d.Medium ?? 0} · Hard ${t.d.Hard ?? 0}`}
                    className={cn("w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", filters.topic === t.topic && "bg-primary-soft font-medium text-primary")}
                  >
                    <span className="flex items-center justify-between gap-2"><span className="truncate">{t.topic}</span><span className="tabular-nums text-xs text-muted-foreground">{t.n}</span></span>
                    <span className="mt-0.5 flex gap-2 text-[11.5px] tabular-nums">
                      <span className="text-success">E {t.d.Easy ?? 0}</span><span className="text-warning">M {t.d.Medium ?? 0}</span><span className="text-danger">H {t.d.Hard ?? 0}</span>
                    </span>
                  </button>
                </li>
              ))}
              {s && !topicList.length && <li className="px-2 py-3 text-sm text-muted-foreground">No topics match.</li>}
            </ul>
          </aside>

          <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search text, question ID or topic" className="pl-8" aria-label="Search questions" />
          </div>
          <FilterSelect label="Type" value={filters.questionType} onChange={(v) => setFilter("questionType", v)} options={Object.entries(QUESTION_TYPE_LABELS)} />
          <FilterSelect label="Source" value={filters.sourceType} onChange={(v) => setFilter("sourceType", v)} options={SOURCE_TYPES.map((x) => [x, SOURCE_LABELS[x]])} />
          <FilterSelect label="Status" value={filters.verificationStatus} onChange={(v) => setFilter("verificationStatus", v)} options={[["pending,verified", "Active"], ["rejected", "Rejected"]]} />
          <FilterSelect label="Images" value={filters.assetStatus} onChange={(v) => setFilter("assetStatus", v)} options={[["ok", "Has images"], ["none", "No images"], ["missing", "Missing / unconfirmed"]]} />
          <FilterSelect label="Issues" value={filters.hasIssues} onChange={(v) => setFilter("hasIssues", v)} options={[["true", "Has issues"], ["false", "No issues"]]} />
          <FilterSelect label="Archive" value={filters.archived} onChange={(v) => setFilter("archived", v)} options={[["true", "Archived only"]]} allLabel="Active" />
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setFilters(Object.fromEntries(FILTERS.map((f) => [f, ""]))); setSearch(""); setPage(1); }}>Clear</Button>
          )}
        </div>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-primary-soft/50 px-4 py-2 text-[14.5px]">
            <span className="font-medium">{selected.size} selected</span>
            <Button size="xs" variant="outline" onClick={() => setBulk("reject")}><XCircle /> Reject</Button>
            <Button size="xs" variant="outline" onClick={() => setBulk("archive")}><Archive /> Archive</Button>
            <Button size="xs" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
          </div>
        )}
        {list.loading && !list.data ? <TableSkeleton rows={10} cols={7} /> : list.error ? <ErrorState message={list.error.message} onRetry={() => list.reload()} /> : !items.length ? (
          <EmptyState
            icon={LibraryBig}
            title={activeFilters ? "No questions match these filters" : "The question bank is empty"}
            description={activeFilters ? "Adjust or clear the filters." : "Import the local datasets or upload a file to get started."}
            action={!activeFilters && <Button asChild size="sm"><Link href="/admin/import/local">Import local dataset</Link></Button>}
          />
        ) : (
          <div className={cn(list.loading && "opacity-60 transition-opacity")}>
            <Table>
              <THead>
                <TR>
                  <TH className="w-8"><Checkbox checked={allSelected ? true : selected.size ? "indeterminate" : false} onCheckedChange={(v) => setSelected(v === true ? new Set(items.map((i) => i.id)) : new Set())} aria-label="Select all on this page" /></TH>
                  <TH>Question</TH>
                  <TH>Topic</TH>
                  <TH>Difficulty</TH>
                  <TH>Source</TH>
                  <TH>Status</TH>
                  <TH><span className="sr-only">Actions</span></TH>
                </TR>
              </THead>
              <TBody>
                {items.map((q) => (
                  <TR key={q.id} data-state={selected.has(q.id) ? "selected" : undefined}>
                    <TD><Checkbox checked={selected.has(q.id)} onCheckedChange={(v) => setSelected((s) => { const n = new Set(s); if (v === true) n.add(q.id); else n.delete(q.id); return n; })} aria-label={`Select ${q.originalQuestionId || "question"}`} /></TD>
                    <TD className="max-w-[440px]">
                      <button className="block w-full text-left hover:text-primary dark:hover:text-primary-soft-foreground" onClick={() => setPreviewId(q.id)}>
                        <MathText text={previewText(q.questionText, 150)} className="line-clamp-2 whitespace-normal font-medium" />
                      </button>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{q.originalQuestionId || "—"}</span>
                        {!subjectSel && <span>· {SUBJECT_SHORT[q.subject as Subject] ?? q.subject}</span>}
                        <span>· {q.questionType === "numerical" ? "Numerical" : "MCQ"}</span>
                        {q.issues.slice(0, 2).map((i) => <Badge key={i} variant="warning" className="text-[11.5px]">{i === "ambiguous_image" ? <ImageOff /> : <AlertTriangle />}{i.replaceAll("_", " ")}</Badge>)}
                        {q.issues.length > 2 && <Badge variant="outline" className="text-[11.5px]">+{q.issues.length - 2}</Badge>}
                      </span>
                    </TD>
                    <TD className="max-w-[180px]">
                      {q.topic ? <button title={q.topic} className="block w-full max-w-[180px] truncate text-left text-muted-foreground hover:text-foreground hover:underline" onClick={() => setFilter("topic", q.topic)}>{q.topic}</button> : <span className="text-muted-foreground">—</span>}
                    </TD>
                    <TD><span className={cn("font-semibold", (DIFF_STYLE[q.difficulty] ?? DIFF_STYLE.Unclassified).text)}>{q.difficulty}</span></TD>
                    <TD className="whitespace-nowrap text-xs text-muted-foreground">{SOURCE_LABELS[q.sourceType]}</TD>
                    <TD>{q.archived ? <Badge>Archived</Badge> : <VerificationBadge status={q.verificationStatus} />}</TD>
                    <TD className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Question actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => setPreviewId(q.id)}><Eye /> View question</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => router.push(`/admin/questions/${q.id}/edit`)}><Pencil /> Edit</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={list.data!.page} totalPages={list.data!.totalPages} total={list.data!.total} pageSize={pageSize} onPage={setPage} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
          </div>
        )}
          </div>
        </div>
      </Card>

      <QuestionDrawer id={previewId} onClose={() => setPreviewId(null)} onChanged={refresh} />

      <ConfirmDialog
        open={!!bulk}
        onOpenChange={(o) => !o && setBulk(null)}
        title={bulk === "reject" ? `Reject ${selected.size} question(s)?` : `Archive ${selected.size} question(s)?`}
        description={bulk === "archive" ? "Archived questions are hidden and cannot be used in new exams. Existing exams keep their copies." : "Rejected questions stay in the bank but are kept out of exams. You can restore them later."}
        confirmLabel={bulk === "reject" ? "Reject" : "Archive"}
        destructive
        loading={busy}
        onConfirm={runBulk}
      >
        {bulk === "reject" && <Field label="Reason (optional)"><Input value={bulkReason} onChange={(e) => setBulkReason(e.target.value)} maxLength={500} /></Field>}
      </ConfirmDialog>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][]; allLabel?: string }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={cn("h-9 w-auto min-w-[118px]", value && "border-primary/60 bg-primary-soft/40")}>
      <option value="">{allLabel ?? `${label}: All`}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </Select>
  );
}

export function QuestionDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { data, loading, error, reload } = useApi<{ question: FullQuestion }>(id ? `/api/admin/questions/${id}` : null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const q = data?.question && data.question.id === id ? data.question : null;

  async function act(action: string, extra: Record<string, unknown> = {}) {
    if (!id) return;
    setBusy(action);
    try {
      await api(`/api/admin/questions/${id}`, { method: "PATCH", json: { action, ...extra } });
      toast.success(action === "reject" ? "Question rejected." : action === "archive" ? "Question archived." : action === "reset_review" ? "Question restored to the bank." : "Question updated.");
      setRejecting(false);
      setReason("");
      await reload(true);
      onChanged();
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setBusy(null);
    }
  }

  const ambiguous = q?.issues.includes("ambiguous_image");
  const blocking = (q?.issues ?? []).filter((i) => i !== "ambiguous_image");

  return (
    <Sheet
      open={!!id}
      onOpenChange={(o) => !o && onClose()}
      title={q ? `${q.subject} · ${q.originalQuestionId || "Question"}` : "Question"}
      description={q ? `${QUESTION_TYPE_LABELS[q.questionType]} · ${SOURCE_LABELS[q.sourceType]}${q.sourceFile ? ` · ${q.sourceFile}` : ""}` : undefined}
      footer={
        q && (
          <>
            <Button asChild variant="outline" size="sm"><Link href={`/admin/questions/${q.id}/edit`}><Pencil /> Edit</Link></Button>
            {q.archived ? (
              <Button variant="outline" size="sm" loading={busy === "restore"} onClick={() => act("restore")}><RotateCcw /> Restore</Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" loading={busy === "archive"} onClick={() => act("archive")}><Archive /> Archive</Button>
                {q.verificationStatus !== "rejected" && <Button variant="outline" size="sm" onClick={() => setRejecting(true)}><XCircle /> Reject</Button>}
                {q.verificationStatus === "rejected" && <Button size="sm" loading={busy === "reset_review"} onClick={() => act("reset_review")}><RotateCcw /> Restore to bank</Button>}
              </>
            )}
          </>
        )
      }
    >
      {loading && !q ? <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div> : error ? <ErrorState message={error.message} /> : q ? (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-1.5">
            {q.archived ? <Badge>Archived</Badge> : <VerificationBadge status={q.verificationStatus} />}
            <DifficultyBadge difficulty={q.difficulty} />
            {q.topic && <Badge variant="outline">{q.topic}</Badge>}
            {q.subtopic && <Badge variant="outline">{q.subtopic}</Badge>}
          </div>
          {blocking.length > 0 && (
            <Alert variant="warning" icon={AlertTriangle} title="These issues keep this question out of exams">
              <ul className="list-disc pl-4">{blocking.map((i) => <li key={i}>{QUESTION_ISSUES[i as QuestionIssue] ?? i}</li>)}</ul>
            </Alert>
          )}
          {ambiguous && (
            <Alert variant="warning" icon={ImageOff} title="Diagram may belong to another question">
              This image file name is shared by questions from several source papers, so the file may show a diagram from a different question. Check the diagram and solution figures below.
            </Alert>
          )}
          {(q.curationNotes?.length ?? 0) > 0 && (
            <Alert variant="info" title="Reviewer notes">
              <ul className="list-disc pl-4">{q.curationNotes!.map((n) => <li key={n}>{n}</li>)}</ul>
            </Alert>
          )}
          {q.verificationStatus === "rejected" && q.rejectionReason && <Alert variant="danger" title="Rejected">{q.rejectionReason}</Alert>}
          {q.missingAssets.length > 0 && <p className="text-xs text-muted-foreground">Missing / unconfirmed assets: <span className="font-mono">{q.missingAssets.join(", ")}</span></p>}
          <div className="rounded-lg border p-4">
            <QuestionPreview {...q} />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            {[
              ["Original difficulty label", q.originalDifficulty || "—"],
              ["Source exam", q.sourceExam || "—"],
              ["Original source", q.originalSource || "—"],
              ["License", q.sourceLicense || "—"],
              ["Imported", formatDateTime(q.createdAt)],
            ].map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="break-words font-medium">{v}</dd></div>)}
          </dl>
          {rejecting && (
            <div className="space-y-2 rounded-md border p-3">
              <Field label="Reason for rejection" htmlFor="reject-reason"><Textarea id="reject-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
                <Button size="sm" variant="destructive" disabled={reason.trim().length < 3} loading={busy === "reject"} onClick={() => act("reject", { reason })}>Reject question</Button>
              </div>
            </div>
          )}
        </div>
      ) : <EmptyState icon={FileQuestion} title="Question not found" />}
    </Sheet>
  );
}
