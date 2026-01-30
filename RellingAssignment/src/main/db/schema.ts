// src/main/db/schema.ts

export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS videos (
  video_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_path TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('Pending','Approved','Rejected')),
  metadata_json TEXT,
  rotation_raw TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);

CREATE TABLE IF NOT EXISTS clips (
  clip_id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  clip_index INTEGER NOT NULL,
  path TEXT NOT NULL,
  duration REAL,
  fps REAL,
  width INTEGER,
  height INTEGER,
  file_size_bytes INTEGER,
  FOREIGN KEY(video_id) REFERENCES videos(video_id) ON DELETE CASCADE,
  UNIQUE(video_id, clip_index)
);

CREATE INDEX IF NOT EXISTS idx_clips_video_id ON clips(video_id);

CREATE TABLE IF NOT EXISTS clip_jobs (
  video_id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(state IN ('NotStarted','Generating','Done','Failed')),
  last_stderr TEXT,
  last_exit_code INTEGER,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(video_id) REFERENCES videos(video_id) ON DELETE CASCADE
);
`;
