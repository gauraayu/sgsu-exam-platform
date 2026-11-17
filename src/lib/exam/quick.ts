/**
 * Pure planning logic for "Quick Generate": turns the saved defaults plus the chosen subjects
 * into exact subject and difficulty counts and a title. No database access, so it is unit-tested.
 */
import { SUBJECT_GROUPS, SUBJECT_SHORT, SUBJECTS, type Difficulty, type Subject } from "@/lib/constants";

/** Largest-remainder apportionment: integer counts proportional to `weights` that add up to `total` exactly. Ties go to the earlier item. */
export function apportion(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (!weights.length) return [];
  if (sum <= 0) return apportion(total, weights.map(() => 1));
  const raw = weights.map((w) => (Math.max(0, w) / sum) * total);
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, n) => a + n, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k].i]++;
  return out;
}

export interface QuickPreset {
  name: string;
  counts: Partial<Record<Subject, number>>;
}

/** Orders subjects canonically (Physics, Chemistry, Mathematics, Quant, Reasoning, Verbal). */
export function canonicalSubjects(subjects: readonly string[]): Subject[] {
  const set = new Set(subjects);
  return SUBJECTS.filter((s) => set.has(s));
}

/**
 * Subject counts: a preset whose subjects are exactly the selected ones is used (scaled to the
 * total if its counts add up to a different number); otherwise the total is split as evenly as
 * possible, extra questions going to subjects in canonical order.
 */
export function planSubjects(total: number, subjects: readonly string[], presets: QuickPreset[]): { counts: Record<string, number>; preset: string | null } {
  const sel = canonicalSubjects(subjects);
  const key = sel.join("|");
  const preset = presets.find((p) => canonicalSubjects(Object.keys(p.counts).filter((s) => (p.counts[s as Subject] ?? 0) > 0)).join("|") === key);
  const weights = preset ? sel.map((s) => preset.counts[s] ?? 0) : sel.map(() => 1);
  const n = apportion(total, weights);
  return { counts: Object.fromEntries(sel.map((s, i) => [s, n[i]])), preset: preset?.name ?? null };
}

export function planDifficulty(total: number, percent: Record<Difficulty, number>): Record<Difficulty, number> {
  const [Easy, Medium, Hard] = apportion(total, [percent.Easy, percent.Medium, percent.Hard]);
  return { Easy, Medium, Hard };
}

/** "PCM", "Aptitude", a single subject, or short names joined with "&". */
export function subjectsLabel(subjects: readonly string[]): string {
  const sel = canonicalSubjects(subjects);
  const group = SUBJECT_GROUPS.find((g) => g.subjects.length === sel.length && g.subjects.every((s) => sel.includes(s)));
  if (group) return group.name === "PCM" ? "PCM Entrance" : group.name;
  if (sel.length === 1) return sel[0];
  return sel.map((s) => SUBJECT_SHORT[s]).join(" & ");
}

export function formatTitle(pattern: string, subjects: readonly string[], date: Date): string {
  const d = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const t = (pattern || "SGSU {subjects} Assessment").replaceAll("{subjects}", subjectsLabel(subjects)).replaceAll("{date}", d);
  return t.replace(/\s+/g, " ").trim().slice(0, 200);
}

export const DEFAULT_PRESETS: QuickPreset[] = [
  { name: "PCM", counts: { Physics: 35, Chemistry: 35, Mathematics: 30 } },
  { name: "Aptitude", counts: { "Quantitative Aptitude": 40, "Logical Reasoning": 35, "Verbal Ability": 25 } },
];
