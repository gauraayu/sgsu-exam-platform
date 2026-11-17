import { z } from "zod";

export const resultsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  outcome: z.enum(["passed", "failed", "all"]).default("all"),
  status: z.enum(["all", "submitted", "auto_submitted", "terminated"]).default("all"),
  sort: z.enum(["-score", "score", "name", "-name", "-submitted", "submitted"]).default("-score"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});
