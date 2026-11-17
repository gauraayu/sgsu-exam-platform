"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { QUESTION_ISSUES, SUBJECTS, type QuestionIssue } from "@/lib/constants";
import { TARGET_FIELDS, TARGET_FIELD_LABELS, REQUIRED_TARGET_FIELDS, type FieldMapping } from "@/lib/dataset/normalize";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/misc";
import { Alert } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { MathText, previewText } from "@/components/question/math-text";
import { DifficultyBadge } from "@/components/shared/status";
import { SubNav } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

export interface ImportStats {
  filesDetected: number;
  totalRecords: number;
  validRecords: number;
  validMcqs: number;
  numericalQuestions: number;
  missingAnswerKeys: number;
  missingImages: number;
  ambiguousImages: number;
  unclassifiedDifficulty: number;
  withIssues: number;
  duplicates: number;
  alreadyImported: number;
  changedInSource: number;
  newRecords: number;
  rejected: number;
  pendingReview: number;
  successfullyImported: number;
  updated: number;
  failedImports: number;
  skippedFlagged?: number;
  removedByCuration?: number;
  aiAnswerKeys?: number;
  aiDifficulty?: number;
}
export interface PreviewResponse {
  stats: ImportStats;
  issueCounts: Record<string, number>;
  rejected: { file: string; line: number; message: string }[];
  removed?: { file: string; line: number; message: string }[];
  removedReasons?: Record<string, number>;
  samples: { file: string; line: number; status: string; originalQuestionId: string; subject: string; topic: string; difficulty: string; questionType: string; questionText: string; options: string[]; correctOption: number | null; numericalAnswer: string | null; issues: string[] }[];
}
export interface CommitResponse {
  batchId: string;
  stats: ImportStats;
  errors: { file: string; line: number; message: string }[];
}

export function ImportNav({ active }: { active: string }) {
  return (
    <SubNav
      active={active}
      items={[
        { href: "/admin/import/local", label: "Local dataset" },
        { href: "/admin/import/upload", label: "Upload file" },
        { href: "/admin/import/api", label: "Import via API" },
        { href: "/admin/import/history", label: "Import history" },
      ]}
    />
  );
}

function Stat({ label, value, tone }: { label: string; value: number | undefined; tone?: "success" | "warning" | "danger" | "muted" }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", tone === "success" && "text-success", tone === "warning" && "text-warning", tone === "danger" && "text-danger", tone === "muted" && "text-muted-foreground")}>{(value ?? 0).toLocaleString("en-IN")}</p>
    </div>
  );
}

