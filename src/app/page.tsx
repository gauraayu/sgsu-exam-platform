import Link from "next/link";
import { ArrowRight, Atom, BookText, Brain, Calculator, CircleHelp, ClipboardCheck, FlaskConical, KeyRound, LinkIcon, Lock, MonitorCheck, Sigma, Timer, Trophy } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { homeFor } from "@/lib/guards";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";

const STEPS = [
  { icon: LinkIcon, title: "Open the link or enter the code", text: "The examination cell shares a link and an access code for each exam." },
  { icon: KeyRound, title: "Sign in or register once", text: "One student account works for every SGSU assessment." },
  { icon: ClipboardCheck, title: "Take the exam", text: "Answers save automatically and the timer runs on the server." },
  { icon: Trophy, title: "View your result", text: "Scores appear on your dashboard as soon as they are released." },
];

const SUBJECTS = [
  { group: "Entrance (PCM)", items: [{ icon: Atom, name: "Physics" }, { icon: FlaskConical, name: "Chemistry" }, { icon: Sigma, name: "Mathematics" }] },
  { group: "Aptitude", items: [{ icon: Calculator, name: "Quantitative Aptitude" }, { icon: Brain, name: "Logical Reasoning" }, { icon: BookText, name: "Verbal Ability" }] },
];

const FACTS = [
  { icon: Timer, label: "Server-timed exams" },
  { icon: MonitorCheck, label: "Auto-save on every answer" },
  { icon: Lock, label: "One attempt per student" },
];

export default async function Home() {
  const user = await getSessionUser();
  const signIn = "/login";
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="SGSU Smart Assessment Portal home"><Logo height={34} /></Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex" aria-label="Page sections">
            <a href="#subjects" className="hover:text-foreground">Subjects</a>
            <a href="#how-it-works" className="hover:text-foreground">How it works</a>
            <a href="#help" className="hover:text-foreground">Help</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <Button asChild size="sm"><Link href={homeFor(user.role)}>Go to dashboard</Link></Button>
            ) : (
              <>
                <Button asChild variant="outline" size="sm" className="max-sm:hidden"><Link href="/signup">Create account</Link></Button>
                <Button asChild size="sm"><Link href={signIn}>Sign in</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden border-b bg-card">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary to-accent" aria-hidden />
          {/* Soft orange glow behind the code card, matching the logo's orange. */}
          <div className="pointer-events-none absolute -right-40 -top-40 size-[560px] rounded-full bg-accent-soft opacity-80 blur-3xl dark:opacity-40" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:py-20">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Scope Global Skills University · Examination Cell</p>
              <h1 className="mt-4 text-[34px] font-semibold leading-[1.12] tracking-tight sm:text-[42px]">
                Entrance and aptitude examinations, <span className="text-primary dark:text-primary-soft-foreground">conducted online.</span>
              </h1>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
                The SGSU Smart Assessment Portal runs the university&apos;s examinations in Physics, Chemistry, Mathematics, Quantitative Aptitude, Logical Reasoning and Verbal Ability.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {user ? (
                  <Button asChild size="lg"><Link href={homeFor(user.role)}>Continue to dashboard <ArrowRight /></Link></Button>
                ) : (
                  <>
                    <Button asChild size="lg"><Link href={signIn}>Sign in <ArrowRight /></Link></Button>
                    <Button asChild size="lg" variant="outline"><Link href="/signup">Create student account</Link></Button>
                  </>
                )}
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {FACTS.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2"><Icon className="size-4 text-accent" aria-hidden /> {label}</li>
                ))}
              </ul>
            </div>

            {/* Join with an exam code: a plain form, so it works before any JavaScript loads. */}
            <div className="rounded-xl border border-t-[3px] border-t-accent bg-card p-6 shadow-md shadow-accent/5 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground"><KeyRound className="size-5" aria-hidden /></span>
                <div>
                  <h2 className="text-lg font-semibold">Have an examination code?</h2>
                  <p className="text-sm text-muted-foreground">Enter the code given by the examination cell.</p>
                </div>
              </div>
              <form action="/student/exams" method="get" className="mt-5 space-y-3">
                <label htmlFor="home-code" className="sr-only">Examination code</label>
                <input
                  id="home-code"
                  name="code"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="SGSU-XXXXXX"
                  maxLength={20}
                  className="flex h-12 w-full rounded-md border border-input bg-card px-4 font-mono text-base uppercase tracking-[0.12em] text-foreground placeholder:tracking-[0.04em] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                />
                <Button type="submit" size="lg" className="w-full">Find examination <ArrowRight /></Button>
              </form>
              <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
                Got an exam <span className="font-medium text-foreground">link</span> instead? Just open it — you&apos;ll be asked to sign in and taken straight to your exam.
              </p>
            </div>
          </div>
        </section>

        <section id="subjects" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Subjects</h2>
          <p className="mt-1.5 text-muted-foreground">Class 11–12 and JEE-level entrance papers, and aptitude assessments.</p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {SUBJECTS.map((g) => (
              <div key={g.group} className="rounded-xl border bg-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{g.group}</p>
                <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                  {g.items.map(({ icon: Icon, name }) => (
                    <li key={name} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-3 text-[15px] font-medium transition-colors hover:border-accent/50 hover:bg-accent-soft/40 sm:flex-col sm:items-start sm:gap-2">
                      <Icon className="size-5 text-primary dark:text-primary-soft-foreground" aria-hidden /> {name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-xl border bg-background p-5">
                  <span className="text-xs font-semibold tabular-nums text-accent">STEP {i + 1}</span>
                  <span className="mt-3 grid size-10 place-items-center rounded-lg bg-accent-soft text-accent-soft-foreground"><s.icon className="size-5" aria-hidden /></span>
                  <p className="mt-3 font-semibold">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="help" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { icon: MonitorCheck, title: "Device requirements", text: "Use a laptop or desktop with a current version of Chrome, Edge or Firefox and a stable internet connection." },
              { icon: Lock, title: "Privacy", text: "Where an exam needs a camera or microphone, video and audio stay on your device. Nothing is recorded or uploaded." },
              { icon: CircleHelp, title: "Need help?", text: "Contact the SGSU examination cell if you cannot sign in or need an accommodation for an exam." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border bg-card p-5">
                <Icon className="size-5 text-primary dark:text-primary-soft-foreground" aria-hidden />
                <p className="mt-3 font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <Logo height={26} />
          <p>© {new Date().getFullYear()} Scope Global Skills University, Bhopal · Examination Cell</p>
        </div>
      </footer>
    </div>
  );
}
