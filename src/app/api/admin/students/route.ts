import { handler, json, parseQuery } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { listStudents } from "@/services/results.service";
import { studentQuerySchema } from "./schema";

export const GET = handler(async (req) => {
  await requireAdmin();
  return json(await listStudents(parseQuery(req, studentQuerySchema)));
});
