import { handler, json, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { LOCAL_DATASET_MAPPING } from "@/lib/dataset/normalize";
import { analyzeImport, previewPayload } from "@/services/import.service";
import { loadLocalFiles, readCuration, readDatasetInfo } from "@/services/local-dataset.service";
import { localImportSchema } from "../schema";

export const POST = handler(async (req) => {
  await requireAdmin();
  const { files, applyCuration } = await parseBody(req, localImportSchema);
  const { inputs, ambiguousImages } = loadLocalFiles(files);
  const analysis = await analyzeImport(inputs, {
    sourceType: "local_dataset",
    mapping: LOCAL_DATASET_MAPPING,
    ambiguousImages,
    curation: applyCuration ? readCuration() : null,
    removeUnusable: applyCuration,
    sourceLicense: String(readDatasetInfo()?.license ?? ""),
  });
  return json(previewPayload(analysis));
});
