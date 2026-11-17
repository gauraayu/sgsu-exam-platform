import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Question } from "@/models";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionEditor } from "@/components/admin/question-editor";
import { Alert } from "@/components/ui/states";
import type { QuestionEditable } from "@/lib/validation/questions";

export const metadata: Metadata = { title: "Edit question" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectDB();
  const q = await Question.findById(id).lean();
  if (!q) notFound();
  const initial: Partial<QuestionEditable> = {
    subject: q.subject as QuestionEditable["subject"],
    chapter: q.chapter,
    topic: q.topic,
    subtopic: q.subtopic,
    academicLevel: q.academicLevel,
    difficulty: q.difficulty as QuestionEditable["difficulty"],
    questionType: q.questionType as QuestionEditable["questionType"],
    questionText: q.questionText,
    options: q.options as string[],
    correctOption: q.correctOption ?? null,
    numericalAnswer: q.numericalAnswer ?? null,
    numericalTolerance: q.numericalTolerance ?? 0,
    explanation: q.explanation,
    questionImages: q.questionImages as string[],
    solutionImages: q.solutionImages as string[],
    originalQuestionId: q.originalQuestionId,
    originalSource: q.originalSource,
    sourceLicense: q.sourceLicense,
  };
  return (
    <>
      <PageHeader title="Edit question" breadcrumbs={[{ label: "Question Bank", href: "/admin/questions" }, { label: q.originalQuestionId || "Question" }, { label: "Edit" }]} />
      <div className="mb-4"><Alert variant="info">Published exams keep their own frozen copy of this question; edits only affect future papers.</Alert></div>
      <QuestionEditor id={id} initial={initial} />
    </>
  );
}
