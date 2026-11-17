"use client";

import { useState } from "react";
import { Activity, CheckCircle2, CircleSlash, Hourglass, ListChecks, RotateCcw, ShieldAlert, Unplug, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/client-api";
import { INTEGRITY_EVENT_LABELS, type IntegrityEventType } from "@/lib/constants";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { PageHeader, StatCard } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmDialog, Sheet } from "@/components/ui/dialog";
import { Field } from "@/components/ui/label";
import { AttemptStatusBadge } from "@/components/shared/status";
import { ExamNav } from "./exam-nav";

interface Row {
  attemptId: string;
  name: string;
  email: string;
  studentCode: string;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  status: string;
  liveStatus: string;
  finalizationReason: string | null;
  answeredCount: number;
  lastActivityAt: string;
  warningCount: number;
  events: Record<string, number>;
}
interface Monitoring {
  exam: { id: string; title: string; status: string; totalQuestions: number; settings: { security: { maxWarnings: number } } };
  summary: { registered: number; started: number; active: number; disconnected: number; awaitingFinalization: number; completed: number; autoSubmitted: number; terminated: number };
  rows: Row[];
  accommodations: { id: string; studentId: { fullName: string; email: string; studentId: string } | null; reason: string; requestCamera: boolean; requestMicrophone: boolean; requestFullscreen: boolean; status: string; createdAt: string }[];
}

