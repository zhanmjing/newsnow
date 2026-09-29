import { describe, expect, it } from "vitest"
import { tokyomotionThumb } from "./tokyomotion"

describe("tokyomotionThumb", () => {
  it("合法的 cdn 缩略图直接返回", () => {
    expect(tokyomotionThumb("https://cdn.tokyo-motion.net/media/videos/tmb216/6943645/1.jpg")).toBe("https://cdn.tokyo-motion.net/media/videos/tmb216/6943645/1.jpg")
  })

  it("其他主机返回 undefined", () => {
    expect(tokyomotionThumb("https://evil.com/a.jpg")).toBeUndefined()
  })

  it("空值返回 undefined", () => {
    expect(tokyomotionThumb(null)).toBeUndefined()
    expect(tokyomotionThumb("")).toBeUndefined()
  })
})
