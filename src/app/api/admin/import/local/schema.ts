import { z } from "zod";

export const localImportSchema = z.object({
  files: z.array(z.string().regex(/^[a-z][a-z-]*\/[\w.-]+\.(jsonl|json)$/i)).min(1, "Select at least one file.").max(50),
  updateExisting: z.boolean().default(false),
  skipFlagged: z.boolean().default(false),
  /** Apply src/data/curation.json and remove questions that can never be displayed correctly (recommended). */
  applyCuration: z.boolean().default(true),
});
