// src/main/db/queries.ts
import crypto from "node:crypto";
import { getDb } from "./index";

export type VideoStatus = "Pending" | "Approved" | "Rejected";
export type ClipJobState = "NotStarted" | "Generating" | "Done" | "Failed";

export type VideoRow = {
  video_id: string;
  created_at: string;
  filename: string;
  original_path: string;
  status: VideoStatus;
  metadata_json: string | null;
  rotation_raw: string | null;
  error_message: string | null;
};

export type ClipRow = {
  clip_id: string;
  video_id: string;
  clip_index: number;
  path: string;
  duration: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
  file_size_bytes: number | null;
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function makeVideoId(): string {
  return crypto.randomUUID();
}

export function makeClipId(videoId: string, clipIndex: number): string {
  return `${videoId}:${String(clipIndex).padStart(3, "0")}`;
}

/** 1) createVideo(...) */
export function createVideo(input: {
  video_id: string;
  filename: string;
  original_path: string;
}): VideoRow {
  const db = getDb();
  const created_at = nowIso();

  const stmt = db.prepare(`
    INSERT INTO videos (video_id, created_at, filename, original_path, status, metadata_json, rotation_raw, error_message)
    VALUES (@video_id, @created_at, @filename, @original_path, 'Pending', NULL, NULL, NULL)
  `);

  stmt.run({
    video_id: input.video_id,
    created_at,
    filename: input.filename,
    original_path: input.original_path,
  });

  return getVideo(input.video_id);
}

/** 2) listVideos() */
export function listVideos(): VideoRow[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM videos
    ORDER BY created_at DESC
  `);
  return stmt.all() as VideoRow[];
}

/** 3) getVideo(video_id) */
export function getVideo(video_id: string): VideoRow {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM videos WHERE video_id = ?`);
  const row = stmt.get(video_id) as VideoRow | undefined;
  if (!row) throw new Error(`Video not found: ${video_id}`);
  return row;
}

/** 4) updateVideoStatus(video_id, status) */
export function updateVideoStatus(video_id: string, status: VideoStatus): VideoRow {
  const db = getDb();
  const stmt = db.prepare(`UPDATE videos SET status = ? WHERE video_id = ?`);
  stmt.run(status, video_id);
  return getVideo(video_id);
}

/** 5) saveVideoMetadata(video_id, metadataJson, rotationRaw) */
export function saveVideoMetadata(video_id: string, metadataJson: string, rotationRaw?: string | null): VideoRow {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE videos
    SET metadata_json = ?, rotation_raw = ?
    WHERE video_id = ?
  `);
  stmt.run(metadataJson, rotationRaw ?? null, video_id);
  return getVideo(video_id);
}

/** 6) setVideoError(video_id, msg) */
export function setVideoError(video_id: string, msg: string | null): VideoRow {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE videos
    SET error_message = ?
    WHERE video_id = ?
  `);
  stmt.run(msg, video_id);
  return getVideo(video_id);
}

/** 7) upsertClip(...) */
export function upsertClip(input: Omit<ClipRow, "clip_id"> & { clip_id?: string }): ClipRow {
  const db = getDb();
  const clip_id = input.clip_id ?? makeClipId(input.video_id, input.clip_index);

  const stmt = db.prepare(`
    INSERT INTO clips (clip_id, video_id, clip_index, path, duration, fps, width, height, file_size_bytes)
    VALUES (@clip_id, @video_id, @clip_index, @path, @duration, @fps, @width, @height, @file_size_bytes)
    ON CONFLICT(video_id, clip_index) DO UPDATE SET
      path = excluded.path,
      duration = excluded.duration,
      fps = excluded.fps,
      width = excluded.width,
      height = excluded.height,
      file_size_bytes = excluded.file_size_bytes
  `);

  stmt.run({
    clip_id,
    video_id: input.video_id,
    clip_index: input.clip_index,
    path: input.path,
    duration: input.duration ?? null,
    fps: input.fps ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    file_size_bytes: input.file_size_bytes ?? null,
  });

  return getClip(input.video_id, input.clip_index);
}

function getClip(video_id: string, clip_index: number): ClipRow {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM clips WHERE video_id = ? AND clip_index = ?`);
  const row = stmt.get(video_id, clip_index) as ClipRow | undefined;
  if (!row) throw new Error(`Clip not found: ${video_id} idx=${clip_index}`);
  return row;
}

/** 8) listClips(video_id) */
export function listClips(video_id: string): ClipRow[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM clips
    WHERE video_id = ?
    ORDER BY clip_index ASC
  `);
  return stmt.all(video_id) as ClipRow[];
}

/** Optional: clip job state */
export function setClipJobState(video_id: string, state: ClipJobState, extra?: { stderr?: string | null; exitCode?: number | null }): void {
  const db = getDb();
  const updated_at = nowIso();

  const stmt = db.prepare(`
    INSERT INTO clip_jobs (video_id, state, last_stderr, last_exit_code, updated_at)
    VALUES (@video_id, @state, @last_stderr, @last_exit_code, @updated_at)
    ON CONFLICT(video_id) DO UPDATE SET
      state = excluded.state,
      last_stderr = excluded.last_stderr,
      last_exit_code = excluded.last_exit_code,
      updated_at = excluded.updated_at
  `);

  stmt.run({
    video_id,
    state,
    last_stderr: extra?.stderr ?? null,
    last_exit_code: extra?.exitCode ?? null,
    updated_at,
  });
}

export function getClipJob(video_id: string): { video_id: string; state: ClipJobState; last_stderr: string | null; last_exit_code: number | null; updated_at: string } | null {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM clip_jobs WHERE video_id = ?`);
  return (stmt.get(video_id) as any) ?? null;
}

/** 9) deleteVideo(video_id) - CASCADE deletes clips and clip_jobs */
export function deleteVideo(video_id: string): void {
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM videos WHERE video_id = ?`);
  stmt.run(video_id);
}
