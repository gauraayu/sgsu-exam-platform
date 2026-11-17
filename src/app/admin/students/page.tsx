import type { Metadata } from "next";
import { StudentsList } from "@/components/admin/students";

export const metadata: Metadata = { title: "Students" };
export default function Page() {
  return <StudentsList />;
}
