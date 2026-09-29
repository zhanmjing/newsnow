import { describe, expect, it } from "vitest"
import { eventIdFromKey, matchEvent, shanghaiDay, shiftDay, windowRange, windowScore } from "./history"

describe("shanghaiDay", () => {
  it("utc 15:59 仍是上海当天", () => {
    expect(shanghaiDay(new Date("2026-09-29T15:59:00Z"))).toBe("2026-09-29")
  })

  it("utc 16:00 进入上海次日", () => {
    expect(shanghaiDay(new Date("2026-09-29T16:00:00Z"))).toBe("2026-09-30")
  })
})

describe("shiftDay", () => {
  it("跨月回退", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28")
  })

  it("跨年回退", () => {
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31")
  })

  it("前进", () => {
    expect(shiftDay("2026-09-29", 1)).toBe("2026-09-30")
  })
})

describe("windowRange", () => {
  it("day 为单日", () => {
    expect(windowRange("day", "2026-09-29")).toEqual({ from: "2026-09-29", to: "2026-09-29" })
  })

  it("week 为 7 天滚动", () => {
    expect(windowRange("week", "2026-09-29")).toEqual({ from: "2026-09-23", to: "2026-09-29" })
  })

  it("month 为 30 天滚动", () => {
    expect(windowRange("month", "2026-09-29")).toEqual({ from: "2026-08-31", to: "2026-09-29" })
  })
})

describe("eventIdFromKey", () => {
  it("确定性", () => {
    expect(eventIdFromKey("苹果发布会定档")).toBe(eventIdFromKey("苹果发布会定档"))
  })

  it("不同 key 不同 id", () => {
    expect(eventIdFromKey("苹果发布会定档")).not.toBe(eventIdFromKey("小米发布会定档"))
  })
})

describe("matchEvent", () => {
  const candidates = [
    { id: "evt-a", title: "苹果发布会定档九月" },
    { id: "evt-b", title: "特斯拉召回部分车型" },
  ]

  it("命中最相似候选", () => {
    expect(matchEvent("苹果发布会定档九月", candidates)).toBe("evt-a")
  })

  it("长标题包含关系命中", () => {
    expect(matchEvent("如何看待iphone17发布", [{ id: "evt-c", title: "iphone17发布" }])).toBe("evt-c")
  })

  it("不同事件不命中", () => {
    expect(matchEvent("某地暴雨预警升级", candidates)).toBeUndefined()
  })

  it("空候选返回 undefined", () => {
    expect(matchEvent("苹果发布会定档九月", [])).toBeUndefined()
  })

  it("短标题跳过", () => {
    expect(matchEvent("重磅", candidates)).toBeUndefined()
  })
})

describe("windowScore", () => {
  it("累计分 + 0.3×天数", () => {
    expect(windowScore([1, 0.5, 2])).toBe(4.4)
  })

  it("空数组为 0", () => {
    expect(windowScore([])).toBe(0)
  })
})
