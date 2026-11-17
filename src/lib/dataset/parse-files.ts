import Papa from "papaparse";

export interface ParsedRow {
  line: number;
  data: Record<string, unknown>;
}
export interface ParseOutcome {
  rows: ParsedRow[];
  errors: { line: number; message: string }[];
  columns: string[];
  blankLines: number;
}

function collectColumns(rows: ParsedRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows.slice(0, 500)) Object.keys(r.data).forEach((k) => set.add(k));
  return [...set];
}

/** Reads JSONL line by line; blank lines are skipped and malformed lines are reported, never thrown. */
export function parseJsonl(text: string): ParseOutcome {
  const rows: ParsedRow[] = [];
  const errors: ParseOutcome["errors"] = [];
  let blankLines = 0;
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const line = idx + 1;
    if (!raw.trim()) {
      if (idx < lines.length - 1 || raw.length) blankLines++;
      return;
    }
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        errors.push({ line, message: "Line is valid JSON but not an object" });
        return;
      }
      rows.push({ line, data: value as Record<string, unknown> });
    } catch (e) {
      errors.push({ line, message: `Malformed JSON: ${(e as Error).message.slice(0, 120)}` });
    }
  });
  return { rows, errors, columns: collectColumns(rows), blankLines };
}

/** Accepts a JSON array of objects, or an object holding one under rows/data/questions/items. */
export function parseJsonDocument(text: string): ParseOutcome {
  let value: unknown;
  try {
    value = JSON.parse(text.replace(/^﻿/, ""));
  } catch (e) {
    return { rows: [], errors: [{ line: 0, message: `Invalid JSON file: ${(e as Error).message.slice(0, 160)}` }], columns: [], blankLines: 0 };
  }
  const list = extractRecordArray(value);
  if (!list) return { rows: [], errors: [{ line: 0, message: "JSON must be an array of question objects" }], columns: [], blankLines: 0 };
  const rows: ParsedRow[] = [];
  const errors: ParseOutcome["errors"] = [];
  list.forEach((item, i) => {
    if (item && typeof item === "object" && !Array.isArray(item)) rows.push({ line: i + 1, data: unwrapRow(item as Record<string, unknown>) });
    else errors.push({ line: i + 1, message: "Item is not an object" });
  });
  return { rows, errors, columns: collectColumns(rows), blankLines: 0 };
}

/** Hugging Face datasets-server wraps records as { row_idx, row: {...} }. */
function unwrapRow(item: Record<string, unknown>) {
  if ("row" in item && item.row && typeof item.row === "object" && !Array.isArray(item.row)) return item.row as Record<string, unknown>;
  return item;
}

export function extractRecordArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    for (const key of ["rows", "data", "questions", "items", "records", "results"]) {
      const v = (value as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v;
    }
  }
  return null;
}

export function parseCsv(text: string): ParseOutcome {
  const result = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const rows: ParsedRow[] = result.data.map((data, i) => ({ line: i + 2, data }));
  const errors = result.errors.slice(0, 200).map((e) => ({ line: (e.row ?? 0) + 2, message: e.message }));
  return { rows, errors, columns: (result.meta.fields ?? []).filter(Boolean), blankLines: 0 };
}

export type UploadFormat = "csv" | "json" | "jsonl";

export function detectFormat(filename: string): UploadFormat | null {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "csv") return "csv";
  if (ext === "json") return "json";
  if (ext === "jsonl" || ext === "ndjson") return "jsonl";
  return null;
}

export function parseByFormat(format: UploadFormat, text: string): ParseOutcome {
  if (format === "csv") return parseCsv(text);
  if (format === "json") return parseJsonDocument(text);
  return parseJsonl(text);
}