export function ImportStatsGrid({ stats, committed }: { stats: ImportStats; committed?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      <Stat label="Files detected" value={stats.filesDetected} />
      <Stat label="Total records" value={stats.totalRecords} />
      <Stat label="Valid MCQs" value={stats.validMcqs} tone="success" />
      <Stat label="Numerical questions" value={stats.numericalQuestions} />
      <Stat label="Missing answer keys" value={stats.missingAnswerKeys} tone="warning" />
      <Stat label="Missing images" value={stats.missingImages} tone="warning" />
      <Stat label="Unconfirmed diagrams" value={stats.ambiguousImages} tone="warning" />
      <Stat label="Duplicates in input" value={stats.duplicates} tone="muted" />
      <Stat label="Already imported" value={stats.alreadyImported} tone="muted" />
      <Stat label="Changed in source" value={stats.changedInSource} tone="muted" />
      {committed ? (
        <>
          <Stat label="Successfully imported" value={stats.successfullyImported} tone="success" />
          <Stat label="Added to bank" value={stats.pendingReview} tone="success" />
          <Stat label="Updated" value={stats.updated} />
          <Stat label="Failed / rejected" value={stats.failedImports} tone="danger" />
          {stats.skippedFlagged !== undefined && <Stat label="Skipped (flagged)" value={stats.skippedFlagged} tone="muted" />}
        </>
      ) : (
        <>
          <Stat label="New records" value={stats.newRecords} tone="success" />
          <Stat label="With issues (review)" value={stats.withIssues} tone="warning" />
          <Stat label="Unclassified difficulty" value={stats.unclassifiedDifficulty} tone="warning" />
          <Stat label="Rejected (invalid)" value={stats.rejected} tone="danger" />
        </>
      )}
      {stats.removedByCuration !== undefined && (
        <>
          <Stat label="Removed by curation" value={stats.removedByCuration} tone="muted" />
          <Stat label="AI-solved answer keys" value={stats.aiAnswerKeys} tone="warning" />
          <Stat label="AI-assigned difficulty" value={stats.aiDifficulty} tone="warning" />
        </>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<string, { label: string; v: "success" | "default" | "warning" }> = {
  new: { label: "New", v: "success" },
  unchanged: { label: "Already imported", v: "default" },
  updatable: { label: "Changed in source", v: "warning" },
  content_changed: { label: "Changed in source", v: "warning" },
};

export function PreviewDetails({ preview }: { preview: PreviewResponse }) {
  const issues = Object.entries(preview.issueCounts).sort((a, b) => b[1] - a[1]);
  return (
    <div className="space-y-4">
      {issues.length > 0 && (
        <Card>
          <CardHeader><div><CardTitle>Validation issues</CardTitle><CardDescription>Flagged questions are imported but kept out of exams until fixed.</CardDescription></div></CardHeader>
          <Table>
            <THead><TR><TH>Issue</TH><TH className="text-right">Questions</TH></TR></THead>
            <TBody>{issues.map(([k, n]) => <TR key={k}><TD>{QUESTION_ISSUES[k as QuestionIssue] ?? k}</TD><TD className="text-right tabular-nums">{n}</TD></TR>)}</TBody>
          </Table>
        </Card>
      )}
      {preview.removed && preview.removed.length > 0 && (
        <Card>
          <CardHeader>
            <div><CardTitle>Removed by curation policy</CardTitle><CardDescription>Unusable questions (missing or unverifiable figures, incomplete options, no answer key) are left out of the bank.</CardDescription></div>
            <Badge>{(preview.stats.removedByCuration ?? preview.removed.length).toLocaleString("en-IN")}</Badge>
          </CardHeader>
          {preview.removedReasons && (
            <Table>
              <THead><TR><TH>Reason</TH><TH className="text-right">Questions</TH></TR></THead>
              <TBody>{Object.entries(preview.removedReasons).sort((a, b) => b[1] - a[1]).map(([k, n]) => <TR key={k}><TD>{k}</TD><TD className="text-right tabular-nums">{n}</TD></TR>)}</TBody>
            </Table>
          )}
          <div className="max-h-56 overflow-y-auto border-t">
            <Table><THead><TR><TH>File</TH><TH>Line</TH><TH>Question</TH></TR></THead>
              <TBody>{preview.removed.map((r, i) => <TR key={i}><TD className="font-mono text-xs">{r.file}</TD><TD className="tabular-nums">{r.line}</TD><TD>{r.message}</TD></TR>)}</TBody></Table>
          </div>
        </Card>
      )}
      {preview.rejected.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Rejected records</CardTitle><Badge variant="danger">{preview.rejected.length}{preview.rejected.length >= 50 ? "+" : ""}</Badge></CardHeader>
          <div className="max-h-56 overflow-y-auto">
            <Table><THead><TR><TH>File</TH><TH>Line</TH><TH>Reason</TH></TR></THead>
              <TBody>{preview.rejected.map((r, i) => <TR key={i}><TD className="font-mono text-xs">{r.file}</TD><TD className="tabular-nums">{r.line}</TD><TD>{r.message}</TD></TR>)}</TBody></Table>
          </div>
        </Card>
      )}
      <Card>
        <CardHeader><div><CardTitle>Sample records</CardTitle><CardDescription>First {preview.samples.length} parsed records</CardDescription></div></CardHeader>
        <Table>
          <THead><TR><TH>Source</TH><TH>ID</TH><TH>Question</TH><TH>Subject</TH><TH>Difficulty</TH><TH>Answer</TH><TH>Status</TH></TR></THead>
          <TBody>
            {preview.samples.map((s, i) => (
              <TR key={i}>
                <TD className="whitespace-nowrap font-mono text-xs">{s.file}:{s.line}</TD>
                <TD className="font-mono text-xs">{s.originalQuestionId || "—"}</TD>
                <TD className="max-w-sm"><MathText text={previewText(s.questionText, 120)} className="line-clamp-2 whitespace-normal" />{s.issues.length > 0 && <span className="mt-1 block text-[12.5px] text-warning">{s.issues.map((x) => x.replaceAll("_", " ")).join(", ")}</span>}</TD>
                <TD>{s.subject}</TD>
                <TD><DifficultyBadge difficulty={s.difficulty} /></TD>
                <TD className="font-mono text-xs">{s.questionType === "numerical" ? s.numericalAnswer ?? "—" : s.correctOption ? "ABCD"[s.correctOption - 1] : "—"}</TD>
                <TD><Badge variant={STATUS_LABEL[s.status]?.v ?? "default"}>{STATUS_LABEL[s.status]?.label ?? s.status}</Badge></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}

export function CurationOption({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
      <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <span>
        <span className="block text-sm font-medium">Apply curation policy (recommended)</span>
        <span className="block text-xs text-muted-foreground">Adds AI-solved answer keys and AI-assigned difficulty from src/data/curation.json (marked for confirmation), and removes questions whose figure is missing or cannot be verified.</span>
      </span>
    </label>
  );
}

export function ImportOptions({ updateExisting, skipFlagged, onChange }: { updateExisting: boolean; skipFlagged: boolean; onChange: (v: { updateExisting: boolean; skipFlagged: boolean }) => void }) {
  return (
    <div className="space-y-2 text-[14.5px]">
      <label className="flex items-start gap-2">
        <Checkbox className="mt-0.5" checked={updateExisting} onCheckedChange={(v) => onChange({ updateExisting: v === true, skipFlagged })} />
        <span><span className="font-medium">Update questions that changed in the source.</span> <span className="text-muted-foreground">Changes to answers, text or images reset verification to pending. Off by default.</span></span>
      </label>
      <label className="flex items-start gap-2">
        <Checkbox className="mt-0.5" checked={skipFlagged} onCheckedChange={(v) => onChange({ updateExisting, skipFlagged: v === true })} />
        <span><span className="font-medium">Skip records with validation issues.</span> <span className="text-muted-foreground">By default they are imported as pending so you can fix them in the Question Bank.</span></span>
      </label>
    </div>
  );
}

export function CommitSummary({ result, onReset }: { result: CommitResponse; onReset: () => void }) {
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="size-5 text-success" /> Import complete</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <ImportStatsGrid stats={result.stats} committed />
        <Alert variant="info">Imported questions are in the Question Bank and can be used in exams straight away. Existing questions were not deleted or replaced.</Alert>
        {result.errors.length > 0 && <p className="text-xs text-muted-foreground">{result.errors.length} record(s) could not be imported — see Import history for details.</p>}
        <div className="flex flex-wrap gap-2">
          <Button asChild><Link href="/admin/questions?verificationStatus=pending&hasIssues=false">Review clean questions</Link></Button>
          <Button asChild variant="outline"><Link href="/admin/import/history">View import history</Link></Button>
          <Button variant="ghost" onClick={onReset}>Import more</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MappingEditor({ columns, mapping, onChange, fallbackSubject, onFallbackSubject, license, onLicense }: { columns: string[]; mapping: FieldMapping; onChange: (m: FieldMapping) => void; fallbackSubject: string; onFallbackSubject: (s: string) => void; license: string; onLicense: (s: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {TARGET_FIELDS.map((f) => (
          <Field key={f} label={TARGET_FIELD_LABELS[f]} htmlFor={`map-${f}`} required={REQUIRED_TARGET_FIELDS.includes(f) && !(f === "subject" && fallbackSubject)}>
            <Select id={`map-${f}`} value={mapping[f] ?? ""} onChange={(e) => onChange({ ...mapping, [f]: e.target.value || undefined })} className={cn(mapping[f] && "border-primary/50")}>
              <option value="">— Not mapped —</option>
              {columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
        ))}
      </div>
      <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
        <Field label="Default subject" htmlFor="fallback" hint="Used when the subject column is missing or empty">
          <Select id="fallback" value={fallbackSubject} onChange={(e) => onFallbackSubject(e.target.value)}><option value="">None</option>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</Select>
        </Field>
        <Field label="Source license / attribution" htmlFor="license" hint="Stored with every imported question"><Input id="license" value={license} onChange={(e) => onLicense(e.target.value)} maxLength={300} /></Field>
      </div>
    </div>
  );
}
