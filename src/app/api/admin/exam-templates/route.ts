import { handler, json, parseBody, parseQuery } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { examTemplateSchema, templateListQuerySchema } from "@/lib/validation/exam-templates";
import { createTemplate, listTemplates } from "@/services/exam-template.service";

export const GET = handler(async (req) => {
  await requireAdmin();
  const { status } = parseQuery(req, templateListQuerySchema);
  return json({ templates: await listTemplates(status) });
});

export const POST = handler(async (req) => {
  const admin = await requireAdmin();
  const template = await createTemplate(await parseBody(req, examTemplateSchema), admin.id);
  return json({ template }, 201);
});
