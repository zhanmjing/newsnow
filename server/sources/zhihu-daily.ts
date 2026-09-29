interface Res {
  stories: Array<{
    id: string | number
    title: string
    hint: string
    url: string
    type: number
  }>
}

export default defineSource(async () => {
  const res: Res = await myFetch("https://daily.zhihu.com/api/4/news/latest", {
    headers: {
      Referer: "https://daily.zhihu.com/api/4/news/latest",
    },
  })
  return res.stories
    .filter(story => story.type === 0)
    .map(story => ({
      id: story.id,
      title: story.title,
      url: story.url,
      extra: {
        info: story.hint,
      },
    }))
})
