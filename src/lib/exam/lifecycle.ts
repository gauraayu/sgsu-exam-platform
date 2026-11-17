/**
 * Examination lifecycle, derived on every request from the stored publication state and the
 * schedule. Nothing depends on a cron job flipping a flag: an exam is "active" exactly while
 * the server clock is inside its access window.
 */

export const EXAM_LIFECYCLE_STATES = ["draft", "scheduled", "active", "expired", "closed", "archived"] as const;
export type ExamLifecycle = (typeof EXAM_LIFECYCLE_STATES)[number];

export interface LifecycleInput {
  status: string;
  startDate: Date | string;
  endDate: Date | string;
}

export function examLifecycle(exam: LifecycleInput, now: Date = new Date()): ExamLifecycle {
  if (exam.status === "draft") return "draft";
  if (exam.status === "archived") return "archived";
  if (exam.status === "closed") return "closed";
  if (now.getTime() < new Date(exam.startDate).getTime()) return "scheduled";
  if (now.getTime() >= new Date(exam.endDate).getTime()) return "expired";
  return "active";
}

export const LIFECYCLE_LABEL: Record<ExamLifecycle, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Active",
  expired: "Expired",
  closed: "Closed",
  archived: "Archived",
};

/** Exact student-facing availability messages. */
export function availabilityMessage(state: ExamLifecycle, start: { date: string; time: string }) {
  switch (state) {
    case "scheduled":
      return `This examination is scheduled to begin on ${start.date} at ${start.time}.`;
    case "expired":
      return "This examination is no longer accepting new attempts.";
    case "closed":
      return "This examination has been closed by the administrator.";
    case "archived":
      return "This examination is no longer available.";
    case "draft":
      return "This examination has not been published.";
    default:
      return null;
  }
}

/**
 * Deadline for a new attempt. By default each student gets the full duration from the moment
 * they start; only when a hard end time is configured is the deadline capped at that time.
 */
export function attemptDeadline(startedAt: Date, durationMinutes: number, hardEndAt?: Date | string | null) {
  const own = startedAt.getTime() + durationMinutes * 60_000;
  return new Date(hardEndAt ? Math.min(own, new Date(hardEndAt).getTime()) : own);
}
