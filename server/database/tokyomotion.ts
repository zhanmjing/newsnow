import type { Database } from "db0"

export async function ensureTokyomotionTable(db: Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS tokyomotion_items (
      window TEXT NOT NULL,
      rank INTEGER NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      thumb TEXT,
      views INTEGER,
      date TEXT,
      duration TEXT,
      captured_at TEXT NOT NULL,
      PRIMARY KEY (window, rank)
    );
  `).run()
}
