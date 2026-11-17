import { Schema, type InferSchemaType, type Types } from "mongoose";
import { getModel } from "./_util";

/** A student's request to take an exam without camera / microphone / fullscreen requirements. */
const AccommodationSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, maxlength: 1000 },
    requestCamera: { type: Boolean, default: false },
    requestMicrophone: { type: Boolean, default: false },
    requestFullscreen: { type: Boolean, default: false },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    adminNote: { type: String, default: "", maxlength: 1000 },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
AccommodationSchema.index({ examId: 1, studentId: 1 }, { unique: true });
AccommodationSchema.index({ status: 1, createdAt: -1 });

export type AccommodationDoc = InferSchemaType<typeof AccommodationSchema> & { _id: Types.ObjectId };
export const Accommodation = getModel("Accommodation", AccommodationSchema);
