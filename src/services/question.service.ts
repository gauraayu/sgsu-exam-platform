import "server-only";
import { Types, type QueryFilter } from "mongoose";
import { Question, audit } from "@/models";
import type { QuestionDoc } from "@/models/Question";
import { imageExists } from "@/lib/assets";
import { revalidate } from "@/lib/dataset/normalize";
import { AppError, badRequest, notFound } from "@/lib/errors";
import { escapeRegex } from "@/lib/api";
import { QUESTION_ISSUES, SUBJECTS, type QuestionIssue } from "@/lib/constants";
import type { QuestionEditable, QuestionListQuery } from "@/lib/validation/questions";

export function buildQuestionFilter(q: Partial<QuestionListQuery>): QueryFilter<QuestionDoc> {
  const filter: QueryFilter<QuestionDoc> = { archived: q.archived === "true" };
  if (q.subject?.length) filter.subject = { $in: q.subject };
  if (q.difficulty?.length) filter.difficulty = { $in: q.difficulty };
  if (q.questionType?.length) filter.questionType = { $in: q.questionType };
  if (q.sourceType?.length) filter.sourceType = { $in: q.sourceType };
  if (q.verificationStatus?.length) filter.verificationStatus = { $in: q.verificationStatus };
  if (q.assetStatus?.length) filter.assetStatus = { $in: q.assetStatus };
  if (q.topic) filter.topic = q.topic;
  if (q.hasIssues === "true") filter["issues.0"] = { $exists: true };
  if (q.hasIssues === "false") filter.issues = { $size: 0 };
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    filter.$or = [{ questionText: rx }, { originalQuestionId: rx }, { topic: rx }, { subtopic: rx }];
  }
  return filter;
}

