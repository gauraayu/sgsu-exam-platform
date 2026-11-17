import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ImportNav } from "@/components/admin/import-shared";
import { ApiImport } from "@/components/admin/import-file";

export const metadata: Metadata = { title: "Import via API" };
export default function Page() {
  return (
    <div className="space-y-5">
      <PageHeader title="Import questions" description="Optionally fetch questions from an approved external JSON API." breadcrumbs={[{ label: "Question Bank", href: "/admin/questions" }, { label: "Import via API" }]}>
        <ImportNav active="/admin/import/api" />
      </PageHeader>
      <ApiImport />
    </div>
  );
}
