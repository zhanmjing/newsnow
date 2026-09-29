export type SupjavWindow = "day" | "week" | "month"

export interface SupjavRow {
  window: SupjavWindow
  rank: number
  url: string
  title: string
  thumb?: string | null
  views?: number | null
  date?: string | null
  capturedAt?: string | null
}

export interface SupjavItem {
  url: string
  title: string
  thumb: string | null
  views: number | null
  date: string | null
  ranks: Partial<Record<SupjavWindow, number>>
  hits: number
  score: number
}

export interface SupjavWindowStat {
  count: number
  capturedAt: string | null
}

export interface SupjavResponse {
  capturedAt: string | null
  windows: Record<SupjavWindow, SupjavWindowStat>
  items: SupjavItem[]
}

export const THUMB_SUFFIX = "!640x432.jpg"
export const SUPJAV_WINDOWS: SupjavWindow[] = ["day", "week", "month"]
export const WINDOW_WEIGHTS: Record<SupjavWindow, number> = { day: 1.2, week: 1.1, month: 1.0 }
export const HIT_BONUS = 25
export const WINDOW_SIZE = 72
export const TOP_ITEMS = 100

const WINDOW_ORDER: Record<SupjavWindow, number> = { day: 0, week: 1, month: 2 }

export function isSupjavWindow(value: unknown): value is SupjavWindow {
  return SUPJAV_WINDOWS.includes(value as SupjavWindow)
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

export function stripThumbSuffix(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  const base = String(url).trim().replace(/!\d+x\d+\.jpg$/i, "")
  if (!hasHost(base, "img.supjav.com")) return undefined
  return base
}

export function thumbURL(base: string | null | undefined): string | undefined {
  if (!base) return undefined
  const value = String(base).trim()
  if (!value) return undefined
  return /!\d+x\d+\.jpg$/i.test(value) ? value : value + THUMB_SUFFIX
}

export function formatViews(views: number | null | undefined): string | undefined {
  if (views == null || !Number.isFinite(views)) return undefined
  if (views >= 10000) return `${(views / 10000).toFixed(1)} 万播放`
  return `${views} 播放`
}

export function buildSupjavItems(rows: SupjavRow[]): SupjavResponse {
  const windows: Record<SupjavWindow, SupjavWindowStat> = {
    day: { count: 0, capturedAt: null },
    week: { count: 0, capturedAt: null },
    month: { count: 0, capturedAt: null },
  }
  const grouped = new Map<string, SupjavRow[]>()
  let capturedAt: string | null = null

  for (const row of rows) {
    if (!isSupjavWindow(row.window)) continue
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

  const items: SupjavItem[] = []
  for (const [url, list] of grouped) {
    const ranks: Partial<Record<SupjavWindow, number>> = {}
    for (const row of list) {
      const current = ranks[row.window]
      if (current === undefined || row.rank < current) ranks[row.window] = row.rank
    }
    const hits = Object.keys(ranks).length
    let score = HIT_BONUS * (hits - 1)
    for (const window of SUPJAV_WINDOWS) {
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
      ranks,
      hits,
      score: Number(score.toFixed(4)),
    })
  }

  items.sort((a, b) => b.score - a.score || (b.views ?? 0) - (a.views ?? 0) || a.url.localeCompare(b.url))
  return { capturedAt, windows, items: items.slice(0, TOP_ITEMS) }
}
