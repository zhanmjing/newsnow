import { hasHost } from "./rank"

export const THUMB_SUFFIX = "!640x432.jpg"

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
