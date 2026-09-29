import { hasHost } from "./rank"

export function tokyomotionThumb(base: string | null | undefined): string | undefined {
  if (!base) return undefined
  const value = String(base).trim()
  if (!value || !hasHost(value, "cdn.tokyo-motion.net")) return undefined
  return value
}
