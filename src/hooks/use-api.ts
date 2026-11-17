"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client-api";

/** Loads JSON from an API route; re-fetches when the URL changes. Supports optional polling. */
export function useApi<T>(url: string | null, opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!url);
  const seq = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      if (!url) return;
      const id = ++seq.current;
      if (!silent) setLoading(true);
      try {
        const d = await api<T>(url);
        if (id === seq.current) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (id === seq.current) setError(e as ApiError);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    },
    [url],
  );

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!opts.pollMs || !url) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, opts.pollMs);
    return () => clearInterval(t);
  }, [opts.pollMs, url, load]);

  return { data, error, loading, reload: load, setData };
}
