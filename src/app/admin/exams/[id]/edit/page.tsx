import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Exam } from "@/models";
import { SUBJECTS, type Subject } from "@/lib/constants";
import { UNIVERSITY_TIMEZONE, utcToZonedInput } from "@/lib/timezone";
import { PageHeader } from "@/components/layout/page-header";
import { ExamWizard } from "@/components/admin/exam-wizard";
import { defaultWizardState, type WizardState } from "@/components/admin/exam-wizard-state";
import type { SubjectDistributionItem } from "@/models/types";

export const metadata: Metadata = { title: "Edit exam" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectDB();
  const e = await Exam.findById(id).lean();
  if (!e) notFound();
  if (e.status !== "draft") redirect(`/admin/exams/${id}`);
  const base = defaultWizardState();
  const dist = (e.subjectDistribution ?? []) as SubjectDistributionItem[];
  const subjects = Object.fromEntries(
    SUBJECTS.map((s) => {
      const d = dist.find((x) => x.subject === s);
      return [s, { enabled: !!d, count: d?.count ?? 0, splitDifficulty: !!d?.difficulty, difficulty: d?.difficulty ? { Easy: d.difficulty.Easy, Medium: d.difficulty.Medium, Hard: d.difficulty.Hard } : { Easy: 0, Medium: 0, Hard: 0 }, topics: d?.topics ?? [] }];
    }),
  ) as WizardState["subjects"];
  const sec = e.settings?.security;
  const initial: WizardState = {
    ...base,
    title: e.title,
    description: e.description ?? "",
    category: e.category ?? "",
    academicLevel: e.academicLevel ?? "",
    durationMinutes: e.durationMinutes,
    totalQuestions: e.totalQuestions,
    startDate: utcToZonedInput(e.startDate, e.timezone || UNIVERSITY_TIMEZONE),
    endDate: utcToZonedInput(e.endDate, e.timezone || UNIVERSITY_TIMEZONE),
    scheduleMode: (e.scheduleMode as WizardState["scheduleMode"]) ?? "scheduled",
    accessValidityMinutes: e.accessValidityMinutes || base.accessValidityMinutes,
    timezone: e.timezone || UNIVERSITY_TIMEZONE,
    hardEnd: !!e.hardEndAt,
    passingMarks: e.passingMarks ?? 0,
    instructions: e.instructions ?? "",
    subjects: dist.length ? subjects : base.subjects,
    useDifficulty: !!e.difficultyDistribution,
    difficulty: e.difficultyDistribution ? { Easy: e.difficultyDistribution.Easy, Medium: e.difficultyDistribution.Medium, Hard: e.difficultyDistribution.Hard } : base.difficulty,
    selection: {
      mode: (e.selection?.mode as "random" | "manual") ?? "random",
      sources: (e.selection?.sources ?? []) as WizardState["selection"]["sources"],
      includeNumerical: !!e.selection?.includeNumerical,
      manualQuestionIds: ((e.selection?.manualQuestionIds ?? []) as Types.ObjectId[]).map(String),
    },
    marking: { correct: e.marking?.correct ?? 4, incorrect: e.marking?.incorrect ?? 1, unanswered: e.marking?.unanswered ?? 0 },
    settings: {
      shuffleQuestions: !!e.settings?.shuffleQuestions,
      shuffleOptions: !!e.settings?.shuffleOptions,
      showTopic: !!e.settings?.showTopic,
      resultRelease: (e.settings?.resultRelease as WizardState["settings"]["resultRelease"]) ?? "immediate",
      allowAnswerReview: !!e.settings?.allowAnswerReview,
      security: { ...base.settings.security, ...(sec ? JSON.parse(JSON.stringify(sec)) : {}) },
    },
  };
  void ({} as Subject);
  return (
    <>
      <PageHeader title="Edit draft exam" breadcrumbs={[{ label: "Exams", href: "/admin/exams" }, { label: e.title, href: `/admin/exams/${id}` }, { label: "Edit" }]} />
      <ExamWizard initial={initial} examId={id} />
    </>
  );
}
