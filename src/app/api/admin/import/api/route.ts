import { Types } from "mongoose";
import { z } from "zod";
import { handler, json, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { env } from "@/lib/env";
import { SUBJECTS } from "@/lib/constants";
import { REQUIRED_TARGET_FIELDS, TARGET_FIELDS, suggestMapping } from "@/lib/dataset/normalize";
import { analyzeImport, commitImport, previewPayload } from "@/services/import.service";
import { fetchApiRecords } from "@/services/api-import.service";

export const maxDuration = 60;

const schema = z.object({
  mode: z.enum(["inspect", "preview", "confirm"]),
  url: z.string().url("Enter a valid URL.").max(2000),
  maxRecords: z.coerce.number().int().min(1).max(5000).default(500),
  mapping: z.partialRecord(z.enum(TARGET_FIELDS), z.string().max(200)).default({}),
  fallbackSubject: z.enum(SUBJECTS).optional(),
  sourceLicense: z.string().max(300).default(""),
  updateExisting: z.boolean().default(false),
  skipFlagged: z.boolean().default(false),
});

export const GET = handler(async () => {
  await requireAdmin();
  return json({ approvedHosts: env.approvedImportHosts, tokenConfigured: !!env.importApiToken });
});

export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const input = await parseBody(req, schema);
  const fetched = await fetchApiRecords(input.url, input.maxRecords);
  if (!fetched.rows.length) throw badRequest("The API returned no records.");
  if (input.mode === "inspect") {
    return json({
      url: fetched.url,
      records: fetched.rows.length,
      totalAvailable: fetched.totalAvailable,
      columns: fetched.columns,
      suggestedMapping: suggestMapping(fetched.columns),
      sampleRows: fetched.rows.slice(0, 5).map((r) => r.data),
    });
  }
  for (const f of REQUIRED_TARGET_FIELDS) {
    if (f === "subject" && input.fallbackSubject) continue;
    if (!input.mapping[f]) throw badRequest(`Map a field to "${f === "questionText" ? "Question text" : "Subject"}" (or choose a default subject).`);
  }
  const host = new URL(fetched.url).hostname;
  const inputs = [{ file: `${host}${new URL(fetched.url).pathname}`, rows: fetched.rows, parseErrors: fetched.errors }];
  const ctx = { sourceType: "external_api" as const, mapping: input.mapping, fallbackSubject: input.fallbackSubject, sourceLicense: input.sourceLicense };
  if (input.mode === "preview") return json(previewPayload(await analyzeImport(inputs, ctx)));
  return json(
    await commitImport(inputs, ctx, {
      userId: new Types.ObjectId(admin.id),
      updateExisting: input.updateExisting,
      skipFlagged: input.skipFlagged,
      filename: fetched.url,
      sourceUrl: fetched.url,
    }),
  );
});
