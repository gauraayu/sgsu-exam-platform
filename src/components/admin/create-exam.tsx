"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutTemplate, Plus, SlidersHorizontal, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApi } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { QuickGenerate } from "./quick-generate";
import { ExamWizard } from "./exam-wizard";
import { templateToWizard, type TemplateData } from "./exam-wizard-state";
import { TemplateSummary } from "./exam-templates";

type Mode = "quick" | "template" | "custom";
const MODES = [
  { id: "quick", icon: Zap, title: "Quick Generate", text: "Select the subjects and generate a ready-to-publish examination in seconds." },
  { id: "template", icon: LayoutTemplate, title: "Create from Template", text: "Start from a saved template, adjust if needed, then generate." },
  { id: "custom", icon: SlidersHorizontal, title: "Custom Generate", text: "Customise question counts, difficulty levels, duration, scoring and examination rules." },
] as const;

/** Create Examination: Quick Generate (default), from a saved template, or the full Custom wizard. */
export function CreateExam() {
  const router = useRouter();
  const sp = useSearchParams();
  const raw = sp.get("mode");
  const mode: Mode = raw === "custom" ? "custom" : raw === "template" ? "template" : "quick";
  const setMode = (m: Mode) => router.replace(m === "quick" ? "/admin/exams/new" : `/admin/exams/new?mode=${m}`, { scroll: false });
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Generation mode">
        {MODES.map((m) => {
          const on = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setMode(m.id)}
              className={cn("flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring", on ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50")}
            >
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg", on ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary dark:text-primary-soft-foreground")}><m.icon className="size-5" aria-hidden /></span>
              <span>
                <span className="block font-semibold">{m.title}{m.id === "quick" && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold text-accent">Recommended</span>}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{m.text}</span>
              </span>
            </button>
          );
        })}
      </div>
      {mode === "quick" ? <QuickGenerate onSwitchToCustom={() => setMode("custom")} /> : mode === "template" ? <FromTemplate selectedId={sp.get("template")} /> : <ExamWizard />}
    </div>
  );
}

function FromTemplate({ selectedId }: { selectedId: string | null }) {
  const router = useRouter();
  const { data, error, loading, reload } = useApi<{ templates: TemplateData[] }>("/api/admin/exam-templates?status=active");
  const pick = (id: string | null) => router.replace(id ? `/admin/exams/new?mode=template&template=${id}` : "/admin/exams/new?mode=template", { scroll: false });

  if (loading) return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>;
  if (error) return <Card><ErrorState message={`Templates could not be loaded: ${error.message}`} onRetry={() => reload()} /></Card>;
  const templates = data?.templates ?? [];
  const chosen = selectedId ? templates.find((t) => t.id === selectedId) : null;

  if (chosen)
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => pick(null)}><ArrowLeft /> Choose another template</Button>
        <ExamWizard key={chosen.id} initial={templateToWizard(chosen, true)} fromTemplate={{ id: chosen.id, name: chosen.name }} />
      </div>
    );

  if (!templates.length)
    return (
      <Card>
        <EmptyState icon={LayoutTemplate} title="No saved templates" description="Create a template once and reuse its settings for every new examination." action={<Button asChild><Link href="/admin/exam-templates/new"><Plus /> Create template</Link></Button>} />
      </Card>
    );

  return (
    <div className="space-y-3">
      {selectedId && <p className="text-sm text-warning">That template is archived or no longer exists. Choose another one.</p>}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Select a template. You can review and change its settings before generating.</p>
        <Button asChild variant="ghost" size="sm"><Link href="/admin/exam-templates">Manage templates</Link></Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" role="list" aria-label="Saved templates">
        {templates.map((t) => (
          <button key={t.id} type="button" role="listitem" onClick={() => pick(t.id)} className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring" data-testid="pick-template">
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{t.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{t.category}</span>
              </span>
              {t.isDefault && <Badge variant="accent"><Star className="size-3" /> Default</Badge>}
            </span>
            <TemplateSummary t={t} />
          </button>
        ))}
      </div>
    </div>
  );
}
