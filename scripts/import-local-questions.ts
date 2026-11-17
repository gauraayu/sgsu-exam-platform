/**
 * Optional CLI alternative to Admin → Import Questions → Local dataset.
 *   npm run import:local                       # all subjects, all files
 *   npm run import:local -- physics/train.jsonl # specific files
 *   npm run import:local -- --dry-run          # statistics only
 *   npm run import:local -- --update-existing  # apply source changes (resets verification on material change)
 */
import "./_env";
import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { LOCAL_DATASET_MAPPING } from "@/lib/dataset/normalize";
import { listLocalDatasets, loadLocalFiles, readCuration, readDatasetInfo } from "@/services/local-dataset.service";
import { analyzeImport, commitImport } from "@/services/import.service";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const updateExisting = args.includes("--update-existing");
  await connectDB();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));

  const listing = await listLocalDatasets();
  for (const s of listing.subjects) console.log(`${s.subject.padEnd(12)} ${s.present ? s.files.map((f) => `${f.filename} (${f.recordCount})`).join(", ") : "not present — not imported"}`);
  const files = args.filter((a) => !a.startsWith("--"));
  const ids = files.length ? files : listing.subjects.flatMap((s) => s.files.map((f) => f.id));
  if (!ids.length) throw new Error("No dataset files found in src/data/.");

  const { inputs, ambiguousImages } = loadLocalFiles(ids);
  const applyCuration = !args.includes("--no-curation");
  const ctx = { sourceType: "local_dataset" as const, mapping: LOCAL_DATASET_MAPPING, ambiguousImages, curation: applyCuration ? readCuration() : null, removeUnusable: applyCuration, sourceLicense: String(readDatasetInfo()?.license ?? "") };
  if (dryRun) {
    const a = await analyzeImport(inputs, ctx);
    console.table(a.stats);
    if (args.includes("--show-removed")) for (const x of a.removed) console.log(JSON.stringify(x).slice(0, 300));
  } else {
    const admin = await User.findOne({ role: "ADMIN" }).select("_id").lean();
    if (!admin) throw new Error("Create an administrator first: npm run seed:admin");
    const r = await commitImport(inputs, ctx, { userId: new Types.ObjectId(String(admin._id)), updateExisting });
    console.table(r.stats);
    console.log(`✔ Import batch ${r.batchId} recorded. New questions are in Pending Review.`);
  }
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("✖", e instanceof Error ? e.message : e);
  await mongoose.disconnect();
  process.exit(1);
});
