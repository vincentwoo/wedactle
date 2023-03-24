const admin = require("firebase-admin");
const functions = require("firebase-functions");
const cheerio = require("cheerio");
admin.initializeApp(functions.config().firebase);

exports.level4Articles = functions.https.onRequest(async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.set("Cache-Control", "public, max-age=86400");
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

exports.cleanupGames = functions.pubsub.schedule("every 12 hours").onRun(() => {
  const cutoffTime = Date.now() - 3 * 86400 * 1000;
  return admin
    .database()
    .ref()
    .get()
    .then((snap) => {
      const deletes = [];
      for (const [key, child] of Object.entries(snap.val() || {})) {
        if (child.timestamp && child.timestamp < cutoffTime) {
          deletes.push(
            admin
              .database()
              .ref(key)
              .set(null)
          );
        }
      }
      return Promise.all(deletes);
    });
});
