// src/main/clipPipeline.ts
import fs from "node:fs";
import { runCommand } from "./utils/runCommand";
import { getVideo, setClipJobState, upsertClip, setVideoError, listClips } from "./db/queries";
import { getDurationSeconds } from "./duration";
import { clipPath, getClipsDir } from "./paths";
import { extractVideoMetadata } from "./videoMetadata";
import { backfillClipMetadata } from "./clipMetadataBackfill";
import { appendLog, truncateForDb } from "./logs";

const CLIP_LEN_SECONDS = 120;

// Prevent duplicate concurrent jobs in one app session
const activeJobs = new Set<string>();

function fileLooksComplete(p: string): boolean {
  try {
    const st = fs.statSync(p);
    // heuristic: must exist and be non-trivially sized
    return st.isFile() && st.size > 1024;
  } catch {
    return false;
  }
}

function safeUnlink(p: string) {
  try { fs.unlinkSync(p); } catch {}
}

export async function generateClipsForVideo(video_id: string): Promise<void> {
  if (activeJobs.has(video_id)) return;
  activeJobs.add(video_id);

  try {
    const v = getVideo(video_id);
    if (v.status !== "Approved") return;

    // Clear visible error (optional)
    setVideoError(video_id, null);

    // Mark job started
    setClipJobState(video_id, "Generating", { stderr: null, exitCode: null });

    // Ensure clips dir exists (deterministic)
    const clipsDir = getClipsDir(video_id);

    // Drift repair: check if files exist but DB rows are missing
    let existingRows = listClips(video_id);
    const hasAnyFiles = fs.readdirSync(clipsDir).some(f => f.startsWith("clip_") && f.endsWith(".mp4"));

    if (hasAnyFiles && existingRows.length === 0) {
      await backfillClipMetadata(video_id);
      // Refresh the list after backfill
      existingRows = listClips(video_id);
    }

    const duration = await getDurationSeconds(video_id);
    const total = Math.max(1, Math.ceil(duration / CLIP_LEN_SECONDS));

    for (let i = 0; i < total; i++) {
      // Check if video status changed during generation
      const latest = getVideo(video_id);
      if (latest.status !== "Approved") {
        setClipJobState(video_id, "Failed", {
          stderr: `Stopped: video status changed to ${latest.status} during generation.`,
          exitCode: null,
        });
        return;
      }

      const start = i * CLIP_LEN_SECONDS;
      const len = Math.min(CLIP_LEN_SECONDS, Math.max(0, duration - start));
      if (len <= 0.01) break;

      const outPath = clipPath(video_id, i);

      // Idempotency: skip if already generated (and non-trivial)
      // Part B: If file is missing or corrupt, regenerate (regardless of DB row state)
      if (fileLooksComplete(outPath)) {
        // File exists and looks good - skip regeneration
        // But ensure DB row exists (drift repair: file exists but DB row missing)
        const existingRow = existingRows.find(r => r.clip_index === i);
        if (!existingRow) {
          // File exists but DB row missing - backfill this specific clip
          const clipMeta = await extractVideoMetadata(outPath);
          let fileSizeBytes: number | null = null;
          try {
            fileSizeBytes = fs.statSync(outPath).size;
          } catch {
            fileSizeBytes = clipMeta.file_size_bytes ?? null;
          }
          upsertClip({
            video_id,
            clip_index: i,
            path: outPath,
            duration: clipMeta.duration_seconds,
            fps: clipMeta.fps,
            width: clipMeta.width,
            height: clipMeta.height,
            file_size_bytes: fileSizeBytes,
          });
        }
        continue;
      } else {
        // if partial/corrupt exists, delete and regenerate
        safeUnlink(outPath);
      }

      const inPath = v.original_path;

      // ffmpeg: re-encode, optional audio mapping
      // -ss before -i is faster; for most MP4s this is good enough for a take-home.
      const args = [
        "-hide_banner",
        "-y",
        "-ss", String(start),
        "-i", inPath,
        "-t", String(len),

        // Map the first video stream and optional audio stream
        "-map", "0:v:0",
        "-map", "0:a?",

        // Video
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "20",

        // Audio (if present)
        "-c:a", "aac",
        "-b:a", "128k",

        // Better progressive playback
        "-movflags", "+faststart",

        outPath,
      ];

      const res = await runCommand("ffmpeg", args, { timeoutMs: 10 * 60_000 });

      if (res.exitCode !== 0) {
        // Persist job failure + logs
        const errorOutput = res.stderr || res.stdout || "(no output)";
        const full = `---- ${new Date().toISOString()} clip ${i} ----\n${errorOutput}\n\n`;
        const logPath = appendLog(`${video_id}-ffmpeg.log`, full);

        setClipJobState(video_id, "Failed", {
          stderr: truncateForDb(`${errorOutput}\n(full log: ${logPath})`),
          exitCode: res.exitCode
        });
        setVideoError(
          video_id,
          `ffmpeg failed while generating clip ${i}/${total - 1} (exit=${res.exitCode}).\n` +
            `Full log: ${logPath}\n` +
            (res.stderr?.trim() ? truncateForDb(res.stderr.trim(), 500) : "(no stderr)")
        );
        return;
      }

      // Extract clip metadata (duration/fps/resolution/filesize)
      const clipMeta = await extractVideoMetadata(outPath);

      let fileSizeBytes: number | null = null;
      try {
        fileSizeBytes = fs.statSync(outPath).size;
      } catch {
        fileSizeBytes = clipMeta.file_size_bytes ?? null;
      }

      // Persist clip row
      upsertClip({
        video_id,
        clip_index: i,
        path: outPath,
        duration: clipMeta.duration_seconds,
        fps: clipMeta.fps,
        width: clipMeta.width,
        height: clipMeta.height,
        file_size_bytes: fileSizeBytes,
      });

      // Refresh updated_at to mark job as still active
      setClipJobState(video_id, "Generating", { stderr: null, exitCode: null });
    }

    setClipJobState(video_id, "Done", { stderr: null, exitCode: 0 });
  } finally {
    activeJobs.delete(video_id);
  }
}
