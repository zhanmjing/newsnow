import { describe, expect, it } from "vitest"
import { javbunnyThumb } from "./javbunny"

describe("javbunnyThumb", () => {
  it("合法的 javbunny 缩略图直接返回", () => {
    expect(javbunnyThumb("https://javbunny.com/javstream_thumbnails/34c49f226d6024645caffac934d927be.jpg")).toBe("https://javbunny.com/javstream_thumbnails/34c49f226d6024645caffac934d927be.jpg")
  })

  it("其他主机返回 undefined", () => {
    expect(javbunnyThumb("https://evil.com/a.jpg")).toBeUndefined()
  })

  it("空值返回 undefined", () => {
    expect(javbunnyThumb(null)).toBeUndefined()
    expect(javbunnyThumb("")).toBeUndefined()
  })
})
