import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { StudentAttemptsTable } from "@/components/student/student-pages";

export const metadata: Metadata = { title: "Exam history" };

export default function Page() {
  return (
    <>
      <PageHeader title="Exam history" description="Every exam you have started with this account." breadcrumbs={[{ label: "Dashboard", href: "/student" }, { label: "Exam history" }]} />
      <StudentAttemptsTable mode="history" />
    </>
  );
}
