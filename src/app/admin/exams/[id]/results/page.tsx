import type { Metadata } from "next";
import { ExamResults } from "@/components/admin/exam-results";

export const metadata: Metadata = { title: "Exam results" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ExamResults id={(await params).id} />;
}
