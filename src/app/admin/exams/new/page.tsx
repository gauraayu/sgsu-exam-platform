import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CreateExam } from "@/components/admin/create-exam";

export const metadata: Metadata = { title: "Create examination" };
export default function Page() {
  return (
    <>
      <PageHeader title="Create Examination" description="Generate an assessment using saved settings or customise it manually." breadcrumbs={[{ label: "All Examinations", href: "/admin/exams" }, { label: "Create examination" }]} />
      <Suspense>
        <CreateExam />
      </Suspense>
    </>
  );
}
