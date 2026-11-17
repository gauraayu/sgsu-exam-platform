"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { useApi } from "@/hooks/use-api";
import { SOURCE_LABELS, type SourceType } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Sheet } from "@/components/ui/dialog";

interface Batch {
  id: string;
  sourceType: SourceType;
  filename: string;
  importedBy?: { fullName: string };
  totalRecords: number;
  validRecords: number;
  rejectedRecords: number;
  duplicateRecords: number;
  alreadyImported: number;
  importedCount: number;
  updatedCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
}

export function ImportHistory() {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<{ items: Batch[]; total: number; page: number; pageSize: number; totalPages: number }>(`/api/admin/import/history?page=${page}`);
  const [open, setOpen] = useState<string | null>(null);
  const detail = useApi<{ batch: Batch & { errorSamples: { file: string; line: number; message: string }[]; sourceUrl: string } }>(open ? `/api/admin/import/history/${open}` : null);
  return (
    <Card>
      {loading && !data ? <TableSkeleton /> : error ? <ErrorState message={error.message} onRetry={() => reload()} /> : !data?.items.length ? <EmptyState icon={History} title="No imports yet" description="Each import from a local dataset, file or API is recorded here." /> : (
        <>
          <Table>
            <THead><TR><TH>Date</TH><TH>Source</TH><TH>File / URL</TH><TH>By</TH><TH className="text-right">Records</TH><TH className="text-right">Imported</TH><TH className="text-right">Already present</TH><TH className="text-right">Duplicates</TH><TH className="text-right">Rejected</TH><TH>Status</TH><TH /></TR></THead>
            <TBody>
              {data.items.map((b) => (
                <TR key={b.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">{formatDateTime(b.createdAt)}</TD>
                  <TD className="whitespace-nowrap">{SOURCE_LABELS[b.sourceType]}</TD>
                  <TD className="max-w-[240px] truncate font-mono text-xs" title={b.filename}>{b.filename}</TD>
                  <TD className="whitespace-nowrap">{b.importedBy?.fullName ?? "—"}</TD>
                  <TD className="text-right tabular-nums">{b.totalRecords}</TD>
                  <TD className="text-right font-medium tabular-nums text-success">{b.importedCount}{b.updatedCount ? ` (+${b.updatedCount} upd.)` : ""}</TD>
                  <TD className="text-right tabular-nums">{b.alreadyImported}</TD>
                  <TD className="text-right tabular-nums">{b.duplicateRecords}</TD>
                  <TD className="text-right tabular-nums">{b.rejectedRecords}</TD>
                  <TD><Badge variant={b.status === "completed" ? "success" : b.status === "partial" ? "warning" : "danger"}>{b.status}</Badge></TD>
                  <TD className="text-right"><Button variant="ghost" size="xs" onClick={() => setOpen(b.id)}>Details</Button></TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={setPage} />
        </>
      )}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)} title="Import details" description={detail.data?.batch.filename}>
        {detail.data && (
          <div className="space-y-4 text-[14.5px]">
            <dl className="grid grid-cols-2 gap-3">
              {Object.entries({ "Total records": detail.data.batch.totalRecords, Valid: detail.data.batch.validRecords, Imported: detail.data.batch.importedCount, Updated: detail.data.batch.updatedCount, "Already present": detail.data.batch.alreadyImported, Duplicates: detail.data.batch.duplicateRecords, Rejected: detail.data.batch.rejectedRecords, Failed: detail.data.batch.failedCount }).map(([k, v]) => (
                <div key={k} className="rounded-md border p-2.5"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
              ))}
            </dl>
            <div>
              <p className="mb-2 font-medium">Rejected / failed records</p>
              {detail.data.batch.errorSamples.length ? (
                <ul className="max-h-96 space-y-1 overflow-y-auto text-xs">{detail.data.batch.errorSamples.map((e, i) => <li key={i} className="rounded bg-muted px-2 py-1"><span className="font-mono">{e.file}:{e.line}</span> — {e.message}</li>)}</ul>
              ) : <p className="text-xs text-muted-foreground">None.</p>}
            </div>
          </div>
        )}
      </Sheet>
    </Card>
  );
}
