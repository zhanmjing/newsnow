import type { Database } from "db0"
import type { RankRow, RankWindow } from "@shared/rank"
import { hasHost, isRankWindow } from "@shared/rank"

export interface RankSiteConfig {
  table: string
  urlHost: string
  thumbHost: string
  hasDuration?: boolean
}

export interface RankItemInput {
  rank: number
  title: string
  url: string
  thumb?: string
  views?: number
  date?: string
  duration?: string
}

export interface ParsedRankBody {
  window: RankWindow
  capturedAt: string
  items: RankItemInput[]
}

export function parseRankBody(body: any, config: RankSiteConfig): ParsedRankBody {
  if (!body || !isRankWindow(body.window) || !Array.isArray(body.items))
    throw createError({ statusCode: 400, message: "Invalid body" })
  if (body.items.length < 1 || body.items.length > 100)
    throw createError({ statusCode: 400, message: "Invalid item count (1..100)" })
  if (JSON.stringify(body).length > 200_000)
    throw createError({ statusCode: 413, message: "Payload too large" })

  const ranks = new Set<number>()
  for (const item of body.items) {
    if (!item || typeof item !== "object")
      throw createError({ statusCode: 400, message: "Invalid item" })
    if (!Number.isInteger(item.rank) || item.rank < 1 || item.rank > 100)
      throw createError({ statusCode: 400, message: "Invalid rank" })
    if (!item.title || typeof item.title !== "string" || item.title.trim().length < 1 || item.title.length > 500)
      throw createError({ statusCode: 400, message: "Invalid title" })
    if (!hasHost(item.url, config.urlHost))
      throw createError({ statusCode: 400, message: "Invalid url host" })
    if (item.thumb && !hasHost(item.thumb, config.thumbHost))
      throw createError({ statusCode: 400, message: "Invalid thumb host" })
    if (ranks.has(item.rank))
      throw createError({ statusCode: 400, message: "Duplicate rank" })
    ranks.add(item.rank)
  }

  const capturedAt = typeof body.capturedAt === "string" && !Number.isNaN(Date.parse(body.capturedAt))
    ? body.capturedAt
    : new Date().toISOString()
  return { window: body.window, capturedAt, items: body.items }
}

export async function replaceRankWindow(db: Database, config: RankSiteConfig, window: RankWindow, items: RankItemInput[], capturedAt: string): Promise<number> {
  await db.prepare(`DELETE FROM ${config.table} WHERE window = ?`).run(window)
  for (const item of items) {
    const views = typeof item.views === "number" && Number.isFinite(item.views) && item.views >= 0
      ? Math.floor(item.views)
      : null
    const date = typeof item.date === "string" && /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(item.date.trim())
      ? item.date.trim()
      : null
    const duration = config.hasDuration && typeof item.duration === "string" && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(item.duration.trim())
      ? item.duration.trim()
      : null
    if (config.hasDuration) {
      await db.prepare(`
        INSERT OR REPLACE INTO ${config.table} (window, rank, url, title, thumb, views, date, duration, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(window, item.rank, item.url, item.title.trim(), item.thumb ?? null, views, date, duration, capturedAt)
    } else {
      await db.prepare(`
        INSERT OR REPLACE INTO ${config.table} (window, rank, url, title, thumb, views, date, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(window, item.rank, item.url, item.title.trim(), item.thumb ?? null, views, date, capturedAt)
    }
  }
  return items.length
}

export async function readRankRows(db: Database, config: RankSiteConfig): Promise<RankRow[]> {
  const columns = config.hasDuration
    ? "window, rank, url, title, thumb, views, date, duration, captured_at"
    : "window, rank, url, title, thumb, views, date, NULL AS duration, captured_at"
  const res = await db.prepare(`SELECT ${columns} FROM ${config.table}`).all() as any
  const rows = (res?.results ?? res) as Array<Record<string, any>>
  if (!rows?.length) return []
  return rows
    .filter(row => isRankWindow(row.window))
    .map(row => ({
      window: row.window as RankWindow,
      rank: row.rank,
      url: row.url,
      title: row.title,
      thumb: row.thumb,
      views: row.views,
      date: row.date,
      duration: row.duration,
      capturedAt: row.captured_at,
    }))
}
