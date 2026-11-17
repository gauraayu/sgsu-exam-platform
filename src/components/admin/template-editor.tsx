"use client";

import { useState } from "react";
import { FilePlus2, FlaskConical, GraduationCap, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExamWizard } from "./exam-wizard";
import { defaultWizardState, exampleTemplate, type WizardState } from "./exam-wizard-state";

const STARTS = [
  { id: "pcm", icon: FlaskConical, title: "PCM Entrance Assessment", text: "Physics 35 · Chemistry 35 · Mathematics 30 · 100 Qs · 120 min" },
  { id: "aptitude", icon: Brain, title: "Aptitude Assessment", text: "Quant 40 · Reasoning 35 · Verbal 25 · 100 Qs · 90 min" },
  { id: "semester", icon: GraduationCap, title: "Semester Assessment", text: "One subject · 30 Qs · 60 min. Adjust everything." },
  { id: "blank", icon: FilePlus2, title: "Blank template", text: "Start from the standard settings." },
] as const;

/** New template: pick a starting configuration, then edit every value in the wizard. */
export function NewTemplate() {
  const [start, setStart] = useState<WizardState | null>(null);
  const [key, setKey] = useState("");
  if (start) return <ExamWizard key={key} variant="template" initial={start} />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Choose a starting point. All values remain editable.</p>
      <div className="grid gap-3 md:grid-cols-2" role="list">
        {STARTS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="listitem"
            onClick={() => {
              const base = x.id === "blank" ? { ...defaultWizardState(), title: "", scheduleMode: "immediate" as const } : exampleTemplate(x.id);
              setKey(x.id);
              setStart(base);
            }}
            className={cn("flex items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring")}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground"><x.icon className="size-5" aria-hidden /></span>
            <span>
              <span className="block font-semibold">{x.title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{x.text}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
