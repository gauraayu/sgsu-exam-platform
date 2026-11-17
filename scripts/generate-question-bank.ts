/**
 * SGSU Question Generator v1.
 * Produces original Class 11–12 / JEE-style MCQs whose answers are computed from the
 * same parameters shown in the question, so every answer key is correct by construction.
 *
 *   npx tsx scripts/generate-question-bank.ts [--per-subject 520] [--seed 2026]
 *
 * Output: src/data/{physics,chemistry,mathematics}/sgsu_generated.jsonl (dataset schema).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Rng, type Item, type Template } from "./generator/core";
import { physics } from "./generator/physics";
import { chemistry } from "./generator/chemistry";
import { maths } from "./generator/maths";
import { chemistryHard, mathsHard, physicsHard } from "./generator/hard";
import { logicalReasoning, quantAptitude, verbalAbility } from "./generator/aptitude";

const args = process.argv.slice(2);
const opt = (name: string, def: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const PER_SUBJECT = opt("per-subject", 520);
const SEED = opt("seed", 2026);

const SUBJECTS: { name: string; dir: string; prefix: string; templates: Template[]; hard: Template[] }[] = [
  { name: "Physics", dir: "physics", prefix: "P", templates: physics, hard: physicsHard },
  { name: "Chemistry", dir: "chemistry", prefix: "C", templates: chemistry, hard: chemistryHard },
  { name: "Mathematics", dir: "mathematics", prefix: "M", templates: maths, hard: mathsHard },
];
/** Aptitude subjects: one file each (sgsu_generated.jsonl) with an explicit difficulty mix. */
const APTITUDE: { name: string; dir: string; prefix: string; templates: Template[]; mix: Record<"Easy" | "Medium" | "Hard", number> }[] = [
  { name: "Quantitative Aptitude", dir: "quantitative-aptitude", prefix: "QA", templates: quantAptitude, mix: { Easy: 70, Medium: 80, Hard: 50 } },
  { name: "Logical Reasoning", dir: "logical-reasoning", prefix: "LR", templates: logicalReasoning, mix: { Easy: 70, Medium: 80, Hard: 50 } },
  { name: "Verbal Ability", dir: "verbal-ability", prefix: "VA", templates: verbalAbility, mix: { Easy: 50, Medium: 55, Hard: 40 } },
];
/** Batch 2 (sgsu_generated_2.jsonl): weighted towards Hard, since the source dataset has few Hard questions. */
const BATCH2 = { Hard: opt("hard", 110), Medium: opt("medium", 30), Easy: opt("easy", 20) };

export function generateSubject(templates: Template[], target: number, seed: number, cfg: { exclude?: Set<string>; difficulty?: Item["difficulty"]; cap?: number } = {}) {
  const rng = new Rng(seed);
  const items: Item[] = [];
  const seen = new Set<string>(cfg.exclude ?? []);
  const perTemplate = new Map<number, number>();
  // Round-robin over templates so topics stay balanced; each template capped to avoid near-clones.
  const cap = cfg.cap ?? Math.max(cfg.difficulty ? 4 : 1, Math.ceil((target / templates.length) * 2.2));
  let stalls = 0;
  while (items.length < target && stalls < 200_000) {
    const ti = items.length % templates.length === 0 ? rng.int(0, templates.length - 1) : rng.int(0, templates.length - 1);
    if ((perTemplate.get(ti) ?? 0) >= cap) { stalls++; continue; }
    let item: Item | null = null;
    try {
      item = templates[ti](rng);
    } catch (e) {
      throw new Error(`Template ${ti} threw: ${(e as Error).message}`);
    }
    if (!item || (cfg.difficulty && item.difficulty !== cfg.difficulty)) { stalls++; continue; }
    const tidy = (x: string) => x.replace(/([+-] )1i\b/g, "$1i").replace(/\$(\s*)1i\b/g, "$$$1i");
    item = { ...item, q: tidy(item.q), sol: tidy(item.sol), correct: tidy(item.correct), wrong: item.wrong.map(tidy) };
    const opts = [item.correct, ...item.wrong];
    const key = item.q.replace(/\s+/g, " ").trim();
    // Mirror the importer's rules so nothing generated is later rejected: ≥25-char stem, no null-like option text.
    const nullLike = (o: string) => ["", "none", "null", "nan", "undefined", "n/a", "na"].includes(o.trim().toLowerCase());
    if (seen.has(key) || key.length < 25 || new Set(opts).size !== 4 || opts.some((o) => nullLike(o) || /NaN|Infinity|undefined/.test(o))) { stalls++; continue; }
    seen.add(key);
    perTemplate.set(ti, (perTemplate.get(ti) ?? 0) + 1);
    items.push(item);
  }
  return { items, perTemplate, stalls };
}

