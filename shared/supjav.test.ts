import { describe, expect, it } from "vitest"
import { buildSupjavItems, formatViews, hasHost, parseViews, stripThumbSuffix, thumbURL } from "./supjav"

describe("parseViews", () => {
  it("解析千分位", () => {
    expect(parseViews("148,812 Views")).toBe(148812)
  })

  it("解析纯数字", () => {
    expect(parseViews("12345 Views")).toBe(12345)
  })

  it("无数字返回 undefined", () => {
    expect(parseViews("No views")).toBeUndefined()
  })

  it("空串返回 undefined", () => {
    expect(parseViews("")).toBeUndefined()
    expect(parseViews(null)).toBeUndefined()
  })
})

describe("hasHost", () => {
  it("匹配主机", () => {
    expect(hasHost("https://supjav.com/1.html", "supjav.com")).toBe(true)
  })

  it("不匹配其他主机", () => {
    expect(hasHost("https://evil.com/1.html", "supjav.com")).toBe(false)
  })

  it("非法 URL 返回 false", () => {
    expect(hasHost("not a url", "supjav.com")).toBe(false)
  })
})

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

describe("formatViews", () => {
  it("万级格式化", () => {
    expect(formatViews(148812)).toBe("14.9 万播放")
  })

  it("万以下原样", () => {
    expect(formatViews(9999)).toBe("9999 播放")
  })

  it("空值返回 undefined", () => {
    expect(formatViews(null)).toBeUndefined()
  })
})

describe("buildSupjavItems", () => {
  it("同 URL 跨窗合并并统计命中", () => {
    const res = buildSupjavItems([
      { window: "day", rank: 2, url: "https://supjav.com/1.html", title: "A", thumb: "https://img.supjav.com/a.jpg", views: 10, capturedAt: "2026-09-29T01:00:00Z" },
      { window: "week", rank: 5, url: "https://supjav.com/1.html", title: "A", thumb: "https://img.supjav.com/a.jpg", views: 10, capturedAt: "2026-09-29T02:00:00Z" },
    ])
    expect(res.items).toHaveLength(1)
    expect(res.items[0].ranks).toEqual({ day: 2, week: 5 })
    expect(res.items[0].hits).toBe(2)
    expect(res.capturedAt).toBe("2026-09-29T02:00:00Z")
    expect(res.windows.day).toEqual({ count: 1, capturedAt: "2026-09-29T01:00:00Z" })
    expect(res.windows.week).toEqual({ count: 1, capturedAt: "2026-09-29T02:00:00Z" })
    expect(res.windows.month).toEqual({ count: 0, capturedAt: null })
  })

  it("打分与排序：双榜命中 > 三榜中游 > 单榜季军 > 单榜月冠", () => {
    const res = buildSupjavItems([
      { window: "day", rank: 1, url: "https://supjav.com/a.html", title: "A", views: 1 },
      { window: "week", rank: 1, url: "https://supjav.com/a.html", title: "A", views: 1 },
      { window: "day", rank: 40, url: "https://supjav.com/d.html", title: "D", views: 1 },
      { window: "week", rank: 40, url: "https://supjav.com/d.html", title: "D", views: 1 },
      { window: "month", rank: 40, url: "https://supjav.com/d.html", title: "D", views: 1 },
      { window: "day", rank: 3, url: "https://supjav.com/b.html", title: "B", views: 1 },
      { window: "month", rank: 1, url: "https://supjav.com/c.html", title: "C", views: 1 },
    ])
    expect(res.items.map(i => i.url.split("/").pop())).toEqual(["a.html", "d.html", "b.html", "c.html"])
    expect(res.items[0].score).toBe(255)
    expect(res.items[1].score).toBe(201.25)
    expect(res.items[2].score).toBe(116.6667)
    expect(res.items[3].score).toBe(100)
  })

  it("同分按播放量降序", () => {
    const res = buildSupjavItems([
      { window: "day", rank: 5, url: "https://supjav.com/lo.html", title: "L", views: 100 },
      { window: "day", rank: 5, url: "https://supjav.com/hi.html", title: "H", views: 200 },
    ])
    expect(res.items[0].url).toBe("https://supjav.com/hi.html")
  })

  it("元数据取最佳名次行", () => {
    const res = buildSupjavItems([
      { window: "month", rank: 9, url: "https://supjav.com/1.html", title: "月九", thumb: "https://img.supjav.com/m.jpg", views: 9 },
      { window: "day", rank: 1, url: "https://supjav.com/1.html", title: "日一", thumb: "https://img.supjav.com/d.jpg", views: 1 },
    ])
    expect(res.items[0].title).toBe("日一")
    expect(res.items[0].thumb).toBe("https://img.supjav.com/d.jpg")
  })

  it("空输入返回空结果", () => {
    const res = buildSupjavItems([])
    expect(res).toEqual({
      capturedAt: null,
      windows: {
        day: { count: 0, capturedAt: null },
        week: { count: 0, capturedAt: null },
        month: { count: 0, capturedAt: null },
      },
      items: [],
    })
  })

  it("超 100 条截断", () => {
    const rows = Array.from({ length: 120 }, (_, i) => ({
      window: "day" as const,
      rank: i + 1,
      url: `https://supjav.com/${i}.html`,
      title: `T${i}`,
    }))
    expect(buildSupjavItems(rows).items).toHaveLength(100)
  })
})
