import { Schema, type InferSchemaType, type Types } from "mongoose";
import { RESULT_RELEASE_MODES } from "@/lib/constants";
import { getModel } from "./_util";

/**
 * Saved defaults used by "Quick Generate". Exams copy these values when they are created
 * (and keep a snapshot), so editing the defaults never changes existing exams.
 */
const PresetSchema = new Schema(
  {
    name: { type: String, required: true, maxlength: 80 },
    /** Exact subject counts for this combination of subjects (they must add up to the preset total). */
    counts: { type: Map, of: Number, required: true },
  },
  { _id: false },
);

const ExamDefaultConfigurationSchema = new Schema(
  {
    name: { type: String, default: "Default examination settings", maxlength: 120 },
    examCategory: { type: String, default: "Entrance Assessment", maxlength: 100 },
    /** e.g. "SGSU {subjects} Assessment"; {subjects} and {date} are filled in automatically. */
    titlePattern: { type: String, default: "SGSU {subjects} Assessment", maxlength: 200 },
    totalQuestions: { type: Number, default: 100, min: 1, max: 500 },
    durationMinutes: { type: Number, default: 120, min: 1, max: 600 },
    /** Percentages; they must add up to 100. */
    difficultyPercent: {
      Easy: { type: Number, default: 30, min: 0, max: 100 },
      Medium: { type: Number, default: 45, min: 0, max: 100 },
      Hard: { type: Number, default: 25, min: 0, max: 100 },
    },
    presets: { type: [PresetSchema], default: [] },
    marking: {
      correct: { type: Number, default: 4 },
      incorrect: { type: Number, default: 1 },
      unanswered: { type: Number, default: 0 },
    },
    passingPercentage: { type: Number, default: 40, min: 0, max: 100 },
    shuffleQuestions: { type: Boolean, default: true },
    shuffleOptions: { type: Boolean, default: true },
    includeNumerical: { type: Boolean, default: false },
    security: {
      oneAttempt: { type: Boolean, default: true },
      fullscreen: { type: Boolean, default: true },
      tabSwitchWarnings: { type: Boolean, default: true },
      fullscreenExitWarnings: { type: Boolean, default: true },
      maxWarnings: { type: Number, default: 3, min: 1, max: 20 },
      terminateOnMaxWarnings: { type: Boolean, default: true },
      camera: { type: Boolean, default: false },
      microphone: { type: Boolean, default: false },
      soundMonitoring: { type: Boolean, default: false },
    },
    resultRelease: { type: String, enum: RESULT_RELEASE_MODES, default: "immediate" },
    allowAnswerReview: { type: Boolean, default: false },
    defaultValidityDays: { type: Number, default: 7, min: 1, max: 365 },
    isDefault: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
ExamDefaultConfigurationSchema.index({ isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

export type ExamDefaultConfigurationDoc = InferSchemaType<typeof ExamDefaultConfigurationSchema> & { _id: Types.ObjectId };
export const ExamDefaultConfiguration = getModel("ExamDefaultConfiguration", ExamDefaultConfigurationSchema);
