import { requirePageUser } from "@/lib/guards";
import { AppShell } from "@/components/layout/app-shell";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("STUDENT");
  return <AppShell user={{ fullName: user.fullName, email: user.email, role: user.role, studentId: user.studentId }}>{children}</AppShell>;
}
