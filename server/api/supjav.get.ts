import type { SupjavResponse, SupjavRow, SupjavWindow } from "@shared/supjav"
import { buildSupjavItems } from "@shared/supjav"

const empty: SupjavResponse = {
  capturedAt: null,
  windows: {
    day: { count: 0, capturedAt: null, items: [] },
    week: { count: 0, capturedAt: null, items: [] },
    month: { count: 0, capturedAt: null, items: [] },
  },
  items: [],
}

export default defineEventHandler(async (): Promise<SupjavResponse> => {
  try {
    const db = useDatabase()
    const res = await db.prepare(`
      SELECT window, rank, url, title, thumb, views, date, captured_at FROM supjav_items
    `).all() as any
    const rows = (res?.results ?? res) as Array<{
      window: string
      rank: number
      url: string
      title: string
      thumb: string | null
      views: number | null
      date: string | null
      captured_at: string | null
    }>
    if (!rows?.length) return empty
    const mapped: SupjavRow[] = rows
      .filter(row => row.window === "day" || row.window === "week" || row.window === "month")
      .map(row => ({
        window: row.window as SupjavWindow,
        rank: row.rank,
        url: row.url,
        title: row.title,
        thumb: row.thumb,
        views: row.views,
        date: row.date,
        capturedAt: row.captured_at,
      }))
    return buildSupjavItems(mapped)
  } catch {
    return empty
  }
})
