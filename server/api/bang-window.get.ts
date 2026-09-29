import type { BangMember } from "@shared/cluster"
import type { BangWindow, BangWindowItem, BangWindowResponse } from "@shared/history"
import { windowRange } from "@shared/history"

export default defineEventHandler(async (event): Promise<BangWindowResponse> => {
  const query = getQuery(event)
  const raw = query.window
  const window: BangWindow = raw === "week" || raw === "month" ? raw : "day"
  const { from, to } = windowRange(window)
  const empty: BangWindowResponse = { window, from, to, items: [] }

  try {
    const db = useDatabase()
    const agg = await db.prepare(`
      SELECT event_id AS id, SUM(score) AS total, COUNT(*) AS days, MAX(source_count) AS sources
      FROM event_days WHERE day >= ? GROUP BY event_id ORDER BY total + 0.3 * days DESC LIMIT 100
    `).all(from) as any
    const rows = (agg?.results ?? agg) as Array<{ id: string, total: number, days: number, sources: number }>
    if (!rows?.length) return empty

    const ids = rows.map(row => row.id)
    const placeholders = ids.map(() => "?").join(",")
    const meta = await db.prepare(`
      SELECT id, title, url, best_rank, top_source, last_day FROM events WHERE id IN (${placeholders})
    `).all(...ids) as any
    const metaRows = (meta?.results ?? meta) as Array<{ id: string, title: string, url: string, best_rank: number, top_source: string, last_day: string }>
    const metaMap = new Map(metaRows.map(m => [m.id, m]))

    const memberQuery = await db.prepare(`
      SELECT event_id, members FROM event_days WHERE event_id IN (${placeholders}) ORDER BY day DESC
    `).all(...ids) as any
    const memberRows = (memberQuery?.results ?? memberQuery) as Array<{ event_id: string, members: string }>
    const memberMap = new Map<string, BangMember[]>()
    for (const row of memberRows) {
      if (!memberMap.has(row.event_id)) memberMap.set(row.event_id, JSON.parse(row.members) as BangMember[])
    }

    const items: BangWindowItem[] = rows.flatMap((row) => {
      const m = metaMap.get(row.id)
      if (!m) return []
      return [{
        id: row.id,
        title: m.title,
        url: m.url,
        score: Number((row.total + 0.3 * row.days).toFixed(4)),
        days: row.days,
        sourceCount: row.sources,
        bestRank: m.best_rank,
        topSource: m.top_source,
        lastDay: m.last_day,
        members: memberMap.get(row.id) ?? [],
      }]
    })
    items.sort((a, b) => b.score - a.score || a.bestRank - b.bestRank)
    return { window, from, to, items }
  } catch {
    return empty
  }
})
