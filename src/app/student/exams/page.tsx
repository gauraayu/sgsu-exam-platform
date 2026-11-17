import type { Metadata } from "next";
import Link from "next/link";
import { History } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StudentExamsList } from "@/components/student/student-pages";
import { ExamCodeCard } from "@/components/student/exam-code";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Examinations" };

export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <>
      <PageHeader
        title="Examinations"
        description="Enter the exam code or open the exam link shared by the examination cell."
        breadcrumbs={[{ label: "Dashboard", href: "/student" }, { label: "Examinations" }]}
        actions={<Button asChild variant="outline"><Link href="/student/history"><History /> Examination history</Link></Button>}
      />
      <div className="space-y-6">
        <ExamCodeCard initialCode={typeof code === "string" ? code.slice(0, 20) : undefined} />
        <section aria-labelledby="my-exams">
          <h2 id="my-exams" className="mb-3 text-lg font-semibold">My examinations</h2>
          <StudentExamsList />
        </section>
      </div>
    </>
  );
}
