import { handler, json, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { examDefaultsSchema } from "@/lib/validation/exam-defaults";
import { getDefaultConfiguration, saveDefaultConfiguration } from "@/services/exam-defaults.service";

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const current = await getDefaultConfiguration();
  if (current.id !== params.id) throw notFound("Default configuration");
  return json({ configuration: await saveDefaultConfiguration(await parseBody(req, examDefaultsSchema), admin.id) });
});
