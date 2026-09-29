import { describe, expect, it } from "vitest"
import { buildRankItems, formatViews, hasHost, parseViews } from "./rank"

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

describe("buildRankItems", () => {
  it("同 URL 跨窗合并并统计命中", () => {
    const res = buildRankItems([
      { window: "day", rank: 2, url: "https://supjav.com/1.html", title: "A", thumb: "https://img.supjav.com/a.jpg", views: 10, capturedAt: "2026-09-29T01:00:00Z" },
      { window: "week", rank: 5, url: "https://supjav.com/1.html", title: "A", thumb: "https://img.supjav.com/a.jpg", views: 10, capturedAt: "2026-09-29T02:00:00Z" },
    ])
    expect(res.items).toHaveLength(1)
    expect(res.items[0].ranks).toEqual({ day: 2, week: 5 })
    expect(res.items[0].hits).toBe(2)
    expect(res.capturedAt).toBe("2026-09-29T02:00:00Z")
    expect(res.windows.day.count).toBe(1)
    expect(res.windows.day.capturedAt).toBe("2026-09-29T01:00:00Z")
    expect(res.windows.week.count).toBe(1)
    expect(res.windows.week.capturedAt).toBe("2026-09-29T02:00:00Z")
    expect(res.windows.month).toEqual({ count: 0, capturedAt: null, items: [] })
  })

  it("窗口榜单按名次排序并附带跨榜名次", () => {
    const res = buildRankItems([
      { window: "day", rank: 2, url: "https://supjav.com/a.html", title: "A", views: 1 },
      { window: "day", rank: 1, url: "https://supjav.com/b.html", title: "B", views: 2 },
      { window: "week", rank: 5, url: "https://supjav.com/a.html", title: "A", views: 1 },
    ])
    expect(res.windows.day.items.map(i => [i.rank, i.title])).toEqual([[1, "B"], [2, "A"]])
    expect(res.windows.day.items[1].ranks).toEqual({ day: 2, week: 5 })
    expect(res.windows.week.items.map(i => [i.rank, i.title])).toEqual([[5, "A"]])
    expect(res.windows.month.items).toEqual([])
  })

  it("窗口内重复 URL 保留最佳名次行", () => {
    const res = buildRankItems([
      { window: "day", rank: 9, url: "https://supjav.com/a.html", title: "A", views: 9 },
      { window: "day", rank: 3, url: "https://supjav.com/a.html", title: "A2", views: 3 },
    ])
    expect(res.windows.day.items).toHaveLength(1)
    expect(res.windows.day.items[0].rank).toBe(3)
    expect(res.windows.day.items[0].title).toBe("A2")
  })

  it("携带 duration（取最佳名次行）", () => {
    const res = buildRankItems([
      { window: "day", rank: 2, url: "https://www.tokyomotion.net/video/1/a", title: "A", duration: "02:02" },
      { window: "week", rank: 1, url: "https://www.tokyomotion.net/video/1/a", title: "A", duration: "21:49" },
    ])
    expect(res.items[0].duration).toBe("21:49")
    expect(res.windows.day.items[0].duration).toBe("21:49")
  })

  it("打分与排序：双榜命中 > 三榜中游 > 单榜季军 > 单榜月冠", () => {
    const res = buildRankItems([
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
    const res = buildRankItems([
      { window: "day", rank: 5, url: "https://supjav.com/lo.html", title: "L", views: 100 },
      { window: "day", rank: 5, url: "https://supjav.com/hi.html", title: "H", views: 200 },
    ])
    expect(res.items[0].url).toBe("https://supjav.com/hi.html")
  })

  it("元数据取最佳名次行", () => {
    const res = buildRankItems([
      { window: "month", rank: 9, url: "https://supjav.com/1.html", title: "月九", thumb: "https://img.supjav.com/m.jpg", views: 9 },
      { window: "day", rank: 1, url: "https://supjav.com/1.html", title: "日一", thumb: "https://img.supjav.com/d.jpg", views: 1 },
    ])
    expect(res.items[0].title).toBe("日一")
    expect(res.items[0].thumb).toBe("https://img.supjav.com/d.jpg")
  })

  it("空输入返回空结果", () => {
    const res = buildRankItems([])
    expect(res).toEqual({
      capturedAt: null,
      windows: {
        day: { count: 0, capturedAt: null, items: [] },
        week: { count: 0, capturedAt: null, items: [] },
        month: { count: 0, capturedAt: null, items: [] },
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
    expect(buildRankItems(rows).items).toHaveLength(100)
  })
})
