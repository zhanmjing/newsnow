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
    url: `https://example.com/${merged.sourceId}/${merged.title}`,
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
})
