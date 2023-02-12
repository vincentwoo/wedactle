const functions = require("firebase-functions");
const cheerio = require("cheerio");

exports.dailyRedactle = functions.https.onRequest(async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const resp = await fetch("https://redactle.com/ses.php");
  const json = await resp.json();
  res.send(atob(json.article));
});

exports.level4Articles = functions.https.onRequest(async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
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
  res.send(JSON.stringify(result));
});
