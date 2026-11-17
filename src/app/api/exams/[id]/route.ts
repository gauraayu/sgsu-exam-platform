import { handler, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { Attempt, Accommodation, registerExamVisit } from "@/models";
import { getExamByToken } from "@/services/exam.service";
import { examWindowState } from "@/services/attempt.service";
import { examLifecycle } from "@/lib/exam/lifecycle";

/** Public exam landing information, looked up by share token. Never includes questions. */
export const GET = handler<{ id: string }>(async (_req, { params }) => {
  const exam = await getExamByToken(params.id);
  if (!exam) throw notFound("Exam");
  const user = await getSessionUser();
  let attempt = null;
  let accommodation = null;
  if (user?.role === "STUDENT") {
    await registerExamVisit(exam._id, user.id);
    const a = await Attempt.findOne({ examId: exam._id, studentId: user.id, isCurrent: true }).select("status").lean();
    attempt = a ? { id: String(a._id), status: a.status } : null;
    const acc = await Accommodation.findOne({ examId: exam._id, studentId: user.id }).lean();
    accommodation = acc ? { status: acc.status, camera: acc.requestCamera, microphone: acc.requestMicrophone, fullscreen: acc.requestFullscreen, adminNote: acc.adminNote } : null;
  }
  const s = exam.settings!.security!;
  return json({
    exam: {
      title: exam.title,
      description: exam.description,
      category: exam.category,
      academicLevel: exam.academicLevel,
      durationMinutes: exam.durationMinutes,
      totalQuestions: exam.totalQuestions,
      totalMarks: exam.totalMarks,
      passingMarks: exam.passingMarks,
      marking: exam.marking,
      startDate: exam.startDate,
      endDate: exam.endDate,
      instructions: exam.instructions,
      state: examWindowState(exam),
      lifecycle: examLifecycle(exam),
      timezone: exam.timezone,
      hardEnd: !!exam.hardEndAt,
      security: {
        fullscreen: s.fullscreen,
        tabSwitchWarnings: s.tabSwitchWarnings,
        fullscreenExitWarnings: s.fullscreenExitWarnings,
        camera: s.camera,
        microphone: s.microphone,
        soundMonitoring: s.soundMonitoring,
        maxWarnings: s.maxWarnings,
        terminateOnMaxWarnings: s.terminateOnMaxWarnings,
        oneAttempt: s.oneAttempt,
      },
    },
    viewer: user ? { role: user.role, fullName: user.fullName } : null,
    attempt,
    accommodation,
  });
});
