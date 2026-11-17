import { handler, json } from "@/lib/api";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { finalizeOverdueAttempts } from "@/services/attempt.service";

/** Scheduled safety net that evaluates attempts whose time has run out. */
export const GET = handler(async (req) => {
  const secret = env.cronSecret;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) throw new AppError("UNAUTHENTICATED", "Invalid cron secret.");
  const finalized = await finalizeOverdueAttempts(undefined, 1000);
  return json({ finalized });
});
