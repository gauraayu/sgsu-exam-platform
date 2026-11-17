import { DIFFICULTIES, type Difficulty } from "@/lib/constants";

export type DifficultyCounts = Record<Difficulty, number>;
export type Availability = Record<string, Partial<Record<Difficulty, number>>>;

export interface SubjectRequest {
  subject: string;
  count: number;
  /** Exact subject-specific split; must sum to count when provided. */
  difficulty?: DifficultyCounts | null;
}

export type AllocationPlan = Record<string, DifficultyCounts | { Any: number }>;

export type AllocationResult = { ok: true; plan: AllocationPlan } | { ok: false; problems: string[] };

const sum = (d: Partial<Record<string, number>>) => Object.values(d).reduce<number>((a, b) => a + (b ?? 0), 0);

/** Edmonds–Karp max flow on a small dense graph. */
function maxFlow(cap: number[][], s: number, t: number) {
  const n = cap.length;
  const flow = cap.map((row) => row.map(() => 0));
  let total = 0;
  for (;;) {
    const parent = new Array<number>(n).fill(-1);
    parent[s] = s;
    const queue = [s];
    while (queue.length && parent[t] === -1) {
      const u = queue.shift()!;
      for (let v = 0; v < n; v++) {
        if (parent[v] === -1 && cap[u][v] - flow[u][v] > 0) {
          parent[v] = u;
          queue.push(v);
        }
      }
    }
    if (parent[t] === -1) break;
    let bottleneck = Infinity;
    for (let v = t; v !== s; v = parent[v]) bottleneck = Math.min(bottleneck, cap[parent[v]][v] - flow[parent[v]][v]);
    for (let v = t; v !== s; v = parent[v]) {
      flow[parent[v]][v] += bottleneck;
      flow[v][parent[v]] -= bottleneck;
    }
    total += bottleneck;
  }
  return { total, flow };
}

const shortageMessage = (available: number, label: string) =>
  `Only ${available} usable ${label} question${available === 1 ? " is" : "s are"} available for the selected filters. Please add more questions or adjust the distribution.`;

/**
 * Decides how many questions to draw from each (subject, difficulty) cell so that the
 * subject totals, optional subject-specific splits and the optional overall difficulty split
 * are all met exactly. Never relaxes a constraint — reports precise shortages instead.
 */
export function allocate(subjects: SubjectRequest[], overall: DifficultyCounts | null, availability: Availability): AllocationResult {
  const problems: string[] = [];
  const avail = (s: string, d: Difficulty) => availability[s]?.[d] ?? 0;
  const availTotal = (s: string) => DIFFICULTIES.reduce((a, d) => a + avail(s, d), 0);
  const requested = subjects.filter((s) => s.count > 0);

  for (const s of requested) {
    if (availTotal(s.subject) < s.count) problems.push(shortageMessage(availTotal(s.subject), s.subject));
    if (s.difficulty) {
      if (sum(s.difficulty) !== s.count) problems.push(`${s.subject}: the difficulty split (${sum(s.difficulty)}) must add up to ${s.count}.`);
      for (const d of DIFFICULTIES) {
        if ((s.difficulty[d] ?? 0) > avail(s.subject, d)) problems.push(shortageMessage(avail(s.subject, d), `${d} ${s.subject}`));
      }
    }
  }
  if (problems.length) return { ok: false, problems };

  const plan: AllocationPlan = {};
  const fixed = requested.filter((s) => s.difficulty);
  const flexible = requested.filter((s) => !s.difficulty);
  for (const s of fixed) plan[s.subject] = { ...s.difficulty! };

  if (!overall) {
    for (const s of flexible) plan[s.subject] = { Any: s.count };
    return { ok: true, plan };
  }

  const total = sum(Object.fromEntries(requested.map((s) => [s.subject, s.count])));
  if (sum(overall) !== total) return { ok: false, problems: [`The overall difficulty split (${sum(overall)}) must add up to the total number of questions (${total}).`] };

  // Remaining per-difficulty demand after subjects with an explicit split.
  const remaining = { ...overall };
  for (const s of fixed) for (const d of DIFFICULTIES) remaining[d] -= s.difficulty![d] ?? 0;
  const negative = DIFFICULTIES.filter((d) => remaining[d] < 0);
  if (negative.length)
    return { ok: false, problems: negative.map((d) => `Subject-specific splits request more ${d} questions than the overall ${d} count (${overall[d]}).`) };
  if (!flexible.length) {
    const mismatch = DIFFICULTIES.filter((d) => remaining[d] !== 0);
    return mismatch.length
      ? { ok: false, problems: [`Subject-specific splits do not match the overall difficulty split for: ${mismatch.join(", ")}.`] }
      : { ok: true, plan };
  }

  // Flow network: source → subject → (subject,difficulty) capacity → difficulty → sink.
  const S = 0;
  const subjIdx = (i: number) => 1 + i;
  const diffIdx = (j: number) => 1 + flexible.length + j;
  const T = 1 + flexible.length + DIFFICULTIES.length;
  const cap = Array.from({ length: T + 1 }, () => new Array<number>(T + 1).fill(0));
  flexible.forEach((s, i) => {
    cap[S][subjIdx(i)] = s.count;
    DIFFICULTIES.forEach((d, j) => (cap[subjIdx(i)][diffIdx(j)] = avail(s.subject, d)));
  });
  DIFFICULTIES.forEach((d, j) => (cap[diffIdx(j)][T] = remaining[d]));
  const { total: flowTotal, flow } = maxFlow(cap, S, T);
  const needed = flexible.reduce((a, s) => a + s.count, 0);

  if (flowTotal < needed) {
    const out: string[] = [];
    DIFFICULTIES.forEach((d) => {
      const pool = flexible.reduce((a, s) => a + avail(s.subject, d), 0);
      if (pool < remaining[d]) out.push(shortageMessage(pool, `${d}`) + ` (requested ${remaining[d]} across ${flexible.map((s) => s.subject).join(", ")}).`);
    });
    if (!out.length)
      out.push("The requested subject and difficulty distributions cannot be satisfied together with the questions available. Adjust the difficulty split or add subject-specific splits.");
    return { ok: false, problems: out };
  }

  flexible.forEach((s, i) => {
    plan[s.subject] = Object.fromEntries(DIFFICULTIES.map((d, j) => [d, flow[subjIdx(i)][diffIdx(j)]])) as DifficultyCounts;
  });
  return { ok: true, plan };
}
