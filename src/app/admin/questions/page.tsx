import type { Metadata } from "next";
import { Suspense } from "react";
import { QuestionBank } from "@/components/admin/question-bank";

export const metadata: Metadata = { title: "Question Bank" };
export default function Page() {
  return <Suspense><QuestionBank /></Suspense>;
}
