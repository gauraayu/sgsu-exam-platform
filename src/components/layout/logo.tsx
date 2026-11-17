/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/** SGSU wordmark with light/dark variants (the dark variant recolours the purple wordmark to white). */
export function Logo({ className, height = 34 }: { className?: string; height?: number }) {
  const width = Math.round((367 / 66) * height);
  return (
    <span className={cn("inline-flex items-center", className)}>
      <img src="/branding/sgsu-logo-transparent.png" alt="Scope Global Skills University" width={width} height={height} className="block dark:hidden" style={{ height, width: "auto" }} />
      <img src="/branding/sgsu-logo-dark.png" alt="Scope Global Skills University" width={width} height={height} className="hidden dark:block" style={{ height, width: "auto" }} />
    </span>
  );
}

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return <img src="/branding/sgsu-mark.png" alt="SGSU" width={size} height={size} className={cn("block", className)} />;
}
