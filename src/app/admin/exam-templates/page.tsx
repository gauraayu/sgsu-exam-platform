import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ExamTemplates } from "@/components/admin/exam-templates";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Exam Templates" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Exam Templates"
        description="Reusable examination settings. Templates store configuration only, never questions, attempts, links or access codes."
        breadcrumbs={[{ label: "All Examinations", href: "/admin/exams" }, { label: "Exam Templates" }]}
        actions={<Button asChild><Link href="/admin/exam-templates/new"><Plus /> Create template</Link></Button>}
      />
      <ExamTemplates />
    </>
  );
}
