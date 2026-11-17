export interface MarkingScheme {
  correct: number;
  /** Penalty for a wrong answer, stored as a positive number (e.g. 1 for −1). */
  incorrect: number;
  unanswered: number;
}

export interface KeyedQuestion {
  id: string;
  subject: string;
  difficulty: string;
  questionType: string;
  correctOption: number | null;
  numericalAnswer: string | null;
  numericalTolerance?: number;
}

export interface SubmittedAnswer {
  selectedOption?: number | null;
  numericalValue?: string | null;
}

export interface QuestionOutcome {
  examQuestionId: string;
  subject: string;
  difficulty: string;
  selectedOption: number | null;
  numericalValue: string | null;
  isCorrect: boolean | null;
  marks: number;
}

export interface Evaluation {
  totalQuestions: number;
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  subjectScores: { subject: string; total: number; attempted: number; correct: number; incorrect: number; unanswered: number; score: number; maxScore: number }[];
  difficultyStats: { difficulty: string; total: number; attempted: number; correct: number }[];
  questionResults: QuestionOutcome[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function numericalEquals(given: string, expected: string, tolerance = 0) {
  const g = Number(given.trim());
  const e = Number(expected.trim());
  if (!Number.isFinite(g) || !Number.isFinite(e)) return false;
  return Math.abs(g - e) <= Math.max(tolerance, 1e-9);
}

/** Pure scoring function. Server-side only — the answer key never leaves the server before release. */
export function evaluate(questions: KeyedQuestion[], answers: Map<string, SubmittedAnswer> | Record<string, SubmittedAnswer>, marking: MarkingScheme, passingMarks: number): Evaluation {
  const get = (id: string): SubmittedAnswer | undefined => (answers instanceof Map ? answers.get(id) : answers[id]);
  const subjects = new Map<string, Evaluation["subjectScores"][number]>();
  const difficulties = new Map<string, Evaluation["difficultyStats"][number]>();
  const results: QuestionOutcome[] = [];
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  let score = 0;

  for (const q of questions) {
    const a = get(q.id);
    const selected = typeof a?.selectedOption === "number" ? a.selectedOption : null;
    const numerical = typeof a?.numericalValue === "string" && a.numericalValue.trim() !== "" ? a.numericalValue.trim() : null;
    const answered = q.questionType === "numerical" ? numerical !== null : selected !== null;

    let isCorrect: boolean | null = null;
    let marks = marking.unanswered;
    if (answered) {
      isCorrect =
        q.questionType === "numerical"
          ? q.numericalAnswer !== null && numericalEquals(numerical!, q.numericalAnswer, q.numericalTolerance)
          : q.correctOption !== null && selected === q.correctOption;
      marks = isCorrect ? marking.correct : -Math.abs(marking.incorrect);
    }
    if (!answered) unanswered++;
    else if (isCorrect) correct++;
    else incorrect++;
    score += marks;

    const s = subjects.get(q.subject) ?? { subject: q.subject, total: 0, attempted: 0, correct: 0, incorrect: 0, unanswered: 0, score: 0, maxScore: 0 };
    s.total++;
    s.maxScore += marking.correct;
    s.score = round2(s.score + marks);
    if (!answered) s.unanswered++;
    else {
      s.attempted++;
      if (isCorrect) s.correct++;
      else s.incorrect++;
    }
    subjects.set(q.subject, s);

    const d = difficulties.get(q.difficulty) ?? { difficulty: q.difficulty, total: 0, attempted: 0, correct: 0 };
    d.total++;
    if (answered) d.attempted++;
    if (isCorrect) d.correct++;
    difficulties.set(q.difficulty, d);

    results.push({ examQuestionId: q.id, subject: q.subject, difficulty: q.difficulty, selectedOption: selected, numericalValue: numerical, isCorrect, marks });
  }

  const maxScore = questions.length * marking.correct;
  const totalScore = round2(score);
  return {
    totalQuestions: questions.length,
    attemptedCount: correct + incorrect,
    correctCount: correct,
    incorrectCount: incorrect,
    unansweredCount: unanswered,
    totalScore,
    maxScore,
    percentage: maxScore > 0 ? round2((totalScore / maxScore) * 100) : 0,
    passed: totalScore >= passingMarks,
    subjectScores: [...subjects.values()],
    difficultyStats: [...difficulties.values()],
    questionResults: results,
  };
}
