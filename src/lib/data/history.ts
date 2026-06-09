import { promises as fs } from "node:fs";
import path from "node:path";
import type { AnalysisRecord } from "@/lib/types";

const HISTORY_DIR = path.join(process.cwd(), "data", "history");

async function ensureDir() {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
}

function fileNameFor(record: AnalysisRecord): string {
  const ts = record.startedAt.replace(/[:.]/g, "-");
  return `${ts}_${record.ticker}.json`;
}

export async function saveAnalysis(record: AnalysisRecord): Promise<string> {
  await ensureDir();
  const fp = path.join(HISTORY_DIR, fileNameFor(record));
  await fs.writeFile(fp, JSON.stringify(record, null, 2), "utf-8");
  return fp;
}

export async function listAnalyses(limit = 50): Promise<AnalysisRecord[]> {
  await ensureDir();
  const files = await fs.readdir(HISTORY_DIR);
  const jsonFiles = files
    .filter((f) => f.endsWith(".json") && !f.startsWith("."))
    .sort()
    .reverse()
    .slice(0, limit);

  const records: AnalysisRecord[] = [];
  for (const f of jsonFiles) {
    try {
      const content = await fs.readFile(path.join(HISTORY_DIR, f), "utf-8");
      records.push(JSON.parse(content));
    } catch {
      // skip corrupt files
    }
  }
  return records;
}

export async function listByTicker(ticker: string, limit = 100): Promise<AnalysisRecord[]> {
  await ensureDir();
  const files = await fs.readdir(HISTORY_DIR);
  const upper = ticker.toUpperCase();
  const jsonFiles = files
    .filter((f) => f.endsWith(".json") && !f.startsWith(".") && f.toUpperCase().includes(`_${upper}.`))
    .sort()
    .reverse()
    .slice(0, limit);

  const records: AnalysisRecord[] = [];
  for (const f of jsonFiles) {
    try {
      const content = await fs.readFile(path.join(HISTORY_DIR, f), "utf-8");
      records.push(JSON.parse(content));
    } catch {
      // skip corrupt files
    }
  }
  return records;
}

export async function getAnalysis(id: string): Promise<AnalysisRecord | null> {
  await ensureDir();
  const files = await fs.readdir(HISTORY_DIR);
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    try {
      const content = await fs.readFile(path.join(HISTORY_DIR, f), "utf-8");
      const rec = JSON.parse(content) as AnalysisRecord;
      if (rec.id === id) return rec;
    } catch {
      // skip
    }
  }
  return null;
}
