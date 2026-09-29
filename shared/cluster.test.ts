import { describe, expect, it } from "vitest"
import { areSimilar, bigrams, containmentCoefficient, diceCoefficient, normalizeTitle } from "./cluster"

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
