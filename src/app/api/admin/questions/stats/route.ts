import { handler, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { questionStats } from "@/services/question.service";

export const GET = handler(async () => {
  await requireAdmin();
  return json(await questionStats());
});
