import type { Metadata } from "next";
import { requirePageUser } from "@/lib/guards";
import { StudentDashboard } from "@/components/student/student-pages";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Page() {
  const user = await requirePageUser("STUDENT");
  return <StudentDashboard name={user.fullName} />;
}
