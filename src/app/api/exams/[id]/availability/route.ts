import { Types } from "mongoose";
import { handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { Exam } from "@/models";
import { studentAvailability } from "@/services/attempt.service";

/**
 * Server-calculated availability of an exam, by id or link token. Students get their own
 * start/resume state; drafts are never revealed to students.
 */
export const GET = handler<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const byId = Types.ObjectId.isValid(params.id) && /^[a-f\d]{24}$/i.test(params.id);
  const exam = await Exam.findOne(byId ? { _id: params.id } : { shareToken: params.id })
    .select("status startDate endDate timezone hardEndAt durationMinutes title")
    .lean();
  if (!exam || (user.role === "STUDENT" && exam.status === "draft")) throw notFound("Exam");
  const a = await studentAvailability(exam, user.role === "STUDENT" ? user.id : null);
  return json({ title: exam.title, ...a });
});
