import type { Database } from "db0"

export async function ensureSupjavTable(db: Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS supjav_items (
      window TEXT NOT NULL,
      rank INTEGER NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      thumb TEXT,
      views INTEGER,
      date TEXT,
      captured_at TEXT NOT NULL,
      PRIMARY KEY (window, rank)
    );
  `).run()
}
