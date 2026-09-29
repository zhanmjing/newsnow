import { describe, expect, it } from "vitest"
import { areSimilar, bigrams, clusterNews, containmentCoefficient, diceCoefficient, normalizeTitle } from "./cluster"
import type { ClusterInput } from "./cluster"

describe("normalizeTitle", () => {
  it("全角转半角并小写", () => {
    expect(normalizeTitle("Ｂ站")).toBe("b站")
  })

  it("去除标点/空白/emoji", () => {
    expect(normalizeTitle("【重磅】ChatGPT-5 发布！😂")).toBe("重磅chatgpt5发布")
  })
})

describe("bigrams", () => {
  it("字符二元组", () => {
    expect([...bigrams("abcd")].sort()).toEqual(["ab", "bc", "cd"])
  })

  it("短于 2 字符返回空集", () => {
    expect(bigrams("a").size).toBe(0)
  })
})

describe("similarity", () => {
  it("相同集合 dice 为 1", () => {
    expect(diceCoefficient(bigrams("苹果发布会"), bigrams("苹果发布会"))).toBe(1)
  })

  it("无交集 dice 为 0", () => {
    expect(diceCoefficient(bigrams("苹果发布"), bigrams("小米事故"))).toBe(0)
  })

  it("子集 containment 为 1", () => {
    expect(containmentCoefficient(bigrams("iphone17发布"), bigrams("如何看待iphone17发布"))).toBe(1)
  })

  it("areSimilar 命中 dice 阈值", () => {
    expect(areSimilar(bigrams("iphone17正式发布售价5999起"), bigrams("iphone17正式发布"))).toBe(true)
  })
})

describe("areSimilar 阈值边界", () => {
  it("3+3 元组交集为 2（dice 0.667）时命中", () => {
    const a = new Set(["ab", "bc", "cd"])
    const b = new Set(["ab", "bc", "de"])
    expect(diceCoefficient(a, b)).toBeCloseTo(2 / 3)
    expect(containmentCoefficient(a, b)).toBeCloseTo(2 / 3)
    expect(areSimilar(a, b)).toBe(true)
  })

  it("3+3 元组交集为 1（dice 0.333）时不命中", () => {
    const a = new Set(["ab", "bc", "cd"])
    const b = new Set(["ab", "de", "ef"])
    expect(diceCoefficient(a, b)).toBeCloseTo(1 / 3)
    expect(containmentCoefficient(a, b)).toBeCloseTo(1 / 3)
    expect(areSimilar(a, b)).toBe(false)
  })

  it("10+3 元组交集为 3 时仅靠 containment 命中，交集为 2 时不命中", () => {
    const long = new Set(["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10"])
    const contained = new Set(["a1", "a2", "a3"])
    expect(diceCoefficient(long, contained)).toBeCloseTo(6 / 13)
    expect(containmentCoefficient(long, contained)).toBe(1)
    expect(areSimilar(long, contained)).toBe(true)

    const partial = new Set(["a1", "a2", "b1"])
    expect(diceCoefficient(long, partial)).toBeCloseTo(4 / 13)
    expect(containmentCoefficient(long, partial)).toBeCloseTo(2 / 3)
    expect(areSimilar(long, partial)).toBe(false)
  })
})

function item(partial: Partial<ClusterInput> & { title: string }): ClusterInput {
  const merged = {
    sourceId: "zhihu",
    sourceName: "知乎",
    rank: 1,
    total: 10,
    ...partial,
  }
  return {
    ...merged,
    url: merged.url ?? `https://example.com/${merged.sourceId}/${merged.title}`,
  }
}

