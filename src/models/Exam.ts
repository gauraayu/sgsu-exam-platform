import { Schema, type InferSchemaType, type Types } from "mongoose";
import { EXAM_STATUSES, RESULT_RELEASE_MODES, SOURCE_TYPES } from "@/lib/constants";
import { getModel } from "./_util";

const DifficultyCountSchema = new Schema({ Easy: { type: Number, default: 0 }, Medium: { type: Number, default: 0 }, Hard: { type: Number, default: 0 } }, { _id: false });

const SubjectDistributionSchema = new Schema(
  {
    subject: { type: String, required: true },
    count: { type: Number, required: true, min: 0 },
    /** Optional subject-specific difficulty split. When set, it must sum to `count`. */
    difficulty: { type: DifficultyCountSchema, default: null },
    topics: { type: [String], default: [] },
  },
  { _id: false },
);

const SecuritySchema = new Schema(
  {
    fullscreen: { type: Boolean, default: true },
    tabSwitchWarnings: { type: Boolean, default: true },
    fullscreenExitWarnings: { type: Boolean, default: true },
    camera: { type: Boolean, default: false },
    microphone: { type: Boolean, default: false },
    soundMonitoring: { type: Boolean, default: false },
    /** Relative level 0–100 computed from browser audio amplitude (not calibrated decibels). */
    soundThreshold: { type: Number, default: 60, min: 1, max: 100 },
    soundMinDurationMs: { type: Number, default: 3000, min: 500, max: 60000 },
    maxWarnings: { type: Number, default: 3, min: 1, max: 20 },
    terminateOnMaxWarnings: { type: Boolean, default: true },
    oneAttempt: { type: Boolean, default: true },
    autoFinalizeOnTimeout: { type: Boolean, default: true },
  },
  { _id: false },
);

const ExamSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 4000 },
    category: { type: String, default: "Entrance Assessment", maxlength: 100 },
    academicLevel: { type: String, default: "", maxlength: 60 },
    durationMinutes: { type: Number, required: true, min: 1, max: 600 },
    totalQuestions: { type: Number, required: true, min: 1, max: 500 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    instructions: { type: String, default: "", maxlength: 8000 },
    subjectDistribution: { type: [SubjectDistributionSchema], default: [] },
    difficultyDistribution: { type: DifficultyCountSchema, default: null },
    selection: {
      mode: { type: String, enum: ["random", "manual"], default: "random" },
      sources: { type: [String], enum: SOURCE_TYPES, default: [] },
      includeNumerical: { type: Boolean, default: false },
      manualQuestionIds: { type: [Schema.Types.ObjectId], default: [] },
    },
    marking: {
      correct: { type: Number, default: 4 },
      incorrect: { type: Number, default: 1 },
      unanswered: { type: Number, default: 0 },
    },
    totalMarks: { type: Number, default: 0 },
    passingMarks: { type: Number, default: 0 },
    settings: {
      shuffleQuestions: { type: Boolean, default: true },
      shuffleOptions: { type: Boolean, default: false },
      showTopic: { type: Boolean, default: false },
      resultRelease: { type: String, enum: RESULT_RELEASE_MODES, default: "immediate" },
      resultsReleased: { type: Boolean, default: false },
      allowAnswerReview: { type: Boolean, default: false },
      security: { type: SecuritySchema, default: () => ({}) },
    },
    shareToken: { type: String },
    /** Human-readable access code (e.g. SGSU-7K92QF), created at publish and never changed afterwards. */
    accessCode: { type: String },
    /** How the exam was created: "quick" (from saved defaults) or "custom" (the full wizard). */
    generationMode: { type: String, enum: ["quick", "custom"], default: "custom" },
    selectedSubjects: { type: [String], default: [] },
    defaultConfigurationId: { type: Schema.Types.ObjectId, ref: "ExamDefaultConfiguration", default: null },
    /** Copy of the default settings applied by Quick Generate, kept for reference. */
    appliedConfigurationSnapshot: { type: Schema.Types.Mixed, default: null },
    /** Scheduling. Times are stored in UTC; `timezone` is how they are entered and displayed. */
    timezone: { type: String, default: "Asia/Kolkata", maxlength: 60 },
    /** "immediate": the window opens at publication and lasts `accessValidityMinutes`. */
    scheduleMode: { type: String, enum: ["immediate", "scheduled"], default: "scheduled" },
    accessValidityMinutes: { type: Number, default: 0, min: 0, max: 60 * 24 * 90 },
    /** When set, running attempts end at this time even if their own duration has not elapsed. */
    hardEndAt: { type: Date, default: null },
    templateId: { type: Schema.Types.ObjectId, ref: "ExamTemplate", default: null },
    /** Copy of the template's settings as they were when this exam was created. Never updated afterwards. */
    appliedTemplateSnapshot: { type: Schema.Types.Mixed, default: null },
    /** Publication status (draft / published / closed / archived). Scheduled, Active and Expired are derived from the window. */
    status: { type: String, enum: EXAM_STATUSES, default: "draft" },
    /** Incremented each time a draft paper is regenerated. Frozen at publish. */
    version: { type: Number, default: 0 },
    generatedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    duplicatedFrom: { type: Schema.Types.ObjectId, ref: "Exam", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

ExamSchema.index({ shareToken: 1 }, { unique: true, partialFilterExpression: { shareToken: { $type: "string" } } });
ExamSchema.index({ accessCode: 1 }, { unique: true, partialFilterExpression: { accessCode: { $type: "string" } } });
ExamSchema.index({ status: 1, createdAt: -1 });
ExamSchema.index({ status: 1, startDate: 1, endDate: 1 });
ExamSchema.index({ templateId: 1 }, { partialFilterExpression: { templateId: { $type: "objectId" } } });

export type ExamDoc = InferSchemaType<typeof ExamSchema> & { _id: Types.ObjectId };
export const Exam = getModel("Exam", ExamSchema);
