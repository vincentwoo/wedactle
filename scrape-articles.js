const cheerio = require("cheerio");
const url = "https://en.wikipedia.org/wiki/Wikipedia:Vital_articles/Level/4/";
const categories = [
  "People",
  "History",
  "Geography",
  "Arts",
  "Philosophy and religion",
  "Everyday life",
  "Society and social sciences",
  "Biology and health sciences",
  "Physical sciences",
  "Technology",
  "Mathematics",
];

async function scrapeArticles() {
  const pages = await Promise.all(
    categories.map(async (category) => {
      const resp = await fetch(url + category);
      const $ = cheerio.load(await resp.text());
      const results = [];
      $("#bodyContent li a").each(function(idx, elem) {
        const href = $(this).attr("href");
        if (href && href.startsWith("/wiki/") && !href.includes(":"))
          results.push(href.split("/wiki/")[1]);
      });
      return [category, results];
    })
  );
  const result = {};
  for (const [category, articles] of pages) {
    result[category] = articles;
  }
  console.log(`window.articles = ${JSON.stringify(result)}`);
}

scrapeArticles();
