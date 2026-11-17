import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { AdminSettings } from "@/components/admin/settings";

export const metadata: Metadata = { title: "Settings" };
export default function Page() {
  return (
    <>
      <PageHeader title="Settings" description="System status, administrators and your account." breadcrumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Settings" }]} />
      <AdminSettings />
    </>
  );
}
