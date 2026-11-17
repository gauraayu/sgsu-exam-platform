import fs from "node:fs";
import { loadLocalFiles } from "@/services/local-dataset.service";
import { applyMapping, normalizeQuestion, LOCAL_DATASET_MAPPING } from "@/lib/dataset/normalize";
import { imageExists } from "@/lib/assets";

const ids = ["physics", "chemistry", "mathematics"].flatMap((s) => [`${s}/train.jsonl`, `${s}/test.jsonl`]);
const { inputs, ambiguousImages } = loadLocalFiles(ids);
const keyless: unknown[] = [], unclassified: unknown[] = [], stats: Record<string, number> = {};
for (const f of inputs) {
  const occ = new Map<string, number>();
  for (const r of f.rows) {
    const rec = applyMapping(r.data, LOCAL_DATASET_MAPPING);
    const n = normalizeQuestion(rec, imageExists, { ambiguousImages });
    if (!n.ok) continue;
    const q = n.question;
    const id = q.originalQuestionId || `line-${r.line}`;
    const o = (occ.get(id) ?? 0) + 1; occ.set(id, o);
    const key = `${f.file}#${id}#${o}`;
    const inc = q.issues.includes("incomplete_options");
    const keyIssue = q.issues.includes("missing_answer_key") || q.issues.includes("invalid_answer_key");
    if (keyIssue) stats[inc ? "key_but_incomplete_options" : "key_with_full_options"] = (stats[inc ? "key_but_incomplete_options" : "key_with_full_options"] ?? 0) + 1;
    if (keyIssue && !inc) keyless.push({ key, subject: q.subject, q: q.questionText, o: q.options, sol: q.explanation, raw: String(r.data.correct_option), qi: q.questionImages.length });
    if (q.difficulty === "Unclassified") unclassified.push({ key, subject: q.subject, topic: q.topic, sub: q.subtopic, q: q.questionText.slice(0, 260), sl: q.explanation.length });
  }
}
fs.writeFileSync("/tmp/keyless.json", JSON.stringify(keyless, null, 1));
fs.writeFileSync("/tmp/unclassified.json", JSON.stringify(unclassified));
console.log(stats, "keyless", keyless.length, "unclassified", unclassified.length);
