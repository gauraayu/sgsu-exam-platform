"use client";

import { useState } from "react";
import { Database, FileJson, FolderX, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { api, ApiError } from "@/lib/client-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, ErrorState } from "@/components/ui/states";
import { ConfirmDialog } from "@/components/ui/dialog";
import { CommitSummary, CurationOption, ImportOptions, ImportStatsGrid, PreviewDetails, type CommitResponse, type PreviewResponse } from "./import-shared";

interface Listing {
  subjects: { subject: string; slug: string; present: boolean; imagesFolder: boolean; imageCount: number; files: { id: string; filename: string; sizeBytes: number; recordCount: number; importedCount: number }[] }[];
  datasetInfo: { name?: string; license?: string; attribution?: string } | null;
}

export function LocalImport() {
  const listing = useApi<Listing>("/api/admin/import/local/files");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [opts, setOpts] = useState({ updateExisting: false, skipFlagged: false });
  const [applyCuration, setApplyCuration] = useState(true);
  const [loading, setLoading] = useState<"preview" | "commit" | null>(null);
  const [confirm, setConfirm] = useState(false);

  const allFiles = listing.data?.subjects.flatMap((s) => s.files.map((f) => f.id)) ?? [];
  const toggle = (id: string, on: boolean) => {
    setSelected((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });
    setPreview(null);
  };

  async function runPreview() {
    setLoading("preview");
    try {
      setPreview(await api<PreviewResponse>("/api/admin/import/local/preview", { method: "POST", json: { files: [...selected], applyCuration } }));
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setLoading(null);
    }
  }
  async function commit() {
    setLoading("commit");
    try {
      const r = await api<CommitResponse>("/api/admin/import/local/confirm", { method: "POST", json: { files: [...selected], applyCuration, ...opts } });
      setResult(r);
      setConfirm(false);
      toast.success(`${r.stats.successfullyImported} question(s) imported.`);
      void listing.reload(true);
    } catch (e) {
      toast.error((e as ApiError).message);
    } finally {
      setLoading(null);
    }
  }

  if (result) return <CommitSummary result={result} onReset={() => { setResult(null); setPreview(null); setSelected(new Set()); }} />;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div><CardTitle>Datasets in the project</CardTitle><CardDescription>Read-only JSONL/JSON files in <code className="rounded bg-muted px-1">src/data/&#123;subject&#125;/</code>. Images are served from <code className="rounded bg-muted px-1">public/questions/&#123;subject&#125;/images/</code>.</CardDescription></div>
          {allFiles.length > 0 && <Button variant="outline" size="sm" onClick={() => { setSelected(selected.size === allFiles.length ? new Set() : new Set(allFiles)); setPreview(null); }}>{selected.size === allFiles.length ? "Clear selection" : "Select all"}</Button>}
        </CardHeader>
        <CardContent>
          {listing.loading ? <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}</div> : listing.error ? <ErrorState message={listing.error.message} onRetry={() => listing.reload()} /> : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                {listing.data!.subjects.map((s) => (
                  <div key={s.slug} className="rounded-lg border">
                    <div className="flex items-center justify-between border-b px-4 py-2.5">
                      <p className="font-medium">{s.subject}</p>
                      {s.present ? <Badge variant="success">Available</Badge> : <Badge>Not yet imported</Badge>}
                    </div>
                    {s.present ? (
                      <ul className="divide-y">
                        {s.files.map((f) => (
                          <li key={f.id}>
                            <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                              <Checkbox checked={selected.has(f.id)} onCheckedChange={(v) => toggle(f.id, v === true)} aria-label={`Select ${f.id}`} />
                              <FileJson className="size-4 text-muted-foreground" />
                              <span className="min-w-0 flex-1">
                                <span className="block font-mono text-[14.5px]">{f.filename}</span>
                                <span className="block text-xs text-muted-foreground">{f.recordCount.toLocaleString("en-IN")} records · {(f.sizeBytes / 1024).toFixed(0)} KB</span>
                              </span>
                              {f.importedCount > 0 && <Badge variant="primary" title="Questions already in MongoDB from this file">{f.importedCount} in bank</Badge>}
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex items-center gap-2 px-4 py-6 text-[14.5px] text-muted-foreground"><FolderX className="size-4" /> No dataset files found for this subject.</div>
                    )}
                    <p className="flex items-center gap-1.5 border-t px-4 py-2 text-xs text-muted-foreground"><ImageIcon className="size-3.5" />{s.imagesFolder ? `${s.imageCount} image file(s)` : "No images folder"}</p>
                  </div>
                ))}
              </div>
              {listing.data!.datasetInfo && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{listing.data!.datasetInfo.name}</span> · License: {listing.data!.datasetInfo.license}
                </p>
              )}
            </div>
          )}
        </CardContent>
        <div className="px-5 pb-4"><CurationOption checked={applyCuration} onChange={(v) => { setApplyCuration(v); setPreview(null); }} /></div>
        <CardFooter className="justify-between">
          <p className="text-xs text-muted-foreground">{selected.size} file(s) selected. Re-importing the same files never creates duplicates.</p>
          <Button onClick={runPreview} disabled={!selected.size} loading={loading === "preview"}><Database /> Preview import</Button>
        </CardFooter>
      </Card>

      {preview && (
        <>
          <Card>
            <CardHeader><div><CardTitle>Import preview</CardTitle><CardDescription>Nothing has been written yet.</CardDescription></div></CardHeader>
            <CardContent className="space-y-4">
              <ImportStatsGrid stats={preview.stats} />
              {preview.stats.ambiguousImages > 0 && (
                <Alert variant="warning" title={`${preview.stats.ambiguousImages} questions reference image files whose names are shared across source papers`}>
                  The source papers numbered their images independently (image1, image2, …), so a file such as image17.png may belong to a different question. These questions are flagged and must be confirmed visually before verification.
                </Alert>
              )}
              <ImportOptions {...opts} onChange={setOpts} />
            </CardContent>
            <CardFooter>
              <Button onClick={() => setConfirm(true)} disabled={!preview.stats.newRecords && !(opts.updateExisting && preview.stats.changedInSource)}>
                Import {preview.stats.newRecords.toLocaleString("en-IN")} new question(s)
              </Button>
            </CardFooter>
          </Card>
          <PreviewDetails preview={preview} />
        </>
      )}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Import into the question bank?"
        description={`${preview?.stats.newRecords ?? 0} new question(s) will be saved as Pending Review${opts.updateExisting ? `, and up to ${preview?.stats.changedInSource ?? 0} changed question(s) will be updated` : ""}. Existing questions are never deleted.`}
        confirmLabel="Import"
        loading={loading === "commit"}
        onConfirm={commit}
      />
    </div>
  );
}
