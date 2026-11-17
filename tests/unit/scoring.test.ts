import { describe, expect, it } from "vitest";
import { evaluate, type KeyedQuestion } from "@/lib/exam/scoring";

const subjects = ["Physics", "Chemistry", "Mathematics"];
const questions: KeyedQuestion[] = Array.from({ length: 100 }, (_, i) => ({
  id: `q${i}`,
  subject: subjects[i % 3],
  difficulty: ["Easy", "Medium", "Hard"][i % 3],
  questionType: "single_correct",
  correctOption: (i % 4) + 1,
  numericalAnswer: null,
}));

describe("evaluate", () => {
  it("scores 70 correct, 20 incorrect, 10 unanswered as 260/400 with +4/−1", () => {
    const answers: Record<string, { selectedOption: number | null }> = {};
    questions.forEach((q, i) => {
      if (i < 70) answers[q.id] = { selectedOption: q.correctOption };
      else if (i < 90) answers[q.id] = { selectedOption: (q.correctOption! % 4) + 1 };
    });
    const r = evaluate(questions, answers, { correct: 4, incorrect: 1, unanswered: 0 }, 160);
    expect(r).toMatchObject({ correctCount: 70, incorrectCount: 20, unansweredCount: 10, attemptedCount: 90, totalScore: 260, maxScore: 400, percentage: 65, passed: true });
    expect(r.subjectScores.reduce((a, s) => a + s.score, 0)).toBe(260);
    expect(r.subjectScores.reduce((a, s) => a + s.total, 0)).toBe(100);
  });

  it("supports no negative marking and fails below passing marks", () => {
    const answers = { q0: { selectedOption: 2 } }; // wrong (correct is 1)
    const r = evaluate(questions.slice(0, 1), answers, { correct: 4, incorrect: 0, unanswered: 0 }, 1);
    expect(r.totalScore).toBe(0);
    expect(r.passed).toBe(false);
  });

  it("evaluates numerical answers with tolerance", () => {
    const q: KeyedQuestion[] = [
      { id: "n1", subject: "Physics", difficulty: "Medium", questionType: "numerical", correctOption: null, numericalAnswer: "2.5", numericalTolerance: 0.01 },
      { id: "n2", subject: "Physics", difficulty: "Medium", questionType: "numerical", correctOption: null, numericalAnswer: "7" },
    ];
    const r = evaluate(q, { n1: { numericalValue: "2.505" }, n2: { numericalValue: "07" } }, { correct: 4, incorrect: 1, unanswered: 0 }, 0);
    expect(r.correctCount).toBe(2);
  });

  it("treats empty numerical input as unanswered", () => {
    const q: KeyedQuestion[] = [{ id: "n", subject: "Physics", difficulty: "Easy", questionType: "numerical", correctOption: null, numericalAnswer: "1" }];
    expect(evaluate(q, { n: { numericalValue: "  " } }, { correct: 4, incorrect: 1, unanswered: 0 }, 0).unansweredCount).toBe(1);
  });
});