function toLines(items: Item[], s: { name: string; prefix: string }, idStart: number, seed: number) {
  const rng = new Rng(seed);
  return items.map((it, i) => {
    const options = rng.shuffle([it.correct, ...it.wrong]);
    return JSON.stringify({
      question_id: `SGSU-${s.prefix}-${String(idStart + i).padStart(4, "0")}`,
      question: it.q,
      question_images: [],
      option_1: options[0],
      option_2: options[1],
      option_3: options[2],
      option_4: options[3],
      correct_option: options.indexOf(it.correct) + 1,
      numerical_answer: null,
      solution: it.sol,
      solution_images: [],
      subject: s.name,
      topic: it.topic,
      subtopic: it.subtopic,
      difficulty: it.difficulty,
      question_type: "single_correct",
      has_image: false,
      exam: "SGSU Practice",
      source_paper: "SGSU Question Generator v1 (computed answers)",
    });
  });
}

const tally = (items: Item[]) => items.reduce<Record<string, number>>((a, x) => ((a[x.difficulty] = (a[x.difficulty] ?? 0) + 1), a), {});
const stemKey = (q: string) => q.replace(/\s+/g, " ").trim();

function main() {
  const root = path.resolve(__dirname, "..");
  for (const [ai, a] of APTITUDE.entries()) {
    const dir = path.join(root, "src", "data", a.dir);
    mkdirSync(dir, { recursive: true });
    const used = new Set<string>();
    const all: Item[] = [];
    for (const [d, n] of Object.entries(a.mix) as [Item["difficulty"], number][]) {
      const got = generateSubject(a.templates, n, SEED * 17 + ai * 211 + d.length, { exclude: used, difficulty: d, cap: Math.ceil(n / 3) }).items;
      if (got.length < n) throw new Error(`${a.name}: only ${got.length}/${n} ${d} questions — add templates`);
      got.forEach((x) => used.add(stemKey(x.q)));
      all.push(...got);
    }
    writeFileSync(path.join(dir, "sgsu_generated.jsonl"), toLines(all, a, 1, SEED * 41 + ai).join("\n") + "\n");
    console.log(`${a.name}: ${all.length} questions, ${new Set(all.map((x) => x.topic)).size} topics, ${JSON.stringify(tally(all))}`);
  }
  for (const [si, s] of SUBJECTS.entries()) {
    const dir = path.join(root, "src", "data", s.dir);
    mkdirSync(dir, { recursive: true });

    // Batch 1: Easy/Medium bank (unchanged IDs SGSU-X-0001…).
    const { items, perTemplate } = generateSubject(s.templates, PER_SUBJECT, SEED + si * 7919);
    if (items.length < PER_SUBJECT) throw new Error(`${s.name}: only ${items.length}/${PER_SUBJECT} unique questions — add templates`);
    writeFileSync(path.join(dir, "sgsu_generated.jsonl"), toLines(items, s, 1, SEED * 31 + si).join("\n") + "\n");
    console.log(`${s.name} batch 1: ${items.length} questions, ${new Set(items.map((x) => x.topic)).size} topics, ${perTemplate.size}/${s.templates.length} templates, ${JSON.stringify(tally(items))}`);

    // Batch 2: Hard-weighted (IDs SGSU-X-2001…), never repeating a batch-1 stem.
    const used = new Set(items.map((x) => stemKey(x.q)));
    const batch: Item[] = [];
    for (const [d, n] of Object.entries(BATCH2) as [Item["difficulty"], number][]) {
      if (!n) continue;
      const pool = d === "Hard" ? s.hard : s.templates;
      const got = generateSubject(pool, n, SEED * 13 + si * 101 + d.length, { exclude: used, difficulty: d }).items;
      if (got.length < n) throw new Error(`${s.name} batch 2: only ${got.length}/${n} ${d} questions — add templates`);
      got.forEach((x) => used.add(stemKey(x.q)));
      batch.push(...got);
    }
    writeFileSync(path.join(dir, "sgsu_generated_2.jsonl"), toLines(batch, s, 2001, SEED * 37 + si).join("\n") + "\n");
    console.log(`${s.name} batch 2: ${batch.length} questions, ${JSON.stringify(tally(batch))}`);
  }
}

if (require.main === module) main();
