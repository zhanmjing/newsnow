// Supjav 日/周/月三榜采集（本机运行，需系统代理可达 supjav.com）
// 用法: node tools/supjav-collect.mjs [--dry-run]
// 配置: tools/supjav.local.json（模板见 supjav.config.example.json；proxy 可选，缺省用系统代理）
// 原理: 启动本机 Chrome headless，经 CDP（Node 内置 WebSocket）等待 Cloudflare 挑战自动通过后解析 DOM

import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import process from "node:process"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dryRun = process.argv.includes("--dry-run")
const WINDOWS = ["day", "week", "month"]
const PAGES = [1, 2, 3]
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
const TIMEOUT_MS = 90_000
const sleep = ms => new Promise(r => setTimeout(r, ms))

function loadConfig() {
  const configPath = path.join(__dirname, "supjav.local.json")
  if (!fs.existsSync(configPath))
    throw new Error(`缺少配置文件 ${configPath}（复制 supjav.config.example.json 并填入 token）`)
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
  if (!config.baseUrl || !config.token)
    throw new Error("配置缺少 baseUrl 或 token")
  const candidates = config.chromePath
    ? [config.chromePath]
    : [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ]
  const chromePath = candidates.find(p => fs.existsSync(p))
  if (!chromePath)
    throw new Error("未找到 Chrome，请在配置中设置 chromePath")
  const proxy = typeof config.proxy === "string" ? config.proxy.trim() : ""
  return { baseUrl: config.baseUrl.replace(/\/$/, ""), token: config.token, chromePath, proxy, headless: config.headless !== false }
}

function parseViews(text) {
  const match = String(text ?? "").replace(/[,\s]/g, "").match(/^(\d+)/)
  return match ? Number(match[1]) : undefined
}

function stripThumbSuffix(url) {
  const base = String(url ?? "").trim().replace(/!\d+x\d+\.jpg$/i, "")
  return base.startsWith("https://img.supjav.com/") ? base : undefined
}

async function launchChrome(chromePath, headless, proxy) {
  const port = 9200 + Math.floor(Math.random() * 700)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "supjav-prof-"))
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--disable-gpu",
    "--window-size=1280,900",
    `--user-agent=${UA}`,
    "--disable-blink-features=AutomationControlled",
    "--lang=en-US,en",
  ]
  if (proxy) args.push(`--proxy-server=${proxy}`)
  if (headless) args.unshift("--headless=new")
  args.push("about:blank")
  const child = spawn(chromePath, args, { stdio: "ignore" })
  let version
  for (let i = 0; i < 80; i++) {
    try {
      version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
      break
    } catch {
      await sleep(250)
    }
  }
  if (!version) {
    child.kill()
    throw new Error("Chrome 启动失败")
  }
  return { child, port, profile }
}

async function openSession(port) {
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  }
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  const send = (method, params = {}) => new Promise((resolve) => {
    const messageId = ++id
    pending.set(messageId, resolve)
    ws.send(JSON.stringify({ id: messageId, method, params }))
    setTimeout(() => {
      if (pending.has(messageId)) {
        pending.delete(messageId)
        resolve({ timeout: true })
      }
    }, TIMEOUT_MS)
  })
  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })
    return res?.result?.result?.value
  }
  const goto = async (url) => {
    await send("Page.enable")
    for (let attempt = 1; attempt <= 3; attempt++) {
      await send("Page.navigate", { url })
      const deadline = Date.now() + TIMEOUT_MS
      while (Date.now() < deadline) {
        await sleep(2000)
        const raw = await evaluate("JSON.stringify({ href: location.href, title: document.title, ready: document.readyState })")
        if (!raw) continue
        let state
        try {
          state = JSON.parse(raw)
        } catch {
          continue
        }
        if (state.href.startsWith("chrome-error://")) break
        if (state.href.replace(/\/$/, "") !== url.replace(/\/$/, "")) continue
        if (state.ready === "loading") continue
        if (!state.title || /just a moment|请稍候|attention required/i.test(state.title)) continue
        return
      }
      await sleep(1500)
    }
    throw new Error(`页面加载失败: ${url}（已重试 3 次，请确认代理正常）`)
  }
  const close = async () => {
    try {
      ws.close()
    } catch {}
    await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`).catch(() => {})
  }
  return { evaluate, goto, close }
}

const EXTRACT_JS = `(() => {
  const rows = []
  document.querySelectorAll(".post").forEach((el, index) => {
    const a = el.querySelector("h3 a")
    if (!a) return
    const meta = el.querySelector(".meta")
    const dateEl = meta && meta.querySelector(".date")
    const img = el.querySelector("img.thumb")
    rows.push({
      title: a.textContent.trim(),
      url: a.href,
      thumb: img ? (img.getAttribute("data-original") || img.src || "") : "",
      views: dateEl ? dateEl.textContent : "",
      date: meta && meta.childNodes[0] ? meta.childNodes[0].textContent.trim() : "",
    })
  })
  return rows
})()`

async function collectWindow(session, window) {
  const items = []
  for (const page of PAGES) {
    const url = page === 1
      ? `https://supjav.com/popular?sort=${window}`
      : `https://supjav.com/popular/page/${page}?sort=${window}`
    await session.goto(url)
    const rows = await session.evaluate(EXTRACT_JS)
    for (const row of rows ?? []) {
      items.push({
        rank: items.length + 1,
        title: row.title,
        url: row.url,
        thumb: stripThumbSuffix(row.thumb),
        views: parseViews(row.views),
        date: row.date || undefined,
      })
    }
  }
  if (!items.length) throw new Error(`${window} 榜提取 0 条（页面可能改版）`)
  return items
}

async function uploadWindow(baseUrl, token, window, items) {
  const res = await fetch(`${baseUrl}/api/supjav-ingest`, {
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
    fs.appendFileSync(path.join(__dirname, "supjav.log"), `[${new Date().toISOString()}] ${line}\n`)
  } catch {}
}

async function main() {
  const config = loadConfig()
  const { child, port, profile } = await launchChrome(config.chromePath, config.headless, config.proxy)
  try {
    const session = await openSession(port)
    try {
      for (const window of WINDOWS) {
        const items = await collectWindow(session, window)
        if (dryRun) {
          console.log(`[dry-run] ${window}: ${items.length} 条；示例: ${items[0].title.slice(0, 60)}`)
        } else {
          await uploadWindow(config.baseUrl, config.token, window, items)
          console.log(`${window}: 上传成功 ${items.length} 条`)
        }
      }
    } finally {
      await session.close()
    }
  } finally {
    child.kill()
    await new Promise((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve()
      const timer = setTimeout(resolve, 5000)
      child.once("exit", () => {
        clearTimeout(timer)
        resolve()
      })
    })
    for (let attempt = 0; attempt < 5 && fs.existsSync(profile); attempt++) {
      try {
        fs.rmSync(profile, { recursive: true, force: true })
      } catch {}
      if (fs.existsSync(profile)) await sleep(1000)
    }
  }
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
