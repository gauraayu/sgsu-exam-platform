import { Badge } from "@/components/ui/badge";

const ATTEMPT: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "default" | "primary" }> = {
  in_progress: { label: "In progress", variant: "info" },
  evaluating: { label: "Evaluating", variant: "info" },
  submitted: { label: "Submitted", variant: "success" },
  auto_submitted: { label: "Auto-submitted", variant: "warning" },
  terminated: { label: "Terminated", variant: "danger" },
  reset: { label: "Reset", variant: "default" },
  active: { label: "Active", variant: "success" },
  disconnected: { label: "Disconnected", variant: "warning" },
  time_expired: { label: "Time expired", variant: "warning" },
};
export function AttemptStatusBadge({ status }: { status: string }) {
  const s = ATTEMPT[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

const EXAM: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "default" | "primary" | "outline" }> = {
  draft: { label: "Draft", variant: "outline" },
  published: { label: "Published", variant: "success" },
  closed: { label: "Closed", variant: "default" },
  archived: { label: "Archived", variant: "default" },
  open: { label: "Open now", variant: "success" },
  upcoming: { label: "Upcoming", variant: "info" },
  ended: { label: "Ended", variant: "default" },
  scheduled: { label: "Scheduled", variant: "info" },
  active: { label: "Active", variant: "success" },
  expired: { label: "Expired", variant: "warning" },
};
export function ExamStatusBadge({ status }: { status: string }) {
  const s = EXAM[status] ?? { label: status, variant: "default" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export function VerificationBadge({ status }: { status: string }) {
  // Review step removed: imported (pending) and verified questions are both usable.
  return status === "rejected" ? <Badge variant="danger">Rejected</Badge> : <Badge variant="success">Active</Badge>;
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  // One colour per level, used everywhere: Easy = green, Medium = amber, Hard = red.
  const v = difficulty === "Easy" ? "success" : difficulty === "Medium" ? "warning" : difficulty === "Hard" ? "danger" : "outline";
  return <Badge variant={v}>{difficulty}</Badge>;
}

export function PassBadge({ passed }: { passed: boolean | null | undefined }) {
  if (passed === null || passed === undefined) return <span className="text-muted-foreground">—</span>;
  return <Badge variant={passed ? "success" : "danger"}>{passed ? "Pass" : "Fail"}</Badge>;
}
