import { handler, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { dashboardStats } from "@/services/results.service";

export const GET = handler(async () => {
  await requireAdmin();
  return json(await dashboardStats());
});
