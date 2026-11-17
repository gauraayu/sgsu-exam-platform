import { SubNav } from "@/components/layout/page-header";

export function ExamNav({ id, active, published }: { id: string; active: "overview" | "monitor" | "results" | "analytics"; published: boolean }) {
  const items = [{ href: `/admin/exams/${id}`, label: "Overview & paper" }];
  if (published) items.push({ href: `/admin/exams/${id}/monitor`, label: "Monitoring" }, { href: `/admin/exams/${id}/results`, label: "Results" }, { href: `/admin/exams/${id}/analytics`, label: "Analytics" });
  const map = { overview: items[0].href, monitor: `/admin/exams/${id}/monitor`, results: `/admin/exams/${id}/results`, analytics: `/admin/exams/${id}/analytics` };
  return <SubNav items={items} active={map[active]} />;
}
