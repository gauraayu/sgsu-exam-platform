"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ChevronsLeft, ChevronsRight, LogOut, Menu, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/client-api";
import { clearAllAttemptStores } from "@/lib/exam/offline-queue";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { Tooltip } from "@/components/ui/misc";
import { Logo, LogoMark } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { NAV, ROLE_LABEL } from "./nav";
import type { Role } from "@/lib/constants";

export interface ShellUser {
  fullName: string;
  email: string;
  role: Role;
  studentId?: string | null;
}

const COLLAPSE_KEY = "sgsu-sidebar-collapsed";
const listeners = new Set<() => void>();
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}
function setCollapsedStore(v: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

function isActive(pathname: string, search: string, item: { href: string; match?: string[]; exclude?: string[]; unlessQuery?: string }) {
  const [path, query] = item.href.split("?");
  if (item.exclude?.some((x) => pathname === x || pathname.startsWith(`${x}/`))) return false;
  if (item.unlessQuery && pathname === path && search.includes(item.unlessQuery)) return false;
  if (query) return pathname === path && search.includes(query);
  if (item.match?.some((m) => pathname.startsWith(m))) return true;
  if (path === "/admin" || path === "/student") return pathname === path;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

function SidebarNav({ role, collapsed, onNavigate }: { role: Role; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return (
    <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3" aria-label="Main">
      {NAV[role].map((group, gi) => (
        <div key={gi}>
          {group.section && !collapsed && <p className="mb-1 px-2.5 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground/80">{group.section}</p>}
          {group.section && collapsed && gi > 0 && <div className="mx-2 mb-2 h-px bg-sidebar-border" />}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, search, item);
              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] font-medium transition-colors",
                    active ? "bg-primary-soft text-primary-soft-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <item.icon className={cn("size-4 shrink-0", active && "text-primary dark:text-primary-soft-foreground")} aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {collapsed && <span className="sr-only">{item.label}</span>}
                </Link>
              );
              return <li key={item.href}>{collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link}</li>;
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    readCollapsed,
    () => false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  async function signOut() {
    setSigningOut(true);
    // Session cleanup: answer changes queued on this device belong to this account only.
    clearAllAttemptStores();
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const home = user.role === "ADMIN" ? "/admin" : "/student";
  const RoleIcon = ROLE_LABEL[user.role].icon;

  return (
    <div className="min-h-dvh bg-background">
      <a href="#main" className="sr-only z-[60] rounded bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 max-lg:hidden", collapsed ? "w-[64px]" : "w-60")}>
        <div className={cn("flex h-14 items-center border-b border-sidebar-border", collapsed ? "justify-center" : "px-4")}>
          <Link href={home} aria-label="SGSU Smart Assessment Portal home">
            {collapsed ? <LogoMark size={30} /> : <Logo height={30} />}
          </Link>
        </div>
        <SidebarNav role={user.role} collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-2">
          <Button variant="ghost" size="sm" className={cn("w-full text-muted-foreground", collapsed ? "justify-center px-0" : "justify-start")} onClick={() => setCollapsedStore(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
            {!collapsed && "Collapse"}
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button className="absolute inset-0 bg-black/40" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r bg-sidebar shadow-xl">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <Logo height={28} />
              <Button variant="ghost" size="icon-sm" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                <X />
              </Button>
            </div>
            <SidebarNav role={user.role} collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className={cn("flex min-h-dvh flex-col transition-[padding] duration-200", collapsed ? "lg:pl-[64px]" : "lg:pl-60")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/75 sm:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu />
          </Button>
          <div className="lg:hidden">
            <LogoMark size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="block truncate text-[14.5px] font-medium text-muted-foreground max-sm:hidden">Smart Assessment Portal{pathname.startsWith("/admin") ? " · Examination Cell" : ""}</p>
          </div>
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring" aria-label="Account menu">
                <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initials(user.fullName)}</span>
                <span className="block text-left leading-tight max-md:hidden">
                  <span className="block max-w-40 truncate text-[14.5px] font-medium">{user.fullName}</span>
                  <span className="block text-[12.5px] text-muted-foreground">{ROLE_LABEL[user.role].label}</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate text-[14.5px] font-medium text-foreground">{user.fullName}</span>
                <span className="block truncate">{user.email}</span>
                {user.studentId && <span className="mt-1 block font-mono text-[12.5px]">{user.studentId}</span>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push(user.role === "ADMIN" ? "/admin/settings" : "/student/profile")}>
                {user.role === "ADMIN" ? <RoleIcon /> : <UserRound />} {user.role === "ADMIN" ? "Settings" : "My profile"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={signOut} disabled={signingOut}>
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
