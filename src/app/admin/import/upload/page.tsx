import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ImportNav } from "@/components/admin/import-shared";
import { FileUploadImport } from "@/components/admin/import-file";

export const metadata: Metadata = { title: "Upload file" };
export default function Page() {
  return (
    <div className="space-y-5">
      <PageHeader title="Import questions" description="Add questions from CSV, JSON or JSONL files with configurable column mapping." breadcrumbs={[{ label: "Question Bank", href: "/admin/questions" }, { label: "Upload file" }]}>
        <ImportNav active="/admin/import/upload" />
      </PageHeader>
      <FileUploadImport />
    </div>
  );
}
