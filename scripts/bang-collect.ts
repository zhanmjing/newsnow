import process from "node:process"
import { ofetch } from "ofetch"
import type { SourceResponse } from "../shared/types"
import { buildBang, normalizeTitle } from "../shared/cluster"
import { matchEvent, shanghaiDay } from "../shared/history"
import { sources } from "../shared/sources"

const BASE = process.env.BANG_BASE_URL ?? "https://newsnow-cyb.pages.dev"
const TOKEN = process.env.INGEST_TOKEN ?? ""
const dryRun = process.argv.includes("--dry-run")

const api = ofetch.create({ baseURL: BASE, retry: 0, timeout: 60_000 })

async function main() {
  const ids = (Object.keys(sources) as Array<keyof typeof sources>).filter(id => !sources[id]?.redirect)

  const rows: SourceResponse[] = []
  let failed = 0
  for (const id of ids) {
    try {
      const res = await api<SourceResponse>("/api/s", { query: { id, latest: true } })
      if (res?.items?.length) rows.push(res)
      else failed++
    } catch {
      failed++
      console.warn(`source failed: ${id}`)
    }
  }

  const data = rows.map(row => ({
    id: row.id,
    name: sources[row.id]?.name ?? row.id,
    items: row.items,
  }))
  const bang = buildBang(data, ids.length)
  console.log(`sources ok=${rows.length} failed=${failed} items=${bang.meta.itemCount} clusters=${bang.clusters.length}`)

  const candidates = (await api<{ events: Array<{ id: string, title: string }> }>("/api/bang-events", { query: { days: 30 } })).events ?? []
  const day = shanghaiDay()
  let matched = 0
  let fresh = 0
  const events = bang.clusters.map((cluster) => {
    const id = matchEvent(cluster.title, candidates)
    if (id) matched++
    else fresh++
    return {
      id,
      key: normalizeTitle(cluster.title),
      title: cluster.title,
      url: cluster.members[0]?.url ?? "",
      score: cluster.score,
      sourceCount: cluster.sourceCount,
      bestRank: Math.min(...cluster.members.map(m => m.rank)),
      topSource: cluster.members[0]?.sourceName ?? "",
      members: cluster.members.slice(0, 8).map(m => ({
        sourceId: m.sourceId,
        sourceName: m.sourceName,
        rank: m.rank,
        title: m.title,
        url: m.url,
      })),
    }
  })
  console.log(`events matched=${matched} new=${fresh} day=${day}`)

  if (dryRun) {
    console.log("dry-run summary (top 10):")
    console.log(JSON.stringify(events.slice(0, 10).map(e => ({ id: e.id ?? "(new)", title: e.title, score: e.score, sources: e.sourceCount })), null, 2))
    return
  }

  if (!TOKEN) throw new Error("INGEST_TOKEN is not set")
  const CHUNK_SIZE = 12
  let inserted = 0
  let updated = 0
  let pruned = 0
  for (let i = 0; i < events.length; i += CHUNK_SIZE) {
    const chunk = events.slice(i, i + CHUNK_SIZE)
    const result = await api<{ ok: boolean, inserted: number, updated: number, pruned: number }>("/api/ingest", {
      method: "POST",
      headers: { "x-ingest-token": TOKEN },
      body: { day, events: chunk },
    })
    inserted += result.inserted
    updated += result.updated
    pruned += result.pruned
  }
  console.log("ingest result:", JSON.stringify({ ok: true, inserted, updated, pruned }))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
