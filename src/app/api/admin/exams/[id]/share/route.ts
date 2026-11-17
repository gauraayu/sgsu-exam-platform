import { handler, json, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { Exam } from "@/models";
import { ensureAccessCode } from "@/services/exam.service";

/**
 * The exam's permanent link token and access code. Reading this never regenerates them; an exam
 * published before access codes existed gets one (once) on first read.
 */
export const GET = handler<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Exam");
  const exam = await Exam.findById(params.id).select("title status shareToken accessCode startDate endDate publishedAt timezone").lean();
  if (!exam) throw notFound("Exam");
  const accessCode = exam.status === "draft" ? null : (exam.accessCode ?? (await ensureAccessCode(exam._id)));
  const now = Date.now();
  const window = exam.status === "closed" ? "closed" : exam.status === "draft" ? "draft" : now < +exam.startDate ? "scheduled" : now > +exam.endDate ? "expired" : "active";
  return json({
    title: exam.title,
    status: exam.status,
    window,
    shareToken: exam.shareToken ?? null,
    path: exam.shareToken ? `/exam/${exam.shareToken}` : null,
    accessCode,
    validFrom: exam.startDate,
    validUntil: exam.endDate,
    timezone: exam.timezone || "Asia/Kolkata",
    publishedAt: exam.publishedAt,
  });
});
