import { Schema, type InferSchemaType, type Types } from "mongoose";
import { getModel } from "./_util";

const ResultSchema = new Schema(
  {
    attemptId: { type: Schema.Types.ObjectId, ref: "Attempt", required: true },
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    totalQuestions: { type: Number, required: true },
    attemptedCount: { type: Number, required: true },
    correctCount: { type: Number, required: true },
    incorrectCount: { type: Number, required: true },
    unansweredCount: { type: Number, required: true },
    subjectScores: {
      type: [
        {
          subject: String,
          total: Number,
          attempted: Number,
          correct: Number,
          incorrect: Number,
          unanswered: Number,
          score: Number,
          maxScore: Number,
          _id: false,
        },
      ],
      default: [],
    },
    difficultyStats: { type: [{ difficulty: String, total: Number, attempted: Number, correct: Number, _id: false }], default: [] },
    questionResults: {
      type: [
        {
          examQuestionId: Schema.Types.ObjectId,
          subject: String,
          difficulty: String,
          selectedOption: { type: Number, default: null },
          numericalValue: { type: String, default: null },
          isCorrect: { type: Boolean, default: null },
          marks: Number,
          _id: false,
        },
      ],
      default: [],
    },
    totalScore: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    percentage: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    finalizationReason: { type: String, default: null },
    /** Set when an Admin resets the attempt; superseded results are kept for audit but excluded from reports. */
    superseded: { type: Boolean, default: false },
    evaluatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

ResultSchema.index({ attemptId: 1 }, { unique: true });
ResultSchema.index({ examId: 1, superseded: 1, totalScore: -1 });
ResultSchema.index({ studentId: 1, createdAt: -1 });

export type ResultDoc = InferSchemaType<typeof ResultSchema> & { _id: Types.ObjectId };
export const Result = getModel("Result", ResultSchema);
