import fs from "node:fs";
import path from "node:path";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function logsDir(): string {
  const dir = path.resolve(process.cwd(), "data", "logs");
  ensureDir(dir);
  return dir;
}

export function appendLog(filename: string, text: string) {
  const p = path.join(logsDir(), filename);
  fs.appendFileSync(p, text);
  return p;
}

export function truncateForDb(s: string, max = 4000): string {
  if (!s) return "";
  return s.length <= max ? s : s.slice(0, max) + `\n... (truncated, total=${s.length})`;
}
