import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Providers } from "@/components/layout/providers";

export const metadata: Metadata = {
  title: { default: "SGSU Smart Assessment Portal", template: "%s · SGSU Smart Assessment Portal" },
  description: "Online examination and assessment platform of Scope Global Skills University, Bhopal.",
  applicationName: "SGSU Smart Assessment Portal",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#101014" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
