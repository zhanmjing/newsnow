import process from "node:process"
import { type BangMember, normalizeTitle } from "@shared/cluster"
import { eventIdFromKey, shanghaiDay, shiftDay } from "@shared/history"
import { ensureHistoryTables, pruneHistory } from "#/database/history"

interface IngestEvent {
  id?: string
  key: string
  title: string
  url: string
  score: number
  sourceCount: number
  bestRank: number
  topSource: string
  members: BangMember[]
}

interface IngestBody {
  day: string
  events: IngestEvent[]
}

export default defineEventHandler(async (event) => {
  if (!process.env.INGEST_TOKEN)
    throw createError({ statusCode: 501, message: "Ingest disabled: INGEST_TOKEN not configured" })

  const token = getHeader(event, "x-ingest-token")
  if (token !== process.env.INGEST_TOKEN)
    throw createError({ statusCode: 401, message: "Invalid ingest token" })

  const body = await readBody<IngestBody>(event)
  if (!body?.day || !Array.isArray(body.events))
    throw createError({ statusCode: 400, message: "Invalid body" })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.day))
    throw createError({ statusCode: 400, message: "Invalid day" })
  if (JSON.stringify(body).length > 1_000_000)
    throw createError({ statusCode: 413, message: "Payload too large" })

  const db = useDatabase()
  await ensureHistoryTables(db)

  let inserted = 0
  let updated = 0

  for (const item of body.events) {
    const key = item.key || normalizeTitle(item.title)
    const id = item.id || eventIdFromKey(key)
    const existing = await db.prepare(`SELECT id FROM events WHERE id = ?`).get(id)
    if (existing) {
      await db.prepare(`
        UPDATE events SET title = ?, url = ?, last_day = ?, best_rank = CASE WHEN best_rank IS NULL OR best_rank > ? THEN ? ELSE best_rank END, top_source = ? WHERE id = ?
      `).run(item.title, item.url, body.day, item.bestRank, item.bestRank, item.topSource, id)
      updated++
    } else {
      await db.prepare(`
        INSERT INTO events (id, key, title, url, first_day, last_day, best_rank, top_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, key, item.title, item.url, body.day, body.day, item.bestRank, item.topSource)
      inserted++
    }
    await db.prepare(`
      INSERT OR REPLACE INTO event_days (event_id, day, score, source_count, members) VALUES (?, ?, ?, ?, ?)
    `).run(id, body.day, item.score, item.sourceCount, JSON.stringify(item.members.slice(0, 8)))
  }

  const pruned = await pruneHistory(db, shiftDay(shanghaiDay(), -90))
  logger.success(`ingest ${body.day}: +${inserted} ~${updated} pruned=${pruned}`)
  return { ok: true, inserted, updated, pruned }
})
