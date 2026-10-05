import type { RankItem, RankResponse, RankWindow, RankWindowItem } from "@shared/rank"
import { formatViews } from "@shared/rank"
import { javbunnyThumb } from "@shared/javbunny"
import { thumbURL } from "@shared/supjav"
import { tokyomotionThumb } from "@shared/tokyomotion"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useTitle } from "react-use"
import { NavBar } from "~/components/navbar"

export const Route = createFileRoute("/supjav")({
  component: RankComponent,
})

type SiteId = "supjav" | "tokyomotion" | "javbunny"
type SiteTab = "all" | RankWindow

const SITES: Array<{ key: SiteId, label: string, api: string }> = [
  { key: "supjav", label: "Supjav", api: "/supjav" },
  { key: "tokyomotion", label: "TokyoMotion", api: "/tokyomotion" },
  { key: "javbunny", label: "JavBunny", api: "/javbunny" },
]

const TABS: Array<{ key: SiteTab, label: string }> = [
  { key: "all", label: "聚合" },
  { key: "day", label: "日榜" },
  { key: "week", label: "周榜" },
  { key: "month", label: "月榜" },
]

const WINDOW_BADGES: Array<{ key: RankWindow, label: string, className: string }> = [
  { key: "day", label: "日", className: "bg-primary/10 color-primary-6" },
  { key: "week", label: "周", className: "bg-orange-400/10 color-orange-600" },
  { key: "month", label: "月", className: "bg-teal-400/10 color-teal-600" },
]

const SOURCE_URLS: Record<SiteId, Record<RankWindow, string>> = {
  supjav: {
    day: "https://supjav.com/popular?sort=day",
    week: "https://supjav.com/popular?sort=week",
    month: "https://supjav.com/popular?sort=month",
  },
  tokyomotion: {
    day: "https://www.tokyomotion.net/videos?o=mv&t=d",
    week: "https://www.tokyomotion.net/videos?o=mv&t=w",
    month: "https://www.tokyomotion.net/videos?o=mv&t=m",
  },
  javbunny: {
    day: "https://javbunny.com/popular.php?t=1d&lang=ja",
    week: "https://javbunny.com/popular.php?t=7d&lang=ja",
    month: "https://javbunny.com/popular.php?t=31d&lang=ja",
  },
}

function itemThumb(site: SiteId, base: string | null) {
  if (site === "supjav") return thumbURL(base)
  if (site === "tokyomotion") return tokyomotionThumb(base)
  return javbunnyThumb(base)
}

function RankComponent() {
  const [site, setSite] = useState<SiteId>("supjav")
  const [tab, setTab] = useState<SiteTab>("all")
  const siteConfig = SITES.find(s => s.key === site)!
  useTitle(`NewsNow | ${siteConfig.label} 榜中榜`)
  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: ["rank", site],
    queryFn: async () => await myFetch<RankResponse>(siteConfig.api),
    staleTime: 1000 * 60 * 5,
    retry: false,
  })

  const list: Array<RankItem | RankWindowItem> = !data
    ? []
    : tab === "all"
      ? data.items
      : data.windows[tab].items

  return (
    <div className="flex flex-col items-center px-2">
      <div className="flex justify-center md:hidden mb-6 w-full">
        <NavBar />
      </div>
      <div className="w-full max-w-900px flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <span className="text-xl font-bold">
            {siteConfig.label}
            {" "}
            榜中榜
          </span>
          <button
            type="button"
            title="Refresh"
            className={$("btn i-ph:arrow-counter-clockwise-duotone", isFetching && "animate-spin i-ph:circle-dashed-duotone")}
            onClick={() => refetch()}
          />
        </div>

        <div className="flex gap-2 px-2 text-base font-bold">
          {SITES.map(s => (
            <button
              key={s.key}
              type="button"
              className={$(
                "px-4 py-1.5 rounded-full transition-all cursor-pointer",
                site === s.key
                  ? "bg-primary/25 color-primary-6 shadow shadow-primary/20"
                  : "bg-neutral-400/10 op-60 hover:bg-neutral-400/20",
              )}
              onClick={() => setSite(s.key)}
            >
              {s.label}
            </button>
          ))}
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

        {data?.capturedAt && (
          <div className="text-center text-xs op-50">
            {`更新于 ${new Date(data.capturedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}`}
          </div>
        )}

        {isError && <div className="text-center op-70 py-10">接口异常，稍后重试</div>}

        {data && !list.length && (
          <div className="text-center op-70 py-10">暂无数据：等待本机采集上传（每 24 小时更新）</div>
        )}

        <ol className="flex flex-col gap-3">
          {list.map((item, i) => (
            <li key={item.url} className="rounded-2xl p-3 bg-neutral-400/10 flex gap-3">
              <span className="min-w-8 text-center text-lg font-bold color-primary-6 self-center">{i + 1}</span>
              <img
                src={itemThumb(site, item.thumb)}
                loading="lazy"
                alt=""
                className="aspect-video w-32 rounded-lg object-cover bg-neutral-400/10 shrink-0"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden"
                }}
              />
              <div className="flex flex-col gap-2 min-w-0 w-full py-1">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={item.title}
                  className="text-base hover:underline line-clamp-2"
                >
                  {item.title}
                </a>
                <div className="flex flex-wrap gap-1 text-xs op-70">
                  {"hits" in item && (
                    <span className="px-1.5 py-0.5 rounded bg-neutral-400/10">{`命中 ${item.hits} 榜`}</span>
                  )}
                  {WINDOW_BADGES.map(b => item.ranks[b.key] !== undefined && (
                    <span key={b.key} className={`px-1.5 py-0.5 rounded ${b.className}`}>
                      {`${b.label}#${item.ranks[b.key]}`}
                    </span>
                  ))}
                  {item.duration && (
                    <span className="px-1.5 py-0.5 rounded bg-neutral-400/10">{item.duration}</span>
                  )}
                  {formatViews(item.views) && (
                    <span className="px-1.5 py-0.5 rounded bg-neutral-400/10">{formatViews(item.views)}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {tab !== "all" && (
          <a
            href={SOURCE_URLS[site][tab]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-sm op-60 hover:op-100 hover:underline pb-4"
          >
            在源站翻页查看更多 →
          </a>
        )}
      </div>
    </div>
  )
}
