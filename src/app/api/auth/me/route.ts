import { handler, json } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export const GET = handler(async () => json({ user: await getSessionUser() }));
