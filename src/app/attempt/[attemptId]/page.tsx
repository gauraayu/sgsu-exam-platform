import type { Metadata } from "next";
import { requirePageUser } from "@/lib/guards";
import { ExamWorkspace } from "@/components/exam/workspace";

export const metadata: Metadata = { title: "Examination" };

export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requirePageUser("STUDENT");
  const { attemptId } = await params;
  return <ExamWorkspace attemptId={attemptId} studentName={`${user.fullName}${user.studentId ? ` · ${user.studentId}` : ""}`} />;
}
