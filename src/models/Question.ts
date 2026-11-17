import { Schema, type InferSchemaType, type Types } from "mongoose";
import { ASSET_STATUSES, DIFFICULTY_VALUES, QUESTION_TYPES, SOURCE_TYPES, VERIFICATION_STATUSES } from "@/lib/constants";
import { getModel } from "./_util";

const QuestionSchema = new Schema(
  {
    originalQuestionId: { type: String, default: "" },
    subject: { type: String, required: true },
    chapter: { type: String, default: "" },
    topic: { type: String, default: "" },
    subtopic: { type: String, default: "" },
    academicLevel: { type: String, default: "" },
    difficulty: { type: String, enum: DIFFICULTY_VALUES, default: "Unclassified" },
    originalDifficulty: { type: String, default: "" },
    questionType: { type: String, enum: QUESTION_TYPES, required: true },
    questionText: { type: String, required: true },
    options: { type: [String], default: [] },
    /** 1-based index of the correct option for single-correct MCQs. */
    correctOption: { type: Number, default: null },
    numericalAnswer: { type: String, default: null },
    numericalTolerance: { type: Number, default: 0 },
    explanation: { type: String, default: "" },
    questionImages: { type: [String], default: [] },
    solutionImages: { type: [String], default: [] },
    sourceType: { type: String, enum: SOURCE_TYPES, required: true },
    sourceFile: { type: String, default: "" },
    sourceKey: { type: String, default: "" },
    originalSource: { type: String, default: "" },
    sourceExam: { type: String, default: "" },
    sourceLicense: { type: String, default: "" },
    contentHash: { type: String, required: true },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: "pending" },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "" },
    assetStatus: { type: String, enum: ASSET_STATUSES, default: "none" },
    missingAssets: { type: [String], default: [] },
    issues: { type: [String], default: [] },
    /** Provenance of reviewer changes, e.g. "Answer key solved by AI reviewer (Claude)". */
    curationNotes: { type: [String], default: [] },
    importBatchId: { type: Schema.Types.ObjectId, ref: "ImportBatch", default: null },
    archived: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

QuestionSchema.index({ contentHash: 1 }, { unique: true });
QuestionSchema.index({ sourceKey: 1 }, { partialFilterExpression: { sourceKey: { $gt: "" } } });
// Exam generator: eligible questions per subject/difficulty.
QuestionSchema.index({ archived: 1, verificationStatus: 1, subject: 1, difficulty: 1, questionType: 1, assetStatus: 1 });
QuestionSchema.index({ archived: 1, subject: 1, topic: 1 });
QuestionSchema.index({ archived: 1, sourceType: 1 });
QuestionSchema.index({ archived: 1, createdAt: -1 });
QuestionSchema.index({ originalQuestionId: 1 });

export type QuestionDoc = InferSchemaType<typeof QuestionSchema> & { _id: Types.ObjectId };
export const Question = getModel("Question", QuestionSchema);
