import { z } from "zod";
import { handler, parseQuery } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/models";
import { MIME, fileResponse, toCsv, toXlsx, type Column } from "@/lib/export";
import { allStudentRows } from "@/services/results.service";
import { studentQuerySchema } from "../schema";

const schema = studentQuerySchema.omit({ page: true, pageSize: true }).extend({ format: z.enum(["csv", "xlsx"]) });
type Row = Awaited<ReturnType<typeof allStudentRows>>[number];

export const GET = handler(async (req) => {
  const admin = await requireAdmin();
  const { format, ...q } = parseQuery(req, schema);
  const rows = await allStudentRows(q);
  const columns: Column<Row>[] = [
    { header: "Student ID", value: (r) => r.studentId, width: 16 },
    { header: "Full Name", value: (r) => r.fullName, width: 26 },
    { header: "Email", value: (r) => r.email, width: 30 },
    { header: "Mobile", value: (r) => r.mobile, width: 15 },
    { header: "Academic Level", value: (r) => r.academicLevel, width: 16 },
    { header: "Institution", value: (r) => r.institutionName, width: 30 },
    { header: "Registered", value: (r) => (r.createdAt ? new Date(r.createdAt) : null), width: 20 },
    { header: "Exams Attempted", value: (r) => r.examsAttempted, width: 16, align: "right" },
    { header: "Average %", value: (r) => r.averagePercentage, width: 11, align: "right" },
    { header: "Latest Activity", value: (r) => (r.latestActivity ? new Date(r.latestActivity) : null), width: 20 },
  ];
  await audit(admin.id, "students.export", "User", "", { format, rows: rows.length });
  if (format === "csv") return fileResponse(toCsv(rows, columns), "sgsu-students.csv", MIME.csv);
  return fileResponse(await toXlsx(rows, columns, { sheetName: "Students", title: "SGSU Registered Students" }), "sgsu-students.xlsx", MIME.xlsx);
});
