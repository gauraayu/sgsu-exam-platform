import Link from "next/link";
import { ArrowLeft, BookOpenCheck, ShieldCheck, Timer } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const POINTS = [
  { icon: BookOpenCheck, title: "One account for every assessment", text: "Register once and use the same account for all SGSU entrance and aptitude exams." },
  { icon: Timer, title: "Answers saved as you work", text: "Every response is saved automatically and the timer runs on the server." },
  { icon: ShieldCheck, title: "Results in your dashboard", text: "See your scores and attempt history as soon as they are released." },
];

/**
 * Shared layout for sign-in, sign-up and password pages. Every entry point (header button, hero
 * button, exam link, session expiry) lands on this same layout.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden bg-primary text-primary-foreground md:flex md:flex-col md:p-8 lg:p-10 xl:p-12 dark:bg-[#24123b]">
        <div className="absolute inset-y-0 right-0 w-1 bg-accent" aria-hidden />
        <Link href="/" className="self-start rounded-lg bg-white px-4 py-3 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label="SGSU home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/branding/sgsu-logo-transparent.png" alt="Scope Global Skills University" className="h-9 w-auto" />
        </Link>
        <div className="my-auto max-w-[420px] py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Examination Cell · Bhopal</p>
          <h2 className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-tight lg:text-[30px]">SGSU Smart Assessment Portal</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/80">Online entrance and aptitude examinations of Scope Global Skills University.</p>
          <ul className="mt-8 space-y-5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-white/10 text-accent ring-1 ring-white/15">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span>
                  <span className="block text-[15px] font-medium text-white">{title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-white/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/60">© {new Date().getFullYear()} Scope Global Skills University, Bhopal</p>
      </aside>

      <main className="flex min-w-0 flex-col">
        <div className="h-1 bg-gradient-to-r from-primary to-accent md:hidden" aria-hidden />
        <header className="flex h-16 items-center justify-between px-5 sm:px-8">
          <Link href="/" className="md:hidden" aria-label="SGSU home">
            <Logo height={28} />
          </Link>
          <Link href="/" className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground md:inline-flex">
            <ArrowLeft className="size-4" aria-hidden /> Back to home
          </Link>
          <ThemeToggle />
        </header>
        <div className="flex flex-1 items-start justify-center px-4 pb-12 pt-2 sm:items-center sm:px-8">
          <div className="w-full max-w-[500px] rounded-xl border border-t-[3px] border-t-accent bg-card p-6 shadow-sm sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
