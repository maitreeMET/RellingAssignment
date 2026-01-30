// src/main/clipMetadataBackfill.ts
import fs from "node:fs";
import path from "node:path";
import { getClipsDir } from "./paths";
import { extractVideoMetadata } from "./videoMetadata";
import { upsertClip } from "./db/queries";

function parseClipIndex(filename: string): number | null {
  // expects clip_000.mp4
  const m = filename.match(/^clip_(\d{3})\.mp4$/);
  if (!m) return null;
  return Number(m[1]);
}

export async function backfillClipMetadata(video_id: string): Promise<{ scanned: number; upserted: number }> {
  const clipsDir = getClipsDir(video_id);
  const files = fs.readdirSync(clipsDir);

  let scanned = 0;
  let upserted = 0;

  for (const f of files) {
    const idx = parseClipIndex(f);
    if (idx === null) continue;

    const fullPath = path.join(clipsDir, f);

    // only files > 1KB
    try {
      const st = fs.statSync(fullPath);
      if (!st.isFile() || st.size <= 1024) continue;
    } catch {
      continue;
    }

    scanned++;

    const meta = await extractVideoMetadata(fullPath);

    let size: number | null = null;
    try {
      size = fs.statSync(fullPath).size;
    } catch {
      size = meta.file_size_bytes ?? null;
    }

    upsertClip({
      video_id,
      clip_index: idx,
      path: fullPath,
      duration: meta.duration_seconds,
      fps: meta.fps,
      width: meta.width,
      height: meta.height,
      file_size_bytes: size,
    });

    upserted++;
  }

  return { scanned, upserted };
}
