import { Schema, type InferSchemaType } from "mongoose";
import { getModel } from "./_util";

const SessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String, default: "" },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
SessionSchema.index({ tokenHash: 1 }, { unique: true });
SessionSchema.index({ userId: 1 });
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = InferSchemaType<typeof SessionSchema>;
export const Session = getModel("Session", SessionSchema);

const PasswordResetSchema = new Schema(
  {
    tokenHash: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);
PasswordResetSchema.index({ tokenHash: 1 }, { unique: true });
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const PasswordResetToken = getModel("PasswordResetToken", PasswordResetSchema);

const ThrottleSchema = new Schema({
  key: { type: String, required: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
ThrottleSchema.index({ key: 1 }, { unique: true });
ThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Throttle = getModel("Throttle", ThrottleSchema);
