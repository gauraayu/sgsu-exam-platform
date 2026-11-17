/**
 * Core helpers for the SGSU question generator. Every answer is computed from the same
 * parameters that appear in the question, so the answer key is correct by construction.
 */
export type Difficulty = "Easy" | "Medium" | "Hard";
export interface Item {
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
  q: string;
  correct: string;
  wrong: string[];
  sol: string;
}
export type Template = (r: Rng) => Item | null;

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next() {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a: number, b: number) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr).slice(0, n);
  }
}

/** Formats a number compactly: integers as-is, otherwise up to 3 decimals (4 significant digits). */
export function f(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
  const abs = Math.abs(x);
  if (abs >= 1e5 || abs < 1e-3) return m(sci(x));
  const v = Number(x.toPrecision(4));
  return String(Number(v.toFixed(3)));
}

/** Scientific notation in LaTeX: 3.2 \times 10^{-5}. */
export function sci(x: number, digits = 3): string {
  if (x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x)));
  let e2 = e;
  let m = Number((x / 10 ** e).toPrecision(digits));
  if (Math.abs(m) >= 10) {
    m = Number((m / 10).toPrecision(digits));
    e2 = e + 1;
  }
  return `${m} \\times 10^{${e2}}`;
}

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** Reduced fraction as LaTeX. */
export function frac(n: number, d: number): string {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  if (d === 1) return String(n);
  return `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
}

export const m = (s: string) => `$${s}$`;

/** Numeric item with unit; wrong values are plausible mistakes, padded with scaled values if needed. */
export function num(
  r: Rng,
  base: Omit<Item, "correct" | "wrong">,
  answer: number,
  wrongs: number[],
  unit = "",
  format: (x: number) => string = f,
): Item | null {
  const show = (x: number) => (unit ? `${format(x)} ${unit}` : format(x));
  const correct = show(answer);
  const seen = new Set([correct]);
  const wrong: string[] = [];
  const intMode = Number.isInteger(answer) && wrongs.every((w) => !Number.isFinite(w) || Number.isInteger(w));
  const add = (x: number) => {
    if (!Number.isFinite(x) || x === answer) return;
    // Counts stay integers; physical magnitudes (with a unit) never get a negative distractor.
    if (intMode && !Number.isInteger(x)) return;
    if (unit && answer > 0 && x <= 0) return;
    if (answer !== 0 && /^0(\s|$)/.test(show(x))) return;
    const s = show(x);
    if (seen.has(s)) return;
    seen.add(s);
    wrong.push(s);
  };
  wrongs.forEach(add);
  const scales = r.shuffle([2, 0.5, 1.5, 4, 0.25, 3, 1.25, 0.75, 10, 0.1]);
  for (const k of scales) {
    if (wrong.length >= 3) break;
    add(answer * k);
  }
  for (let d = 1; wrong.length < 3 && d < 20; d++) add(answer + d * (answer === 0 ? 1 : Math.sign(answer)));
  if (wrong.length < 3) return null;
  return { ...base, correct, wrong: wrong.slice(0, 3) };
}

/** Text options (conceptual questions): correct + 3 distinct distractors. */
export function txt(r: Rng, base: Omit<Item, "correct" | "wrong">, correct: string, pool: string[]): Item | null {
  const wrong = r.shuffle([...new Set(pool.filter((p) => p !== correct))]).slice(0, 3);
  if (wrong.length < 3) return null;
  return { ...base, correct, wrong };
}

/** Formats a value that is a simple rational number as a LaTeX fraction (denominator ≤ 500). */
export function ratio(x: number): string {
  for (let d = 1; d <= 500; d++) {
    const n = Math.round(x * d);
    if (Math.abs(x - n / d) < 1e-9) return m(frac(n, d));
  }
  return f(x);
}
