import { Types } from "mongoose";
import { z } from "zod";
import { handler, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { AppError, badRequest } from "@/lib/errors";
import { SUBJECTS, type SourceType } from "@/lib/constants";
import { REQUIRED_TARGET_FIELDS, TARGET_FIELDS, suggestMapping, type FieldMapping } from "@/lib/dataset/normalize";
import { detectFormat, parseByFormat } from "@/lib/dataset/parse-files";
import { analyzeImport, commitImport, previewPayload } from "@/services/import.service";

export const maxDuration = 60;
const MAX_BYTES = 4 * 1024 * 1024; // Vercel serverless request bodies are limited to ~4.5 MB.

const mappingSchema = z.partialRecord(z.enum(TARGET_FIELDS), z.string().max(200));
const optionsSchema = z.object({
  mode: z.enum(["inspect", "preview", "confirm"]),
  mapping: z.string().optional(),
  fallbackSubject: z.enum(SUBJECTS).optional().or(z.literal("").transform(() => undefined)),
  sourceLicense: z.string().max(300).optional(),
  updateExisting: z.enum(["true", "false"]).optional(),
  skipFlagged: z.enum(["true", "false"]).optional(),
});

/**
 * Multipart upload of CSV / JSON / JSONL datasets.
 *  mode=inspect  → detected columns, suggested mapping, sample rows
 *  mode=preview  → validation statistics with the chosen mapping (no writes)
 *  mode=confirm  → import into MongoDB (existing questions are never deleted)
 */
export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const form = await req.formData().catch(() => {
    throw badRequest("Upload the dataset as multipart/form-data.");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Choose a file to upload.");
  if (file.size === 0) throw badRequest("The uploaded file is empty.");
  if (file.size > MAX_BYTES) throw new AppError("PAYLOAD_TOO_LARGE", "Files larger than 4 MB must be split or imported with the CLI script.");
  const format = detectFormat(file.name);
  if (!format) throw badRequest("Unsupported file type. Upload a .csv, .json or .jsonl file.");

  const opts = optionsSchema.parse(Object.fromEntries([...form.entries()].filter(([k]) => k !== "file")));
  const text = await file.text();
  const parsed = parseByFormat(format, text);
  if (!parsed.rows.length) throw badRequest(parsed.errors[0]?.message ?? "No records were found in the file.", { errors: parsed.errors.slice(0, 20) });

  if (opts.mode === "inspect") {
    return json({
      format,
      filename: file.name,
      records: parsed.rows.length,
      parseErrors: parsed.errors.slice(0, 20),
      parseErrorCount: parsed.errors.length,
      columns: parsed.columns,
      suggestedMapping: suggestMapping(parsed.columns),
      sampleRows: parsed.rows.slice(0, 5).map((r) => r.data),
    });
  }

  let mapping: FieldMapping;
  try {
    mapping = mappingSchema.parse(JSON.parse(opts.mapping ?? "{}"));
  } catch {
    throw badRequest("Invalid column mapping.");
  }
  for (const f of REQUIRED_TARGET_FIELDS) {
    if (f === "subject" && opts.fallbackSubject) continue;
    if (!mapping[f]) throw badRequest(`Map a column to "${f === "questionText" ? "Question text" : "Subject"}" (or choose a default subject).`);
  }
  for (const col of Object.values(mapping)) if (col && !parsed.columns.includes(col)) throw badRequest(`Column "${col}" does not exist in the file.`);

  const sourceType: SourceType = format === "csv" ? "csv_upload" : format === "json" ? "json_upload" : "jsonl_upload";
  const inputs = [{ file: file.name, rows: parsed.rows, parseErrors: parsed.errors }];
  const ctx = { sourceType, mapping, fallbackSubject: opts.fallbackSubject, sourceLicense: opts.sourceLicense ?? "" };

  if (opts.mode === "preview") return json(previewPayload(await analyzeImport(inputs, ctx)));
  return json(
    await commitImport(inputs, ctx, {
      userId: new Types.ObjectId(admin.id),
      updateExisting: opts.updateExisting === "true",
      skipFlagged: opts.skipFlagged === "true",
      filename: file.name,
    }),
  );
});
