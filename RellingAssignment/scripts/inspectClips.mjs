import Database from "better-sqlite3";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), "data", "app.db");
const db = new Database(dbPath);

const videoId = process.argv[2];
if (!videoId) {
  console.log("Usage: node scripts/inspectClips.mjs <video_id>");
  process.exit(1);
}

const rows = db
  .prepare(
    `SELECT clip_index, path, duration, fps, width, height, file_size_bytes
     FROM clips WHERE video_id = ? ORDER BY clip_index ASC`
  )
  .all(videoId);

console.table(rows);
