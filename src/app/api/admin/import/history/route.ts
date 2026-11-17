import { z } from "zod";
import { handler, json, parseQuery } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { ImportBatch } from "@/models";

const q = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(5).max(100).default(20) });

export const GET = handler(async (req) => {
  await requireAdmin();
  const { page, pageSize } = parseQuery(req, q);
  const [items, total] = await Promise.all([
    ImportBatch.find().sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).select("-errorSamples -mapping").populate("importedBy", "fullName").lean(),
    ImportBatch.countDocuments(),
  ]);
  return json({ items: items.map((i) => ({ ...i, id: String(i._id) })), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
});
