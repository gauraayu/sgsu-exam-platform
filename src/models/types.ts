import type { Types } from "mongoose";

/** Explicit shapes for array sub-documents (Mongoose infers these as `any` on lean results). */
export interface QuestionOrderItem {
  examQuestionId: Types.ObjectId;
  optionOrder: number[];
}
export interface QuestionResultItem {
  examQuestionId: Types.ObjectId;
  subject: string;
  difficulty: string;
  selectedOption: number | null;
  numericalValue: string | null;
  isCorrect: boolean | null;
  marks: number;
}
export interface SubjectDistributionItem {
  subject: string;
  count: number;
  difficulty?: { Easy: number; Medium: number; Hard: number } | null;
  topics?: string[];
}
