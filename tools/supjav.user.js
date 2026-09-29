// ==UserScript==
// @name         Supjav 榜中榜采集（备用通道）
// @namespace    newsnow-supjav
// @version      1.0.0
// @description  在 supjav 页面内抓取日/周/月三榜并上传到个人聚合站；每 6 小时最多一次
// @match        https://supjav.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      newsnow-cyb.pages.dev
// ==/UserScript==
/* global GM_xmlhttpRequest, GM_getValue, GM_setValue, GM_registerMenuCommand */
/* eslint-disable no-alert */

(function () {
  // 修改为你的站点域名与 INGEST_TOKEN（使用自定义域名时同步修改 @connect）
  const BASE_URL = "https://newsnow-cyb.pages.dev"
  const TOKEN = "REPLACE_WITH_INGEST_TOKEN"
  const INTERVAL_MS = 6 * 60 * 60 * 1000
  const WINDOWS = ["day", "week", "month"]
  const PAGES = [1, 2, 3]

  function parseViews(text) {
    const match = String(text ?? "").replace(/[,\s]/g, "").match(/^(\d+)/)
    return match ? Number(match[1]) : undefined
  }

  function stripThumbSuffix(url) {
    const base = String(url ?? "").trim().replace(/!\d+x\d+\.jpg$/i, "")
    return base.startsWith("https://img.supjav.com/") ? base : undefined
  }

  async function fetchWindow(window) {
    const items = []
    for (const page of PAGES) {
      const url = page === 1
        ? `/popular?sort=${window}`
        : `/popular/page/${page}?sort=${window}`
      const res = await fetch(url, { credentials: "include" })
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, "text/html")
      doc.querySelectorAll(".post").forEach((el) => {
        const a = el.querySelector("h3 a")
        if (!a) return
        const meta = el.querySelector(".meta")
        const dateEl = meta && meta.querySelector(".date")
        const img = el.querySelector("img.thumb")
        items.push({
          rank: items.length + 1,
          title: a.textContent.trim(),
          url: a.href,
          thumb: stripThumbSuffix(img ? (img.getAttribute("data-original") || img.src || "") : ""),
          views: parseViews(dateEl ? dateEl.textContent : ""),
          date: meta && meta.childNodes[0] ? meta.childNodes[0].textContent.trim() : undefined,
        })
      })
    }
    if (!items.length) throw new Error(`${window} 榜提取 0 条`)
    return items
  }

  function uploadWindow(window, items) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: `${BASE_URL}/api/supjav-ingest`,
        headers: {
          "content-type": "application/json",
          "x-ingest-token": TOKEN,
        },
        data: JSON.stringify({ window, items }),
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText)
          else reject(new Error(`HTTP ${res.status}: ${String(res.responseText).slice(0, 120)}`))
        },
        onerror: () => reject(new Error("网络错误")),
        ontimeout: () => reject(new Error("请求超时")),
        timeout: 30_000,
      })
    })
  }

  async function run() {
    for (const window of WINDOWS) {
      const items = await fetchWindow(window)
      await uploadWindow(window, items)
      console.log(`[supjav-bang] ${window}: ${items.length} 条已上传`)
    }
  }

  GM_registerMenuCommand("立即上传 Supjav 榜中榜", async () => {
    try {
      await run()
      GM_setValue("lastUpload", Date.now())
      alert("Supjav 三榜上传成功")
    } catch (err) {
      alert(`上传失败：${err.message}`)
    }
  })

  const last = Number(GM_getValue("lastUpload", 0))
  if (Date.now() - last >= INTERVAL_MS) {
    run()
      .then(() => {
        GM_setValue("lastUpload", Date.now())
        console.log("[supjav-bang] 自动上传成功")
      })
      .catch(err => console.warn("[supjav-bang] 自动上传失败", err))
  }
})()
