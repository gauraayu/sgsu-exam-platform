import { handler, json, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { examDefaultsSchema } from "@/lib/validation/exam-defaults";
import { getDefaultConfiguration, saveDefaultConfiguration } from "@/services/exam-defaults.service";

/** Saved defaults used by Quick Generate. */
export const GET = handler(async () => {
  await requireAdmin();
  return json({ configuration: await getDefaultConfiguration() });
});

/** "Save as default": replaces the saved default configuration. */
export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  return json({ configuration: await saveDefaultConfiguration(await parseBody(req, examDefaultsSchema), admin.id) });
});
