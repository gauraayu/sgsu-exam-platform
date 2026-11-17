import { SUBJECTS, type Difficulty, type SourceType, type Subject } from "@/lib/constants";
import { UNIVERSITY_TIMEZONE, utcToZonedInput, zonedInputToUtc } from "@/lib/timezone";

export type Counts = Record<Difficulty, number>;
export interface WizardState {
  title: string;
  description: string;
  category: string;
  academicLevel: string;
  durationMinutes: number;
  totalQuestions: number;
  startDate: string; // datetime-local, in `timezone`
  endDate: string;
  /** Start right after publishing (open for accessValidityMinutes) or at the scheduled time. */
  scheduleMode: "immediate" | "scheduled";
  accessValidityMinutes: number;
  timezone: string;
  /** Running attempts also end at the end time. */
  hardEnd: boolean;
  passingMarks: number;
  /** Used by templates instead of absolute passing marks. */
  passingPercent: number;
  isDefaultTemplate: boolean;
  instructions: string;
  subjects: Record<Subject, { enabled: boolean; count: number; splitDifficulty: boolean; difficulty: Counts; topics: string[] }>;
  useDifficulty: boolean;
  difficulty: Counts;
  selection: { mode: "random" | "manual"; sources: SourceType[]; includeNumerical: boolean; manualQuestionIds: string[] };
  marking: { correct: number; incorrect: number; unanswered: number };
  settings: {
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    showTopic: boolean;
    resultRelease: "immediate" | "after_end" | "manual";
    allowAnswerReview: boolean;
    security: {
      fullscreen: boolean;
      tabSwitchWarnings: boolean;
      fullscreenExitWarnings: boolean;
      camera: boolean;
      microphone: boolean;
      soundMonitoring: boolean;
      soundThreshold: number;
      soundMinDurationMs: number;
      maxWarnings: number;
      terminateOnMaxWarnings: boolean;
      oneAttempt: boolean;
      autoFinalizeOnTimeout: boolean;
    };
  };
}

export const zero = (): Counts => ({ Easy: 0, Medium: 0, Hard: 0 });
export const sumCounts = (c: Counts) => c.Easy + c.Medium + c.Hard;

