import type { BangMember } from "./cluster"
import { bigrams, containmentCoefficient, diceCoefficient, normalizeTitle } from "./cluster"

export type BangWindow = "day" | "week" | "month"

export interface BangWindowItem {
  id: string
  title: string
  url: string
  score: number
  days: number
  sourceCount: number
  bestRank: number
  topSource: string
  lastDay: string
  members: BangMember[]
}

export interface BangWindowResponse {
  window: BangWindow
  from: string
  to: string
  items: BangWindowItem[]
}

export interface EventCandidate {
  id: string
  title: string
}

export function shanghaiDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function shiftDay(day: string, offset: number): string {
  const [y, m, d] = day.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) + offset * 86400000)
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(dt.getUTCDate()).padStart(2, "0")
  return `${yy}-${mm}-${dd}`
}

export function windowRange(window: BangWindow, today: string = shanghaiDay()): { from: string, to: string } {
  const span = window === "day" ? 1 : window === "week" ? 7 : 30
  return { from: shiftDay(today, -(span - 1)), to: today }
}

export function fnv1a(str: string): number {
  let hash = 0x811C9DC5
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function eventIdFromKey(key: string): string {
  return `evt-${fnv1a(key).toString(36)}-${key.length.toString(36)}`
}

export function matchEvent(title: string, candidates: EventCandidate[], options?: { diceThreshold?: number, containmentThreshold?: number }): string | undefined {
  const normalized = normalizeTitle(title)
  if (normalized.length < 4) return undefined
  const grams = bigrams(normalized)
  const diceThreshold = options?.diceThreshold ?? 0.5
  const containmentThreshold = options?.containmentThreshold ?? 0.8
  let bestId: string | undefined
  let bestScore = 0
  for (const candidate of candidates) {
    const candidateNormalized = normalizeTitle(candidate.title)
    if (candidateNormalized.length < 4) continue
    const candidateGrams = bigrams(candidateNormalized)
    const dice = diceCoefficient(grams, candidateGrams)
    const containment = containmentCoefficient(grams, candidateGrams)
    if (dice < diceThreshold && containment < containmentThreshold) continue
    const score = Math.max(dice, containment)
    if (score > bestScore) {
      bestScore = score
      bestId = candidate.id
    }
  }
  return bestId
}

export function windowScore(dayScores: number[]): number {
  const sum = dayScores.reduce((a, b) => a + b, 0)
  return Number((sum + 0.3 * dayScores.length).toFixed(4))
}
