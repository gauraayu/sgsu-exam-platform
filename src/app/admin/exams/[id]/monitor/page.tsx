import type { Metadata } from "next";
import { ExamMonitor } from "@/components/admin/exam-monitor";

export const metadata: Metadata = { title: "Exam monitoring" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <ExamMonitor id={(await params).id} />;
}
