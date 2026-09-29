import { load } from "cheerio"

export default defineSource(async () => {
  const html = await myFetch("https://www.douban.com/group/explore", {
    responseType: "text",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    },
  })
  const $ = load(html as string)
  return $(".article .channel-item")
    .toArray()
    .map((el) => {
      const $el = $(el)
      const url = $el.find("h3 a").attr("href") ?? ""
      const id = url.match(/(\d+)/)?.[1] ?? url
      return {
        id,
        title: $el.find("h3 a").text().trim(),
        url,
        extra: {
          hover: $el.find(".block p").text().trim(),
        },
      }
    })
    .filter(item => item.title && item.url)
})
