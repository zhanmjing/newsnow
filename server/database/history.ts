import type { Database } from "db0"

export async function ensureHistoryTables(db: Database) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      first_day TEXT NOT NULL,
      last_day TEXT NOT NULL,
      best_rank INTEGER,
      top_source TEXT
    );
  `).run()
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS event_days (
      event_id TEXT NOT NULL,
      day TEXT NOT NULL,
      score REAL NOT NULL,
      source_count INTEGER NOT NULL,
      members TEXT NOT NULL,
      PRIMARY KEY (event_id, day)
    );
  `).run()
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_event_days_day ON event_days(day);`).run()
}

export async function pruneHistory(db: Database, beforeDay: string): Promise<number> {
  const days = await db.prepare(`DELETE FROM event_days WHERE day < ?`).run(beforeDay) as any
  const events = await db.prepare(`DELETE FROM events WHERE last_day < ?`).run(beforeDay) as any
  const changes = (r: any) => Number(r?.meta?.changes ?? r?.changes ?? 0)
  return changes(days) + changes(events)
}
