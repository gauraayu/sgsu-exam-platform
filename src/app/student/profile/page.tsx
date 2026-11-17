import type { Metadata } from "next";
import { requirePageUser } from "@/lib/guards";
import { PageHeader } from "@/components/layout/page-header";
import { ChangePasswordForm, ProfileForm } from "@/components/student/profile-form";
import { ACADEMIC_LEVELS } from "@/lib/constants";

export const metadata: Metadata = { title: "Profile" };

export default async function Page() {
  const u = await requirePageUser("STUDENT");
  const level = (ACADEMIC_LEVELS as readonly string[]).includes(u.academicLevel) ? (u.academicLevel as (typeof ACADEMIC_LEVELS)[number]) : "Other";
  return (
    <div className="space-y-6">
      <PageHeader title="Profile" breadcrumbs={[{ label: "Dashboard", href: "/student" }, { label: "Profile" }]} />
      <ProfileForm initial={{ fullName: u.fullName, mobile: u.mobile, academicLevel: level, institutionName: u.institutionName }} email={u.email} studentId={u.studentId} />
      <ChangePasswordForm />
    </div>
  );
}
