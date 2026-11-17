import "server-only";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { assertSafeImportUrl, fetchJson } from "@/lib/net/safe-fetch";
import { extractRecordArray } from "@/lib/dataset/parse-files";
import type { ParsedRow } from "@/lib/dataset/parse-files";

function unwrap(item: unknown): Record<string, unknown> | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const obj = item as Record<string, unknown>;
  if (obj.row && typeof obj.row === "object" && !Array.isArray(obj.row)) return obj.row as Record<string, unknown>;
  return obj;
}

/**
 * Fetches records from an approved JSON API (e.g. Hugging Face datasets-server `/rows`).
 * Paginates with offset/length when the endpoint supports it.
 */
export async function fetchApiRecords(rawUrl: string, maxRecords: number) {
  const url = await assertSafeImportUrl(rawUrl, env.approvedImportHosts);
  const paginated = url.pathname.endsWith("/rows") || url.searchParams.has("offset");
  const pageSize = Math.min(100, Number(url.searchParams.get("length")) || 100);
  const rows: ParsedRow[] = [];
  const errors: { line: number; message: string }[] = [];
  let offset = Number(url.searchParams.get("offset")) || 0;
  let totalAvailable: number | null = null;

  for (let page = 0; page < 100 && rows.length < maxRecords; page++) {
    const pageUrl = new URL(url);
    if (paginated) {
      pageUrl.searchParams.set("offset", String(offset));
      pageUrl.searchParams.set("length", String(Math.min(pageSize, maxRecords - rows.length)));
    }
    const data = await fetchJson(pageUrl, { token: env.importApiToken || undefined });
    if (data && typeof data === "object" && "num_rows_total" in data) totalAvailable = Number((data as { num_rows_total: number }).num_rows_total);
    const list = extractRecordArray(data);
    if (!list) throw new AppError("UPSTREAM_ERROR", "The API response does not contain a list of records (expected an array or rows/data/questions).");
    list.forEach((item, i) => {
      const rec = unwrap(item);
      if (rec) rows.push({ line: offset + i + 1, data: rec });
      else errors.push({ line: offset + i + 1, message: "Record is not an object" });
    });
    if (!paginated || list.length === 0 || list.length < pageSize) break;
    offset += list.length;
    if (totalAvailable !== null && offset >= totalAvailable) break;
  }
  const columns = [...new Set(rows.slice(0, 200).flatMap((r) => Object.keys(r.data)))];
  return { url: url.toString(), rows: rows.slice(0, maxRecords), errors, columns, totalAvailable };
}
