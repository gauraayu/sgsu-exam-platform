import { z } from "zod";
import { Types } from "mongoose";
import { handler, json, parseBody } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { WizardDraft } from "@/models";

/** The admin's auto-saved Create Examination wizard (one per admin). */
export const GET = handler(async () => {
  const admin = await requireAdmin();
  const d = await WizardDraft.findOne({ adminId: new Types.ObjectId(admin.id) }).lean();
  return json({ draft: d ? { step: d.step, state: d.state, title: d.title, updatedAt: d.updatedAt } : null });
});

const bodySchema = z.object({
  step: z.number().int().min(0).max(10),
  // The wizard state is re-validated when the exam is actually created; here it is only stored.
  state: z.record(z.string(), z.unknown()).refine((v) => JSON.stringify(v).length < 200_000, "Draft is too large."),
});

export const PUT = handler(async (req) => {
  const admin = await requireAdmin();
  const { step, state } = await parseBody(req, bodySchema);
  const title = typeof state.title === "string" ? state.title.slice(0, 200) : "";
  const d = await WizardDraft.findOneAndUpdate(
    { adminId: new Types.ObjectId(admin.id) },
    { $set: { step, state, title } },
    { upsert: true, returnDocument: "after" },
  ).lean();
  return json({ savedAt: d!.updatedAt });
});

export const DELETE = handler(async () => {
  const admin = await requireAdmin();
  await WizardDraft.deleteOne({ adminId: new Types.ObjectId(admin.id) });
  return json({ ok: true });
});
