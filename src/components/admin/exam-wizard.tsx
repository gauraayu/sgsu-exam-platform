"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, CloudCheck, History, Info, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError, qs } from "@/lib/client-api";
import { useApi } from "@/hooks/use-api";
import { useDebounce } from "@/hooks/use-debounce";
import { ACADEMIC_LEVELS, DIFFICULTIES, SUBJECTS, type Difficulty, type Subject } from "@/lib/constants";
import { examConfigSchema } from "@/lib/validation/exams";
import { cn, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Checkbox, Switch } from "@/components/ui/misc";
import { Alert } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { MathText, previewText } from "@/components/question/math-text";

import { defaultWizardState, toPayload, wizardToTemplatePayload, zero, sumCounts, type Counts, type WizardState } from "./exam-wizard-state";
import { examTemplateSchema } from "@/lib/validation/exam-templates";
import { TIMEZONES, zonedInputToUtc, formatInZone } from "@/lib/timezone";
export type { WizardState } from "./exam-wizard-state";

const EXAM_STEPS = ["Exam details & schedule", "Subject distribution", "Difficulty distribution", "Selection & rules", "Review"];
const TEMPLATE_STEPS = ["Template details", "Subject distribution", "Difficulty distribution", "Scoring & rules", "Review"];
const STEPS = EXAM_STEPS;

const VALIDITY_PRESETS = [
  { v: 60, l: "1 hour" },
  { v: 180, l: "3 hours" },
  { v: 360, l: "6 hours" },
  { v: 720, l: "12 hours" },
  { v: 1440, l: "24 hours" },
  { v: 2880, l: "2 days" },
  { v: 10080, l: "7 days" },
];

function NumberInput({ value, onChange, min = 0, max = 500, className, ...rest }: { value: number; onChange: (n: number) => void; min?: number; max?: number; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max">) {
  return <Input type="number" inputMode="numeric" min={min} max={max} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} className={cn("tabular-nums", className)} {...rest} />;
}

