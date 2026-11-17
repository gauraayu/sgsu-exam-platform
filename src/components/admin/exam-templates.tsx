"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CalendarClock, Clock, Copy, FileQuestion, LayoutTemplate, MoreHorizontal, Pencil, Play, Plus, Star, Target } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/client-api";
import { useApi } from "@/hooks/use-api";
import { SUBJECT_SHORT, type Subject } from "@/lib/constants";
import { formatDateTime, formatDuration } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import type { TemplateData } from "./exam-wizard-state";

const VALIDITY = (m: number) => (m % 1440 === 0 ? `${m / 1440} day${m === 1440 ? "" : "s"}` : m % 60 === 0 ? `${m / 60} h` : `${m} min`);

export function scheduleLabel(t: TemplateData) {
  const d = t.schedulingDefaults;
  return `${d.startBehavior === "immediate" ? "Starts on publish" : "Scheduled start"} · open ${VALIDITY(d.accessDurationMinutes)}${d.expiryPolicy === "hard_end" ? " · hard end" : ""}`;
}

export function TemplateSummary({ t }: { t: TemplateData }) {
  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {t.subjectDistribution.map((d) => (
          <span key={d.subject} className="rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-soft-foreground" title={d.subject}>
            {SUBJECT_SHORT[d.subject as Subject] ?? d.subject} {d.count}
          </span>
        ))}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1"><FileQuestion className="size-3.5" aria-hidden />{t.totalQuestions} Qs</div>
        <div className="flex items-center gap-1"><Clock className="size-3.5" aria-hidden />{formatDuration(t.duration)}</div>
        <div className="flex items-center gap-1"><Target className="size-3.5" aria-hidden />+{t.markingScheme.correct}/−{t.markingScheme.incorrect}</div>
      </dl>
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3.5" aria-hidden />{scheduleLabel(t)}</p>
    </>
  );
}

