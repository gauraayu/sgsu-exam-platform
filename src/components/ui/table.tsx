import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom border-collapse text-[14.5px]", className)} {...props} />
    </div>
  );
}
export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-subtle [&_tr]:border-b", className)} {...props} />;
}
export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-primary-soft/60", className)} {...props} />;
}
export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-9 whitespace-nowrap px-3 text-left align-middle text-xs font-medium text-muted-foreground first:pl-4 last:pr-4", className)} {...props} />;
}
export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2.5 align-middle first:pl-4 last:pr-4", className)} {...props} />;
}

export function SortableTH({
  label,
  field,
  sort,
  onSort,
  className,
}: {
  label: string;
  field: string;
  sort: string;
  onSort: (s: string) => void;
  className?: string;
}) {
  const active = sort === field || sort === `-${field}`;
  const desc = sort === `-${field}`;
  const Icon = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <TH className={className} aria-sort={active ? (desc ? "descending" : "ascending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort(active && !desc ? `-${field}` : field)}>
        {label}
        <Icon className={cn("size-3", !active && "opacity-40")} aria-hidden />
      </button>
    </TH>
  );
}
