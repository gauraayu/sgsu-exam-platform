import { Schema } from "mongoose";
import { getModel } from "./_util";

const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: String, default: "" },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);
AuditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
AuditLogSchema.index({ createdAt: -1 });

export const AuditLog = getModel("AuditLog", AuditLogSchema);

export async function audit(actorId: unknown, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) {
  await AuditLog.create({ actorId, action, targetType, targetId, details });
}
