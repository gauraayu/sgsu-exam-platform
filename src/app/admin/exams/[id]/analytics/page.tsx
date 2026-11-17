import type { Metadata } from "next";
import { ExamAnalytics } from "@/components/admin/exam-analytics";

export const metadata: Metadata = { title: "Exam analytics" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ExamAnalytics id={(await params).id} />;
}
