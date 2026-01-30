// src/main/metadataPipeline.ts
import { getVideo, saveVideoMetadata, setVideoError } from "./db/queries";
import { extractVideoMetadata } from "./videoMetadata";
import { appendLog, truncateForDb } from "./logs";

export async function extractAndPersistMetadata(video_id: string): Promise<void> {
  // Clear any prior error first (optional but nice)
  setVideoError(video_id, null);

  const video = getVideo(video_id);
  try {
    const meta = await extractVideoMetadata(video.original_path);

    // Save metadata JSON (string) + rotation raw in dedicated column
    saveVideoMetadata(video_id, JSON.stringify(meta), meta.rotation_raw ?? null);
  } catch (e: any) {
    // store a readable error for UI
    const errorMsg = e?.message ?? String(e);
    const full = `---- ${new Date().toISOString()} metadata extraction ----\n${errorMsg}\n${e?.stack ?? ''}\n\n`;
    const logPath = appendLog(`${video_id}-ffprobe.log`, full);

    setVideoError(
      video_id,
      `Metadata extraction failed.\nFull log: ${logPath}\n${truncateForDb(errorMsg, 500)}`
    );
  }
}
