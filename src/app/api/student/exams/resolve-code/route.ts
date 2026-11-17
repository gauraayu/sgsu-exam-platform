import { z } from "zod";
import { handler, json, parseBody } from "@/lib/api";
import { clientIp, requireStudent, throttle } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { registerExamVisit } from "@/models";
import { examWindowState, studentAvailability } from "@/services/attempt.service";
import { getExamByAccessCode } from "@/services/exam.service";

const schema = z.object({ code: z.string().trim().min(4, "Enter the examination code.").max(20) });

/**
 * Finds an exam by its access code. Returns only public details and the exam's link token: the
 * student then opens the same exam page as the link, so login, eligibility and the one-attempt
 * rule are enforced in exactly one place.
 */
export const POST = handler(async (req) => {
  const user = await requireStudent();
  // Stop code guessing: 10 lookups per minute per student and 30 per minute per IP.
  await throttle(`code:user:${user.id}`, 10, 60);
  await throttle(`code:ip:${await clientIp()}`, 30, 60);
  const { code } = await parseBody(req, schema);
  const exam = await getExamByAccessCode(code);
  if (!exam || !exam.shareToken) throw new AppError("NOT_FOUND", "Invalid examination code. Please verify the code and try again.");

  await registerExamVisit(exam._id, user.id);
  const a = await studentAvailability(exam, user.id);
  const window = examWindowState(exam);
  let message: string | null = a.message;
  if (a.completed) message = "You have already completed this examination.";

  return json({
    exam: {
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      totalQuestions: exam.totalQuestions,
      subjects: ((exam.subjectDistribution ?? []) as { subject: string }[]).map((d) => d.subject),
      startDate: exam.startDate,
      endDate: exam.endDate,
      timezone: a.schedule.timezone,
      startLabel: a.schedule.startLabel,
      endLabel: a.schedule.endLabel,
      token: exam.shareToken,
    },
    state: a.completed ? "completed" : a.canResume ? "in_progress" : window,
    lifecycle: a.lifecycle,
    message,
  });
});