export async function listQuestions(q: QuestionListQuery) {
  const filter = buildQuestionFilter(q);
  const sortField = q.sort.replace(/^-/, "");
  const sort: Record<string, 1 | -1> = { [sortField]: q.sort.startsWith("-") ? -1 : 1, _id: -1 };
  const [items, total] = await Promise.all([
    Question.find(filter)
      .sort(sort)
      .skip((q.page - 1) * q.pageSize)
      .limit(q.pageSize)
      .select("originalQuestionId subject topic subtopic difficulty questionType questionText sourceType sourceFile verificationStatus assetStatus issues questionImages createdAt archived")
      .lean(),
    Question.countDocuments(filter),
  ]);
  return {
    items: items.map((i) => ({ ...i, id: String(i._id), _id: undefined, questionText: i.questionText.slice(0, 400) })),
    total,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

export async function questionStats() {
  const [agg] = await Question.aggregate([
    { $match: { archived: false } },
    {
      $facet: {
        total: [{ $count: "n" }],
        bySubject: [{ $group: { _id: "$subject", n: { $sum: 1 } } }],
        byType: [{ $group: { _id: "$questionType", n: { $sum: 1 } } }],
        byStatus: [{ $group: { _id: "$verificationStatus", n: { $sum: 1 } } }],
        missingImages: [{ $match: { assetStatus: "missing" } }, { $count: "n" }],
        withIssues: [{ $match: { "issues.0": { $exists: true } } }, { $count: "n" }],
        validMcq: [{ $match: { questionType: "single_correct", issues: { $size: 0 } } }, { $count: "n" }],
        eligible: [
          { $match: { archived: false, verificationStatus: { $ne: "rejected" }, assetStatus: { $ne: "missing" }, issues: { $size: 0 } } },
          { $group: { _id: { subject: "$subject", difficulty: "$difficulty", type: "$questionType" }, n: { $sum: 1 } } },
        ],
        topics: [{ $group: { _id: { subject: "$subject", topic: "$topic" }, n: { $sum: 1 } } }, { $sort: { "_id.topic": 1 } }],
        breakdown: [{ $group: { _id: { subject: "$subject", topic: "$topic", difficulty: "$difficulty" }, n: { $sum: 1 } } }],
      },
    },
  ]);
  const count = (arr: { n: number }[]) => arr[0]?.n ?? 0;
  const map = (arr: { _id: string; n: number }[]) => Object.fromEntries(arr.map((x) => [x._id, x.n]));
  const bySubject = map(agg.bySubject);
  const byType = map(agg.byType);
  const byStatus = map(agg.byStatus);
  return {
    total: count(agg.total),
    bySubject: Object.fromEntries(SUBJECTS.map((s) => [s, bySubject[s] ?? 0])),
    validMcqs: count(agg.validMcq),
    numerical: byType.numerical ?? 0,
    verified: byStatus.verified ?? 0,
    pending: byStatus.pending ?? 0,
    rejected: byStatus.rejected ?? 0,
    missingImages: count(agg.missingImages),
    withIssues: count(agg.withIssues),
    eligible: (agg.eligible as { _id: { subject: string; difficulty: string; type: string }; n: number }[]).map((e) => ({ ...e._id, count: e.n })),
    topics: (agg.topics as { _id: { subject: string; topic: string }; n: number }[])
      .filter((t) => t._id.topic)
      .map((t) => ({ subject: t._id.subject, topic: t._id.topic, count: t.n })),
    /** Counts per subject × topic × difficulty, for the topic browser and difficulty summary. */
    breakdown: (agg.breakdown as { _id: { subject: string; topic: string; difficulty: string }; n: number }[]).map((b) => ({ subject: b._id.subject, topic: b._id.topic || "", difficulty: b._id.difficulty, count: b.n })),
  };
}

export async function getQuestion(id: string) {
  const q = await Question.findById(id).populate("verifiedBy", "fullName").lean();
  if (!q) throw notFound("Question");
  return { ...q, id: String(q._id), issueLabels: (q.issues as string[]).map((i) => QUESTION_ISSUES[i as QuestionIssue] ?? i) };
}

function issueBlocksVerification(issues: string[], confirmImages?: boolean) {
  return issues.filter((i) => !(i === "ambiguous_image" && confirmImages));
}

export async function verifyQuestion(id: string, adminId: string, confirmImages?: boolean) {
  const q = await Question.findById(id);
  if (!q) throw notFound("Question");
  if (q.archived) throw badRequest("Restore the question before verifying it.");
  const blocking = issueBlocksVerification(q.issues, confirmImages);
  if (blocking.length) {
    throw new AppError(
      "VALIDATION_ERROR",
      `This question cannot be verified until these issues are fixed: ${blocking.map((i) => QUESTION_ISSUES[i as QuestionIssue] ?? i).join("; ")}.`,
      { issues: blocking },
    );
  }
  if (confirmImages && q.issues.includes("ambiguous_image")) {
    q.issues = (q.issues as string[]).filter((i) => i !== "ambiguous_image");
    q.assetStatus = q.questionImages.length ? "ok" : "none";
  }
  q.verificationStatus = "verified";
  q.verifiedAt = new Date();
  q.verifiedBy = new Types.ObjectId(adminId);
  q.rejectionReason = "";
  await q.save();
  await audit(adminId, "question.verify", "Question", id, { confirmImages: !!confirmImages });
  return q.toObject();
}

export async function setReviewStatus(id: string, adminId: string, status: "rejected" | "pending", reason = "") {
  const q = await Question.findByIdAndUpdate(
    id,
    { $set: { verificationStatus: status, rejectionReason: status === "rejected" ? reason : "", verifiedAt: null, verifiedBy: null } },
    { returnDocument: "after" },
  ).lean();
  if (!q) throw notFound("Question");
  await audit(adminId, `question.${status === "rejected" ? "reject" : "reset_review"}`, "Question", id, { reason });
  return q;
}

export async function setArchived(id: string, adminId: string, archived: boolean) {
  const q = await Question.findByIdAndUpdate(id, { $set: { archived } }, { returnDocument: "after" }).lean();
  if (!q) throw notFound("Question");
  await audit(adminId, archived ? "question.archive" : "question.restore", "Question", id);
  return q;
}

function validateEditable(data: QuestionEditable, keepAmbiguous: boolean) {
  const result = revalidate(
    {
      ...data,
      sourceExam: "",
      correctOption: data.questionType === "single_correct" ? data.correctOption : null,
      numericalAnswer: data.questionType === "numerical" ? data.numericalAnswer : null,
    },
    imageExists,
  );
  if (!result.ok) throw new AppError("VALIDATION_ERROR", result.error);
  const n = result.question;
  if (keepAmbiguous && !n.issues.includes("ambiguous_image")) {
    n.issues.push("ambiguous_image");
    n.assetStatus = "missing";
  }
  return n;
}

export async function createManualQuestion(data: QuestionEditable, adminId: string) {
  const n = validateEditable(data, false);
  try {
    const doc = await Question.create({
      ...n,
      numericalTolerance: data.numericalTolerance,
      originalSource: data.originalSource,
      sourceLicense: data.sourceLicense,
      sourceType: "manual",
      sourceFile: "",
      verificationStatus: "pending",
      createdBy: adminId,
    });
    await audit(adminId, "question.create", "Question", String(doc._id));
    return doc.toObject();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new AppError("CONFLICT", "An identical question already exists in the question bank.");
    throw err;
  }
}

/**
 * Updates a question. Changing the answer key, question text, options or images resets
 * verification to pending (published exams keep their own frozen snapshot).
 */
export async function updateQuestion(id: string, data: QuestionEditable, adminId: string) {
  const existing = await Question.findById(id);
  if (!existing) throw notFound("Question");
  const imagesUnchanged =
    JSON.stringify(existing.questionImages) === JSON.stringify(data.questionImages) &&
    JSON.stringify(existing.solutionImages) === JSON.stringify(data.solutionImages);
  const n = validateEditable(data, existing.issues.includes("ambiguous_image") && imagesUnchanged);

  const material =
    existing.contentHash !== n.contentHash ||
    (existing.correctOption ?? null) !== n.correctOption ||
    (existing.numericalAnswer ?? null) !== n.numericalAnswer ||
    !imagesUnchanged ||
    existing.questionType !== n.questionType;

  if (existing.contentHash !== n.contentHash && (await Question.exists({ contentHash: n.contentHash, _id: { $ne: existing._id } })))
    throw new AppError("CONFLICT", "Another question with identical content already exists.");

  Object.assign(existing, {
    ...n,
    originalDifficulty: existing.originalDifficulty,
    numericalTolerance: data.numericalTolerance,
    originalSource: data.originalSource,
    sourceLicense: data.sourceLicense,
  });
  if (material || n.issues.length) {
    existing.verificationStatus = "pending";
    existing.verifiedAt = null;
    existing.verifiedBy = null;
  }
  await existing.save();
  await audit(adminId, "question.update", "Question", id, { material });
  return existing.toObject();
}

export async function bulkAction(ids: string[], action: "verify" | "reject" | "archive" | "restore" | "reset_review", adminId: string, reason = "") {
  const objectIds = ids.map((i) => new Types.ObjectId(i));
  if (action === "verify") {
    // Only questions without validation issues can be bulk-verified; others are reported back.
    const docs = await Question.find({ _id: { $in: objectIds } }).select("issues archived").lean();
    const ok = docs.filter((d) => !d.issues.length && !d.archived).map((d) => d._id);
    const r = await Question.updateMany(
      { _id: { $in: ok } },
      { $set: { verificationStatus: "verified", verifiedAt: new Date(), verifiedBy: new Types.ObjectId(adminId), rejectionReason: "" } },
    );
    await audit(adminId, "question.bulk_verify", "Question", "", { count: r.modifiedCount });
    return { updated: r.modifiedCount, skipped: ids.length - ok.length, skippedReason: "Questions with unresolved issues or archived questions were skipped." };
  }
  const update =
    action === "reject"
      ? { verificationStatus: "rejected", rejectionReason: reason || "Rejected in bulk review", verifiedAt: null, verifiedBy: null }
      : action === "reset_review"
        ? { verificationStatus: "pending", verifiedAt: null, verifiedBy: null }
        : { archived: action === "archive" };
  const r = await Question.updateMany({ _id: { $in: objectIds } }, { $set: update });
  await audit(adminId, `question.bulk_${action}`, "Question", "", { count: r.modifiedCount });
  return { updated: r.modifiedCount, skipped: 0 };
}
