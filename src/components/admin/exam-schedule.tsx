"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, CalendarCog, Users } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client-api";
import { cn, formatDuration } from "@/lib/utils";
import { TIMEZONES, UNIVERSITY_TIMEZONE, formatInZone, utcToZonedInput, zonedInputToUtc } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/misc";
import { Alert } from "@/components/ui/states";
import { ExamStatusBadge } from "@/components/shared/status";

export interface ScheduleExam {
  id: string;
  status: string;
  lifecycle: "draft" | "scheduled" | "active" | "expired" | "closed" | "archived";
  startDate: string;
  endDate: string;
  timezone?: string;
  scheduleMode?: "immediate" | "scheduled";
  accessValidityMinutes?: number;
  hardEndAt?: string | null;
  durationMinutes: number;
  publishedAt?: string;
  closedAt?: string;
}

const PUBLICATION: Record<string, string> = { draft: "Draft (not published)", published: "Published", closed: "Closed by administrator", archived: "Archived" };

function relative(ms: number) {
  const m = Math.round(Math.abs(ms) / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}

/** Schedule panel on Exam Details: publication status, window, timezone and live availability. */
export function ScheduleCard({ exam, participants, serverNow, onChanged }: { exam: ScheduleExam; participants: number; serverNow: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const tz = exam.timezone || UNIVERSITY_TIMEZONE;
  const now = new Date(serverNow).getTime();
  const immediateDraft = exam.status === "draft" && exam.scheduleMode === "immediate";
  const availability =
    exam.lifecycle === "scheduled"
      ? `Opens in ${relative(new Date(exam.startDate).getTime() - now)}`
      : exam.lifecycle === "active"
        ? `Accepting attempts · closes in ${relative(new Date(exam.endDate).getTime() - now)}`
        : exam.lifecycle === "expired"
          ? "Not accepting new attempts (window ended)"
          : exam.lifecycle === "closed"
            ? "Closed: no new attempts"
            : exam.lifecycle === "archived"
              ? "Archived"
              : immediateDraft
                ? "Opens as soon as it is published"
                : "Not published";
  const editable = exam.status === "draft" || exam.status === "published";

  return (
    <Card data-testid="schedule-card">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-muted-foreground" aria-hidden /> Schedule & availability</CardTitle>
          <CardDescription>Availability is calculated by the server from these times on every request.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm"><Link href={`/admin/exams/${exam.id}/monitor`}><Users /> View participants</Link></Button>
          {editable && <Button variant="outline" size="sm" onClick={() => setOpen(true)}><CalendarCog /> Edit schedule</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-3 text-[14.5px] sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-xs text-muted-foreground">Publication status</dt><dd className="font-medium">{PUBLICATION[exam.status] ?? exam.status}</dd></div>
          <div>
            <dt className="text-xs text-muted-foreground">Current availability</dt>
            <dd className="flex flex-wrap items-center gap-2 font-medium" data-testid="current-availability"><ExamStatusBadge status={exam.lifecycle} /> <span className="text-sm font-normal text-muted-foreground">{availability}</span></dd>
          </div>
          <div><dt className="text-xs text-muted-foreground">Scheduled start</dt><dd className="font-medium" data-testid="schedule-start">{immediateDraft ? "When published" : formatInZone(exam.startDate, tz)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Scheduled end</dt><dd className="font-medium" data-testid="schedule-end">{immediateDraft ? `${formatDuration(exam.accessValidityMinutes ?? 0)} after publishing` : formatInZone(exam.endDate, tz)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Time zone</dt><dd className="font-medium">{TIMEZONES.find((t) => t.value === tz)?.label ?? tz}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Total participants</dt><dd className="font-medium tabular-nums">{participants}</dd></div>
          <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Running attempts at the end time</dt><dd className="font-medium">{exam.hardEndAt ? "Hard end: submitted automatically at the end time" : `May finish their full ${formatDuration(exam.durationMinutes)}`}</dd></div>
        </dl>
      </CardContent>
      {open && <EditScheduleDialog exam={exam} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onChanged(); }} serverNow={now} />}
    </Card>
  );
}

function EditScheduleDialog({ exam, onClose, onSaved, serverNow }: { exam: ScheduleExam; onClose: () => void; onSaved: () => void; serverNow: number }) {
  const initialTz = exam.timezone || UNIVERSITY_TIMEZONE;
  const opened = exam.status === "published" && new Date(exam.startDate).getTime() <= serverNow;
  const [mode, setMode] = useState<"immediate" | "scheduled">(opened ? "scheduled" : (exam.scheduleMode ?? "scheduled"));
  const [tz, setTz] = useState(initialTz);
  const [start, setStart] = useState(utcToZonedInput(exam.startDate, initialTz));
  const [end, setEnd] = useState(utcToZonedInput(exam.endDate, initialTz));
  const [validity, setValidity] = useState(exam.accessValidityMinutes || 1440);
  const [hardEnd, setHardEnd] = useState(!!exam.hardEndAt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Changing the zone keeps the same instants and re-expresses them in the new zone.
  const changeTz = (next: string) => {
    if (start) setStart(utcToZonedInput(zonedInputToUtc(start, tz), next));
    if (end) setEnd(utcToZonedInput(zonedInputToUtc(end, tz), next));
    setTz(next);
  };

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const body =
        mode === "immediate"
          ? { scheduleMode: mode, accessValidityMinutes: validity, timezone: tz, hardEnd }
          : { scheduleMode: mode, startDate: zonedInputToUtc(start, tz), endDate: zonedInputToUtc(end, tz), timezone: tz, hardEnd };
      await api(`/api/admin/exams/${exam.id}/schedule`, { method: "PATCH", json: body });
      toast.success("Schedule updated. The exam link and access code are unchanged.");
      onSaved();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Edit schedule</DialogTitle>
          <DialogDescription>Times are entered in the selected time zone and stored in UTC.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {!opened && (
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Start">
              {([
                ["immediate", "Start immediately", exam.status === "draft" ? "Opens when published" : "Opens now"],
                ["scheduled", "Schedule examination", "Opens and closes at set times"],
              ] as const).map(([v, l, d]) => (
                <button key={v} type="button" role="radio" aria-checked={mode === v} onClick={() => setMode(v)} className={cn("rounded-md border px-3 py-2 text-left", mode === v ? "border-primary bg-primary-soft" : "hover:bg-muted")}>
                  <span className="block text-[14px] font-medium">{l}</span>
                  <span className="block text-xs text-muted-foreground">{d}</span>
                </button>
              ))}
            </div>
          )}
          {opened && <Alert variant="info">This examination has already opened, so its start time is fixed. You can change the end time and the policy for new attempts.</Alert>}
          {mode === "immediate" ? (
            <Field label="Access validity (minutes)" htmlFor="sv" hint="How long new attempts can be started">
              <Input id="sv" type="number" min={5} max={129600} value={validity} onChange={(e) => setValidity(Number(e.target.value))} />
            </Field>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Start date & time" htmlFor="ss"><Input id="ss" type="datetime-local" value={start} disabled={opened} onChange={(e) => setStart(e.target.value)} /></Field>
              <Field label="End date & time" htmlFor="se"><Input id="se" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            </div>
          )}
          <Field label="Time zone" htmlFor="stz">
            <Select id="stz" value={tz} onChange={(e) => changeTz(e.target.value)}>
              {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <label className="flex items-start justify-between gap-4 rounded-md border px-3 py-2.5">
            <span>
              <span className="block text-[14px] font-medium">Hard end time</span>
              <span className="block text-xs text-muted-foreground">{hardEnd ? "New attempts end no later than the end time." : "Attempts started before the end time get their full duration."} Attempts already running keep the deadline they were given.</span>
            </span>
            <Switch checked={hardEnd} onCheckedChange={setHardEnd} aria-label="Hard end time" />
          </label>
          {error && <Alert variant="danger">{error}</Alert>}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={saving}>Save schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
