import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({ title, description, breadcrumbs, actions, className, children }: { title: React.ReactNode; description?: React.ReactNode; breadcrumbs?: Crumb[]; actions?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("mb-6 space-y-3", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {breadcrumbs.map((c, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3" aria-hidden />}
                {c.href ? (
                  <Link href={c.href} className="hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground/80">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight sm:text-2xl">{title}</h1>
          {description && <p className="max-w-3xl text-[14.5px] text-muted-foreground sm:text-sm">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default", href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ElementType; tone?: "default" | "primary" | "accent" | "success" | "warning" | "danger"; href?: string }) {
  const toneClass = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary-soft text-primary dark:text-primary-soft-foreground",
    accent: "bg-accent-soft text-accent-soft-foreground",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  }[tone];
  const body = (
    <div className={cn("flex h-full items-start justify-between gap-3 rounded-lg border bg-card p-4 shadow-[0_1px_2px_rgba(16,16,20,0.04)]", href && "transition-colors hover:border-primary/40")}>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-[24px] font-semibold leading-none tabular-nums">{value}</p>
        {hint && <p className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
      {Icon && (
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", toneClass)}>
          <Icon className="size-4" aria-hidden />
        </span>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

export function SubNav({ items, active }: { items: { href: string; label: string }[]; active: string }) {
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b" aria-label="Section">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={active === i.href ? "page" : undefined}
          className={cn(
            "inline-flex h-9 shrink-0 items-center border-b-2 px-3 text-[14.5px] font-medium transition-colors",
            active === i.href ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
