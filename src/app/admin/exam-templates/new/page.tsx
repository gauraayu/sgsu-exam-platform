import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { NewTemplate } from "@/components/admin/template-editor";

export const metadata: Metadata = { title: "Create template" };

export default function Page() {
  return (
    <>
      <PageHeader title="Create Exam Template" breadcrumbs={[{ label: "Exam Templates", href: "/admin/exam-templates" }, { label: "Create template" }]} />
      <NewTemplate />
    </>
  );
}
