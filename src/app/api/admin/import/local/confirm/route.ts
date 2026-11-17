import { Types } from "mongoose";
import { handler, json, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { LOCAL_DATASET_MAPPING } from "@/lib/dataset/normalize";
import { commitImport } from "@/services/import.service";
import { loadLocalFiles, readCuration, readDatasetInfo } from "@/services/local-dataset.service";
import { localImportSchema } from "../schema";

export const maxDuration = 60;

export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const { files, updateExisting, skipFlagged, applyCuration } = await parseBody(req, localImportSchema);
  const { inputs, ambiguousImages } = loadLocalFiles(files);
  const result = await commitImport(
    inputs,
    { sourceType: "local_dataset", mapping: LOCAL_DATASET_MAPPING, ambiguousImages, curation: applyCuration ? readCuration() : null, removeUnusable: applyCuration, sourceLicense: String(readDatasetInfo()?.license ?? "") },
    { userId: new Types.ObjectId(admin.id), updateExisting, skipFlagged },
  );
  return json(result);
});
