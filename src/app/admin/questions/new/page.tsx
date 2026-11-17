import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { QuestionEditor } from "@/components/admin/question-editor";

export const metadata: Metadata = { title: "Add question" };
export default function Page() {
  return (
    <>
      <PageHeader title="Add question" description="Manually added questions can be used in exams straight away." breadcrumbs={[{ label: "Question Bank", href: "/admin/questions" }, { label: "Add question" }]} />
      <QuestionEditor />
    </>
  );
}
