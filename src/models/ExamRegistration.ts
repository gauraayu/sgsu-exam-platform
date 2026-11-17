import { Schema } from "mongoose";
import { getModel } from "./_util";

/** Records that a signed-in student opened an exam link (used for "registered participants"). */
const ExamRegistrationSchema = new Schema(
  {
    examId: { type: Schema.Types.ObjectId, ref: "Exam", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    firstVisitedAt: { type: Date, default: Date.now },
    lastVisitedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
ExamRegistrationSchema.index({ examId: 1, studentId: 1 }, { unique: true });
export const ExamRegistration = getModel("ExamRegistration", ExamRegistrationSchema);

export async function registerExamVisit(examId: unknown, studentId: unknown) {
  await ExamRegistration.updateOne(
    { examId, studentId },
    { $set: { lastVisitedAt: new Date() }, $setOnInsert: { firstVisitedAt: new Date() } },
    { upsert: true },
  ).catch((err) => {
    if ((err as { code?: number }).code !== 11000) throw err;
  });
}
