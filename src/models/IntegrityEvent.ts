import { Schema, type InferSchemaType, type Types } from "mongoose";
import { INTEGRITY_EVENT_TYPES } from "@/lib/constants";
import { getModel } from "./_util";

const IntegrityEventSchema = new Schema(
  {
    attemptId: { type: Schema.Types.ObjectId, ref: "Attempt", required: true },
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    eventType: { type: String, enum: INTEGRITY_EVENT_TYPES, required: true },
    /** Client-generated id; a unique index makes event delivery idempotent. */
    clientEventId: { type: String, required: true },
    timestamp: { type: Date, required: true },
    receivedAt: { type: Date, default: Date.now },
    countedAsWarning: { type: Boolean, default: false },
    warningNumber: { type: Number, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    reviewStatus: { type: String, enum: ["pending", "informational", "reviewed", "dismissed", "flagged"], default: "pending" },
    reviewNote: { type: String, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

IntegrityEventSchema.index({ attemptId: 1, clientEventId: 1 }, { unique: true });
IntegrityEventSchema.index({ examId: 1, timestamp: -1 });
IntegrityEventSchema.index({ attemptId: 1, timestamp: 1 });

export type IntegrityEventDoc = InferSchemaType<typeof IntegrityEventSchema> & { _id: Types.ObjectId };
export const IntegrityEvent = getModel("IntegrityEvent", IntegrityEventSchema);
