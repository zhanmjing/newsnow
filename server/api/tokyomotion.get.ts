import type { RankResponse } from "@shared/rank"
import { buildRankItems } from "@shared/rank"
import type { RankSiteConfig } from "#/utils/rankApi"
import { readRankRows } from "#/utils/rankApi"

const SITE: RankSiteConfig = { table: "tokyomotion_items", urlHost: "www.tokyomotion.net", thumbHost: "cdn.tokyo-motion.net", hasDuration: true }

export default defineEventHandler(async (): Promise<RankResponse> => {
  try {
    const db = useDatabase()
    return buildRankItems(await readRankRows(db, SITE))
  } catch {
    return buildRankItems([])
  }
})
