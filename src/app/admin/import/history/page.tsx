import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ImportNav } from "@/components/admin/import-shared";
import { ImportHistory } from "@/components/admin/import-history";

export const metadata: Metadata = { title: "Import history" };
export default function Page() {
  return (
    <div className="space-y-5">
      <PageHeader title="Import questions" description="Every import operation with its statistics and rejected records." breadcrumbs={[{ label: "Question Bank", href: "/admin/questions" }, { label: "Import history" }]}>
        <ImportNav active="/admin/import/history" />
      </PageHeader>
      <ImportHistory />
    </div>
  );
}
