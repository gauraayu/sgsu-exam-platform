"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3 } from "lucide-react";
import { api } from "@/lib/client-api";

/**
 * Shown while an exam is scheduled. Counts down with the server's clock and asks the server again
 * at the start time; the page refreshes as soon as the server reports the exam is active.
 */
export function AvailabilityWatcher({ token, startsAt }: { token: string; startsAt: string }) {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const start = new Date(startsAt).getTime();

  useEffect(() => {
    let live = true;
    const check = () =>
      api<{ lifecycle: string; serverNow: string }>(`/api/exams/${token}/availability`)
        .then((r) => {
          if (!live) return;
          setOffset(new Date(r.serverNow).getTime() - Date.now());
          if (r.lifecycle !== "scheduled") router.refresh();
        })
        .catch(() => undefined);
    void check();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(check, 30_000);
    return () => {
      live = false;
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [token, router]);

  const left = Math.max(0, start - (now + offset));
  useEffect(() => {
    if (left > 0) return;
    const t = setTimeout(() => router.refresh(), 1500);
    return () => clearTimeout(t);
  }, [left, router]);

  const d = Math.floor(left / 86_400_000);
  const h = Math.floor((left % 86_400_000) / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  const sec = Math.floor((left % 60_000) / 1000);
  return (
    <p className="flex items-start gap-2 text-sm text-muted-foreground" role="timer" aria-live="off">
      <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden />
      {left > 0 ? (
        <span>
          Opens in <span className="font-medium tabular-nums text-foreground">{d ? `${d}d ` : ""}{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(sec).padStart(2, "0")}</span>. This page updates automatically.
        </span>
      ) : (
        <span>Opening…</span>
      )}
    </p>
  );
}
