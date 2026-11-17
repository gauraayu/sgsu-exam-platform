import { Schema, type InferSchemaType, type Types } from "mongoose";
import { ATTEMPT_STATUSES, FINALIZATION_REASONS } from "@/lib/constants";
import { getModel } from "./_util";

const AnswerSchema = new Schema(
  {
    selectedOption: { type: Number, default: null },
    numericalValue: { type: String, default: null },
    markedForReview: { type: Boolean, default: false },
    visited: { type: Boolean, default: true },
    savedAt: { type: Date, default: Date.now },
    /** Client mutation sequence of the change that produced this value. Older sequences are ignored. */
    seq: { type: Number, default: 0 },
  },
  { _id: false },
);

const AttemptSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    examVersion: { type: Number, required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    startedAt: { type: Date, required: true },
    deadlineAt: { type: Date, required: true },
    submittedAt: { type: Date, default: null },
    evaluatingSince: { type: Date, default: null },
    status: { type: String, enum: ATTEMPT_STATUSES, default: "in_progress" },
    /** Only one current attempt per (exam, student). Admin resets flip the old one to false. */
    isCurrent: { type: Boolean, default: true },
    /** Keyed by ExamQuestion id. */
    answers: { type: Map, of: AnswerSchema, default: () => new Map() },
    questionOrder: {
      type: [{ examQuestionId: { type: Schema.Types.ObjectId, required: true }, optionOrder: { type: [Number], default: [] }, _id: false }],
      default: [],
    },
    /** Incremented on every accepted answer write (optimistic concurrency for answer saves). */
    serverRevision: { type: Number, default: 0 },
    lastSavedAt: { type: Date, default: null },
    warningCount: { type: Number, default: 0 },
    lastWarningAt: { type: Date, default: null },
    finalizationReason: { type: String, enum: [...FINALIZATION_REASONS, null], default: null },
    lastActivityAt: { type: Date, default: Date.now },
    userAgent: { type: String, default: "" },
    resetBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    resetAt: { type: Date, default: null },
    resetReason: { type: String, default: "" },
  },
  { timestamps: true },
);

AttemptSchema.index({ examId: 1, studentId: 1 }, { unique: true, partialFilterExpression: { isCurrent: true } });
AttemptSchema.index({ studentId: 1, createdAt: -1 });
AttemptSchema.index({ examId: 1, status: 1 });
AttemptSchema.index({ status: 1, deadlineAt: 1 });

export type AttemptDoc = InferSchemaType<typeof AttemptSchema> & { _id: Types.ObjectId };
export const Attempt = getModel("Attempt", AttemptSchema);
