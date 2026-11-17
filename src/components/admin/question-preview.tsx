"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuestionContent, OPTION_LETTERS } from "@/components/question/question-content";
import { MathText } from "@/components/question/math-text";

/** Full question render for Admins (includes the answer key). */
export function QuestionPreview({
  questionText,
  questionImages,
  options,
  questionType,
  correctOption,
  numericalAnswer,
  explanation,
  solutionImages,
  showAnswer = true,
}: {
  questionText: string;
  questionImages: string[];
  options: string[];
  questionType: string;
  correctOption: number | null;
  numericalAnswer: string | null;
  explanation?: string;
  solutionImages?: string[];
  showAnswer?: boolean;
}) {
  return (
    <div className="space-y-3">
      <QuestionContent text={questionText} images={questionImages} />
      {questionType === "single_correct" ? (
        <ul className="space-y-1.5">
          {options.map((o, i) => {
            const correct = showAnswer && correctOption === i + 1;
            return (
              <li key={i} className={cn("flex items-start gap-2 rounded-md border px-3 py-2 text-sm", correct && "border-success/50 bg-success-soft")}>
                <span className="font-semibold text-muted-foreground">{OPTION_LETTERS[i]}.</span>
                {o ? <MathText text={o} className="flex-1" /> : <span className="flex-1 italic text-danger">Empty option</span>}
                {correct && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Correct answer" />}
              </li>
            );
          })}
        </ul>
      ) : (
        showAnswer && <p className="text-sm">Numerical answer: <span className="font-mono font-semibold">{numericalAnswer ?? "—"}</span></p>
      )}
      {showAnswer && (explanation || (solutionImages?.length ?? 0) > 0) && (
        <div className="rounded-md bg-subtle p-3">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Solution</p>
          <QuestionContent text={explanation ?? ""} images={solutionImages ?? []} className="text-sm" label="Solution figure" />
        </div>
      )}
    </div>
  );
}
