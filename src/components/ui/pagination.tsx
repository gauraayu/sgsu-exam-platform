"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { Select } from "./input";

export function Pagination({ page, totalPages, total, pageSize, onPage, onPageSize }: { page: number; totalPages: number; total: number; pageSize: number; onPage: (p: number) => void; onPageSize?: (n: number) => void }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-2.5 text-[14.5px] text-muted-foreground">
      <span>
        {from}–{to} of {total.toLocaleString("en-IN")}
      </span>
      <div className="flex items-center gap-2">
        {onPageSize && (
          <label className="flex items-center gap-2">
            <span className="inline max-sm:hidden">Rows</span>
            <Select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="h-8 w-[72px]" aria-label="Rows per page">
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
        )}
        <Button variant="outline" size="icon-sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="tabular-nums">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
