import { requirePageUser } from "@/lib/guards";
import { AppShell } from "@/components/layout/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser("ADMIN");
  return <AppShell user={{ fullName: user.fullName, email: user.email, role: user.role }}>{children}</AppShell>;
}
