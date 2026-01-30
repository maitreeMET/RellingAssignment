// src/main/duration.ts
import { getVideo, saveVideoMetadata } from "./db/queries";
import { extractVideoMetadata } from "./videoMetadata";

/**
 * Returns duration_seconds for a video_id.
 * Prefer stored metadata_json. If missing, compute it (ffprobe) and persist.
 */
export async function getDurationSeconds(video_id: string): Promise<number> {
  const v = getVideo(video_id);

  // 1) try DB metadata_json
  if (v.metadata_json) {
    try {
      const meta = JSON.parse(v.metadata_json);
      const d = Number(meta?.duration_seconds);
      if (Number.isFinite(d) && d > 0) return d;
    } catch {
      // ignore parse errors
    }
  }

  // 2) fallback: ffprobe now + persist
  const meta = await extractVideoMetadata(v.original_path);
  saveVideoMetadata(video_id, JSON.stringify(meta), meta.rotation_raw ?? null);

  if (meta.duration_seconds === null || meta.duration_seconds <= 0) {
    throw new Error("Could not determine video duration.");
  }
  return meta.duration_seconds;
}