export function ExamMonitor({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi<Monitoring>(`/api/admin/exams/${id}/monitoring`, { pollMs: 15_000 });
  const [eventsFor, setEventsFor] = useState<Row | null>(null);
  const [resetFor, setResetFor] = useState<Row | null>(null);
  const [finalizeFor, setFinalizeFor] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      setResetFor(null);
      setFinalizeFor(null);
      setReason("");
      await reload(true);
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const s = data?.summary;
  return (
    <div className="space-y-5">
      <PageHeader title={data?.exam.title ?? "Exam monitoring"} description="Participant status and the technical events required by this exam's policy. Refreshes every 15 seconds." breadcrumbs={[{ label: "Exams", href: "/admin/exams" }, { label: data?.exam.title ?? "Exam", href: `/admin/exams/${id}` }, { label: "Monitoring" }]}>
        <ExamNav id={id} active="monitor" published />
      </PageHeader>
      {error ? <Card><ErrorState message={error.message} onRetry={() => reload()} /></Card> : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {!s ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[78px]" />) : (
              <>
                <StatCard label="Registered" value={s.registered} icon={Users} hint="Opened the link" />
                <StatCard label="Exam started" value={s.started} icon={ListChecks} />
                <StatCard label="Currently active" value={s.active} icon={Activity} tone="success" />
                <StatCard label="Disconnected" value={s.disconnected} icon={Unplug} tone="warning" hint="No activity for 2+ min" />
                <StatCard label="Completed" value={s.completed} icon={CheckCircle2} tone="primary" />
                <StatCard label="Auto-submitted" value={s.autoSubmitted} icon={Zap} />
                <StatCard label="Terminated" value={s.terminated} icon={CircleSlash} tone="danger" />
                <StatCard label="Awaiting finalisation" value={s.awaitingFinalization} icon={Hourglass} />
              </>
            )}
          </div>

          {data && data.accommodations.length > 0 && (
            <Card>
              <CardHeader><div><CardTitle>Accommodation requests</CardTitle><CardDescription>Approved students take the exam without the exempted requirement.</CardDescription></div></CardHeader>
              <Table>
                <THead><TR><TH>Student</TH><TH>Exemption</TH><TH>Reason</TH><TH>Requested</TH><TH>Status</TH><TH /></TR></THead>
                <TBody>
                  {data.accommodations.map((a) => (
                    <TR key={a.id}>
                      <TD><p className="font-medium">{a.studentId?.fullName}</p><p className="text-xs text-muted-foreground">{a.studentId?.email}</p></TD>
                      <TD className="whitespace-nowrap">{[a.requestCamera && "Camera", a.requestMicrophone && "Microphone", a.requestFullscreen && "Fullscreen"].filter(Boolean).join(", ")}</TD>
                      <TD className="max-w-sm text-muted-foreground">{a.reason}</TD>
                      <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</TD>
                      <TD><Badge variant={a.status === "approved" ? "success" : a.status === "rejected" ? "danger" : "warning"}>{a.status}</Badge></TD>
                      <TD className="whitespace-nowrap text-right">
                        {a.status === "pending" && (
                          <>
                            <Button size="xs" variant="ghost" onClick={() => run(() => api(`/api/admin/exams/${id}/accommodations/${a.id}`, { method: "PATCH", json: { approve: false } }), "Request rejected.")}>Reject</Button>
                            <Button size="xs" onClick={() => run(() => api(`/api/admin/exams/${id}/accommodations/${a.id}`, { method: "PATCH", json: { approve: true } }), "Request approved.")}>Approve</Button>
                          </>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}

          <Card>
            <CardHeader><div><CardTitle>Participants</CardTitle><CardDescription>Integrity events are technical signals for review, not proof of misconduct.</CardDescription></div></CardHeader>
            {loading && !data ? <TableSkeleton rows={6} cols={8} /> : !data?.rows.length ? <EmptyState icon={Users} title="No one has started this exam yet" description="Participants appear here as soon as they start." /> : (
              <Table>
                <THead><TR><TH>Student</TH><TH>Started</TH><TH>Status</TH><TH className="text-right">Answered</TH><TH>Last activity</TH><TH className="text-right">Warnings</TH><TH>Integrity events</TH><TH /></TR></THead>
                <TBody>
                  {data.rows.map((r) => {
                    const evTotal = Object.values(r.events).reduce((a, b) => a + b, 0);
                    return (
                      <TR key={r.attemptId}>
                        <TD><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.email}</p></TD>
                        <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.startedAt)}</TD>
                        <TD><AttemptStatusBadge status={r.liveStatus} /></TD>
                        <TD className="text-right tabular-nums">{r.answeredCount}/{data.exam.totalQuestions}</TD>
                        <TD className="whitespace-nowrap text-xs text-muted-foreground">{formatRelative(r.lastActivityAt)}</TD>
                        <TD className="text-right"><Badge variant={r.warningCount ? "warning" : "outline"}><ShieldAlert />{r.warningCount}/{data.exam.settings.security.maxWarnings}</Badge></TD>
                        <TD>
                          {evTotal ? <button className="text-left text-xs text-primary hover:underline dark:text-primary-soft-foreground" onClick={() => setEventsFor(r)}>{Object.entries(r.events).map(([k, n]) => `${INTEGRITY_EVENT_LABELS[k as IntegrityEventType] ?? k} ×${n}`).join(" · ")}</button> : <span className="text-xs text-muted-foreground">None</span>}
                        </TD>
                        <TD className="whitespace-nowrap text-right">
                          {r.status === "in_progress" && <Button size="xs" variant="outline" onClick={() => setFinalizeFor(r)}>Finalise</Button>}
                          {["submitted", "auto_submitted", "terminated"].includes(r.status) && <Button size="xs" variant="ghost" onClick={() => setResetFor(r)}><RotateCcw /> Reset</Button>}
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </Card>
        </>
      )}
      <EventsSheet examId={id} row={eventsFor} onClose={() => setEventsFor(null)} />
      <ConfirmDialog open={!!finalizeFor} onOpenChange={(o) => !o && setFinalizeFor(null)} title={`Finalise ${finalizeFor?.name}'s attempt?`} description="The attempt is submitted now with the answers saved so far and evaluated." confirmLabel="Finalise attempt" loading={busy} onConfirm={() => run(() => api(`/api/admin/exams/${id}/attempts/${finalizeFor!.attemptId}/finalize`, { method: "POST" }), "Attempt finalised.")} />
      <ConfirmDialog open={!!resetFor} onOpenChange={(o) => !o && setResetFor(null)} title={`Reset ${resetFor?.name}'s attempt?`} description="The student will be able to take this exam again. The previous attempt and result are kept in the audit history and excluded from reports." confirmLabel="Reset attempt" destructive loading={busy} onConfirm={() => run(() => api(`/api/admin/exams/${id}/attempts/${resetFor!.attemptId}/reset`, { method: "POST", json: { reason } }), "Attempt reset.")}>
        <Field label="Reason (recorded in the audit log)" htmlFor="reset-reason"><Input id="reset-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Power failure at the exam centre" /></Field>
      </ConfirmDialog>
    </div>
  );
}

function EventsSheet({ examId, row, onClose }: { examId: string; row: Row | null; onClose: () => void }) {
  const { data, reload } = useApi<{ events: { id: string; eventType: IntegrityEventType; timestamp: string; countedAsWarning: boolean; warningNumber: number | null; metadata: Record<string, unknown>; reviewStatus: string }[] }>(row ? `/api/admin/exams/${examId}/attempts/${row.attemptId}/events` : null);
  async function review(eventId: string, reviewStatus: string) {
    try {
      await api(`/api/admin/exams/${examId}/events/${eventId}`, { method: "PATCH", json: { reviewStatus } });
      await reload(true);
    } catch (e) {
      toast.error((e as ApiError).message);
    }
  }
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()} title={`Integrity events · ${row?.name ?? ""}`} description="Timeline of recorded technical events">
      {!data ? <Skeleton className="h-40" /> : !data.events.length ? <p className="text-sm text-muted-foreground">No events.</p> : (
        <ol className="space-y-2">
          {data.events.map((e) => (
            <li key={e.id} className="rounded-md border p-3 text-[14.5px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{INTEGRITY_EVENT_LABELS[e.eventType]}</span>
                {e.countedAsWarning && <Badge variant="warning">Warning {e.warningNumber}</Badge>}
                {e.metadata?.coalesced ? <Badge variant="outline">Same action as previous warning</Badge> : null}
                <Badge variant={e.reviewStatus === "flagged" ? "danger" : e.reviewStatus === "dismissed" ? "default" : e.reviewStatus === "reviewed" ? "success" : "outline"}>{e.reviewStatus}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(e.timestamp, { dateStyle: "medium", timeStyle: "medium" })}</span>
              </div>
              {e.eventType === "sound_level" && <p className="mt-1 text-xs text-muted-foreground">Relative level {String(e.metadata.relativeLevel)} (threshold {String(e.metadata.threshold)}) for {Math.round(Number(e.metadata.durationMs) / 1000)} s — uncalibrated amplitude, not decibels.</p>}
              <div className="mt-2 flex gap-1.5">
                {["reviewed", "dismissed", "flagged"].map((st) => <Button key={st} size="xs" variant={e.reviewStatus === st ? "secondary" : "ghost"} onClick={() => review(e.id, st)}>{st[0].toUpperCase() + st.slice(1)}</Button>)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}
