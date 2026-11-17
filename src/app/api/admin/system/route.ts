import mongoose from "mongoose";
import { handler, json } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { getAvailableImages } from "@/lib/assets";
import { AuditLog } from "@/models";

export const GET = handler(async () => {
  await requireAdmin();
  const db = mongoose.connection;
  const ping = await db.db!.admin().ping().then(() => true).catch(() => false);
  const recentAudit = await AuditLog.find().sort({ createdAt: -1 }).limit(20).populate("actorId", "fullName").lean();
  return json({
    database: { connected: ping, name: db.name, host: db.host },
    appUrl: env.appUrl,
    approvedImportHosts: env.approvedImportHosts,
    smtpConfigured: !!env.smtp(),
    cronConfigured: !!env.cronSecret,
    questionImages: getAvailableImages().size,
    nodeVersion: process.version,
    recentAudit: recentAudit.map((a) => ({ ...a, id: String(a._id) })),
  });
});
