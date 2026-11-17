"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="sgsu-theme" disableTransitionOnChange>
      {children}
      <Toaster position="top-right" richColors closeButton toastOptions={{ className: "text-[14.5px]" }} />
    </ThemeProvider>
  );
}
