const functions = require("firebase-functions");

exports.dailyRedactle = functions.https.onRequest(async (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  const resp = await fetch("https://redactle.com/ses.php");
  const json = await resp.json();
  res.send(atob(json.article));
});
