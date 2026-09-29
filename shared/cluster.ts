export interface ClusterInput {
  sourceId: string
  sourceName: string
  rank: number
  total: number
  title: string
  url: string
  pubDate?: number | string
}

export interface BangMember {
  sourceId: string
  sourceName: string
  rank: number
  title: string
  url: string
  pubDate?: number | string
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
