import { z } from "zod";
import { handler, json, parseBody, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { Session, audit } from "@/models";
import { getStudentProfileForAdmin, setStudentStatus } from "@/services/results.service";

export const GET = handler<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Student");
  return json(await getStudentProfileForAdmin(params.id));
});

const schema = z.object({ status: z.enum(["active", "disabled"]) });

export const PATCH = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Student");
  const { status } = await parseBody(req, schema);
  await setStudentStatus(params.id, status);
  if (status === "disabled") await Session.deleteMany({ userId: params.id });
  await audit(admin.id, `student.${status}`, "User", params.id);
  return json({ ok: true });
});
