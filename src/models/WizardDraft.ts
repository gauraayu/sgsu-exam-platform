import { Schema, type InferSchemaType, type Types } from "mongoose";
import { getModel } from "./_util";

/**
 * Auto-saved, not-yet-created exam from the Create Examination wizard. One per admin:
 * the wizard saves it as the admin types and offers to resume it on the next visit.
 */
const WizardDraftSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    step: { type: Number, default: 0, min: 0, max: 10 },
    state: { type: Schema.Types.Mixed, required: true },
    title: { type: String, default: "", maxlength: 200 },
  },
  { timestamps: true },
);
WizardDraftSchema.index({ adminId: 1 }, { unique: true });

export type WizardDraftDoc = InferSchemaType<typeof WizardDraftSchema> & { _id: Types.ObjectId };
export const WizardDraft = getModel("WizardDraft", WizardDraftSchema);
