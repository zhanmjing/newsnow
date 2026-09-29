import type { RankResponse } from "@shared/rank"
import { buildRankItems } from "@shared/rank"
import type { RankSiteConfig } from "#/utils/rankApi"
import { readRankRows } from "#/utils/rankApi"

const SITE: RankSiteConfig = { table: "javbunny_items", urlHost: "javbunny.com", thumbHost: "javbunny.com" }

export default defineEventHandler(async (): Promise<RankResponse> => {
  try {
    const db = useDatabase()
    return buildRankItems(await readRankRows(db, SITE))
  } catch {
    return buildRankItems([])
  }
})
