// src/main/db/index.ts
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema";

let db: Database.Database | null = null;

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

// For this take-home, we keep it in project-root ./data/app.db
// (In a packaged app you’d usually put this in app.getPath('userData'), but dev is fine.)
export function getDbPath(): string {
  const dataDir = path.resolve(process.cwd(), "data");
  ensureDir(dataDir);
  return path.join(dataDir, "app.db");
}

export function initDb(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  db = new Database(dbPath);

  // Reliability settings
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Create tables if needed
  db.exec(SCHEMA_SQL);

  console.log(`[db] initialized at ${dbPath}`);
  return db;
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("DB not initialized. Call initDb() first.");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
