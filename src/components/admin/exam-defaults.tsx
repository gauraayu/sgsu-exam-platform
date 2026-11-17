"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/client-api";
import { SUBJECT_GROUPS, type Subject } from "@/lib/constants";
import { cn, formatDateTime } from "@/lib/utils";
import { examDefaultsSchema, type ExamDefaultsInput } from "@/lib/validation/exam-defaults";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, ErrorState } from "@/components/ui/states";

type Config = ExamDefaultsInput & { id: string; updatedAt?: string };

function Num({ id, value, onChange, min = 0, max = 500, step = 1, suffix }: { id: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div className="relative">
      <Input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Number(e.target.value))} className={cn("tabular-nums", suffix && "pr-14")} />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-[14.5px] font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

export function ExamDefaultsForm() {
  const { data, error, reload } = useApi<{ configuration: Config }>("/api/admin/exam-defaults");
  const [c, setC] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setC(data.configuration), 0);
    return () => clearTimeout(t);
  }, [data]);

  if (error) return <Card><ErrorState message={error.message} onRetry={() => reload()} /></Card>;
  if (!c) return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setC((p) => (p ? { ...p, [k]: v } : p));
  const sec = <K extends keyof Config["security"]>(k: K, v: Config["security"][K]) => setC((p) => (p ? { ...p, security: { ...p.security, [k]: v } } : p));
  const pctSum = c.difficultyPercent.Easy + c.difficultyPercent.Medium + c.difficultyPercent.Hard;
  const preset = (name: string) => c.presets.find((p) => p.name === name);
  function setPresetCount(name: string, subjects: Subject[], subject: Subject, n: number) {
    setC((p) => {
      if (!p) return p;
      const others = p.presets.filter((x) => x.name !== name);
      const cur = p.presets.find((x) => x.name === name) ?? { name, counts: Object.fromEntries(subjects.map((s) => [s, 0])) };
      return { ...p, presets: [...others, { ...cur, counts: { ...cur.counts, [subject]: n } }] };
    });
  }

  async function save() {
    if (!c) return;
    const { id, updatedAt, ...body } = c;
    void updatedAt;
    const parsed = examDefaultsSchema.safeParse(body);
    if (!parsed.success) {
      setProblems(parsed.error.issues.map((i) => i.message));
      return;
    }
    setProblems([]);
    setSaving(true);
    try {
      const r = await api<{ configuration: Config }>(`/api/admin/exam-defaults/${id}`, { method: "PATCH", json: parsed.data });
      setC(r.configuration);
      toast.success("Default examination settings saved. Quick Generate will use them for new exams.");
    } catch (e) {
      setProblems([(e as ApiError).message]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Alert variant="info">Quick Generate uses these settings for every new exam. Changing them never affects exams that already exist — each exam keeps a copy of the settings it was created with.</Alert>

      <Card>
        <CardHeader><div><CardTitle>General</CardTitle><CardDescription>Title, size and timing of a generated exam.</CardDescription></div></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Exam title pattern" htmlFor="tp" className="sm:col-span-2" hint="{subjects} becomes e.g. “PCM Entrance” or “Physics”; {date} becomes today's date.">
            <Input id="tp" value={c.titlePattern} onChange={(e) => set("titlePattern", e.target.value)} />
          </Field>
          <Field label="Category" htmlFor="cat" className="sm:col-span-2"><Input id="cat" value={c.examCategory} onChange={(e) => set("examCategory", e.target.value)} /></Field>
          <Field label="Total questions" htmlFor="tq"><Num id="tq" value={c.totalQuestions} onChange={(n) => set("totalQuestions", n)} min={1} /></Field>
          <Field label="Duration" htmlFor="dur"><Num id="dur" value={c.durationMinutes} onChange={(n) => set("durationMinutes", n)} min={1} max={600} suffix="min" /></Field>
          <Field label="Exam validity" htmlFor="val" hint="How long the link and code accept new attempts."><Num id="val" value={c.defaultValidityDays} onChange={(n) => set("defaultValidityDays", n)} min={1} max={365} suffix="days" /></Field>
          <Field label="Passing percentage" htmlFor="pp"><Num id="pp" value={c.passingPercentage} onChange={(n) => set("passingPercentage", n)} max={100} suffix="%" /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Question distribution</CardTitle><CardDescription>Subject counts for each subject combination, and the difficulty mix.</CardDescription></div></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {SUBJECT_GROUPS.map((g) => {
              const p = preset(g.name);
              const sum = g.subjects.reduce((a, s) => a + (p?.counts[s] ?? 0), 0);
              return (
                <div key={g.name} className="rounded-lg border p-4">
                  <p className="text-sm font-semibold">{g.name} default</p>
                  <p className="text-xs text-muted-foreground">Used when exactly these subjects are selected.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {g.subjects.map((s) => (
                      <Field key={s} label={s} htmlFor={`p-${g.name}-${s}`}><Num id={`p-${g.name}-${s}`} value={p?.counts[s] ?? 0} onChange={(n) => setPresetCount(g.name, g.subjects, s, n)} /></Field>
                    ))}
                  </div>
                  <p className={cn("mt-2 text-sm font-medium tabular-nums", sum === c.totalQuestions ? "text-success" : "text-warning")}>
                    Total {sum} / {c.totalQuestions}{sum !== c.totalQuestions && " — counts are scaled proportionally to the total"}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Any other combination of subjects is split as evenly as possible.</p>
          <div>
            <p className="mb-2 text-sm font-semibold">Difficulty mix</p>
            <div className="grid max-w-xl gap-3 sm:grid-cols-3">
              {(["Easy", "Medium", "Hard"] as const).map((d) => (
                <Field key={d} label={d} htmlFor={`d-${d}`}><Num id={`d-${d}`} value={c.difficultyPercent[d]} onChange={(n) => set("difficultyPercent", { ...c.difficultyPercent, [d]: n })} max={100} suffix="%" /></Field>
              ))}
            </div>
            <p className={cn("mt-2 text-sm font-medium tabular-nums", pctSum === 100 ? "text-success" : "text-danger")}>Total {pctSum}%{pctSum !== 100 && " — must be 100%"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><div><CardTitle>Scoring</CardTitle><CardDescription>Marks per question.</CardDescription></div></CardHeader>
          <CardContent className="space-y-1">
            <div className="grid grid-cols-3 gap-3 pb-2">
              <Field label="Correct (+)" htmlFor="mc"><Num id="mc" value={c.marking.correct} onChange={(n) => set("marking", { ...c.marking, correct: n })} step={0.25} /></Field>
              <Field label="Incorrect (−)" htmlFor="mi"><Num id="mi" value={c.marking.incorrect} onChange={(n) => set("marking", { ...c.marking, incorrect: n })} step={0.25} /></Field>
              <Field label="Unanswered" htmlFor="mu"><Num id="mu" value={c.marking.unanswered} onChange={(n) => set("marking", { ...c.marking, unanswered: n })} min={-100} step={0.25} /></Field>
            </div>
            <div className="divide-y">
              <Toggle label="Shuffle question order" description="Each student sees the questions in a different order within each subject." checked={c.shuffleQuestions} onChange={(v) => set("shuffleQuestions", v)} />
              <Toggle label="Shuffle option order" description="Options A–D appear in a different order for each student." checked={c.shuffleOptions} onChange={(v) => set("shuffleOptions", v)} />
              <Toggle label="Include numerical-answer questions" description="Off: only four-option single-correct questions are used." checked={c.includeNumerical} onChange={(v) => set("includeNumerical", v)} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Results</CardTitle><CardDescription>What students see after submitting.</CardDescription></div></CardHeader>
          <CardContent className="space-y-1">
            <Field label="Result visibility" htmlFor="rr">
              <Select id="rr" value={c.resultRelease} onChange={(e) => set("resultRelease", e.target.value as Config["resultRelease"])}>
                <option value="immediate">Immediately after submission</option>
                <option value="after_end">After the exam closes</option>
                <option value="manual">When I release them</option>
              </Select>
            </Field>
            <div className="divide-y">
              <Toggle label="Allow answer review" description="Students can see correct answers and explanations once results are released." checked={c.allowAnswerReview} onChange={(v) => set("allowAnswerReview", v)} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><div><CardTitle>Exam security</CardTitle><CardDescription>Rules applied while a student takes the exam.</CardDescription></div></CardHeader>
        <CardContent className="grid gap-x-8 lg:grid-cols-2">
          <div className="divide-y">
            <Toggle label="One attempt per student" description="A student can start the exam only once, by link or by code." checked={c.security.oneAttempt} onChange={(v) => sec("oneAttempt", v)} />
            <Toggle label="Require fullscreen" description="The exam runs in fullscreen; leaving it records a warning." checked={c.security.fullscreen} onChange={(v) => sec("fullscreen", v)} />
            <Toggle label="Warn on tab switching" description="Switching to another tab or window records a warning." checked={c.security.tabSwitchWarnings} onChange={(v) => sec("tabSwitchWarnings", v)} />
            <Toggle label="Warn on leaving fullscreen" description="Exiting fullscreen during the exam records a warning." checked={c.security.fullscreenExitWarnings} onChange={(v) => sec("fullscreenExitWarnings", v)} />
            <Toggle label="Submit automatically at the warning limit" description="The attempt is submitted with its saved answers when the limit is reached." checked={c.security.terminateOnMaxWarnings} onChange={(v) => sec("terminateOnMaxWarnings", v)} />
          </div>
          <div className="divide-y">
            <div className="py-3"><Field label="Maximum warnings" htmlFor="mw"><Num id="mw" value={c.security.maxWarnings} onChange={(n) => sec("maxWarnings", n)} min={1} max={20} /></Field></div>
            <Toggle label="Camera required" description="The student must allow camera access before starting. Video stays on the device." checked={c.security.camera} onChange={(v) => sec("camera", v)} />
            <Toggle label="Microphone required" description="The student must allow microphone access before starting." checked={c.security.microphone} onChange={(v) => sec("microphone", v)} />
            <Toggle label="Sound monitoring" description="Sustained loud sound records a warning (needs the microphone)." checked={c.security.soundMonitoring} onChange={(v) => sec("soundMonitoring", v)} />
          </div>
        </CardContent>
      </Card>

      {problems.length > 0 && <Alert variant="danger" title="Please fix these before saving"><ul className="list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Alert>}
      <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-between gap-3 border-t bg-background/95 px-1 py-3 backdrop-blur">
        <p className="text-xs text-muted-foreground">{c.updatedAt ? `Last saved ${formatDateTime(c.updatedAt)}` : "Not saved yet — these are the starting values."}</p>
        <Button onClick={save} loading={saving} size="lg"><Save /> Save as default</Button>
      </div>
    </div>
  );
}
