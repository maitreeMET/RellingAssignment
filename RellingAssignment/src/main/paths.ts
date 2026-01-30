// src/main/paths.ts
import path from "node:path";
import fs from "node:fs";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export function getVideoDir(video_id: string): string {
  const dir = path.resolve(process.cwd(), "data", "videos", video_id);
  ensureDir(dir);
  return dir;
}

export function getClipsDir(video_id: string): string {
  const dir = path.join(getVideoDir(video_id), "clips");
  ensureDir(dir);
  return dir;
}

export function clipPath(video_id: string, clipIndex: number): string {
  const name = `clip_${String(clipIndex).padStart(3, "0")}.mp4`;
  return path.join(getClipsDir(video_id), name);
}
