import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { StudentAttemptsTable } from "@/components/student/student-pages";

export const metadata: Metadata = { title: "Results" };

export default function Page() {
  return (
    <>
      <PageHeader title="Results" description="Scores are shown once the examination cell releases them." breadcrumbs={[{ label: "Dashboard", href: "/student" }, { label: "Results" }]} />
      <StudentAttemptsTable mode="results" />
    </>
  );
}
