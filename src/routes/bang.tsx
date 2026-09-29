import type { SourceID, SourceResponse } from "@shared/types"
import type { BangResponse } from "@shared/cluster"
import type { BangWindow, BangWindowResponse } from "@shared/history"
import { sources } from "@shared/sources"
import { buildBang } from "@shared/cluster"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useTitle } from "react-use"
import { NavBar } from "~/components/navbar"

export const Route = createFileRoute("/bang")({
  component: BangComponent,
})

const allSourceIds = (Object.keys(sources) as SourceID[]).filter(id => !sources[id]?.redirect)

const TABS: Array<{ key: "live" | BangWindow, label: string }> = [
  { key: "live", label: "实时" },
  { key: "day", label: "日榜" },
  { key: "week", label: "周榜" },
  { key: "month", label: "月榜" },
]

const WINDOW_SPAN: Record<BangWindow, number> = { day: 1, week: 7, month: 30 }

function BangComponent() {
  useTitle("NewsNow | 榜中榜")
  const [tab, setTab] = useState<"live" | BangWindow>("live")

  const live = useQuery({
    queryKey: ["bang", "live"],
    enabled: tab === "live",
    queryFn: async () => {
      const rows: SourceResponse[] | undefined = await myFetch("/s/entire", {
        method: "POST",
        body: { sources: allSourceIds },
      })
      const data = (rows ?? []).map(row => ({
        id: row.id,
        name: sources[row.id]?.name ?? row.id,
        items: row.items,
      }))
      return buildBang(data, allSourceIds.length) as BangResponse
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  })

  const win = useQuery({
    queryKey: ["bang-window", tab],
    enabled: tab !== "live",
    queryFn: async () => await myFetch<BangWindowResponse>(`/bang-window?window=${tab}`),
    staleTime: 1000 * 60 * 5,
    retry: false,
  })

  const isError = tab === "live" ? live.isError : win.isError
  const isFetching = tab === "live" ? live.isFetching : win.isFetching
  const refetch = tab === "live" ? live.refetch : win.refetch
  const windowData = win.data
  const expanding = tab !== "live" && !!windowData?.items.length
    && Math.max(...windowData!.items.map(i => i.days)) < WINDOW_SPAN[tab as BangWindow]

  return (
    <div className="flex flex-col items-center px-2">
      <div className="flex justify-center md:hidden mb-6 w-full">
        <NavBar />
      </div>
      <div className="w-full max-w-900px flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-xl font-bold">榜中榜</span>
          <button
            type="button"
            title="Refresh"
            className={$("btn i-ph:arrow-counter-clockwise-duotone", isFetching && "animate-spin i-ph:circle-dashed-duotone")}
            onClick={() => refetch()}
          />
        </div>

        <div className="flex gap-2 px-2 text-sm">
          {TABS.map(t => (
            <button
              key={t.key}
              type="button"
              className={$(
                "px-3 py-1 rounded-full transition-all cursor-pointer",
                tab === t.key
                  ? "bg-primary/20 color-primary-6 font-bold"
                  : "bg-neutral-400/10 op-70 hover:bg-neutral-400/20",
              )}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isError && (
          <div className="text-center op-70 py-10">接口异常，稍后重试</div>
        )}

        {tab === "live" && live.data && !live.data.clusters.length && (
          <div className="text-center op-70 py-10">暂无数据，先去首页逛逛以填充缓存</div>
        )}

        {tab !== "live" && windowData && (
          <div className="text-center text-xs op-50">
            {windowData.from === windowData.to ? windowData.to : `${windowData.from} ~ ${windowData.to}`}
            {expanding && "（数据积累中，周榜需 ≥7 天、月榜需 ≥30 天）"}
          </div>
        )}

        {tab !== "live" && windowData && !windowData.items.length && (
          <div className="text-center op-70 py-10">暂无数据：等待采集管线运行（每 3 小时更新）</div>
        )}

        {tab === "live"
          ? (
              <ol className="flex flex-col gap-3">
                {live.data?.clusters.map((c, i) => (
                  <li key={c.id} className="rounded-2xl p-4 bg-neutral-400/10 flex gap-3">
                    <span className="min-w-8 text-center text-lg font-bold color-primary-6">
                      {i + 1}
                    </span>
                    <div className="flex flex-col gap-2 min-w-0 w-full">
                      <a
                        href={c.members[0]?.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={c.title}
                        className="text-base hover:underline w-fit"
                      >
                        {c.title}
                      </a>
                      <div className="flex flex-wrap gap-1 text-xs op-70">
                        {c.members.map(m => (
                          <span key={`${m.sourceId}-${m.rank}`} className="px-1.5 py-0.5 rounded bg-neutral-400/10">
                            {`${m.sourceName} #${m.rank}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )
          : (
              <ol className="flex flex-col gap-3">
                {windowData?.items.map((item, i) => (
                  <li key={item.id} className="rounded-2xl p-4 bg-neutral-400/10 flex gap-3">
                    <span className="min-w-8 text-center text-lg font-bold color-primary-6">
                      {i + 1}
                    </span>
                    <div className="flex flex-col gap-2 min-w-0 w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={item.title}
                          className="text-base hover:underline w-fit"
                        >
                          {item.title}
                        </a>
                        {item.days > 1 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 color-primary-6">
                            {`持续 ${item.days} 天`}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 text-xs op-70">
                        {item.members.map(m => (
                          <span key={`${m.sourceId}-${m.rank}`} className="px-1.5 py-0.5 rounded bg-neutral-400/10">
                            {`${m.sourceName} #${m.rank}`}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs op-50">
                        {`${item.sourceCount} 源命中 · 最佳 #${item.bestRank} · 代表源 ${item.topSource}`}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
      </div>
    </div>
  )
}
