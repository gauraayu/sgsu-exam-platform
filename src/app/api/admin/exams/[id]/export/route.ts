import { z } from "zod";
import { handler, parseQuery, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { audit } from "@/models";
import { MIME, fileResponse, toCsv, toPdf, toXlsx, type Column } from "@/lib/export";
import { allExamResultRows, type ResultRow } from "@/services/results.service";
import { resultsQuerySchema } from "../results/schema";
import { SUBJECT_SHORT, type Subject } from "@/lib/constants";

export const maxDuration = 60;
const schema = resultsQuerySchema.omit({ page: true, pageSize: true }).extend({ format: z.enum(["csv", "xlsx", "pdf"]) });

const STATUS: Record<string, string> = { submitted: "Submitted", auto_submitted: "Auto-submitted", terminated: "Terminated" };

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Exam");
  const { format, ...q } = parseQuery(req, schema);
  const { exam, rows, subjects } = await allExamResultRows(params.id, q);
  const columns: Column<ResultRow>[] = [
    { header: "Rank", value: (r) => rows.indexOf(r) + 1, width: 7, pdfWidth: 0.45, align: "right" },
    { header: "Student ID", value: (r) => r.studentCode, width: 16, pdfWidth: 1.1 },
    { header: "Student Name", value: (r) => r.name, width: 26, pdfWidth: 1.6 },
    { header: "Email", value: (r) => r.email, width: 30, pdfWidth: 1.9 },
    { header: "Attempt Date", value: (r) => (r.attemptDate ? new Date(r.attemptDate) : null), width: 20, pdfWidth: 1.3 },
    { header: "Submitted", value: (r) => (r.submittedAt ? new Date(r.submittedAt) : null), width: 20, pdfWidth: 1.3 },
    // One column per subject in this exam (PCM, aptitude or any mix).
    ...subjects.map((s): Column<ResultRow> => ({ header: SUBJECT_SHORT[s as Subject] ?? s, value: (r) => r.subjectScores[s], width: Math.max(10, s.length + 2), pdfWidth: 0.7, align: "right" })),
    { header: "Final Marks", value: (r) => r.totalScore, width: 12, pdfWidth: 0.75, align: "right" },
    { header: "Max Marks", value: (r) => r.maxScore, width: 11, pdfWidth: 0.65, align: "right" },
    { header: "Percentage", value: (r) => r.percentage, width: 11, pdfWidth: 0.7, align: "right" },
    { header: "Result", value: (r) => (r.passed ? "Pass" : "Fail"), width: 9, pdfWidth: 0.5 },
    { header: "Attempt Status", value: (r) => STATUS[r.attemptStatus] ?? r.attemptStatus, width: 16, pdfWidth: 1 },
  ];
  await audit(admin.id, "exam.export_results", "Exam", params.id, { format, rows: rows.length });
  const base = `${exam.title}-results`.toLowerCase();
  if (format === "csv") return fileResponse(toCsv(rows, columns), `${base}.csv`, MIME.csv);
  if (format === "xlsx")
    return fileResponse(await toXlsx(rows, columns, { sheetName: "Results", title: `${exam.title} — Results` }), `${base}.xlsx`, MIME.xlsx);
  const n = rows.length;
  const avg = n ? rows.reduce((a, r) => a + r.totalScore, 0) / n : 0;
  return fileResponse(
    await toPdf({
      title: `${exam.title} — Result Report`,
      subtitle: `${exam.totalQuestions} questions · ${exam.durationMinutes} minutes · Total marks ${exam.totalMarks} · Passing marks ${exam.passingMarks}`,
      summary: [
        { label: "Candidates evaluated", value: String(n) },
        { label: "Average marks", value: n ? avg.toFixed(2) : "—" },
        { label: "Highest marks", value: n ? String(Math.max(...rows.map((r) => r.totalScore))) : "—" },
        { label: "Pass rate", value: n ? `${((rows.filter((r) => r.passed).length / n) * 100).toFixed(1)}%` : "—" },
      ],
      rows,
      columns: columns.filter((c) => c.header !== "Email" && c.header !== "Submitted"),
    }),
    `${base}.pdf`,
    MIME.pdf,
  );
});
