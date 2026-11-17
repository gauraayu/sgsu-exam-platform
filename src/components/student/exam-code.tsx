"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CalendarClock, Clock, FileQuestion, KeyRound } from "lucide-react";
import { api, ApiError } from "@/lib/client-api";
import { formatDateTime, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";

interface Resolved {
  exam: { title: string; description: string; durationMinutes: number; totalQuestions: number; subjects: string[]; startDate: string; endDate: string; startLabel?: string; endLabel?: string; token: string };
  state: "open" | "upcoming" | "ended" | "closed" | "completed" | "in_progress";
  message: string | null;
}

const ACTION: Record<Resolved["state"], string | null> = {
  open: "View instructions & start examination",
  in_progress: "Continue examination",
  completed: "View result",
  upcoming: "View examination details",
  ended: null,
  closed: null,
};

/** "Have an examination code?" — finds the exam and opens the same page as its link. */
export function ExamCodeCard({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Resolved | null>(null);
  const autoRan = useRef(false);

  async function lookup(value: string) {
    setError(null);
    setFound(null);
    if (!value.trim()) {
      setError("Enter the examination code provided by your administrator.");
      return;
    }
    setBusy(true);
    try {
      setFound(await api<Resolved>("/api/student/exams/resolve-code", { method: "POST", json: { code: value } }));
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  // A code typed on the home page arrives as ?code=… after sign-in: look it up straight away.
  useEffect(() => {
    if (initialCode && !autoRan.current) {
      autoRan.current = true;
      const t = setTimeout(() => void lookup(initialCode), 0);
      return () => clearTimeout(t);
    }
  }, [initialCode]);

  const action = found ? ACTION[found.state] : null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground"><KeyRound className="size-5" aria-hidden /></span>
          <div>
            <CardTitle>Have an examination code?</CardTitle>
            <CardDescription>Enter the examination code provided by your administrator.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(code);
          }}
        >
          <label htmlFor="exam-code" className="sr-only">Examination code</label>
          <Input id="exam-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SGSU-XXXXXX" autoComplete="off" spellCheck={false} maxLength={20} className="h-11 font-mono text-base tracking-[0.12em] sm:max-w-xs" aria-invalid={!!error} aria-describedby={error ? "exam-code-error" : undefined} />
          <Button type="submit" size="lg" loading={busy}>Find examination</Button>
        </form>
        {error && <Alert variant="danger"><span id="exam-code-error">{error}</span></Alert>}
        {found && (
          <div className="rounded-lg border p-4" data-testid="code-result">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">{found.exam.title}</p>
                {found.exam.subjects.length > 0 && <p className="text-sm text-muted-foreground">{found.exam.subjects.join(" · ")}</p>}
              </div>
              <Badge variant={found.state === "open" || found.state === "in_progress" ? "success" : found.state === "upcoming" ? "info" : "outline"}>
                {{ open: "Open now", in_progress: "In progress", completed: "Completed", upcoming: "Scheduled", ended: "Expired", closed: "Closed" }[found.state]}
              </Badge>
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-1.5"><Clock className="size-4" aria-hidden /> {formatDuration(found.exam.durationMinutes)}</li>
              <li className="flex items-center gap-1.5"><FileQuestion className="size-4" aria-hidden /> {found.exam.totalQuestions} questions</li>
              <li className="flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden /> {found.state === "upcoming" ? `Opens ${found.exam.startLabel ?? formatDateTime(found.exam.startDate)}` : `Until ${found.exam.endLabel ?? formatDateTime(found.exam.endDate)}`}</li>
            </ul>
            {found.message && <Alert variant={found.state === "completed" || found.state === "upcoming" ? "info" : "warning"} className="mt-3"><span data-testid="code-message">{found.message}</span></Alert>}
            {action && (
              <Button asChild className="mt-4"><Link href={`/exam/${found.exam.token}`}>{action} <ArrowRight /></Link></Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
