export interface ClusterInput {
  sourceId: string
  sourceName: string
  rank: number
  total: number
  title: string
  url: string
  pubDate?: number | string
  info?: string
  hover?: string
}

export interface BangMember {
  sourceId: string
  sourceName: string
  rank: number
  title: string
  url: string
  pubDate?: number | string
  info?: string
  hover?: string
}

export interface BangCluster {
  id: string
  title: string
  score: number
  sourceCount: number
  members: BangMember[]
}

export interface BangResponse {
  status: "success" | "cache"
  updatedTime: number
  clusters: BangCluster[]
  meta: {
    okSources: number
    failedSources: number
    itemCount: number
  }
}

export interface ClusterOptions {
  minLength?: number
  diceThreshold?: number
  containmentThreshold?: number
  maxClusterSize?: number
  limit?: number
  weights?: Record<string, number>
}

export function normalizeTitle(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "")
}

export function bigrams(s: string): Set<string> {
  const grams = new Set<string>()
  for (let i = 0; i + 2 <= s.length; i++) grams.add(s.slice(i, i + 2))
  return grams
}

export function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const g of a) {
    if (b.has(g)) inter++
  }
  return (2 * inter) / (a.size + b.size)
}

export function containmentCoefficient(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const g of a) {
    if (b.has(g)) inter++
  }
  return inter / Math.min(a.size, b.size)
}

export function areSimilar(a: Set<string>, b: Set<string>, diceThreshold = 0.5, containmentThreshold = 0.8): boolean {
  return diceCoefficient(a, b) >= diceThreshold || containmentCoefficient(a, b) >= containmentThreshold
}

interface WorkingCluster {
  rep: ClusterInput
  repGrams: Set<string>
  members: ClusterInput[]
  order: number
}

const TEXT_MAX = 200

function clampText(text: string | false | undefined, max = TEXT_MAX): string | undefined {
  if (!text) return undefined
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function clusterNews(items: ClusterInput[], options: ClusterOptions = {}): BangCluster[] {
  const {
    minLength = 4,
    diceThreshold = 0.5,
    containmentThreshold = 0.8,
    maxClusterSize = 20,
    limit = 100,
    weights = {},
  } = options

  const prepared = items
    .map(input => ({ input, normalized: normalizeTitle(input.title) }))
    .filter(x => x.normalized.length >= minLength)
    .sort((a, b) => a.input.rank - b.input.rank)

  const seenUrls = new Set<string>()
  const clusters: WorkingCluster[] = []
  const gramIndex = new Map<string, WorkingCluster[]>()
  const sharedCounts = new Map<WorkingCluster, number>()
  const candidates: WorkingCluster[] = []

  for (const { input, normalized } of prepared) {
    if (seenUrls.has(input.url)) continue
    seenUrls.add(input.url)
    const grams = bigrams(normalized)

    sharedCounts.clear()
    for (const gram of grams) {
      const bucket = gramIndex.get(gram)
      if (!bucket) continue
      for (const c of bucket) sharedCounts.set(c, (sharedCounts.get(c) ?? 0) + 1)
    }

    let target: WorkingCluster | undefined
    if (sharedCounts.size) {
      candidates.length = 0
      for (const [c, shared] of sharedCounts) {
        if (shared >= 2) candidates.push(c)
      }
      if (candidates.length > 1) candidates.sort((a, b) => a.order - b.order)
      for (const c of candidates) {
        if (c.members.length >= maxClusterSize) continue
        if (areSimilar(c.repGrams, grams, diceThreshold, containmentThreshold)) {
          target = c
          break
        }
      }
    }

    if (!target) {
      target = { rep: input, repGrams: grams, members: [], order: clusters.length }
      clusters.push(target)
      for (const gram of grams) {
        const bucket = gramIndex.get(gram)
        if (bucket) bucket.push(target)
        else gramIndex.set(gram, [target])
      }
    }
    target.members.push(input)
  }

  const results: BangCluster[] = clusters.map((c) => {
    const sourceIds = new Set(c.members.map(m => m.sourceId))
    let score = 0
    for (const m of c.members) {
      const w = weights[m.sourceId] ?? 1
      if (m.total > 0) score += w * ((m.total - m.rank + 1) / m.total)
    }
    score += 0.5 * (sourceIds.size - 1)
    return {
      id: c.rep.url,
      title: c.rep.title,
      score: Number(score.toFixed(4)),
      sourceCount: sourceIds.size,
      members: c.members.map(m => ({
        sourceId: m.sourceId,
        sourceName: m.sourceName,
        rank: m.rank,
        title: m.title,
        url: m.url,
        pubDate: m.pubDate,
        info: m.info,
        hover: m.hover,
      })),
    }
  })

  return results.sort((a, b) => b.score - a.score).slice(0, limit)
}

export interface BangSourceData {
  id: string
  name: string
  items: Array<{ title: string, url: string, pubDate?: number | string, extra?: { info?: string | false, hover?: string } }>
}

export function buildBang(sourcesData: BangSourceData[], totalSourceCount: number, options?: ClusterOptions): BangResponse {
  const items: ClusterInput[] = []
  for (const source of sourcesData) {
    const total = source.items.length
    source.items.forEach((item, i) => {
      items.push({
        sourceId: source.id,
        sourceName: source.name,
        rank: i + 1,
        total,
        title: item.title,
        url: item.url,
        pubDate: item.pubDate,
        info: clampText(item.extra?.info),
        hover: clampText(item.extra?.hover),
      })
    })
  }
  return {
    status: "success",
    updatedTime: Date.now(),
    clusters: clusterNews(items, options),
    meta: {
      okSources: sourcesData.length,
      failedSources: totalSourceCount - sourcesData.length,
      itemCount: items.length,
    },
  }
}
