import { Schema, type InferSchemaType, type Types } from "mongoose";
import { ROLES } from "@/lib/constants";
import { getModel } from "./_util";

const UserSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    mobile: { type: String, trim: true, maxlength: 20, default: "" },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: "STUDENT" },
    studentId: { type: String },
    academicLevel: { type: String, trim: true, maxlength: 60, default: "" },
    institutionName: { type: String, trim: true, maxlength: 200, default: "" },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    lastLoginAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: null },
  },
  { timestamps: true },
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ studentId: 1 }, { unique: true, partialFilterExpression: { studentId: { $type: "string" } } });
UserSchema.index({ role: 1, createdAt: -1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Types.ObjectId };
export const User = getModel("User", UserSchema);
