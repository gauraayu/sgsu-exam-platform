/**
 * Writes src/data/asset-manifest.json listing every question image under public/questions.
 * Runs automatically before `next build` so serverless functions can validate image references
 * without filesystem access to public/.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "public", "questions");
const files: string[] = [];
if (fs.existsSync(root)) {
  for (const subject of fs.readdirSync(root)) {
    const dir = path.join(root, subject, "images");
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) files.push(`/questions/${subject}/images/${f}`);
  }
}
files.sort();
const out = path.join(process.cwd(), "src", "data", "asset-manifest.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), count: files.length, files }, null, 0));
console.log(`[assets] manifest written with ${files.length} image(s) → ${path.relative(process.cwd(), out)}`);
