import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Camera, Clock, FileQuestion, Maximize, Mic, RefreshCcw, Save, ShieldAlert, Target, Timer } from "lucide-react";
import { connectDB } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getExamByToken } from "@/services/exam.service";

import { LIFECYCLE_LABEL, availabilityMessage, examLifecycle } from "@/lib/exam/lifecycle";
import { formatDateAndTime, formatInZone, UNIVERSITY_TIMEZONE } from "@/lib/timezone";
import { AvailabilityWatcher } from "@/components/exam/availability-watcher";
import { Attempt, Accommodation, registerExamVisit } from "@/models";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/states";
import { StartPanel } from "@/components/exam/start-panel";
import { formatDuration } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  await connectDB();
  const exam = await getExamByToken((await params).token);
  return { title: exam?.title ?? "Exam" };
}

const STATE_BADGE = {
  active: "success",
  scheduled: "info",
  expired: "default",
  closed: "default",
  archived: "default",
  draft: "default",
} as const;

export default async function ExamLandingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await connectDB();
  const exam = await getExamByToken(token);
  if (!exam) notFound();
  const user = await getSessionUser();
  const lifecycle = examLifecycle(exam);
  const tz = exam.timezone || UNIVERSITY_TIMEZONE;
  const message = availabilityMessage(lifecycle, formatDateAndTime(exam.startDate, tz));
  const s = exam.settings!.security!;
  const next = `/exam/${token}`;

  let attempt: { id: string; status: string } | null = null;
  let accommodation = null;
  if (user?.role === "STUDENT") {
    await registerExamVisit(exam._id, user.id);
    const a = await Attempt.findOne({ examId: exam._id, studentId: user.id, isCurrent: true }).select("status").lean();
    attempt = a ? { id: String(a._id), status: a.status } : null;
    const acc = await Accommodation.findOne({ examId: exam._id, studentId: user.id }).lean();
    accommodation = acc ? { status: acc.status, camera: acc.requestCamera, microphone: acc.requestMicrophone, fullscreen: acc.requestFullscreen, adminNote: acc.adminNote } : null;
  }

  const rules: { icon: React.ElementType; text: string }[] = [
    { icon: Timer, text: `You will have ${formatDuration(exam.durationMinutes)} once you start. The timer runs on the server and does not pause if you close or refresh the page.` },
    {
      icon: CalendarClock,
      text: exam.hardEndAt
        ? `Every attempt ends at ${formatInZone(exam.hardEndAt, tz)} at the latest, even if your ${formatDuration(exam.durationMinutes)} have not run out.`
        : `You may start any time before ${formatInZone(exam.endDate, tz)}. Once started, you get the full ${formatDuration(exam.durationMinutes)}, even if the start window closes meanwhile.`,
    },
    { icon: Save, text: "Your answers are saved automatically. If your connection drops, keep working: changes are kept on this device and synchronise when the connection returns. A network problem is never counted as a warning." },
    { icon: Target, text: `Marking: +${exam.marking?.correct ?? 4} for a correct answer, ${exam.marking?.incorrect ? `−${exam.marking.incorrect}` : "no negative marks"} for an incorrect answer, ${exam.marking?.unanswered ?? 0} for unanswered questions.` },
  ];
  if (s.fullscreen) rules.push({ icon: Maximize, text: "The exam runs in fullscreen. Leaving fullscreen is recorded as a warning." });
  if (s.tabSwitchWarnings) rules.push({ icon: ShieldAlert, text: "Switching to another tab or application is recorded as a warning." });
  if (s.fullscreenExitWarnings || s.tabSwitchWarnings)
    rules.push({ icon: ShieldAlert, text: s.terminateOnMaxWarnings ? `After ${s.maxWarnings} warnings your attempt is submitted automatically with the answers saved so far.` : `Warnings are reported to the examination cell (limit ${s.maxWarnings}).` });
  if (s.camera) rules.push({ icon: Camera, text: "Camera access is required. The video stays on your device; it is not recorded, uploaded or used for face recognition." });
  if (s.microphone) rules.push({ icon: Mic, text: "Microphone access is required. Only the relative sound level is measured on your device. No audio is recorded or transcribed." });
  if (s.oneAttempt) rules.push({ icon: RefreshCcw, text: "You can attempt this exam only once. Re-opening the link resumes your existing attempt." });

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Portal home">
            <Logo height={30} />
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <span className="inline text-[14.5px] text-muted-foreground max-sm:hidden">
                Signed in as <span className="font-medium text-foreground">{user.fullName}</span>
              </span>
            ) : (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STATE_BADGE[lifecycle]}>{lifecycle === "active" ? "Open now" : LIFECYCLE_LABEL[lifecycle]}</Badge>
              {exam.category && <Badge variant="outline">{exam.category}</Badge>}
              {exam.academicLevel && <Badge variant="outline">{exam.academicLevel}</Badge>}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{exam.title}</h1>
            {exam.description && <p className="max-w-2xl whitespace-pre-line text-sm text-muted-foreground">{exam.description}</p>}
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: FileQuestion, label: "Questions", value: exam.totalQuestions },
              { icon: Clock, label: "Duration", value: formatDuration(exam.durationMinutes) },
              { icon: Target, label: "Total marks", value: exam.totalMarks },
              { icon: Target, label: "Passing marks", value: exam.passingMarks || "—" },
            ].map((i) => (
              <div key={i.label} className="rounded-lg border bg-card p-3.5">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <i.icon className="size-3.5" /> {i.label}
                </dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">{i.value}</dd>
              </div>
            ))}
          </dl>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="size-4 text-muted-foreground" /> Exam window
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-[14.5px] sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Opens</p>
                <p className="font-medium" data-testid="window-start">{formatInZone(exam.startDate, tz)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stops accepting new attempts</p>
                <p className="font-medium" data-testid="window-end">{formatInZone(exam.endDate, tz)}</p>
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {exam.hardEndAt
                  ? "Hard end time: attempts still running at the closing time are submitted automatically."
                  : "Attempts already started continue for their full duration after the start window closes."}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {exam.instructions && <p className="whitespace-pre-line text-sm leading-relaxed">{exam.instructions}</p>}
              <ul className="space-y-2.5">
                {rules.map((r, i) => (
                  <li key={i} className="flex gap-3 text-[14.5px] leading-relaxed">
                    <r.icon className="mt-0.5 size-4 shrink-0 text-primary dark:text-primary-soft-foreground" aria-hidden />
                    <span>{r.text}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Browser-based monitoring records technical events only (such as leaving fullscreen). These events are reviewed by the examination cell and are not, on their own, treated as proof of misconduct.
              </p>
            </CardContent>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>{user?.role === "STUDENT" ? "Begin your exam" : "Get started"}</CardTitle>
            </CardHeader>
            <CardContent>
              {!user ? (
                <div className="space-y-3">
                  <p className="text-[14.5px] text-muted-foreground">Create your student account once, then use it for this and every future SGSU assessment. You will return to this exam after signing in.</p>
                  <Button asChild className="w-full" size="lg">
                    <Link href={`/signup?next=${encodeURIComponent(next)}`}>Create account</Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/login?next=${encodeURIComponent(next)}`}>I already have an account</Link>
                  </Button>
                </div>
              ) : user.role !== "STUDENT" ? (
                <Alert variant="info" title="Administrator preview">
                  You are signed in as an administrator. Students see their start panel here.
                </Alert>
              ) : lifecycle === "scheduled" && attempt?.status !== "in_progress" ? (
                <div className="space-y-3">
                  <Alert variant="info" title="Not open yet">
                    <span data-testid="availability-message">{message}</span>
                  </Alert>
                  <AvailabilityWatcher token={token} startsAt={new Date(exam.startDate).toISOString()} />
                </div>
              ) : (lifecycle === "expired" || lifecycle === "closed" || lifecycle === "archived") && !attempt ? (
                <Alert variant="warning" title={lifecycle === "closed" ? "Examination closed" : "Examination expired"}>
                  <span data-testid="availability-message">{message}</span>
                </Alert>
              ) : (
                <StartPanel token={token} security={{ fullscreen: s.fullscreen, camera: s.camera, microphone: s.microphone }} accommodation={accommodation} attempt={attempt} />
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
