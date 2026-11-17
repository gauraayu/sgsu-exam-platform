import "server-only";
import { Types } from "mongoose";
import { Exam, ExamTemplate, audit } from "@/models";
import type { ExamTemplateDoc } from "@/models/ExamTemplate";
import { AppError, badRequest, notFound } from "@/lib/errors";
import { SUBJECTS } from "@/lib/constants";
import type { ExamTemplateInput } from "@/lib/validation/exam-templates";

function toDoc(input: ExamTemplateInput) {
  const order = (s: string) => SUBJECTS.indexOf(s as (typeof SUBJECTS)[number]);
  const subjectDistribution = [...input.subjectDistribution].filter((s) => s.count > 0).sort((a, b) => order(a.subject) - order(b.subject));
  return {
    ...input,
    subjectDistribution,
    selectedSubjects: subjectDistribution.map((s) => s.subject),
    topicFilters: Object.fromEntries(subjectDistribution.filter((s) => s.topics.length).map((s) => [s.subject, s.topics])),
  };
}

/** Plain JSON view used by the API and by exam snapshots. */
export function serializeTemplate(t: ExamTemplateDoc & { createdAt?: Date; updatedAt?: Date }) {
  return {
    id: String(t._id),
    name: t.name,
    description: t.description,
    category: t.category,
    academicLevel: t.academicLevel,
    selectedSubjects: t.selectedSubjects,
    totalQuestions: t.totalQuestions,
    subjectDistribution: (t.subjectDistribution ?? []).map((s) => ({ subject: s.subject, count: s.count, difficulty: s.difficulty ? { Easy: s.difficulty.Easy, Medium: s.difficulty.Medium, Hard: s.difficulty.Hard } : null, topics: [...(s.topics ?? [])] })),
    difficultyDistribution: t.difficultyDistribution ? { Easy: t.difficultyDistribution.Easy, Medium: t.difficultyDistribution.Medium, Hard: t.difficultyDistribution.Hard } : null,
    topicFilters: t.topicFilters ?? {},
    questionSettings: t.questionSettings,
    markingScheme: t.markingScheme,
    duration: t.duration,
    instructions: t.instructions,
    securitySettings: t.securitySettings ?? {},
    resultSettings: t.resultSettings,
    schedulingDefaults: t.schedulingDefaults,
    isDefault: t.isDefault,
    status: t.status,
    archivedAt: t.archivedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
export type SerializedTemplate = ReturnType<typeof serializeTemplate>;

/** Frozen copy stored on an exam created from this template. */
export function templateSnapshot(t: ExamTemplateDoc & { updatedAt?: Date }) {
  const s = serializeTemplate(t);
  return JSON.parse(JSON.stringify({ ...s, snapshotAt: new Date() }));
}

export async function listTemplates(status: "active" | "archived" | "all" = "active") {
  const filter = status === "all" ? {} : { status };
  const items = await ExamTemplate.find(filter).sort({ isDefault: -1, updatedAt: -1 }).lean<(ExamTemplateDoc & { createdAt: Date; updatedAt: Date })[]>();
  const usage = await Exam.aggregate<{ _id: Types.ObjectId; n: number; last: Date }>([
    { $match: { templateId: { $in: items.map((i) => i._id) } } },
    { $group: { _id: "$templateId", n: { $sum: 1 }, last: { $max: "$createdAt" } } },
  ]);
  const byId = new Map(usage.map((u) => [String(u._id), u]));
  return items.map((t) => ({ ...serializeTemplate(t), examsCreated: byId.get(String(t._id))?.n ?? 0, lastUsedAt: byId.get(String(t._id))?.last ?? null }));
}

export async function getTemplate(id: string) {
  if (!Types.ObjectId.isValid(id)) throw notFound("Template");
  const t = await ExamTemplate.findById(id).lean<ExamTemplateDoc & { createdAt: Date; updatedAt: Date }>();
  if (!t) throw notFound("Template");
  return serializeTemplate(t);
}

async function clearOtherDefaults(exceptId?: Types.ObjectId) {
  await ExamTemplate.updateMany({ isDefault: true, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }, { $set: { isDefault: false } });
}

export async function createTemplate(input: ExamTemplateInput, adminId: string) {
  if (input.isDefault) await clearOtherDefaults();
  const t = await ExamTemplate.create({ ...toDoc(input), createdBy: adminId, updatedBy: adminId, status: "active" });
  await audit(adminId, "template.create", "ExamTemplate", String(t._id), { name: t.name });
  return getTemplate(String(t._id));
}

export async function updateTemplate(id: string, input: ExamTemplateInput, adminId: string) {
  const t = await ExamTemplate.findById(id);
  if (!t) throw notFound("Template");
  if (t.status === "archived") throw new AppError("CONFLICT", "Restore this template before editing it.");
  if (input.isDefault) await clearOtherDefaults(t._id);
  t.set({ ...toDoc(input), updatedBy: adminId });
  await t.save();
  await audit(adminId, "template.update", "ExamTemplate", id);
  return getTemplate(id);
}

export async function duplicateTemplate(id: string, adminId: string) {
  const src = await ExamTemplate.findById(id).lean<ExamTemplateDoc>();
  if (!src) throw notFound("Template");
  const { _id, createdAt, updatedAt, ...rest } = src as ExamTemplateDoc & { createdAt: Date; updatedAt: Date; __v?: number };
  void createdAt;
  void updatedAt;
  delete (rest as { __v?: number }).__v;
  const copy = await ExamTemplate.create({ ...rest, name: `${src.name} (Copy)`.slice(0, 120), isDefault: false, status: "active", archivedAt: null, createdBy: adminId, updatedBy: adminId });
  await audit(adminId, "template.duplicate", "ExamTemplate", String(copy._id), { from: String(_id) });
  return getTemplate(String(copy._id));
}

export async function setTemplateStatus(id: string, status: "active" | "archived", adminId: string) {
  const t = await ExamTemplate.findById(id);
  if (!t) throw notFound("Template");
  t.status = status;
  t.archivedAt = status === "archived" ? new Date() : null;
  if (status === "archived") t.isDefault = false;
  await t.save();
  await audit(adminId, status === "archived" ? "template.archive" : "template.restore", "ExamTemplate", id);
  return getTemplate(id);
}

export async function setDefaultTemplate(id: string, adminId: string) {
  const t = await ExamTemplate.findById(id);
  if (!t) throw notFound("Template");
  if (t.status !== "active") throw badRequest("Archived templates cannot be the default.");
  await clearOtherDefaults(t._id);
  t.isDefault = true;
  await t.save();
  await audit(adminId, "template.set_default", "ExamTemplate", id);
  return getTemplate(id);
}
