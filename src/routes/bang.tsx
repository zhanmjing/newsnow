import type { BangResponse } from "@shared/cluster"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useTitle } from "react-use"
import { NavBar } from "~/components/navbar"

export const Route = createFileRoute("/bang")({
  component: BangComponent,
})

function BangComponent() {
  useTitle("NewsNow | 榜中榜")
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["bang"],
    queryFn: async () => await myFetch<BangResponse>("/bang"),
    staleTime: 1000 * 60 * 5,
    retry: false,
  })

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
        {isError && (
          <div className="text-center op-70 py-10">接口异常，稍后重试</div>
        )}
        {data && !data.clusters.length && (
          <div className="text-center op-70 py-10">暂无数据，先去首页逛逛以填充缓存</div>
        )}
        <ol className="flex flex-col gap-3">
          {data?.clusters.map((c, i) => (
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
      </div>
    </div>
  )
}
