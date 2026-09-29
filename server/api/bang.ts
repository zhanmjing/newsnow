import type { SourceID } from "@shared/types"
import type { BangResponse, ClusterInput } from "@shared/cluster"
import { clusterNews } from "@shared/cluster"
import { sources } from "@shared/sources"
import type { CacheInfo } from "#/types"
import { getCacheTable } from "#/database/cache"

// 榜中榜结果缓存 15 分钟（best-effort：Serverless 实例内存，实例回收即失效）
const BANG_TTL = 1000 * 60 * 15

let lastResult: { data: BangResponse, time: number } | undefined
let inflight: Promise<BangResponse> | undefined

export async function buildBangResponse(): Promise<BangResponse> {
  const cacheTable = await getCacheTable()
  const ids = (Object.keys(sources) as SourceID[]).filter(id => !sources[id]?.redirect)
  let rows: CacheInfo[] = []
  if (cacheTable) rows = await cacheTable.getEntire(ids)

  const items: ClusterInput[] = []
  for (const row of rows) {
    const source = sources[row.id]
    if (!source) continue
    row.items.forEach((item, i) => {
      items.push({
        sourceId: row.id,
        sourceName: source.name,
        rank: i + 1,
        total: row.items.length,
        title: item.title,
        url: item.url,
        pubDate: item.pubDate,
      })
    })
  }

  return {
    status: "success",
    updatedTime: Date.now(),
    clusters: clusterNews(items),
    meta: {
      okSources: rows.length,
      failedSources: ids.length - rows.length,
      itemCount: items.length,
    },
  }
}

export default defineEventHandler(async (): Promise<BangResponse> => {
  const now = Date.now()
  if (lastResult && now - lastResult.time < BANG_TTL) {
    return { ...lastResult.data, status: "cache" }
  }

  if (!inflight) {
    inflight = buildBangResponse()
      .then((data) => {
        lastResult = { data, time: Date.now() }
        return data
      })
      .finally(() => {
        inflight = undefined
      })
  }

  try {
    return await inflight
  } catch (e: any) {
    logger.error(e)
    throw createError({
      statusCode: 500,
      message: e instanceof Error ? e.message : "Internal Server Error",
    })
  }
})
