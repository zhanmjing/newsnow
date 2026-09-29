import { hasHost } from "./rank"

export function javbunnyThumb(base: string | null | undefined): string | undefined {
  if (!base) return undefined
  const value = String(base).trim()
  if (!value || !hasHost(value, "javbunny.com")) return undefined
  return value
}