describe("clusterNews", () => {
  it("同一事件跨源合并并按分数排序", () => {
    const clusters = clusterNews([
      item({ sourceId: "zhihu", sourceName: "知乎", rank: 1, total: 10, title: "苹果发布会定档九月" }),
      item({ sourceId: "weibo", sourceName: "微博", rank: 2, total: 10, title: "苹果发布会定档九月" }),
      item({ sourceId: "baidu", sourceName: "百度", rank: 3, total: 10, title: "完全无关的另一个事件" }),
    ])
    expect(clusters.length).toBe(2)
    expect(clusters[0].sourceCount).toBe(2)
    expect(clusters[0].members.length).toBe(2)
    expect(clusters[0].score).toBe(2.4)
    expect(clusters[1].score).toBe(0.8)
  })

  it("不同事件不合并", () => {
    const clusters = clusterNews([
      item({ title: "苹果发布会定档九月" }),
      item({ sourceId: "weibo", sourceName: "微博", title: "苹果价格突然上调" }),
    ])
    expect(clusters.length).toBe(2)
  })

  it("长标题包含关系可合并", () => {
    const clusters = clusterNews([
      item({ title: "如何看待iphone17发布" }),
      item({ sourceId: "weibo", sourceName: "微博", title: "iphone17发布" }),
    ])
    expect(clusters.length).toBe(1)
    expect(clusters[0].sourceCount).toBe(2)
  })

  it("跨源命中加成使多源事件排名更前", () => {
    const clusters = clusterNews([
      item({ sourceId: "zhihu", sourceName: "知乎", rank: 1, total: 10, title: "苹果发布会定档九月" }),
      item({ sourceId: "weibo", sourceName: "微博", rank: 10, total: 10, title: "苹果发布会定档九月" }),
      item({ sourceId: "baidu", sourceName: "百度", rank: 1, total: 10, title: "特斯拉召回部分车型" }),
    ])
    expect(clusters[0].title).toBe("苹果发布会定档九月")
    expect(clusters[0].score).toBe(1.6)
    expect(clusters[1].title).toBe("特斯拉召回部分车型")
  })

  it("短标题剔除（归一化后不足 4 字符）", () => {
    expect(clusterNews([item({ title: "重磅" })]).length).toBe(0)
  })

  it("空输入返回空数组", () => {
    expect(clusterNews([]).length).toBe(0)
  })

  it("仅 containment 达标（dice 不足）时仍合并", () => {
    const short = "小米su7发布"
    const long = "小米su7发布售价公布全系车型降价促销活动今日开启"
    expect(diceCoefficient(bigrams(short), bigrams(long))).toBeLessThan(0.5)
    expect(containmentCoefficient(bigrams(short), bigrams(long))).toBe(1)
    const clusters = clusterNews([
      item({ title: short }),
      item({ sourceId: "weibo", sourceName: "微博", title: long }),
    ])
    expect(clusters.length).toBe(1)
    expect(clusters[0].sourceCount).toBe(2)
  })

  it("相同 URL 去重只保留一条", () => {
    const url = "https://example.com/same-story"
    const clusters = clusterNews([
      item({ sourceId: "zhihu", sourceName: "知乎", title: "苹果发布会定档九月", url }),
      item({ sourceId: "weibo", sourceName: "微博", title: "苹果发布会定档九月", url }),
    ])
    expect(clusters.length).toBe(1)
    expect(clusters[0].members.length).toBe(1)
    expect(clusters[0].sourceCount).toBe(1)
  })

  it("total 为 0 时分数按 0 计而非 NaN", () => {
    const clusters = clusterNews([item({ title: "苹果发布会定档九月", total: 0 })])
    expect(clusters.length).toBe(1)
    expect(clusters[0].score).toBe(0)
  })
})

function scaleItems(): ClusterInput[] {
  let seed = 20260929
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  const words = ["苹果", "小米", "特斯拉", "比亚迪", "英伟达", "央行", "国足", "暴雨", "台风", "地震", "电影", "票房", "补贴", "政策", "芯片", "关税", "航线", "油价", "黄金", "楼市", "考研", "春运", "演唱会", "飞船", "新能源", "手机", "汽车", "白酒", "医药", "银行", "券商", "基金", "汇率", "出口", "进口", "就业", "生育", "养老"]
  const chars = "国际经济科技市场金融政策民生教育文化体育卫生健康环境能源交通农业旅游信息网络安全创新改革发展稳定合作交流消费投资贸易增长就业价格服务保障质量水平提升优化结构调整产业供应链数字化智能化".split("")
  const randWord = () => words[Math.floor(rand() * words.length)]
  const randChars = (n: number) => {
    let s = ""
    while (s.length < n) s += chars[Math.floor(rand() * chars.length)]
    return s
  }
  const eventTitles = Array.from({ length: 40 }, () => {
    const parts = new Set<string>()
    while (parts.size < 5) parts.add(randWord())
    return [...parts].join("")
  })

  const sourceCount = 47
  const perSource = 64
  const items: ClusterInput[] = []
  for (let s = 0; s < sourceCount; s++) {
    for (let i = 0; i < perSource; i++) {
      const sourceId = `source-${s}`
      const base = { sourceId, sourceName: `来源${s}`, rank: i + 1, total: perSource }
      if (i < eventTitles.length && (s + i) % sourceCount < 15) {
        items.push({ ...base, title: eventTitles[i], url: `https://example.com/${sourceId}/event-${i}` })
      } else {
        const title = `${randWord()}${randChars(4)}${randWord()}${randChars(4)}${randWord()}`
        items.push({ ...base, title, url: `https://example.com/${sourceId}/unique-${i}` })
      }
    }
  }
  return items
}

describe("clusterNews 规模性能", () => {
  it("47 源 × 64 条（含 40 个跨源事件）在 500ms 内完成", () => {
    const items = scaleItems()
    expect(items.length).toBe(3008)

    const start = performance.now()
    const clusters = clusterNews(items)
    const duration = performance.now() - start

    // 500ms 约为倒排索引实现预期耗时的 5 倍，远低于线性扫描基线（本机实测约 1.4s，评审基线约 2.4s），
    // 用于守住 Cloudflare Workers Free 10ms CPU 限额
    expect(duration).toBeLessThan(500)

    const known = clusters.find(c => c.members.some(m => m.title === items[0].title))
    expect(known?.sourceCount ?? 0).toBeGreaterThanOrEqual(4)
  })
})
