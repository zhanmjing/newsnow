import process from "node:process"
import type { SupjavWindow } from "@shared/supjav"
import { hasHost, isSupjavWindow } from "@shared/supjav"
import { ensureSupjavTable } from "#/database/supjav"

interface IngestItem {
  rank: number
  title: string
  url: string
  thumb?: string
  views?: number
  date?: string
}

interface IngestBody {
  window: SupjavWindow
  capturedAt?: string
  items: IngestItem[]
}

export default defineEventHandler(async (event) => {
  if (!process.env.INGEST_TOKEN)
    throw createError({ statusCode: 501, message: "Ingest disabled: INGEST_TOKEN not configured" })

  const token = getHeader(event, "x-ingest-token")
  if (token !== process.env.INGEST_TOKEN)
    throw createError({ statusCode: 401, message: "Invalid ingest token" })

  const body = await readBody<IngestBody>(event)
  if (!body || !isSupjavWindow(body.window) || !Array.isArray(body.items))
    throw createError({ statusCode: 400, message: "Invalid body" })
  if (body.items.length < 1 || body.items.length > 100)
    throw createError({ statusCode: 400, message: "Invalid item count (1..100)" })
  if (JSON.stringify(body).length > 200_000)
    throw createError({ statusCode: 413, message: "Payload too large" })

  const ranks = new Set<number>()
  for (const item of body.items) {
    if (!Number.isInteger(item.rank) || item.rank < 1 || item.rank > 100)
      throw createError({ statusCode: 400, message: "Invalid rank" })
    if (!item.title || typeof item.title !== "string" || item.title.trim().length < 1 || item.title.length > 500)
      throw createError({ statusCode: 400, message: "Invalid title" })
    if (!hasHost(item.url, "supjav.com"))
      throw createError({ statusCode: 400, message: "Invalid url host" })
    if (item.thumb && !hasHost(item.thumb, "img.supjav.com"))
      throw createError({ statusCode: 400, message: "Invalid thumb host" })
    if (ranks.has(item.rank))
      throw createError({ statusCode: 400, message: "Duplicate rank" })
    ranks.add(item.rank)
  }

  const capturedAt = typeof body.capturedAt === "string" && !Number.isNaN(Date.parse(body.capturedAt))
    ? body.capturedAt
    : new Date().toISOString()

  const db = useDatabase()
  await ensureSupjavTable(db)
  await db.prepare(`DELETE FROM supjav_items WHERE window = ?`).run(body.window)
  for (const item of body.items) {
    const views = typeof item.views === "number" && Number.isFinite(item.views) && item.views >= 0
      ? Math.floor(item.views)
      : null
    const date = typeof item.date === "string" && /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(item.date.trim())
      ? item.date.trim()
      : null
    await db.prepare(`
      INSERT OR REPLACE INTO supjav_items (window, rank, url, title, thumb, views, date, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(body.window, item.rank, item.url, item.title.trim(), item.thumb ?? null, views, date, capturedAt)
  }

  logger.success(`supjav ingest ${body.window}: ${body.items.length} items`)
  return { ok: true, window: body.window, count: body.items.length }
})
