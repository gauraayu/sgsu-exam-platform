import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ExamDefaultsForm } from "@/components/admin/exam-defaults";

export const metadata: Metadata = { title: "Default examination settings" };
export default function Page() {
  return (
    <>
      <PageHeader
        title="Default Examination Settings"
        description="Saved configuration used by Quick Generate: size, timing, distribution, scoring, security and results."
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Default examination settings" }]}
      />
      <ExamDefaultsForm />
    </>
  );
}