export function defaultWizardState(): WizardState {
  const start = new Date(Date.now() + 60 * 60_000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return {
    title: "",
    description: "",
    category: "Entrance Assessment",
    academicLevel: "",
    durationMinutes: 120,
    totalQuestions: 90,
    startDate: utcToZonedInput(start, UNIVERSITY_TIMEZONE),
    endDate: utcToZonedInput(end, UNIVERSITY_TIMEZONE),
    scheduleMode: "scheduled",
    accessValidityMinutes: 24 * 60,
    timezone: UNIVERSITY_TIMEZONE,
    hardEnd: false,
    passingMarks: 0,
    passingPercent: 0,
    isDefaultTemplate: false,
    instructions: "",
    subjects: {
      Physics: { enabled: true, count: 30, splitDifficulty: false, difficulty: zero(), topics: [] },
      Chemistry: { enabled: true, count: 30, splitDifficulty: false, difficulty: zero(), topics: [] },
      Mathematics: { enabled: true, count: 30, splitDifficulty: false, difficulty: zero(), topics: [] },
      "Quantitative Aptitude": { enabled: false, count: 0, splitDifficulty: false, difficulty: zero(), topics: [] },
      "Logical Reasoning": { enabled: false, count: 0, splitDifficulty: false, difficulty: zero(), topics: [] },
      "Verbal Ability": { enabled: false, count: 0, splitDifficulty: false, difficulty: zero(), topics: [] },
    },
    useDifficulty: false,
    difficulty: { Easy: 30, Medium: 40, Hard: 20 },
    selection: { mode: "random", sources: [], includeNumerical: false, manualQuestionIds: [] },
    marking: { correct: 4, incorrect: 1, unanswered: 0 },
    settings: {
      shuffleQuestions: true,
      shuffleOptions: false,
      showTopic: false,
      resultRelease: "immediate",
      allowAnswerReview: false,
      security: {
        fullscreen: true,
        tabSwitchWarnings: true,
        fullscreenExitWarnings: true,
        camera: false,
        microphone: false,
        soundMonitoring: false,
        soundThreshold: 60,
        soundMinDurationMs: 3000,
        maxWarnings: 3,
        terminateOnMaxWarnings: true,
        oneAttempt: true,
        autoFinalizeOnTimeout: true,
      },
    },
  };
}

export function toPayload(s: WizardState, templateId?: string | null) {
  const subjects = SUBJECTS.filter((x) => s.subjects[x].enabled && s.subjects[x].count > 0);
  const now = Date.now();
  const window =
    s.scheduleMode === "immediate"
      ? { startDate: new Date(now).toISOString(), endDate: new Date(now + Math.max(5, s.accessValidityMinutes) * 60_000).toISOString() }
      : { startDate: zonedInputToUtc(s.startDate, s.timezone), endDate: zonedInputToUtc(s.endDate, s.timezone) };
  return {
    ...(templateId ? { templateId } : {}),
    scheduleMode: s.scheduleMode,
    accessValidityMinutes: s.scheduleMode === "immediate" ? s.accessValidityMinutes : 0,
    timezone: s.timezone,
    hardEnd: s.hardEnd,
    title: s.title,
    description: s.description,
    category: s.category,
    academicLevel: s.academicLevel,
    durationMinutes: s.durationMinutes,
    totalQuestions: s.selection.mode === "manual" ? s.selection.manualQuestionIds.length : s.totalQuestions,
    ...window,
    passingMarks: s.passingMarks,
    instructions: s.instructions,
    subjectDistribution:
      s.selection.mode === "manual"
        ? []
        : subjects.map((x) => ({ subject: x, count: s.subjects[x].count, difficulty: s.subjects[x].splitDifficulty ? s.subjects[x].difficulty : null, topics: s.subjects[x].topics })),
    difficultyDistribution: s.selection.mode === "random" && s.useDifficulty ? s.difficulty : null,
    selection: s.selection,
    marking: s.marking,
    settings: { ...s.settings, resultsReleased: false },
  };
}


/* -------------------------------------------------------------------------- */
/*  Templates                                                                  */
/* -------------------------------------------------------------------------- */

export interface TemplateData {
  id: string;
  name: string;
  description: string;
  category: string;
  academicLevel: string;
  selectedSubjects: string[];
  totalQuestions: number;
  subjectDistribution: { subject: string; count: number; difficulty: Counts | null; topics: string[] }[];
  difficultyDistribution: Counts | null;
  questionSettings: { shuffleQuestions: boolean; shuffleOptions: boolean; showTopic: boolean; includeNumerical: boolean; sources: string[] };
  markingScheme: { correct: number; incorrect: number; unanswered: number; passingPercentage: number };
  duration: number;
  instructions: string;
  securitySettings: Partial<WizardState["settings"]["security"]>;
  resultSettings: { resultRelease: WizardState["settings"]["resultRelease"]; allowAnswerReview: boolean };
  schedulingDefaults: { startBehavior: "immediate" | "scheduled"; accessDurationMinutes: number; expiryPolicy: "allow_finish" | "hard_end"; timezone: string };
  isDefault: boolean;
  status: "active" | "archived";
  updatedAt?: string;
  examsCreated?: number;
  lastUsedAt?: string | null;
}

/** Template → wizard state. For exams, passing marks are derived from the template's percentage. */
export function templateToWizard(t: TemplateData, forExam: boolean): WizardState {
  const base = defaultWizardState();
  const subjects = Object.fromEntries(
    SUBJECTS.map((x) => {
      const d = t.subjectDistribution.find((y) => y.subject === x);
      return [x, { enabled: !!d && d.count > 0, count: d?.count ?? 0, splitDifficulty: !!d?.difficulty, difficulty: d?.difficulty ?? zero(), topics: d?.topics ?? [] }];
    }),
  ) as WizardState["subjects"];
  const sched = t.schedulingDefaults;
  const tz = sched?.timezone || UNIVERSITY_TIMEZONE;
  // Scheduled templates propose the next full hour as the start, for the template's access duration.
  const start = new Date(Date.now() + 60 * 60_000);
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + (sched?.accessDurationMinutes ?? 1440) * 60_000);
  const marking = { correct: t.markingScheme.correct, incorrect: t.markingScheme.incorrect, unanswered: t.markingScheme.unanswered };
  return {
    ...base,
    title: forExam ? t.name : t.name,
    description: t.description,
    category: t.category,
    academicLevel: t.academicLevel,
    durationMinutes: t.duration,
    totalQuestions: t.totalQuestions,
    startDate: utcToZonedInput(start, tz),
    endDate: utcToZonedInput(end, tz),
    scheduleMode: sched?.startBehavior ?? "immediate",
    accessValidityMinutes: sched?.accessDurationMinutes ?? 1440,
    timezone: tz,
    hardEnd: sched?.expiryPolicy === "hard_end",
    passingPercent: t.markingScheme.passingPercentage ?? 0,
    passingMarks: Math.round((t.totalQuestions * marking.correct * (t.markingScheme.passingPercentage ?? 0)) / 100),
    isDefaultTemplate: t.isDefault,
    instructions: t.instructions,
    subjects,
    useDifficulty: !!t.difficultyDistribution,
    difficulty: t.difficultyDistribution ?? base.difficulty,
    selection: { mode: "random", sources: (t.questionSettings?.sources ?? []) as SourceType[], includeNumerical: !!t.questionSettings?.includeNumerical, manualQuestionIds: [] },
    marking,
    settings: {
      shuffleQuestions: t.questionSettings?.shuffleQuestions ?? true,
      shuffleOptions: t.questionSettings?.shuffleOptions ?? false,
      showTopic: t.questionSettings?.showTopic ?? false,
      resultRelease: t.resultSettings?.resultRelease ?? "immediate",
      allowAnswerReview: !!t.resultSettings?.allowAnswerReview,
      security: { ...base.settings.security, ...(t.securitySettings ?? {}) },
    },
  };
}

