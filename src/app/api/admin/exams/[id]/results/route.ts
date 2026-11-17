import { handler, json, parseQuery, isValidObjectId } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { listExamResults } from "@/services/results.service";
import { resultsQuerySchema } from "./schema";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  if (!isValidObjectId(params.id)) throw notFound("Exam");
  return json(await listExamResults(params.id, parseQuery(req, resultsQuerySchema)));
});
