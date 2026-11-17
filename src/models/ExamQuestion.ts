import { Schema, type InferSchemaType, type Types } from "mongoose";
import { getModel } from "./_util";

/**
 * A frozen copy of a question as it appears in a specific exam version.
 * The student-facing snapshot and the answer key are stored separately so that
 * student APIs can project the snapshot without ever loading the key.
 */
const ExamQuestionSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    examVersion: { type: Number, required: true },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    displayOrder: { type: Number, required: true },
    questionSnapshot: {
      subject: String,
      topic: String,
      subtopic: String,
      difficulty: String,
      questionType: String,
      questionText: String,
      options: [String],
      questionImages: [String],
      originalQuestionId: String,
    },
    answerKeySnapshot: {
      correctOption: { type: Number, default: null },
      numericalAnswer: { type: String, default: null },
      numericalTolerance: { type: Number, default: 0 },
      explanation: { type: String, default: "" },
      solutionImages: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

ExamQuestionSchema.index({ examId: 1, examVersion: 1, questionId: 1 }, { unique: true });
ExamQuestionSchema.index({ examId: 1, examVersion: 1, displayOrder: 1 });

export type ExamQuestionDoc = InferSchemaType<typeof ExamQuestionSchema> & { _id: Types.ObjectId };
export const ExamQuestion = getModel("ExamQuestion", ExamQuestionSchema);