export function wizardToTemplatePayload(s: WizardState) {
  const subjects = SUBJECTS.filter((x) => s.subjects[x].enabled && s.subjects[x].count > 0);
  return {
    name: s.title,
    description: s.description,
    category: s.category,
    academicLevel: s.academicLevel,
    totalQuestions: s.totalQuestions,
    subjectDistribution: subjects.map((x) => ({ subject: x, count: s.subjects[x].count, difficulty: s.subjects[x].splitDifficulty ? s.subjects[x].difficulty : null, topics: s.subjects[x].topics })),
    difficultyDistribution: s.useDifficulty ? s.difficulty : null,
    questionSettings: { shuffleQuestions: s.settings.shuffleQuestions, shuffleOptions: s.settings.shuffleOptions, showTopic: s.settings.showTopic, includeNumerical: s.selection.includeNumerical, sources: s.selection.sources },
    markingScheme: { ...s.marking, passingPercentage: s.passingPercent },
    duration: s.durationMinutes,
    instructions: s.instructions,
    securitySettings: s.settings.security,
    resultSettings: { resultRelease: s.settings.resultRelease, allowAnswerReview: s.settings.allowAnswerReview },
    schedulingDefaults: { startBehavior: s.scheduleMode, accessDurationMinutes: s.accessValidityMinutes, expiryPolicy: s.hardEnd ? "hard_end" : "allow_finish", timezone: s.timezone },
    isDefault: s.isDefaultTemplate,
  };
}

/** Example starting points offered when creating a template. Every value stays editable. */
export function exampleTemplate(kind: "pcm" | "aptitude" | "semester"): WizardState {
  const base = defaultWizardState();
  const off = Object.fromEntries(SUBJECTS.map((x) => [x, { enabled: false, count: 0, splitDifficulty: false, difficulty: zero(), topics: [] as string[] }])) as unknown as WizardState["subjects"];
  const on = (counts: Partial<Record<Subject, number>>) => {
    const out = { ...off };
    for (const [k, v] of Object.entries(counts)) out[k as Subject] = { enabled: true, count: v!, splitDifficulty: false, difficulty: zero(), topics: [] };
    return out;
  };
  const common = { ...base, scheduleMode: "immediate" as const, accessValidityMinutes: 24 * 60, passingPercent: 40 };
  if (kind === "pcm")
    return { ...common, title: "PCM Entrance Assessment", category: "Entrance Assessment", totalQuestions: 100, durationMinutes: 120, subjects: on({ Physics: 35, Chemistry: 35, Mathematics: 30 }), difficulty: { Easy: 30, Medium: 45, Hard: 25 } };
  if (kind === "aptitude")
    return { ...common, title: "Aptitude Assessment", category: "Aptitude Test", totalQuestions: 100, durationMinutes: 90, subjects: on({ "Quantitative Aptitude": 40, "Logical Reasoning": 35, "Verbal Ability": 25 }), difficulty: { Easy: 35, Medium: 45, Hard: 20 } };
  return { ...common, title: "Semester Assessment", category: "Semester Assessment", totalQuestions: 30, durationMinutes: 60, subjects: on({ Physics: 30 }), difficulty: { Easy: 10, Medium: 15, Hard: 5 } };
}
