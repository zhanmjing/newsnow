interface Res {
  data?: {
    topics: Array<{
      firstArticleId: string
      article: {
        topicId: string
        subject: string
        body: string
        account?: { name: string }
      }
      board?: { title: string }
    }>
  }
}

export default defineSource(async () => {
  const res: Res = await myFetch("https://wap.newsmth.net/wap/api/hot/global")
  return (res.data?.topics ?? []).map(topic => ({
    id: topic.firstArticleId,
    title: topic.article.subject,
    url: `https://wap.newsmth.net/article/${topic.article.topicId}?title=${topic.board?.title}&from=home`,
    extra: {
      info: topic.article.account?.name,
      hover: topic.article.body,
    },
  }))
})
