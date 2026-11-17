"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, RefreshCw, Settings2, SlidersHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/client-api";
import { SUBJECT_GROUPS, type Subject } from "@/lib/constants";
import { formatTitle, planDifficulty, planSubjects, type QuickPreset } from "@/lib/exam/quick";
import { cn, formatDuration } from "@/lib/utils";
import type { ExamDefaultsInput } from "@/lib/validation/exam-defaults";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, ErrorState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";

type Config = ExamDefaultsInput & { id: string };
interface Stats { eligible: { subject: string; difficulty: string; type: string; count: number }[] }

const RESULT_LABEL = { immediate: "Shown after submission", after_end: "After the exam closes", manual: "When released by the cell" } as const;

export function QuickGenerate({ onSwitchToCustom }: { onSwitchToCustom: () => void }) {
  const router = useRouter();
  const cfg = useApi<{ configuration: Config }>("/api/admin/exam-defaults");
  const stats = useApi<Stats>("/api/admin/questions/stats");
  const [selected, setSelected] = useState<Subject[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const c = cfg.data?.configuration;
  const available = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of stats.data?.eligible ?? []) if (e.type === "single_correct" || c?.includeNumerical) m[e.subject] = (m[e.subject] ?? 0) + e.count;
    return m;
  }, [stats.data, c?.includeNumerical]);

  const plan = useMemo(() => {
    if (!c || !selected.length) return null;
    const { counts, preset } = planSubjects(c.totalQuestions, selected, c.presets as QuickPreset[]);
    return { counts, preset, difficulty: planDifficulty(c.totalQuestions, c.difficultyPercent), title: formatTitle(c.titlePattern, selected, new Date()) };
  }, [c, selected]);
  const shortfalls = plan ? Object.entries(plan.counts).filter(([s, n]) => (available[s] ?? 0) < n) : [];

  const toggle = (s: Subject) => {
    setFailure(null);
    setSelected((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  };

  async function generate() {
    setBusy(true);
    setFailure(null);
    try {
      const r = await api<{ id: string; title: string }>("/api/admin/exams/quick-generate", { method: "POST", json: { subjects: selected } });
      toast.success(`“${r.title}” generated as a draft. Review the paper, then publish.`);
      router.push(`/admin/exams/${r.id}`);
    } catch (e) {
      setFailure((e as ApiError).message);
      setBusy(false);
    }
  }

  // Subjects render straight away; the settings panel loads on its own and never stays blank.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (c || cfg.error) return;
    const t = setTimeout(() => setSlow(true), 10_000);
    return () => clearTimeout(t);
  }, [c, cfg.error]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Step 1 · Select subjects</CardTitle>
            <CardDescription>Everything else comes from your saved default settings.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {SUBJECT_GROUPS.map((g) => (
            <fieldset key={g.name}>
              <legend className="mb-2 flex w-full items-center justify-between text-sm font-semibold">
                {g.name === "PCM" ? "Entrance (PCM)" : "Aptitude"}
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline dark:text-primary-soft-foreground"
                  onClick={() => setSelected((p) => (g.subjects.every((s) => p.includes(s)) ? p.filter((s) => !g.subjects.includes(s)) : [...new Set([...p, ...g.subjects])]))}
                >
                  {g.subjects.every((s) => selected.includes(s)) ? "Clear" : "Select all"}
                </button>
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {g.subjects.map((s) => {
                  const on = selected.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(s)}
                      className={cn("flex items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring", on ? "border-primary bg-primary-soft" : "hover:bg-muted/60")}
                    >
                      <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded border", on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>{on && <Check className="size-3.5" />}</span>
                      <span>
                        <span className="block text-[14.5px] font-medium">{s}</span>
                        <span className="block text-xs text-muted-foreground">{stats.data ? `${(available[s] ?? 0).toLocaleString("en-IN")} questions available` : "Counting…"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </CardContent>
      </Card>

      {!c ? (
        <Card className="xl:sticky xl:top-20 xl:self-start">
          <CardHeader><div><CardTitle>Step 2 · Default configuration</CardTitle><CardDescription>Applied automatically.</CardDescription></div></CardHeader>
          <CardContent className="space-y-3">
            {cfg.error ? (
              <ErrorState message={`Default settings could not be loaded: ${cfg.error.message}`} onRetry={() => cfg.reload()} />
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" /> Loading your default settings…</p>
                <Skeleton className="h-40" />
                {slow && (
                  <Alert variant="warning">
                    This is taking longer than usual. The development server may still be compiling, or the database may be slow to respond.
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => { setSlow(false); void cfg.reload(); }}><RefreshCw /> Retry</Button>
                  </Alert>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
      <Card className="xl:sticky xl:top-20 xl:self-start">
        <CardHeader>
          <div>
            <CardTitle>Step 2 · Default configuration</CardTitle>
            <CardDescription>
              Applied automatically. <Link href="/admin/settings/exam-defaults" className="font-medium text-primary hover:underline dark:text-primary-soft-foreground">View default settings</Link>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div><dt className="text-xs text-muted-foreground">Total questions</dt><dd className="font-medium tabular-nums">{c.totalQuestions}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Duration</dt><dd className="font-medium">{formatDuration(c.durationMinutes)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Difficulty</dt><dd className="font-medium">E {c.difficultyPercent.Easy}% · M {c.difficultyPercent.Medium}% · H {c.difficultyPercent.Hard}%</dd></div>
            <div><dt className="text-xs text-muted-foreground">Marking</dt><dd className="font-medium">+{c.marking.correct} / −{c.marking.incorrect} / {c.marking.unanswered}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Exam rules</dt><dd className="font-medium">{[c.security.oneAttempt && "One attempt", c.security.fullscreen && "Fullscreen", `${c.security.maxWarnings} warnings`].filter(Boolean).join(" · ")}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Validity</dt><dd className="font-medium">{c.defaultValidityDays} days · pass {c.passingPercentage}%</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted-foreground">Results</dt><dd className="font-medium">{RESULT_LABEL[c.resultRelease]}</dd></div>
          </dl>
          {plan && (
            <div className="rounded-lg border border-accent/30 bg-accent-soft/50 p-3" data-testid="quick-plan">
              <p className="text-xs text-muted-foreground">Exam to be generated</p>
              <p className="mt-0.5 font-semibold">{plan.title}</p>
              <ul className="mt-2 space-y-1">
                {Object.entries(plan.counts).map(([s, n]) => (
                  <li key={s} className="flex justify-between gap-2 tabular-nums">
                    <span>{s}</span>
                    <span className={cn((available[s] ?? 0) < n && "font-semibold text-danger")}>{n}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t pt-2 text-xs tabular-nums text-muted-foreground">
                Easy {plan.difficulty.Easy} · Medium {plan.difficulty.Medium} · Hard {plan.difficulty.Hard} {plan.preset && <Badge variant="outline" className="ml-1">{plan.preset} preset</Badge>}
              </p>
            </div>
          )}
          {shortfalls.length > 0 && (
            <Alert variant="warning">Not enough questions in the bank: {shortfalls.map(([s, n]) => `${s} needs ${n}, ${available[s] ?? 0} available`).join("; ")}.</Alert>
          )}
          {failure && (
            <Alert variant="danger" title="The examination could not be generated">
              <p>{failure}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={onSwitchToCustom}><SlidersHorizontal /> Switch to Custom Generate</Button>
                <Button size="sm" variant="outline" asChild><Link href="/admin/settings/exam-defaults"><Settings2 /> Revise default counts</Link></Button>
              </div>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex-col items-stretch gap-2">
          <Button size="lg" onClick={generate} loading={busy} disabled={!selected.length}><Sparkles /> Generate examination</Button>
          <p className="text-center text-xs text-muted-foreground">{selected.length ? "Creates a draft and opens its preview. Nothing is published until you confirm." : "Select at least one subject to continue."}</p>
        </CardFooter>
      </Card>
      )}
    </div>
  );
}
