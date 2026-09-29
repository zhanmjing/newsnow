import { describe, expect, it } from "vitest"
import { stripThumbSuffix, thumbURL } from "./supjav"

describe("stripThumbSuffix", () => {
  it("去掉 !WxH.jpg 后缀", () => {
    expect(stripThumbSuffix("https://img.supjav.com/images/2026/09/a.jpg!320x216.jpg")).toBe("https://img.supjav.com/images/2026/09/a.jpg")
  })

  it("无后缀原样返回", () => {
    expect(stripThumbSuffix("https://img.supjav.com/images/2026/09/a.jpg")).toBe("https://img.supjav.com/images/2026/09/a.jpg")
  })

  it("非 img.supjav.com 返回 undefined", () => {
    expect(stripThumbSuffix("https://evil.com/a.jpg")).toBeUndefined()
  })

  it("空值返回 undefined", () => {
    expect(stripThumbSuffix(undefined)).toBeUndefined()
    expect(stripThumbSuffix("")).toBeUndefined()
  })
})

describe("thumbURL", () => {
  it("拼接默认质量档", () => {
    expect(thumbURL("https://img.supjav.com/images/a.jpg")).toBe("https://img.supjav.com/images/a.jpg!640x432.jpg")
  })

  it("空值返回 undefined", () => {
    expect(thumbURL(null)).toBeUndefined()
  })

  it("已带后缀不重复拼接", () => {
    expect(thumbURL("https://img.supjav.com/images/a.jpg!320x216.jpg")).toBe("https://img.supjav.com/images/a.jpg!320x216.jpg")
  })
})
