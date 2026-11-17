import type { Metadata } from "next";
import { ExamsList } from "@/components/admin/exams-list";

export const metadata: Metadata = { title: "Exams" };
export default function Page() {
  return <ExamsList />;
}
