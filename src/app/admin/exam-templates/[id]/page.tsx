import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getTemplate } from "@/services/exam-template.service";
import { PageHeader } from "@/components/layout/page-header";
import { ExamWizard } from "@/components/admin/exam-wizard";
import { templateToWizard, type TemplateData } from "@/components/admin/exam-wizard-state";
import { Alert } from "@/components/ui/states";

export const metadata: Metadata = { title: "Edit template" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) notFound();
  await connectDB();
  const t = await getTemplate(id).catch(() => null);
  if (!t) notFound();
  const data = JSON.parse(JSON.stringify(t)) as TemplateData;
  return (
    <>
      <PageHeader title={`Edit template · ${t.name}`} breadcrumbs={[{ label: "Exam Templates", href: "/admin/exam-templates" }, { label: t.name }]} />
      {t.status === "archived" ? (
        <Alert variant="warning" title="This template is archived">Restore it from the Archived tab before editing.</Alert>
      ) : (
        <div className="space-y-4">
          <Alert variant="info">Changes apply to examinations created from now on. Examinations already created from this template keep their own copy of the settings.</Alert>
          <ExamWizard variant="template" templateId={id} initial={templateToWizard(data, false)} />
        </div>
      )}
    </>
  );
}
