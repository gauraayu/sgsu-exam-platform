import { BarChart3, BookOpenCheck, ClipboardList, FileUp, GraduationCap, History, LayoutDashboard, LayoutTemplate, LibraryBig, PlusCircle, Radio, Settings, SlidersHorizontal, Trophy, UserRound, Users } from "lucide-react";
import type { Role } from "@/lib/constants";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  match?: string[];
  /** Sub-paths that belong to another item. */
  exclude?: string[];
  /** Not active when the URL has this query (another item covers it). */
  unlessQuery?: string;
}

export const NAV: Record<Role, { section?: string; items: NavItem[] }[]> = {
  ADMIN: [
    { section: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard }] },
    {
      section: "Question Management",
      items: [
        { href: "/admin/questions", label: "Question Bank", icon: LibraryBig },
        { href: "/admin/import/local", label: "Import Questions", icon: FileUp, match: ["/admin/import/local", "/admin/import/upload", "/admin/import/api"] },
        { href: "/admin/import/history", label: "Import History", icon: History },
      ],
    },
    {
      section: "Examination Management",
      items: [
        { href: "/admin/exams", label: "All Examinations", icon: ClipboardList, exclude: ["/admin/exams/new"], unlessQuery: "status=active" },
        { href: "/admin/exams/new", label: "Create Examination", icon: PlusCircle },
        { href: "/admin/exams?status=active", label: "Active Examinations", icon: Radio },
        { href: "/admin/exam-templates", label: "Exam Templates", icon: LayoutTemplate },
      ],
    },
    { section: "Student Management", items: [{ href: "/admin/students", label: "Registered Students", icon: Users }] },
    { section: "Results & Analytics", items: [{ href: "/admin/analytics", label: "Performance Analytics", icon: BarChart3 }] },
    {
      section: "System",
      items: [
        { href: "/admin/settings/exam-defaults", label: "Default Exam Settings", icon: SlidersHorizontal },
        { href: "/admin/settings", label: "Settings", icon: Settings, exclude: ["/admin/settings/exam-defaults"] },
      ],
    },
  ],
  STUDENT: [
    {
      items: [
        { href: "/student", label: "Dashboard", icon: LayoutDashboard },
        { href: "/student/exams", label: "Examinations", icon: BookOpenCheck },
        { href: "/student/results", label: "Results", icon: Trophy },
        { href: "/student/history", label: "Examination History", icon: History },
        { href: "/student/profile", label: "Profile", icon: UserRound },
      ],
    },
  ],
};

export const ROLE_LABEL: Record<Role, { label: string; icon: React.ElementType }> = {
  ADMIN: { label: "Administrator", icon: Settings },
  STUDENT: { label: "Student", icon: GraduationCap },
};
