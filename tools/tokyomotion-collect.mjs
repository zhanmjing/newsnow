// TokyoMotion 日/周/月榜单采集（本机运行，纯 HTTP 抓取，无需浏览器）
// 用法: node tools/tokyomotion-collect.mjs [--dry-run]
// 配置: tools/supjav.local.json（与 supjav 采集共用：baseUrl / token；可选 tokyomotionPages 默认 3）
// 翻页: 源站 20 条/页；每窗抓前 N 页（默认 3 页 = 60 条），更深页面由页面「在源站翻页」外链承载

import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const cheerio = require("cheerio")

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dryRun = process.argv.includes("--dry-run")
const WINDOW_PARAMS = { day: "d", week: "w", month: "m" }
const WINDOWS = ["day", "week", "month"]
const BASE = "https://www.tokyomotion.net"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
const sleep = ms => new Promise(r => setTimeout(r, ms))

function loadConfig() {
  const configPath = path.join(__dirname, "supjav.local.json")
  if (!fs.existsSync(configPath) && !dryRun)
    throw new Error(`缺少配置文件 ${configPath}（复制 supjav.config.example.json 并填入 token）`)
  const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, "utf8")) : {}
  if (!dryRun && (!config.baseUrl || !config.token))
    throw new Error("配置缺少 baseUrl 或 token")
  const pages = Number(config.tokyomotionPages) > 0 ? Math.min(20, Math.floor(Number(config.tokyomotionPages))) : 3
  return { baseUrl: (config.baseUrl ?? "").replace(/\/$/, ""), token: config.token ?? "", pages }
}

function parseViews(text) {
  const match = String(text ?? "").replace(/[,\s]/g, "").match(/^(\d+)/)
  return match ? Number(match[1]) : undefined
}

function parseDuration(text) {
  const match = String(text ?? "").trim().match(/^\d{1,2}:\d{2}(?::\d{2})?$/)
  return match ? match[0] : undefined
}

async function fetchPage(window, page) {
  const t = WINDOW_PARAMS[window]
  const url = page === 1
    ? `${BASE}/videos?o=mv&t=${t}`
    : `${BASE}/videos?o=mv&t=${t}&page=${page}`
  let lastError
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "ja,en;q=0.8" },
        signal: AbortSignal.timeout(30_000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      const doc = cheerio.load(html)
      const items = []
      doc(".well.well-sm").each((_, el) => {
        const node = doc(el)
        const href = node.find("a.thumb-popu").first().attr("href") ?? ""
        const title = node.find(".video-title").first().text().trim() || node.find("img").first().attr("title")?.trim() || ""
        const thumb = node.find("img.img-responsive").first().attr("src") ?? ""
        const duration = node.find(".duration").first().text().trim()
        const views = node.find(".video-views").first().text().trim()
        if (!href.startsWith("/video/") || !title) return
        items.push({ title, url: BASE + href, thumb, duration, views })
      })
      if (!items.length) throw new Error("提取 0 条（页面可能改版）")
      return items
    } catch (err) {
      lastError = err
      if (attempt < 3) await sleep(2000)
    }
  }
  throw new Error(`${window} 第 ${page} 页抓取失败: ${lastError?.message ?? lastError}`)
}

async function collectWindow(window, pages) {
  const items = []
  for (let page = 1; page <= pages; page++) {
    const rows = await fetchPage(window, page)
    for (const row of rows) {
      items.push({
        rank: items.length + 1,
        title: row.title,
        url: row.url,
        thumb: row.thumb.startsWith("https://cdn.tokyo-motion.net/") ? row.thumb : undefined,
        views: parseViews(row.views),
        duration: parseDuration(row.duration),
      })
    }
  }
  return items
}

async function uploadWindow(baseUrl, token, window, items) {
  const res = await fetch(`${baseUrl}/api/tokyomotion-ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ingest-token": token,
    },
    body: JSON.stringify({ window, items }),
    signal: AbortSignal.timeout(30_000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`上传 ${window} 失败 HTTP ${res.status}: ${text.slice(0, 200)}`)
  return text
}

function appendLog(line) {
  try {
    fs.appendFileSync(path.join(__dirname, "tokyomotion.log"), `[${new Date().toISOString()}] ${line}\n`)
  } catch {}
}

async function main() {
  const config = loadConfig()
  let failed = 0
  for (const window of WINDOWS) {
    try {
      const items = await collectWindow(window, config.pages)
      if (dryRun) {
        console.log(`[dry-run] ${window}: ${items.length} 条；示例: ${items[0].title.slice(0, 40)} (${items[0].duration ?? "?"})`)
      } else {
        await uploadWindow(config.baseUrl, config.token, window, items)
        console.log(`${window}: 上传成功 ${items.length} 条`)
      }
    } catch (err) {
      failed++
      console.error(`${window}: 失败 ${err?.message ?? err}`)
    }
  }
  if (failed) throw new Error(`${failed} 个窗口采集失败`)
}

main()
  .then(() => {
    const line = dryRun ? "dry-run 完成" : "全部窗口上传成功"
    console.log(line)
    appendLog(line)
    process.exit(0)
  })
  .catch((err) => {
    const line = `失败: ${err?.message ?? err}`
    console.error(line)
    appendLog(line)
    process.exit(1)
  })
