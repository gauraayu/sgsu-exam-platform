import { Schema, type InferSchemaType, type Types } from "mongoose";
import { SOURCE_TYPES } from "@/lib/constants";
import { getModel } from "./_util";

const ImportBatchSchema = new Schema(
  {
    sourceType: { type: String, enum: SOURCE_TYPES, required: true },
    filename: { type: String, default: "" },
    files: { type: [String], default: [] },
    sourceUrl: { type: String, default: "" },
    importedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    totalRecords: { type: Number, default: 0 },
    validRecords: { type: Number, default: 0 },
    rejectedRecords: { type: Number, default: 0 },
    duplicateRecords: { type: Number, default: 0 },
    alreadyImported: { type: Number, default: 0 },
    updatedCount: { type: Number, default: 0 },
    importedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    mcqCount: { type: Number, default: 0 },
    numericalCount: { type: Number, default: 0 },
    missingAnswerKeys: { type: Number, default: 0 },
    missingImages: { type: Number, default: 0 },
    pendingReview: { type: Number, default: 0 },
    mapping: { type: Schema.Types.Mixed, default: null },
    errorSamples: { type: [{ file: String, line: Number, message: String, _id: false }], default: [] },
    status: { type: String, enum: ["completed", "partial", "failed"], default: "completed" },
  },
  { timestamps: true },
);
ImportBatchSchema.index({ createdAt: -1 });

export type ImportBatchDoc = InferSchemaType<typeof ImportBatchSchema> & { _id: Types.ObjectId };
export const ImportBatch = getModel("ImportBatch", ImportBatchSchema);
