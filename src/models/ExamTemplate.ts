import { Schema, type InferSchemaType, type Types } from "mongoose";
import { RESULT_RELEASE_MODES, SUBJECTS } from "@/lib/constants";
import { getModel } from "./_util";

const Counts = { Easy: { type: Number, default: 0 }, Medium: { type: Number, default: 0 }, Hard: { type: Number, default: 0 } };

/**
 * Reusable examination configuration. Stores settings only: never questions, attempts,
 * results, links or access codes. Exams created from a template keep their own snapshot.
 */
const ExamTemplateSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 2000 },
    category: { type: String, default: "Entrance Assessment", maxlength: 100 },
    academicLevel: { type: String, default: "", maxlength: 60 },
    selectedSubjects: { type: [{ type: String, enum: SUBJECTS }], default: [] },
    totalQuestions: { type: Number, required: true, min: 1, max: 500 },
    subjectDistribution: {
      type: [
        new Schema(
          {
            subject: { type: String, enum: SUBJECTS, required: true },
            count: { type: Number, required: true, min: 0, max: 500 },
            difficulty: { type: new Schema(Counts, { _id: false }), default: null },
            topics: { type: [String], default: [] },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    difficultyDistribution: { type: new Schema(Counts, { _id: false }), default: null },
    /** Subject → allowed topics; mirrors subjectDistribution[].topics for quick reading. */
    topicFilters: { type: Schema.Types.Mixed, default: {} },
    questionSettings: {
      shuffleQuestions: { type: Boolean, default: true },
      shuffleOptions: { type: Boolean, default: false },
      showTopic: { type: Boolean, default: false },
      includeNumerical: { type: Boolean, default: false },
      sources: { type: [String], default: [] },
    },
    markingScheme: {
      correct: { type: Number, default: 4 },
      incorrect: { type: Number, default: 1 },
      unanswered: { type: Number, default: 0 },
      passingPercentage: { type: Number, default: 0, min: 0, max: 100 },
    },
    duration: { type: Number, required: true, min: 1, max: 600 },
    instructions: { type: String, default: "", maxlength: 8000 },
    securitySettings: { type: Schema.Types.Mixed, default: {} },
    resultSettings: {
      resultRelease: { type: String, enum: RESULT_RELEASE_MODES, default: "immediate" },
      allowAnswerReview: { type: Boolean, default: false },
    },
    schedulingDefaults: {
      startBehavior: { type: String, enum: ["immediate", "scheduled"], default: "immediate" },
      accessDurationMinutes: { type: Number, default: 24 * 60, min: 5, max: 60 * 24 * 90 },
      expiryPolicy: { type: String, enum: ["allow_finish", "hard_end"], default: "allow_finish" },
      timezone: { type: String, default: "Asia/Kolkata" },
    },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    archivedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

ExamTemplateSchema.index({ status: 1, updatedAt: -1 });
ExamTemplateSchema.index({ isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

export type ExamTemplateDoc = InferSchemaType<typeof ExamTemplateSchema> & { _id: Types.ObjectId };
export const ExamTemplate = getModel("ExamTemplate", ExamTemplateSchema);
