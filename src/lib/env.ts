import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}. See .env.example.`);
  return value;
}

export const env = {
  get mongoUri() {
    return required("MONGODB_URI");
  },
  get authSecret() {
    const secret = required("AUTH_SECRET");
    if (secret.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters long.");
    return secret;
  },
  get appUrl() {
    return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  get approvedImportHosts(): string[] {
    return (process.env.APPROVED_IMPORT_HOSTS || "datasets-server.huggingface.co")
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
  },
  get importApiToken() {
    return process.env.IMPORT_API_TOKEN || "";
  },
  get cronSecret() {
    return process.env.CRON_SECRET || "";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  smtp() {
    const host = process.env.SMTP_HOST;
    if (!host) return null;
    return {
      host,
      port: Number(process.env.SMTP_PORT || 587),
      user: process.env.SMTP_USER || "",
      password: process.env.SMTP_PASSWORD || "",
      from: process.env.SMTP_FROM || "SGSU Examination Cell <no-reply@sgsu.ac.in>",
    };
  },
};
