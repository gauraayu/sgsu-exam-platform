import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Camera / microphone / fullscreen are only ever requested by the exam workspace on this origin.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), fullscreen=(self), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["mongoose", "exceljs", "bcryptjs"],
  // Local JSONL datasets are read-only source assets read by the admin import routes.
  // They live in src/data (never in public/) because they contain answer keys.
  outputFileTracingIncludes: {
    "/api/admin/import/local/*": ["./src/data/**/*"],
    "/api/admin/questions/*": ["./src/data/asset-manifest.json"],
    "/api/admin/import/*": ["./src/data/asset-manifest.json"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
