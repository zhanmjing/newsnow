export type RankWindow = "day" | "week" | "month"

export interface RankRow {
  window: RankWindow
  rank: number
  url: string
  title: string
  thumb?: string | null
  views?: number | null
  date?: string | null
  duration?: string | null
  capturedAt?: string | null
}

export interface RankItem {
  url: string
  title: string
  thumb: string | null
  views: number | null
  date: string | null
  duration: string | null
  ranks: Partial<Record<RankWindow, number>>
  hits: number
  score: number
}

export interface RankWindowItem {
  rank: number
  url: string
  title: string
  thumb: string | null
  views: number | null
  date: string | null
  duration: string | null
  ranks: Partial<Record<RankWindow, number>>
}

export interface RankWindowStat {
  count: number
  capturedAt: string | null
  items: RankWindowItem[]
}

export interface RankResponse {
  capturedAt: string | null
  windows: Record<RankWindow, RankWindowStat>
  items: RankItem[]
}

export const RANK_WINDOWS: RankWindow[] = ["day", "week", "month"]
export const WINDOW_WEIGHTS: Record<RankWindow, number> = { day: 1.2, week: 1.1, month: 1.0 }
export const HIT_BONUS = 25
export const WINDOW_SIZE = 72
export const TOP_ITEMS = 100

const WINDOW_ORDER: Record<RankWindow, number> = { day: 0, week: 1, month: 2 }

export function isRankWindow(value: unknown): value is RankWindow {
  return RANK_WINDOWS.includes(value as RankWindow)
}

export function parseViews(text: string | null | undefined): number | undefined {
  const match = String(text ?? "").replace(/[,\s]/g, "").match(/^(\d+)/)
  if (!match) return undefined
  const n = Number(match[1])
  return Number.isFinite(n) ? n : undefined
}

export function hasHost(url: string, host: string): boolean {
  try {
    return new URL(url).hostname === host
  } catch {
    return false
  }
}

export function formatViews(views: number | null | undefined): string | undefined {
  if (views == null || !Number.isFinite(views)) return undefined
  if (views >= 10000) return `${(views / 10000).toFixed(1)} 万播放`
  return `${views} 播放`
}

export function buildRankItems(rows: RankRow[]): RankResponse {
  const windows: Record<RankWindow, RankWindowStat> = {
    day: { count: 0, capturedAt: null, items: [] },
    week: { count: 0, capturedAt: null, items: [] },
    month: { count: 0, capturedAt: null, items: [] },
  }
  const grouped = new Map<string, RankRow[]>()
  let capturedAt: string | null = null

  for (const row of rows) {
    if (!isRankWindow(row.window)) continue
    const stat = windows[row.window]
    stat.count++
    if (row.capturedAt) {
      if (!stat.capturedAt || row.capturedAt > stat.capturedAt) stat.capturedAt = row.capturedAt
      if (!capturedAt || row.capturedAt > capturedAt) capturedAt = row.capturedAt
    }
    const list = grouped.get(row.url)
    if (list) list.push(row)
    else grouped.set(row.url, [row])
  }

  const items: RankItem[] = []
  for (const [url, list] of grouped) {
    const ranks: Partial<Record<RankWindow, number>> = {}
    for (const row of list) {
      const current = ranks[row.window]
      if (current === undefined || row.rank < current) ranks[row.window] = row.rank
    }
    const hits = Object.keys(ranks).length
    let score = HIT_BONUS * (hits - 1)
    for (const window of RANK_WINDOWS) {
      const rank = ranks[window]
      if (rank !== undefined) score += 100 * WINDOW_WEIGHTS[window] * (1 - (rank - 1) / WINDOW_SIZE)
    }
    const head = [...list].sort((a, b) => a.rank - b.rank || WINDOW_ORDER[a.window] - WINDOW_ORDER[b.window])[0]
    items.push({
      url,
      title: head.title,
      thumb: head.thumb ?? null,
      views: head.views ?? null,
      date: head.date ?? null,
      duration: head.duration ?? null,
      ranks,
      hits,
      score: Number(score.toFixed(4)),
    })
  }

  items.sort((a, b) => b.score - a.score || (b.views ?? 0) - (a.views ?? 0) || a.url.localeCompare(b.url))
  for (const item of items) {
    for (const window of RANK_WINDOWS) {
      const rank = item.ranks[window]
      if (rank === undefined) continue
      windows[window].items.push({
        rank,
        url: item.url,
        title: item.title,
        thumb: item.thumb,
        views: item.views,
        date: item.date,
        duration: item.duration,
        ranks: item.ranks,
      })
    }
  }
  for (const window of RANK_WINDOWS) {
    windows[window].items.sort((a, b) => a.rank - b.rank || a.url.localeCompare(b.url))
  }
  return { capturedAt, windows, items: items.slice(0, TOP_ITEMS) }
}
