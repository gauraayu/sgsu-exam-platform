import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ImportNav } from "@/components/admin/import-shared";
import { LocalImport } from "@/components/admin/import-local";

export const metadata: Metadata = { title: "Local dataset" };
export default function Page() {
  return (
    <div className="space-y-5">
      <PageHeader title="Import questions" description="Import the JSONL datasets shipped with the project into MongoDB. Imported questions start in Pending Review." breadcrumbs={[{ label: "Question Bank", href: "/admin/questions" }, { label: "Local dataset" }]}>
        <ImportNav active="/admin/import/local" />
      </PageHeader>
      <LocalImport />
    </div>
  );
}
