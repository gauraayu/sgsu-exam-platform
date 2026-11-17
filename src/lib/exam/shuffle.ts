import { randomInt } from "node:crypto";

/** Unbiased Fisher–Yates shuffle using a CSPRNG. Returns a new array. */
export function shuffle<T>(input: readonly T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample<T>(input: readonly T[], n: number): T[] {
  return shuffle(input).slice(0, n);
}