export function ExamTemplates() {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const active = useApi<{ templates: TemplateData[] }>("/api/admin/exam-templates?status=active");
  const archived = useApi<{ templates: TemplateData[] }>(tab === "archived" ? "/api/admin/exam-templates?status=archived" : null);
  const [confirm, setConfirm] = useState<TemplateData | null>(null);
  const [busy, setBusy] = useState(false);

  const reloadAll = () => {
    void active.reload();
    if (tab === "archived") void archived.reload();
  };
  async function act(t: TemplateData, kind: "duplicate" | "default" | "archive" | "restore") {
    setBusy(true);
    try {
      if (kind === "duplicate") {
        const r = await api<{ template: TemplateData }>(`/api/admin/exam-templates/${t.id}/duplicate`, { method: "POST" });
        toast.success(`Created “${r.template.name}”.`);
      } else if (kind === "default") {
        await api(`/api/admin/exam-templates/${t.id}/default`, { method: "POST" });
        toast.success(`“${t.name}” is now the default template.`);
      } else if (kind === "archive") {
        await api(`/api/admin/exam-templates/${t.id}`, { method: "DELETE" });
        toast.success("Template archived. It is no longer offered for new examinations.");
      } else {
        await api(`/api/admin/exam-templates/${t.id}`, { method: "PATCH", json: { status: "active" } });
        toast.success("Template restored.");
      }
      reloadAll();
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  const list = active.data?.templates ?? [];
  const def = list.find((t) => t.isDefault);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")} className="space-y-4">
      <TabsList>
        <TabsTrigger value="active">Saved templates{active.data ? ` (${list.length})` : ""}</TabsTrigger>
        <TabsTrigger value="archived">Archived</TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="space-y-4">
        {active.loading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-52" />)}</div>
        ) : active.error ? (
          <Card><ErrorState message={active.error.message} onRetry={() => active.reload()} /></Card>
        ) : !list.length ? (
          <Card>
            <EmptyState icon={LayoutTemplate} title="No templates yet" description="Save the settings you use often (subjects, question counts, scoring, rules and schedule) and reuse them for every new examination." action={<Button asChild><Link href="/admin/exam-templates/new"><Plus /> Create template</Link></Button>} />
          </Card>
        ) : (
          <>
            {def && (
              <p className="text-sm text-muted-foreground">
                Default template: <span className="font-medium text-foreground">{def.name}</span>. It is shown first when you create an examination from a template.
              </p>
            )}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="template-cards">
              {list.map((t) => (
                <article key={t.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4" data-testid="template-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-1.5 truncate font-semibold">
                        {t.name}
                        {t.isDefault && <Badge variant="accent" className="shrink-0"><Star className="size-3" /> Default</Badge>}
                      </h3>
                      <p className="truncate text-xs text-muted-foreground">{t.category}{t.academicLevel ? ` · ${t.academicLevel}` : ""}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.name}`}><MoreHorizontal /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => router.push(`/admin/exam-templates/${t.id}`)}><Pencil /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void act(t, "duplicate")} disabled={busy}><Copy /> Duplicate</DropdownMenuItem>
                        {!t.isDefault && <DropdownMenuItem onSelect={() => void act(t, "default")} disabled={busy}><Star /> Set as default</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onSelect={() => setConfirm(t)}><Archive /> Archive</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {t.description && <p className="line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
                  <TemplateSummary t={t} />
                  <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
                    <span className="text-xs text-muted-foreground">{t.examsCreated ? `Used for ${t.examsCreated} exam${t.examsCreated === 1 ? "" : "s"}` : "Not used yet"}</span>
                    <div className="flex gap-1.5">
                      <Button asChild size="sm" variant="outline"><Link href={`/admin/exam-templates/${t.id}`}><Pencil /> Edit</Link></Button>
                      <Button asChild size="sm"><Link href={`/admin/exams/new?mode=template&template=${t.id}`}><Play /> Use</Link></Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <Card className="overflow-hidden">
              <Table>
                <THead><TR><TH>Template</TH><TH>Subjects</TH><TH className="text-right">Questions</TH><TH className="text-right">Duration</TH><TH>Schedule</TH><TH className="text-right">Exams</TH><TH>Updated</TH></TR></THead>
                <TBody>
                  {list.map((t) => (
                    <TR key={t.id}>
                      <TD className="font-medium"><Link href={`/admin/exam-templates/${t.id}`} className="hover:underline">{t.name}</Link></TD>
                      <TD className="text-sm text-muted-foreground">{t.subjectDistribution.map((d) => SUBJECT_SHORT[d.subject as Subject] ?? d.subject).join(", ")}</TD>
                      <TD className="text-right tabular-nums">{t.totalQuestions}</TD>
                      <TD className="text-right">{formatDuration(t.duration)}</TD>
                      <TD className="text-sm text-muted-foreground">{scheduleLabel(t)}</TD>
                      <TD className="text-right tabular-nums">{t.examsCreated ?? 0}</TD>
                      <TD className="text-sm text-muted-foreground">{formatDateTime(t.updatedAt)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </Card>
          </>
        )}
      </TabsContent>

      <TabsContent value="archived">
        <Card className="overflow-hidden">
          {archived.loading ? (
            <TableSkeleton rows={3} cols={4} />
          ) : archived.error ? (
            <ErrorState message={archived.error.message} onRetry={() => archived.reload()} />
          ) : !archived.data?.templates.length ? (
            <EmptyState icon={Archive} title="No archived templates" description="Archived templates are kept for reference and are not offered when creating examinations." />
          ) : (
            <Table>
              <THead><TR><TH>Template</TH><TH className="text-right">Questions</TH><TH className="text-right">Exams created</TH><TH>Archived</TH><TH className="w-32" /></TR></THead>
              <TBody>
                {archived.data.templates.map((t) => (
                  <TR key={t.id}>
                    <TD className="font-medium">{t.name}</TD>
                    <TD className="text-right tabular-nums">{t.totalQuestions}</TD>
                    <TD className="text-right tabular-nums">{t.examsCreated ?? 0}</TD>
                    <TD className="text-sm text-muted-foreground">{formatDateTime((t as TemplateData & { archivedAt?: string }).archivedAt)}</TD>
                    <TD className="text-right"><Button size="sm" variant="outline" onClick={() => void act(t, "restore")} disabled={busy}><ArchiveRestore /> Restore</Button></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </TabsContent>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Archive “${confirm?.name}”?`}
        description="It will no longer be offered when creating examinations. Exams already created from it are not affected, and you can restore it later."
        confirmLabel="Archive template"
        destructive
        loading={busy}
        onConfirm={() => confirm && act(confirm, "archive")}
      />
    </Tabs>
  );
}
