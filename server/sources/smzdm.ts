interface Res {
  data: Array<{
    article_id: string
    title: string
    content: string
    collection_count: string
    jump_link: string
  }>
}

export default defineSource(async () => {
  const res: Res = await myFetch("https://post.smzdm.com/rank/json_more/?unit=1", {
    headers: {
      Referer: "https://post.smzdm.com/",
    },
  })
  return (res.data ?? []).map(item => ({
    id: item.article_id,
    title: item.title,
    url: item.jump_link,
    extra: {
      info: `${item.collection_count} 收藏`,
      hover: item.content,
    },
  }))
})