function ToggleRow({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start justify-between gap-4 py-2.5", disabled && "opacity-50")}>
      <span><span className="block text-[14.5px] font-medium">{label}</span>{description && <span className="block text-xs text-muted-foreground">{description}</span>}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

export function ExamWizard({
  initial,
  examId,
  variant = "exam",
  templateId,
  fromTemplate,
}: {
  initial?: WizardState;
  examId?: string;
  /** "template" edits a reusable template instead of an exam. */
  variant?: "exam" | "template";
  /** Template being edited (variant "template"). */
  templateId?: string;
  /** Template an exam is being created from. */
  fromTemplate?: { id: string; name: string };
}) {
  const router = useRouter();
  const isTemplate = variant === "template";
  const stepNames = isTemplate ? TEMPLATE_STEPS : EXAM_STEPS;
  const [step, setStep] = useState(0);
  const dirty = useRef(false);
  const [s, setRawS] = useState<WizardState>(initial ?? defaultWizardState());
  const setS: typeof setRawS = (v) => {
    dirty.current = true;
    setRawS(v);
  };
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [availability, setAvailability] = useState<Record<string, Counts> | null>(null);
  const topics = useApi<{ topics: { subject: string; topic: string; count: number }[] }>("/api/admin/questions/stats");

  // ---- Auto-save (new exams only): the wizard is saved to MongoDB as the admin works, so
  // leaving midway keeps the progress. On the next visit the admin can resume or discard it.
  const autosave = !examId && !isTemplate && !fromTemplate;
  const [draft, setDraft] = useState<{ step: number; state: WizardState; title: string; updatedAt: string } | null>(null);
  const [draftResolved, setDraftResolved] = useState(!autosave);
  const [saveState, setSaveState] = useState<{ status: "idle" | "saving" | "saved" | "error"; at?: string }>({ status: "idle" });
  useEffect(() => {
    if (!autosave) return;
    let live = true;
    api<{ draft: { step: number; state: WizardState; title: string; updatedAt: string } | null }>("/api/admin/exams/wizard-draft")
      .then((r) => {
        if (!live) return;
        if (r.draft) setDraft(r.draft);
        else setDraftResolved(true);
      })
      .catch(() => live && setDraftResolved(true));
    return () => {
      live = false;
    };
  }, [autosave]);
  const debouncedState = useDebounce(s, 1200);
  const debouncedStep = useDebounce(step, 1200);
  // Always send the latest state (not the debounced snapshot), and remember whether anything is unsaved.
  const latest = useRef({ s, step });
  const unsaved = useRef(false);
  useEffect(() => {
    latest.current = { s, step };
    if (dirty.current) unsaved.current = true;
  }, [s, step]);
  useEffect(() => {
    if (!autosave || !draftResolved || !dirty.current) return;
    let live = true;
    const t = setTimeout(() => setSaveState({ status: "saving" }), 0);
    const sent = latest.current;
    unsaved.current = false;
    api<{ savedAt: string }>("/api/admin/exams/wizard-draft", { method: "PUT", json: { step: sent.step, state: sent.s } })
      .then((r) => live && setSaveState({ status: "saved", at: r.savedAt }))
      .catch(() => {
        unsaved.current = true;
        if (live) setSaveState({ status: "error" });
      });
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [autosave, draftResolved, debouncedState, debouncedStep]);
  const draftResolvedRef = useRef(draftResolved);
  useEffect(() => {
    draftResolvedRef.current = draftResolved;
  }, [draftResolved]);
  // Leaving the page (navigation, closing the tab) flushes changes made in the last second.
  useEffect(() => {
    if (!autosave) return;
    const flush = () => {
      if (!unsaved.current || !dirty.current || !draftResolvedRef.current) return;
      unsaved.current = false;
      void fetch("/api/admin/exams/wizard-draft", { method: "PUT", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: latest.current.step, state: latest.current.s }) }).catch(() => undefined);
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [autosave]);
  function resumeDraft() {
    if (!draft) return;
    const base = defaultWizardState();
    const st = draft.state as Partial<WizardState>;
    setRawS({ ...base, ...st, subjects: { ...base.subjects, ...(st.subjects ?? {}) }, settings: { ...base.settings, ...(st.settings ?? {}), security: { ...base.settings.security, ...(st.settings?.security ?? {}) } } });
    setStep(Math.min(draft.step, STEPS.length - 1));
    setDraft(null);
    setDraftResolved(true);
    toast.success("Draft restored. Your changes keep saving automatically.");
  }
  async function discardDraft() {
    setDraft(null);
    setDraftResolved(true);
    try {
      await api("/api/admin/exams/wizard-draft", { method: "DELETE" });
    } catch {
      /* ignore — the next auto-save overwrites it */
    }
  }

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) => {
    dirty.current = true;
    setS((p) => ({ ...p, [k]: v }));
  };
  const setSubject = (sub: Subject, patch: Partial<WizardState["subjects"][Subject]>) => {
    dirty.current = true;
    setS((p) => ({ ...p, subjects: { ...p.subjects, [sub]: { ...p.subjects[sub], ...patch } } }));
  };
  const setSecurity = (patch: Partial<WizardState["settings"]["security"]>) => setS((p) => ({ ...p, settings: { ...p.settings, security: { ...p.settings.security, ...patch } } }));

  const sourcesKey = s.selection.sources.join(",");
  const topicsKey = SUBJECTS.map((x) => s.subjects[x].topics.join("|")).join("/");
  useEffect(() => {
    let cancelled = false;
    const body = {
      subjectDistribution: SUBJECTS.map((x) => ({ subject: x, count: 0, topics: s.subjects[x].topics })),
      selection: { mode: "random", sources: s.selection.sources, includeNumerical: s.selection.includeNumerical, manualQuestionIds: [] },
    };
    api<{ availability: Record<string, Counts> }>("/api/admin/exams/availability", { method: "POST", json: body })
      .then((r) => !cancelled && setAvailability(r.availability))
      .catch(() => !cancelled && setAvailability(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey, topicsKey, s.selection.includeNumerical]);

  const subjectTotal = SUBJECTS.reduce((a, x) => a + (s.subjects[x].enabled ? s.subjects[x].count : 0), 0);
  const diffTotal = sumCounts(s.difficulty);
  const avail = (sub: Subject, d?: Difficulty) => (availability ? (d ? availability[sub]?.[d] ?? 0 : sumCounts(availability[sub] ?? zero())) : null);

  const stepIssues = useMemo(() => {
    const out: string[][] = [[], [], [], [], []];
    if (s.title.trim().length < 3) out[0].push(isTemplate ? "Enter a template name (at least 3 characters)." : "Enter a title (at least 3 characters).");
    if (s.durationMinutes < 1) out[0].push("Duration must be at least 1 minute.");
    if (s.scheduleMode === "immediate" || isTemplate) {
      if (s.accessValidityMinutes < 5) out[0].push("The access window must be at least 5 minutes.");
    } else {
      if (!s.startDate || !s.endDate || s.endDate <= s.startDate) out[0].push("End time must be after the start time.");
    }
    if (isTemplate && (s.passingPercent < 0 || s.passingPercent > 100)) out[0].push("Passing percentage must be between 0 and 100.");
    if (isTemplate && s.selection.mode === "manual") out[1].push("Templates use random selection from the question bank.");
    if (s.selection.mode === "random") {
      if (subjectTotal !== s.totalQuestions) out[1].push(`Subject counts add up to ${subjectTotal}; the exam has ${s.totalQuestions} questions.`);
      for (const x of SUBJECTS) {
        const sub = s.subjects[x];
        if (!sub.enabled) continue;
        const a = avail(x);
        if (a !== null && sub.count > a) out[1].push(`Only ${a} usable ${x} questions are available for the selected filters. Please add more questions or adjust the distribution.`);
        if (sub.splitDifficulty && sumCounts(sub.difficulty) !== sub.count) out[1].push(`${x}: difficulty split adds up to ${sumCounts(sub.difficulty)}, expected ${sub.count}.`);
      }
      if (s.useDifficulty && diffTotal !== s.totalQuestions) out[2].push(`Difficulty counts add up to ${diffTotal}; the exam has ${s.totalQuestions} questions.`);
      if (s.useDifficulty && availability) {
        for (const d of DIFFICULTIES) {
          const pool = SUBJECTS.filter((x) => s.subjects[x].enabled && s.subjects[x].count > 0).reduce((a, x) => a + (availability[x]?.[d] ?? 0), 0);
          if (s.difficulty[d] > pool) out[2].push(`Only ${pool} usable ${d} questions are available across the selected subjects.`);
        }
      }
    } else if (s.selection.manualQuestionIds.length === 0) out[1].push("Select at least one question.");
    const max = (s.selection.mode === "manual" ? s.selection.manualQuestionIds.length : s.totalQuestions) * s.marking.correct;
    if (!isTemplate && s.passingMarks > max) out[0].push(`Passing marks cannot exceed total marks (${max}).`);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, availability, subjectTotal, diffTotal]);

  async function save() {
    setErrors([]);
    if (isTemplate) return saveTemplate();
    const payload = toPayload(s, fromTemplate?.id);
    const parsed = examConfigSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message));
      return;
    }
    setSaving(true);
    try {
      if (examId) {
        await api(`/api/admin/exams/${examId}`, { method: "PATCH", json: payload });
        toast.success("Draft updated. Regenerate the paper to apply distribution changes.");
        router.push(`/admin/exams/${examId}`);
      } else if (fromTemplate) {
        const r = await api<{ id: string }>("/api/admin/exams", { method: "POST", json: payload });
        // Generate the paper straight away from the verified question bank, then show the preview.
        try {
          await api(`/api/admin/exams/${r.id}/generate`, { method: "POST" });
          toast.success("Examination generated from the template. Review the paper, then publish.");
        } catch (e) {
          toast.error(`Draft created, but the paper could not be generated: ${(e as ApiError).message}`);
        }
        router.push(`/admin/exams/${r.id}`);
      } else {
        const r = await api<{ id: string }>("/api/admin/exams", { method: "POST", json: payload });
        dirty.current = false;
        await api("/api/admin/exams/wizard-draft", { method: "DELETE" }).catch(() => undefined);
        toast.success("Draft exam created. Generate the paper to preview it.");
        router.push(`/admin/exams/${r.id}`);
      }
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      setErrors([err.message]);
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate() {
    const payload = wizardToTemplatePayload(s);
    const parsed = examTemplateSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message));
      return;
    }
    setSaving(true);
    try {
      if (templateId) await api(`/api/admin/exam-templates/${templateId}`, { method: "PATCH", json: payload });
      else await api("/api/admin/exam-templates", { method: "POST", json: payload });
      toast.success(templateId ? "Template updated. Exams created earlier keep their own settings." : "Template saved.");
      router.push("/admin/exam-templates");
      router.refresh();
    } catch (e) {
      setErrors([(e as ApiError).message]);
    } finally {
      setSaving(false);
    }
  }

  const issuesHere = stepIssues[step];
  const totalMarks = (s.selection.mode === "manual" ? s.selection.manualQuestionIds.length : s.totalQuestions) * s.marking.correct;
  const scheduleSummary =
    s.scheduleMode === "immediate"
      ? `Starts when published · open ${VALIDITY_PRESETS.find((p) => p.v === s.accessValidityMinutes)?.l ?? `${s.accessValidityMinutes} min`}`
      : isTemplate
        ? `Scheduled by the admin · default window ${VALIDITY_PRESETS.find((p) => p.v === s.accessValidityMinutes)?.l ?? `${s.accessValidityMinutes} min`}`
        : `${formatInZone(zonedInputToUtc(s.startDate, s.timezone), s.timezone)} → ${formatInZone(zonedInputToUtc(s.endDate, s.timezone), s.timezone)}`;

  return (
    <div className="space-y-4">
      {draft && (
        <Alert variant="info" icon={History} title="You have an unsaved examination draft">
          <p>
            {draft.title ? <span className="font-medium text-foreground">“{draft.title}”</span> : "An untitled exam"} was saved automatically on {formatDateTime(draft.updatedAt)} (step {draft.step + 1} of {STEPS.length}).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={resumeDraft}><History /> Resume draft</Button>
            <Button size="sm" variant="outline" onClick={discardDraft}><Trash2 /> Discard and start new</Button>
          </div>
        </Alert>
      )}
      {autosave && draftResolved && (
        <p className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground" role="status" aria-live="polite">
          {saveState.status === "saving" && <><Loader2 className="size-3.5 animate-spin" /> Saving draft…</>}
          {saveState.status === "saved" && <><CloudCheck className="size-3.5 text-success" /> Draft saved automatically · {formatDateTime(saveState.at!)}</>}
          {saveState.status === "error" && <span className="text-danger">Draft could not be saved. Check your connection — your changes are still on this page.</span>}
          {saveState.status === "idle" && "Your progress is saved automatically as a draft."}
        </p>
      )}
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Wizard steps" className="lg:sticky lg:top-20 lg:self-start">
        <ol className="flex gap-1 overflow-x-auto lg:flex-col">
          {stepNames.map((label, i) => {
            const done = i < step && !stepIssues[i].length;
            return (
              <li key={label}>
                <button onClick={() => setStep(i)} aria-current={i === step ? "step" : undefined} className={cn("flex w-full items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-left text-[14.5px]", i === step ? "bg-primary-soft font-medium text-primary-soft-foreground" : "text-muted-foreground hover:bg-muted")}>
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold", i === step && "border-primary bg-primary text-primary-foreground", done && "border-success bg-success text-white")}>{done ? <Check className="size-3.5" /> : i + 1}</span>
                  {label}
                  {i < 4 && stepIssues[i].length > 0 && i !== step && <span className="ml-auto size-1.5 rounded-full bg-warning" aria-label="Has issues" />}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Card>
        <CardHeader><div><CardTitle>Step {step + 1} · {stepNames[step]}</CardTitle>{fromTemplate && <CardDescription>Settings copied from the template “{fromTemplate.name}”. Changes here apply to this examination only.</CardDescription>}</div></CardHeader>
        <CardContent className="space-y-5">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={isTemplate ? "Template name" : "Exam title"} htmlFor="title" required className="sm:col-span-2"><Input id="title" value={s.title} onChange={(e) => set("title", e.target.value)} placeholder={isTemplate ? "PCM Entrance Assessment" : "SGSU PCM Entrance Assessment"} maxLength={isTemplate ? 120 : 200} /></Field>
              <Field label="Description" htmlFor="desc" className="sm:col-span-2"><Textarea id="desc" rows={2} value={s.description} onChange={(e) => set("description", e.target.value)} maxLength={isTemplate ? 2000 : 4000} /></Field>
              <Field label="Category" htmlFor="cat"><Input id="cat" value={s.category} onChange={(e) => set("category", e.target.value)} /></Field>
              <Field label="Academic level" htmlFor="level"><Select id="level" value={s.academicLevel} onChange={(e) => set("academicLevel", e.target.value)}><option value="">Any</option>{ACADEMIC_LEVELS.map((l) => <option key={l}>{l}</option>)}</Select></Field>
              <Field label="Duration (minutes)" htmlFor="dur" required><NumberInput id="dur" value={s.durationMinutes} onChange={(n) => set("durationMinutes", n)} min={1} max={600} /></Field>
              <Field label="Total questions" htmlFor="tq" required hint={s.selection.mode === "manual" ? "Set by the number of selected questions" : "Any value from 1 to 500"}><NumberInput id="tq" value={s.totalQuestions} onChange={(n) => set("totalQuestions", n)} min={1} disabled={s.selection.mode === "manual"} /></Field>
              {isTemplate ? (
                <Field label="Passing percentage" htmlFor="pass" hint={`${Math.round((totalMarks * s.passingPercent) / 100)} of ${totalMarks} marks with the current scoring`}><NumberInput id="pass" value={s.passingPercent} onChange={(n) => set("passingPercent", n)} max={100} /></Field>
              ) : (
                <Field label="Passing marks" htmlFor="pass" hint={`Total marks: ${totalMarks}`}><NumberInput id="pass" value={s.passingMarks} onChange={(n) => set("passingMarks", n)} max={100000} /></Field>
              )}
              {isTemplate && <div className="flex items-end"><ToggleRow label="Default template" description="Shown first when creating an examination from a template" checked={s.isDefaultTemplate} onChange={(v) => set("isDefaultTemplate", v)} /></div>}
              <ScheduleFields s={s} set={set} isTemplate={isTemplate} />
              <Field label="Instructions for students" htmlFor="instr" className="sm:col-span-2" hint="Shown on the exam landing page together with the automatic rules."><Textarea id="instr" rows={4} value={s.instructions} onChange={(e) => set("instructions", e.target.value)} maxLength={8000} /></Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Question selection mode">
                {(isTemplate ? (["random"] as const) : (["random", "manual"] as const)).map((m) => (
                  <button key={m} role="radio" aria-checked={s.selection.mode === m} onClick={() => setS((p) => ({ ...p, selection: { ...p.selection, mode: m } }))} className={cn("rounded-md border px-3 py-2 text-left text-[14.5px]", s.selection.mode === m ? "border-primary bg-primary-soft" : "hover:bg-muted")}>
                    <span className="block font-medium">{m === "random" ? "Random questions from the bank" : "Manual selection"}</span>
                    <span className="block text-xs text-muted-foreground">{m === "random" ? "Exact counts by subject, topic and difficulty" : "Hand-pick specific questions from the bank"}</span>
                  </button>
                ))}
              </div>
              {s.selection.mode === "random" ? (
                <>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-[14.5px]">
                      <thead className="bg-subtle text-xs text-muted-foreground">
                        <tr><th className="px-3 py-2 text-left font-medium">Subject</th><th className="px-3 py-2 text-left font-medium">Questions</th><th className="px-3 py-2 text-left font-medium">Available (E / M / H)</th><th className="px-3 py-2 text-left font-medium">Topics</th><th className="px-3 py-2 text-left font-medium">Own difficulty split</th></tr>
                      </thead>
                      <tbody className="divide-y">
                        {SUBJECTS.map((x) => {
                          const sub = s.subjects[x];
                          const a = avail(x);
                          const short = a !== null && sub.enabled && sub.count > a;
                          const subjectTopics = (topics.data?.topics ?? []).filter((t) => t.subject === x);
                          return (
                            <tr key={x} className="align-top">
                              <td className="px-3 py-2.5"><label className="flex items-center gap-2 font-medium"><Checkbox checked={sub.enabled} onCheckedChange={(v) => setSubject(x, { enabled: v === true })} />{x}</label></td>
                              <td className="px-3 py-2.5"><NumberInput value={sub.count} onChange={(n) => setSubject(x, { count: n })} disabled={!sub.enabled} className={cn("h-8 w-24", short && "border-danger")} aria-label={`${x} questions`} /></td>
                              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{availability ? <span className={cn(short && "text-danger")}>{a} <span className="text-xs">({avail(x, "Easy")} / {avail(x, "Medium")} / {avail(x, "Hard")})</span></span> : "…"}</td>
                              <td className="px-3 py-2.5">
                                <TopicPicker options={subjectTopics.map((t) => t.topic)} value={sub.topics} onChange={(t) => setSubject(x, { topics: t })} disabled={!sub.enabled} />
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="space-y-2">
                                  <Switch checked={sub.splitDifficulty} onCheckedChange={(v) => setSubject(x, { splitDifficulty: v })} disabled={!sub.enabled} aria-label={`${x} subject-specific difficulty`} />
                                  {sub.splitDifficulty && (
                                    <div className="flex gap-1.5">
                                      {DIFFICULTIES.map((d) => (
                                        <label key={d} className="text-[12.5px] text-muted-foreground">{d[0]}<NumberInput value={sub.difficulty[d]} onChange={(n) => setSubject(x, { difficulty: { ...sub.difficulty, [d]: n } })} className="h-7 w-14 px-1.5 text-xs" aria-label={`${x} ${d}`} /></label>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t bg-subtle">
                        <tr><td className="px-3 py-2 font-medium">Total</td><td className={cn("px-3 py-2 font-semibold tabular-nums", subjectTotal === s.totalQuestions ? "text-success" : "text-danger")} aria-live="polite">{subjectTotal} / {s.totalQuestions}</td><td colSpan={3} /></tr>
                      </tfoot>
                    </table>
                  </div>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="size-3.5" /> Availability counts every question in the bank except rejected or archived ones and those with open issues.</p>
                </>
              ) : (
                <ManualPicker value={s.selection.manualQuestionIds} onChange={(ids) => setS((p) => ({ ...p, selection: { ...p.selection, manualQuestionIds: ids }, totalQuestions: ids.length || p.totalQuestions }))} />
              )}
            </div>
          )}

          {step === 2 && (
            s.selection.mode === "manual" ? <Alert variant="info">Difficulty distribution does not apply to manually selected papers.</Alert> : (
              <div className="space-y-4">
                <ToggleRow label="Require an exact overall difficulty distribution" description="When off, questions of any difficulty are drawn for each subject (unless a subject has its own split)." checked={s.useDifficulty} onChange={(v) => set("useDifficulty", v)} />
                {s.useDifficulty && (
                  <div className="grid gap-4 sm:grid-cols-4">
                    {DIFFICULTIES.map((d) => {
                      const pool = availability ? SUBJECTS.filter((x) => s.subjects[x].enabled && s.subjects[x].count > 0).reduce((a, x) => a + (availability[x]?.[d] ?? 0), 0) : null;
                      return <Field key={d} label={d} htmlFor={`d-${d}`} hint={pool !== null ? `${pool} available` : undefined}><NumberInput id={`d-${d}`} value={s.difficulty[d]} onChange={(n) => set("difficulty", { ...s.difficulty, [d]: n })} /></Field>;
                    })}
                    <div className="rounded-md border bg-subtle p-3"><p className="text-xs text-muted-foreground">Total</p><p className={cn("text-lg font-semibold tabular-nums", diffTotal === s.totalQuestions ? "text-success" : "text-danger")}>{diffTotal} / {s.totalQuestions}</p></div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Subject totals and the overall difficulty split are satisfied together. If the bank cannot satisfy both, generation stops with the exact shortage — questions are never invented.</p>
              </div>
            )
          )}

          {step === 3 && (
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="space-y-4">
                <ToggleRow label="Include numerical-answer questions" description="Off by default: standard papers use four-option single-correct MCQs." checked={s.selection.includeNumerical} onChange={(v) => setS((p) => ({ ...p, selection: { ...p.selection, includeNumerical: v } }))} />
                <div>
                  <p className="mb-2 text-[14.5px] font-semibold">Marking scheme</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Correct (+)" htmlFor="mc"><Input id="mc" type="number" step="0.25" min={0.25} value={s.marking.correct} onChange={(e) => set("marking", { ...s.marking, correct: Number(e.target.value) })} /></Field>
                    <Field label="Incorrect (−)" htmlFor="mi"><Input id="mi" type="number" step="0.25" min={0} value={s.marking.incorrect} onChange={(e) => set("marking", { ...s.marking, incorrect: Number(e.target.value) })} /></Field>
                    <Field label="Unanswered" htmlFor="mu"><Input id="mu" type="number" step="0.25" value={s.marking.unanswered} onChange={(e) => set("marking", { ...s.marking, unanswered: Number(e.target.value) })} /></Field>
                  </div>
                </div>
                <div className="divide-y rounded-md border px-3">
                  <ToggleRow label="Shuffle question order" description="Per student, within each subject section" checked={s.settings.shuffleQuestions} onChange={(v) => setS((p) => ({ ...p, settings: { ...p.settings, shuffleQuestions: v } }))} />
                  <ToggleRow label="Shuffle option order" checked={s.settings.shuffleOptions} onChange={(v) => setS((p) => ({ ...p, settings: { ...p.settings, shuffleOptions: v } }))} />
                  <ToggleRow label="Show topic to students" checked={s.settings.showTopic} onChange={(v) => setS((p) => ({ ...p, settings: { ...p.settings, showTopic: v } }))} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Result release" htmlFor="rr">
                    <Select id="rr" value={s.settings.resultRelease} onChange={(e) => setS((p) => ({ ...p, settings: { ...p.settings, resultRelease: e.target.value as WizardState["settings"]["resultRelease"] } }))}>
                      <option value="immediate">Immediately after submission</option>
                      <option value="after_end">After the exam closes</option>
                      <option value="manual">When an admin releases them</option>
                    </Select>
                  </Field>
                  <div className="flex items-end"><ToggleRow label="Allow answer review" description="Correct answers & explanations after release" checked={s.settings.allowAnswerReview} onChange={(v) => setS((p) => ({ ...p, settings: { ...p.settings, allowAnswerReview: v } }))} /></div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-[14.5px] font-semibold">Exam security</p>
                <div className="divide-y rounded-md border px-3">
                  <ToggleRow label="Fullscreen mode" checked={s.settings.security.fullscreen} onChange={(v) => setSecurity({ fullscreen: v })} />
                  <ToggleRow label="Fullscreen exit warnings" checked={s.settings.security.fullscreenExitWarnings} onChange={(v) => setSecurity({ fullscreenExitWarnings: v })} disabled={!s.settings.security.fullscreen} />
                  <ToggleRow label="Tab switch warnings" checked={s.settings.security.tabSwitchWarnings} onChange={(v) => setSecurity({ tabSwitchWarnings: v })} />
                  <div className="flex items-center justify-between gap-4 py-2.5">
                    <span className="text-[14.5px] font-medium">Maximum warnings</span>
                    <NumberInput value={s.settings.security.maxWarnings} onChange={(n) => setSecurity({ maxWarnings: n })} min={1} max={20} className="h-8 w-20" aria-label="Maximum warnings" />
                  </div>
                  <ToggleRow label="Auto-submit when the warning limit is reached" checked={s.settings.security.terminateOnMaxWarnings} onChange={(v) => setSecurity({ terminateOnMaxWarnings: v })} />
                  <ToggleRow label="Camera required" description="Local preview only. No recording, upload or face recognition." checked={s.settings.security.camera} onChange={(v) => setSecurity({ camera: v })} />
                  <ToggleRow label="Microphone required" checked={s.settings.security.microphone} onChange={(v) => setSecurity({ microphone: v, soundMonitoring: v ? s.settings.security.soundMonitoring : false })} />
                  <ToggleRow label="Sound level monitoring" description="Relative amplitude measured in the browser; informational alerts only." checked={s.settings.security.soundMonitoring} onChange={(v) => setSecurity({ soundMonitoring: v })} disabled={!s.settings.security.microphone} />
                  {s.settings.security.soundMonitoring && (
                    <div className="grid grid-cols-2 gap-3 py-2.5">
                      <Field label="Relative threshold (1–100)" htmlFor="st"><NumberInput id="st" value={s.settings.security.soundThreshold} onChange={(n) => setSecurity({ soundThreshold: n })} min={1} max={100} /></Field>
                      <Field label="Minimum duration (ms)" htmlFor="sd"><NumberInput id="sd" value={s.settings.security.soundMinDurationMs} onChange={(n) => setSecurity({ soundMinDurationMs: n })} min={500} max={60000} /></Field>
                    </div>
                  )}
                  <ToggleRow label="One attempt per student" checked={s.settings.security.oneAttempt} onChange={(v) => setSecurity({ oneAttempt: v })} />
                  <ToggleRow label="Automatically submit when time runs out" description="When off, expired attempts wait for an admin to finalise them." checked={s.settings.security.autoFinalizeOnTimeout} onChange={(v) => setSecurity({ autoFinalizeOnTimeout: v })} />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <dl className="grid gap-3 text-[14.5px] sm:grid-cols-2 lg:grid-cols-3">
                {[
                  [isTemplate ? "Template name" : "Title", s.title || "—"],
                  ["Duration", `${s.durationMinutes} min`],
                  ["Questions", s.selection.mode === "manual" ? s.selection.manualQuestionIds.length : s.totalQuestions],
                  ["Schedule", scheduleSummary],
                  ["Attempts after the window closes", s.hardEnd ? "Hard end: running attempts end at the end time" : "May finish their full duration"],
                  ["Marking", `+${s.marking.correct} / −${s.marking.incorrect} / ${s.marking.unanswered}`],
                  isTemplate ? ["Passing percentage", `${s.passingPercent}%`] : ["Passing marks", s.passingMarks],
                  ["Selection", s.selection.mode === "manual" ? "Manual" : SUBJECTS.filter((x) => s.subjects[x].enabled && s.subjects[x].count).map((x) => `${x} ${s.subjects[x].count}`).join(" · ")],
                  ["Difficulty", s.selection.mode === "random" && s.useDifficulty ? `E ${s.difficulty.Easy} · M ${s.difficulty.Medium} · H ${s.difficulty.Hard}` : "Any"],
                  ["Results", { immediate: "Immediate", after_end: "After exam closes", manual: "Manual release" }[s.settings.resultRelease]],
                ].map(([k, v]) => <div key={k as string} className="rounded-md border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
              </dl>
              {stepIssues.flat().length > 0 ? (
                <Alert variant="warning" title="Resolve these before saving"><ul className="list-disc pl-4">{stepIssues.flat().map((x) => <li key={x}>{x}</li>)}</ul></Alert>
              ) : (
                <Alert variant="success">
                  {isTemplate
                    ? "Template is valid. Saving stores the settings only: no questions, links or codes are kept in a template."
                    : fromTemplate
                      ? "Configuration is valid. Generating creates a draft paper from the question bank for you to review. Nothing is published until you confirm."
                      : "Configuration is valid. Saving creates a draft; you will generate and review the paper next."}
                </Alert>
              )}
            </div>
          )}

          {issuesHere.length > 0 && step < 4 && <Alert variant="warning"><ul className="list-disc pl-4">{issuesHere.map((x) => <li key={x}>{x}</li>)}</ul></Alert>}
          {errors.length > 0 && <Alert variant="danger" title="Could not save"><ul className="list-disc pl-4">{errors.map((x) => <li key={x}>{x}</li>)}</ul></Alert>}
        </CardContent>
        <CardFooter className="justify-between">
          <Button variant="outline" onClick={() => setStep((x) => x - 1)} disabled={step === 0}><ChevronLeft /> Back</Button>
          {step < 4 ? <Button onClick={() => setStep((x) => x + 1)}>Continue <ChevronRight /></Button> : <Button onClick={save} loading={saving} disabled={stepIssues.flat().length > 0}>{isTemplate ? (templateId ? "Save template" : "Create template") : examId ? "Save draft" : fromTemplate ? "Generate examination" : "Create draft exam"}</Button>}
        </CardFooter>
      </Card>
    </div>
    </div>
  );
}

function TopicPicker({ options, value, onChange, disabled }: { options: string[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <div className="max-w-[220px] space-y-1.5">
      <Select value="" onChange={(e) => e.target.value && onChange([...value, e.target.value])} disabled={disabled || !options.length} className="h-8 text-xs" aria-label="Add topic filter">
        <option value="">{value.length ? "Add topic…" : "All topics"}</option>
        {options.filter((o) => !value.includes(o)).map((o) => <option key={o} value={o}>{o}</option>)}
      </Select>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((t) => <Badge key={t} variant="primary" className="max-w-full"><span className="truncate">{t}</span><button onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X /></button></Badge>)}
        </div>
      )}
    </div>
  );
}

function ManualPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const q = useDebounce(search, 300);
  const { data, loading } = useApi<{ items: { id: string; originalQuestionId: string; subject: string; difficulty: string; questionType: string; questionText: string }[]; total: number }>(
    `/api/admin/questions${qs({ verificationStatus: "pending,verified", hasIssues: "false", search: q, subject, pageSize: 20 })}`,
  );
  const selected = new Set(value);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions" className="pl-8" /></div>
        <Select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-40" aria-label="Subject"><option value="">All subjects</option>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</Select>
        <Badge variant="primary" className="self-center">{value.length} selected</Badge>
        {value.length > 0 && <Button variant="ghost" size="sm" onClick={() => onChange([])}>Clear</Button>}
      </div>
      <ul className="max-h-96 divide-y overflow-y-auto rounded-md border">
        {loading && !data ? <li className="p-4 text-sm text-muted-foreground">Loading…</li> : !data?.items.length ? <li className="p-4 text-sm text-muted-foreground">No questions match.</li> : data.items.map((it) => (
          <li key={it.id} className="flex items-start gap-3 px-3 py-2.5">
            <Button size="icon-sm" variant={selected.has(it.id) ? "default" : "outline"} onClick={() => onChange(selected.has(it.id) ? value.filter((x) => x !== it.id) : [...value, it.id])} aria-label={selected.has(it.id) ? "Remove question" : "Add question"}>{selected.has(it.id) ? <Check /> : <Plus />}</Button>
            <div className="min-w-0 flex-1 text-[14.5px]">
              <MathText text={previewText(it.questionText, 160)} className="line-clamp-2 whitespace-normal" />
              <p className="mt-0.5 text-xs text-muted-foreground">{it.subject} · {it.difficulty} · {it.originalQuestionId || "—"}</p>
            </div>
          </li>
        ))}
      </ul>
      <CardDescription>Showing up to 20 matches; refine the search to find specific questions.</CardDescription>
    </div>
  );
}

function ScheduleFields({ s, set, isTemplate }: { s: WizardState; set: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void; isTemplate: boolean }) {
  const preset = VALIDITY_PRESETS.some((p) => p.v === s.accessValidityMinutes);
  return (
    <fieldset className="space-y-3 rounded-lg border p-4 sm:col-span-2">
      <legend className="px-1 text-[14px] font-semibold">{isTemplate ? "Scheduling defaults" : "Schedule"}</legend>
      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Exam start">
        {([
          ["immediate", "Start immediately", isTemplate ? "Exams open as soon as they are published" : "Opens as soon as you publish it"],
          ["scheduled", "Schedule examination", isTemplate ? "Admin picks the start and end time for each exam" : "Opens and closes at set times"],
        ] as const).map(([v, l, d]) => (
          <button key={v} type="button" role="radio" aria-checked={s.scheduleMode === v} onClick={() => set("scheduleMode", v)} className={cn("rounded-md border px-3 py-2 text-left", s.scheduleMode === v ? "border-primary bg-primary-soft" : "hover:bg-muted")}>
            <span className="block text-[14px] font-medium">{l}</span>
            <span className="block text-xs text-muted-foreground">{d}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {s.scheduleMode === "immediate" || isTemplate ? (
          <Field label={isTemplate ? "Default access duration" : "Access validity"} htmlFor="validity" hint="How long new attempts can be started">
            <div className="flex gap-2">
              <Select id="validity" value={preset ? String(s.accessValidityMinutes) : "custom"} onChange={(e) => e.target.value !== "custom" && set("accessValidityMinutes", Number(e.target.value))}>
                {VALIDITY_PRESETS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                <option value="custom">Custom (minutes)</option>
              </Select>
              {!preset && <NumberInput aria-label="Access validity in minutes" value={s.accessValidityMinutes} onChange={(n) => set("accessValidityMinutes", n)} min={5} max={129600} className="w-28" />}
            </div>
          </Field>
        ) : (
          <>
            <Field label="Start date & time" htmlFor="start" required><Input id="start" type="datetime-local" value={s.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
            <Field label="End date & time" htmlFor="end" required hint="No new attempts after this time"><Input id="end" type="datetime-local" value={s.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
          </>
        )}
        <Field label="Time zone" htmlFor="tz" hint="Times are entered and shown in this zone, stored in UTC">
          <Select id="tz" value={s.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
      </div>
      <ToggleRow
        label="Hard end time"
        description={s.hardEnd ? "Attempts still running at the end time are submitted automatically at that time." : "Off: students who started before the end time get their full duration. Closing the window only stops new attempts."}
        checked={s.hardEnd}
        onChange={(v) => set("hardEnd", v)}
      />
    </fieldset>
  );
}
