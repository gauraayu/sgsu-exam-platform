import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Question } from "@/models";
import { SUBJECTS, SUBJECT_SLUGS, type Subject } from "@/lib/constants";
import { applyMapping, findAmbiguousImages, LOCAL_DATASET_MAPPING } from "@/lib/dataset/normalize";
import { parseJsonDocument, parseJsonl } from "@/lib/dataset/parse-files";
import { badRequest } from "@/lib/errors";
import type { CurationOverlay, ImportInputFile } from "./import.service";

/** Overridable for tests; defaults to the read-only datasets shipped in src/data. */
const DATA_DIR = process.env.SGSU_DATA_DIR ? path.resolve(process.env.SGSU_DATA_DIR) : path.join(process.cwd(), "src", "data");
const FILE_PATTERN = /^[\w.-]+\.(jsonl|json)$/i;

export interface LocalDatasetFile {
  id: string; // "physics/train.jsonl"
  subject: Subject;
  filename: string;
  sizeBytes: number;
  recordCount: number;
  importedCount: number;
}

export interface LocalDatasetListing {
  subjects: { subject: Subject; slug: string; present: boolean; files: LocalDatasetFile[]; imagesFolder: boolean; imageCount: number }[];
  datasetInfo: Record<string, unknown> | null;
}

function countRecords(file: string): number {
  const text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".json")) return parseJsonDocument(text).rows.length;
  return text.split(/\r?\n/).filter((l) => l.trim()).length;
}

export function readCuration(): CurationOverlay | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, "curation.json"), "utf8"));
  } catch {
    return null;
  }
}

export function readDatasetInfo(): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, "DATASET_INFO.json"), "utf8"));
  } catch {
    return null;
  }
}

/** Lists permitted dataset files in src/data/{subject}/. Subjects without files are reported as not present. */
export async function listLocalDatasets(): Promise<LocalDatasetListing> {
  const imported = await Question.aggregate<{ _id: string; n: number }>([
    { $match: { sourceType: "local_dataset" } },
    { $group: { _id: "$sourceFile", n: { $sum: 1 } } },
  ]);
  const importedMap = new Map(imported.map((i) => [i._id, i.n]));

  const subjects = SUBJECTS.map((subject) => {
    const slug = SUBJECT_SLUGS[subject];
    const dir = path.join(DATA_DIR, slug);
    const files: LocalDatasetFile[] = [];
    if (fs.existsSync(dir)) {
      for (const filename of fs.readdirSync(dir).sort()) {
        if (!FILE_PATTERN.test(filename)) continue;
        const full = path.join(dir, filename);
        const id = `${slug}/${filename}`;
        files.push({
          id,
          subject,
          filename,
          sizeBytes: fs.statSync(full).size,
          recordCount: countRecords(full),
          importedCount: importedMap.get(id) ?? 0,
        });
      }
    }
    const imagesDir = path.join(process.cwd(), "public", "questions", slug, "images");
    const imagesFolder = fs.existsSync(imagesDir);
    return {
      subject,
      slug,
      present: files.length > 0,
      files,
      imagesFolder,
      imageCount: imagesFolder ? fs.readdirSync(imagesDir).length : 0,
    };
  });
  return { subjects, datasetInfo: readDatasetInfo() };
}

function resolveFileId(id: string): { subject: Subject; full: string } {
  const [slug, filename, ...rest] = id.split("/");
  const subject = SUBJECTS.find((s) => SUBJECT_SLUGS[s] === slug);
  if (!subject || !filename || rest.length || !FILE_PATTERN.test(filename)) throw badRequest(`Unknown dataset file "${id}".`);
  const full = path.join(DATA_DIR, slug, filename);
  if (!full.startsWith(DATA_DIR + path.sep) || !fs.existsSync(full)) throw badRequest(`Dataset file "${id}" does not exist.`);
  return { subject, full };
}

function readFile(full: string) {
  const text = fs.readFileSync(full, "utf8");
  return full.endsWith(".json") ? parseJsonDocument(text) : parseJsonl(text);
}

/**
 * Loads the selected files. Image ambiguity is computed over every file of the affected
 * subjects (not only the selected ones) so results do not depend on the selection.
 */
export function loadLocalFiles(ids: string[]): { inputs: ImportInputFile[]; ambiguousImages: Set<string> } {
  if (!ids.length) throw badRequest("Select at least one dataset file.");
  const unique = [...new Set(ids)];
  const resolved = unique.map((id) => ({ id, ...resolveFileId(id) }));
  const inputs: ImportInputFile[] = resolved.map((r) => {
    const parsed = readFile(r.full);
    return { file: r.id, rows: parsed.rows, parseErrors: parsed.errors };
  });

  const subjects = new Set(resolved.map((r) => r.subject));
  const allRecords = [];
  for (const subject of subjects) {
    const dir = path.join(DATA_DIR, SUBJECT_SLUGS[subject]);
    for (const filename of fs.readdirSync(dir)) {
      if (!FILE_PATTERN.test(filename)) continue;
      for (const row of readFile(path.join(dir, filename)).rows) allRecords.push(applyMapping(row.data, LOCAL_DATASET_MAPPING));
    }
  }
  return { inputs, ambiguousImages: findAmbiguousImages(allRecords) };
}
