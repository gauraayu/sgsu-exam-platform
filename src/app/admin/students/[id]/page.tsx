import type { Metadata } from "next";
import { StudentDetail } from "@/components/admin/students";

export const metadata: Metadata = { title: "Student" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <StudentDetail id={(await params).id} />;
}
