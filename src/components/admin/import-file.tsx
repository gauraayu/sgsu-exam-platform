"use client";

import { useRef, useState } from "react";
import { FileUp, Globe, Search, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/client-api";
import type { FieldMapping } from "@/lib/dataset/normalize";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Alert } from "@/components/ui/states";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CommitSummary, ImportOptions, ImportStatsGrid, MappingEditor, PreviewDetails, type CommitResponse, type PreviewResponse } from "./import-shared";

interface Inspect {
  columns: string[];
  suggestedMapping: FieldMapping;
  sampleRows: Record<string, unknown>[];
  records: number;
  parseErrorCount?: number;
  parseErrors?: { line: number; message: string }[];
  format?: string;
  filename?: string;
  totalAvailable?: number | null;
  url?: string;
}

function SampleTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: string[] }) {
  return (
    <div className="max-h-64 overflow-auto rounded-md border">
      <Table>
        <THead><TR>{columns.map((c) => <TH key={c}>{c}</TH>)}</TR></THead>
        <TBody>{rows.map((r, i) => <TR key={i}>{columns.map((c) => <TD key={c} className="max-w-[220px] truncate font-mono text-xs" title={String(r[c] ?? "")}>{typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c] ?? "")}</TD>)}</TR>)}</TBody>
      </Table>
    </div>
  );
}

/** Shared flow for file uploads and API imports: inspect → map → preview → confirm. */
function useImportFlow(send: (mode: "inspect" | "preview" | "confirm", extra: Record<string, unknown>) => Promise<unknown>) {
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [fallbackSubject, setFallbackSubject] = useState("");
  const [license, setLicense] = useState("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [opts, setOpts] = useState({ updateExisting: false, skipFlagged: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (mode: "inspect" | "preview" | "confirm") => {
    setBusy(mode);
    setError(null);
    try {
      const extra = { mapping, fallbackSubject: fallbackSubject || undefined, sourceLicense: license, ...opts };
      const r = await send(mode, extra);
      if (mode === "inspect") {
        const i = r as Inspect;
        setInspect(i);
        setMapping(i.suggestedMapping);
        setPreview(null);
      } else if (mode === "preview") setPreview(r as PreviewResponse);
      else {
        setResult(r as CommitResponse);
        toast.success(`${(r as CommitResponse).stats.successfullyImported} question(s) imported.`);
      }
      return true;
    } catch (e) {
      setError((e as ApiError).message);
      return false;
    } finally {
      setBusy(null);
    }
  };
  const reset = () => { setInspect(null); setPreview(null); setResult(null); setMapping({}); setError(null); };
  return { inspect, mapping, setMapping: (m: FieldMapping) => { setMapping(m); setPreview(null); }, fallbackSubject, setFallbackSubject, license, setLicense, preview, result, opts, setOpts, busy, error, run, reset };
}

function FlowBody({ flow, confirmLabel }: { flow: ReturnType<typeof useImportFlow>; confirmLabel: string }) {
  const [confirm, setConfirm] = useState(false);
  if (!flow.inspect) return null;
  return (
    <>
      <Card>
        <CardHeader><div><CardTitle>Map columns</CardTitle><CardDescription>{flow.inspect.records.toLocaleString("en-IN")} records · {flow.inspect.columns.length} columns detected. Suggested mappings are pre-filled; adjust as needed.</CardDescription></div></CardHeader>
        <CardContent className="space-y-5">
          {(flow.inspect.parseErrorCount ?? 0) > 0 && <Alert variant="warning" title={`${flow.inspect.parseErrorCount} line(s) could not be parsed`}>{flow.inspect.parseErrors?.slice(0, 3).map((e) => `Line ${e.line}: ${e.message}`).join(" · ")}</Alert>}
          <SampleTable rows={flow.inspect.sampleRows} columns={flow.inspect.columns} />
          <MappingEditor columns={flow.inspect.columns} mapping={flow.mapping} onChange={flow.setMapping} fallbackSubject={flow.fallbackSubject} onFallbackSubject={flow.setFallbackSubject} license={flow.license} onLicense={flow.setLicense} />
        </CardContent>
        <CardFooter><Button onClick={() => flow.run("preview")} loading={flow.busy === "preview"}><Search /> Validate & preview</Button></CardFooter>
      </Card>
      {flow.preview && (
        <>
          <Card>
            <CardHeader><div><CardTitle>Validation preview</CardTitle><CardDescription>Nothing has been written yet.</CardDescription></div></CardHeader>
            <CardContent className="space-y-4"><ImportStatsGrid stats={flow.preview.stats} /><ImportOptions {...flow.opts} onChange={flow.setOpts} /></CardContent>
            <CardFooter><Button onClick={() => setConfirm(true)} disabled={!flow.preview.stats.newRecords && !(flow.opts.updateExisting && flow.preview.stats.changedInSource)}>{confirmLabel} ({flow.preview.stats.newRecords} new)</Button></CardFooter>
          </Card>
          <PreviewDetails preview={flow.preview} />
        </>
      )}
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Save to the question bank?" description="New questions are saved as Pending Review. Previously imported questions and exam history are never deleted." confirmLabel="Import" loading={flow.busy === "confirm"} onConfirm={async () => { if (await flow.run("confirm")) setConfirm(false); }} />
    </>
  );
}

