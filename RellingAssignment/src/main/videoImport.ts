// src/main/videoImport.ts
import fs from "node:fs";
import path from "node:path";
import { makeVideoId, createVideo } from "./db/queries";

/**
 * Optional lightweight MP4 sniff:
 * MP4 files typically contain the "ftyp" box at bytes 4..7.
 * This prevents someone renaming a .txt to .mp4.
 */
function looksLikeMp4(filePath: string): boolean {
  const fd = fs.openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, 0);
    if (bytesRead < 8) return false;
    return buf.slice(4, 8).toString("ascii") === "ftyp";
  } finally {
    fs.closeSync(fd);
  }
}

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

export type ImportVideoResult =
  | { ok: true; video_id: string }
  | { ok: false; error: string };

export function importVideoFromFilePickerPath(
  pickedFilePath: string
): ImportVideoResult {
  try {
    // 1) Validate extension
    const ext = path.extname(pickedFilePath).toLowerCase();
    if (ext !== ".mp4") {
      return { ok: false, error: "Only .mp4 files are allowed." };
    }

    // 2) Optional extra sniff
    if (!looksLikeMp4(pickedFilePath)) {
      return { ok: false, error: "File does not look like a valid MP4 (ftyp box missing)." };
    }

    // 3) Create video_id and destination folder
    const video_id = makeVideoId();
    const videoDir = path.resolve(process.cwd(), "data", "videos", video_id);
    ensureDir(videoDir);

    // 4) Copy to deterministic path
    const destPath = path.join(videoDir, "original.mp4");
    fs.copyFileSync(pickedFilePath, destPath);

    // 5) Insert DB row (status defaults to Pending in your createVideo)
    const filename = path.basename(pickedFilePath);
    createVideo({
      video_id,
      filename,
      original_path: destPath,
    });

    return { ok: true, video_id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}
