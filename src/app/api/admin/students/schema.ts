import { z } from "zod";

export const studentQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  academicLevel: z.string().trim().max(60).optional(),
  sort: z.enum(["-createdAt", "createdAt", "name", "-exams", "-average", "-activity"]).default("-createdAt"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});
