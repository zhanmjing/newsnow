import { shanghaiDay, shiftDay } from "@shared/history"

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const days = Math.min(Math.max(Number(query.days) || 30, 1), 90)
  const from = shiftDay(shanghaiDay(), -(days - 1))
  try {
    const db = useDatabase()
    const res = await db.prepare(`
      SELECT id, title, last_day FROM events WHERE last_day >= ? ORDER BY last_day DESC LIMIT 5000
    `).all(from) as any
    const rows = (res?.results ?? res) as Array<{ id: string, title: string, last_day: string }>
    return { from, events: (rows ?? []).map(row => ({ id: row.id, title: row.title, lastDay: row.last_day })) }
  } catch {
    return { from, events: [] }
  }
})
