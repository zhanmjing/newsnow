import process from "node:process"
import type { RankSiteConfig } from "#/utils/rankApi"
import { parseRankBody, replaceRankWindow } from "#/utils/rankApi"
import { ensureHistoryTables, getConfigValue } from "#/database/history"
import { ensureTokyomotionTable } from "#/database/tokyomotion"

const SITE: RankSiteConfig = { table: "tokyomotion_items", urlHost: "www.tokyomotion.net", thumbHost: "cdn.tokyo-motion.net", hasDuration: true }

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  await ensureHistoryTables(db)

  const expectedToken = (await getConfigValue(db, "ingest_token")) ?? process.env.INGEST_TOKEN
  if (!expectedToken)
    throw createError({ statusCode: 501, message: "Ingest disabled: ingest_token not configured" })

  const token = getHeader(event, "x-ingest-token")
  if (token !== expectedToken)
    throw createError({ statusCode: 401, message: "Invalid ingest token" })

  const body = await readBody(event)
  const parsed = parseRankBody(body, SITE)

  await ensureTokyomotionTable(db)
  await replaceRankWindow(db, SITE, parsed.window, parsed.items, parsed.capturedAt)

  logger.success(`tokyomotion ingest ${parsed.window}: ${parsed.items.length} items`)
  return { ok: true, window: parsed.window, count: parsed.items.length }
})
