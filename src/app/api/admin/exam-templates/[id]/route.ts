import { z } from "zod";
import { handler, json, parseBody, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { examTemplateSchema } from "@/lib/validation/exam-templates";
import { getTemplate, setTemplateStatus, updateTemplate } from "@/services/exam-template.service";

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Template");
  return json({ template: await getTemplate(params.id) });
});

/** Full update, or `{ status: "active" }` to restore an archived template. */
export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Template");
  const body = await req.clone().json().catch(() => null);
  if (body && typeof body === "object" && Object.keys(body).length === 1 && "status" in body) {
    const { status } = await parseBody(req, z.object({ status: z.enum(["active", "archived"]) }));
    return json({ template: await setTemplateStatus(params.id, status, admin.id) });
  }
  return json({ template: await updateTemplate(params.id, await parseBody(req, examTemplateSchema), admin.id) });
});

/** Templates are archived, never hard-deleted: exams created from them keep their reference. */
export const DELETE = handler<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Template");
  return json({ template: await setTemplateStatus(params.id, "archived", admin.id) });
});