export function FileUploadImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const flow = useImportFlow(async (mode, extra) => {
    const fd = new FormData();
    fd.set("file", file!);
    fd.set("mode", mode);
    fd.set("mapping", JSON.stringify(extra.mapping ?? {}));
    if (extra.fallbackSubject) fd.set("fallbackSubject", String(extra.fallbackSubject));
    fd.set("sourceLicense", String(extra.sourceLicense ?? ""));
    fd.set("updateExisting", String(extra.updateExisting));
    fd.set("skipFlagged", String(extra.skipFlagged));
    return api("/api/admin/import/upload", { method: "POST", body: fd });
  });
  const choose = (f: File | null | undefined) => {
    if (!f) return;
    if (!/\.(csv|json|jsonl|ndjson)$/i.test(f.name)) return toast.error("Upload a .csv, .json or .jsonl file.");
    if (f.size > 4 * 1024 * 1024) return toast.error("Files larger than 4 MB must be split or imported with the CLI script.");
    setFile(f);
    flow.reset();
  };
  if (flow.result) return <CommitSummary result={flow.result} onReset={() => { flow.reset(); setFile(null); }} />;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><div><CardTitle>Upload a dataset</CardTitle><CardDescription>CSV (with header row), JSON array, or JSONL — up to 4 MB. Column names can differ; you will map them next.</CardDescription></div></CardHeader>
        <CardContent className="space-y-3">
          {flow.error && <Alert variant="danger">{flow.error}</Alert>}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files[0]); }}
            className={cn("flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors", drag ? "border-primary bg-primary-soft/40" : "hover:bg-muted/40")}
          >
            <UploadCloud className="size-8 text-muted-foreground" />
            <span className="text-sm font-medium">{file ? file.name : "Drop a file here or click to browse"}</span>
            <span className="text-xs text-muted-foreground">{file ? `${(file.size / 1024).toFixed(0)} KB` : ".csv · .json · .jsonl"}</span>
          </button>
          <input ref={fileRef} type="file" accept=".csv,.json,.jsonl,.ndjson" className="sr-only" onChange={(e) => choose(e.target.files?.[0])} aria-label="Choose dataset file" />
        </CardContent>
        <CardFooter><Button disabled={!file} loading={flow.busy === "inspect"} onClick={() => flow.run("inspect")}><FileUp /> Read file</Button></CardFooter>
      </Card>
      <FlowBody flow={flow} confirmLabel="Import questions" />
    </div>
  );
}

export function ApiImport() {
  const cfg = useApi<{ approvedHosts: string[]; tokenConfigured: boolean }>("/api/admin/import/api");
  const [url, setUrl] = useState("");
  const [maxRecords, setMaxRecords] = useState(200);
  const flow = useImportFlow((mode, extra) => api("/api/admin/import/api", { method: "POST", json: { mode, url, maxRecords, ...extra } }));
  if (flow.result) return <CommitSummary result={flow.result} onReset={flow.reset} />;
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><div><CardTitle>Import from an approved API</CardTitle><CardDescription>Optional. The portal works fully with local datasets; use this only for approved JSON sources such as the Hugging Face datasets server.</CardDescription></div></CardHeader>
        <CardContent className="space-y-4">
          {flow.error && <Alert variant="danger">{flow.error}</Alert>}
          <Alert variant="info" icon={Globe}>
            Approved hosts: <span className="font-mono">{cfg.data?.approvedHosts.join(", ") || "…"}</span>. Requests are made from the server over HTTPS only, without following redirects; private and internal network addresses are blocked. Do not assume every API contains valid PCM MCQs — every record is validated.
          </Alert>
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="API URL" htmlFor="api-url" hint="e.g. https://datasets-server.huggingface.co/rows?dataset=…&config=default&split=train">
              <Input id="api-url" type="url" value={url} onChange={(e) => { setUrl(e.target.value); flow.reset(); }} placeholder="https://" className="font-mono text-[14.5px]" />
            </Field>
            <Field label="Max records" htmlFor="api-max"><Input id="api-max" type="number" min={1} max={5000} value={maxRecords} onChange={(e) => setMaxRecords(Number(e.target.value))} /></Field>
          </div>
        </CardContent>
        <CardFooter><Button disabled={!url} loading={flow.busy === "inspect"} onClick={() => flow.run("inspect")}><Search /> Fetch & inspect</Button></CardFooter>
      </Card>
      <FlowBody flow={flow} confirmLabel="Import from API" />
    </div>
  );
}
