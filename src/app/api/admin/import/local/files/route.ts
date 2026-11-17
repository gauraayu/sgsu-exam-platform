import { handler, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { listLocalDatasets } from "@/services/local-dataset.service";

export const GET = handler(async () => {
  await requireAdmin();
  return json(await listLocalDatasets());
});
