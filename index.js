// prettier-ignore
const commonWords = ["a","aboard","about","above","across","after","against","along","amid","among","an","and","around","as","at","because","before","behind","below","beneath","beside","between","beyond","but","by","concerning","considering","despite","down","during","except","following","for","from","if","in","inside","into","is","it","like","minus","near","next","of","off","on","onto","opposite","or","out","outside","over","past","per","plus","regarding","round","save","since","than","the","through","till","to","toward","under","underneath","unlike","until","up","upon","versus","via","was","with","within","without"];
const startTime = Date.now();
const db = firebase
  .initializeApp({
    apiKey: "AIzaSyCKuwvb-kN3FgzmGdp-n8KsDcfwsqXyEuM",
    databaseURL: "https://wedactle-default-rtdb.firebaseio.com",
  })
  .database();
// prettier-ignore
const colors = ["#ffadad","#ffd6a5","#caffbf","#9bf6ff","#bdb2ff","#fffffc","#a0c4ff","#ffc6ff","#fdffb6"];
const playerMappings = {};
const storageKey = "wedactleSave2";
let guessedWordsRef;
let articlesPromise;
let articles;

var wikiHolder = document.getElementById("wikiHolder");
var guessLogBody = document.getElementById("guessLogBody");
var baffled = {};
var guessedWords = [];
var ans = [];
var hidingZero = false;
var hidingLog = false;
var currentlyHighlighted;
var save = {};
var clickThruIndex = 0;
var myPlayerID;
var gameID = window.location.hash.slice(1).trim();
var pluralizing;

String.prototype.normalizeGuess = function() {
  return this.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

String.prototype.cyrb53 = function(seed = 0) {
  let h1 = 0xdeadbeef ^ seed,
    h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < this.length; i++) {
    ch = this.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

function uuidv4() {
  return ([1e7] + 1e3 + 4e3 + 8e3 + 1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

async function Initialize() {
  console.log(`${Date.now() - startTime}: Initialize`);
  if (localStorage.getItem(storageKey) === null) {
    localStorage.clear();
    myPlayerID = uuidv4().slice(0, 6);
    save = {
      prefs: { hidingZero, hidingLog, pluralizing },
      id: { myPlayerID },
    };
    localStorage.setItem(storageKey, JSON.stringify(save));
  } else {
    save = JSON.parse(localStorage.getItem(storageKey));
  }
  myPlayerID = save.id.myPlayerID;
  hidingZero = save.prefs.hidingZero;
  pluralizing = save.prefs.pluralizing;
  articlesPromise = fetch("https://wedactle.web.app/level4Articles").then(
    async (resp) => (articles = await resp.json())
  );

  console.log(`${Date.now() - startTime}: Get article`);
  let article;
  if (gameID == "") {
    gameID = uuidv4().slice(0, 6);
    window.location.hash = "#" + gameID;
  }

  db.ref(`/${gameID}/article`).on("value", (snap) => {
    if (!snap.val()) {
      $("#newGameModal").modal("show");
    } else {
      LoadGame(snap.val());
    }
  });
}

async function NewGame(article) {
  db.ref(gameID).set({
    article,
    guessedWords: null,
    timestamp: firebase.database.ServerValue.TIMESTAMP,
  });
}

async function LoadGame(article) {
  $("#newGameModal").modal("hide");
  $("#winText").css("display", "none");
  document.getElementById("userGuess").disabled = false;
  guessedWordsRef = db.ref(`/${gameID}/guessedWords`);
  guessedWordsRef.off();
  guessedWords = [];
  guessLogBody.replaceChildren();

  await renderArticle(article);

  guessedWordsRef.on("child_added", (snap) => handleGuess(snap.val()));
}

function getRandomArticle(categories) {
  const pages = categories.reduce(
    (result, category) => result.concat(articles[category]),
    []
  );
  return pages[Math.floor(Math.random() * pages.length)];
}

async function renderArticle(article) {
  return await fetch(
    `https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=text&formatversion=2&origin=*&page=${article}`
  )
    .then((resp) => {
      if (!resp.ok) {
        throw `Server error: [${resp.status}] [${resp.statusText}] [${
          resp.url
        }]`;
      }
      return resp.json();
    })
    .then((receivedJson) => {
      var cleanText = receivedJson.parse.text
        .replace(/<img[^>]*>/g, "")
        .replace(/<figure.*?<\/figure>/g, "")
        .replace(/\<\/?small\>/g, "")
        .replace(/–/g, "-")
        .replace(/<audio.*?<\/audio>/g, "")
        .replace(/<video.*?<\/video>/g, "")
        .replace(/<!--(?!>)[\S\s]*?-->/g, "")
        .replace(/(<style.*?<\/style>)/g, "");
      wikiHolder.style.display = "none";
      wikiHolder.innerHTML = cleanText;
      var redirecting = document.getElementsByClassName("redirectMsg");
      if (redirecting.length > 0) {
        var redirURL = $(
          ".redirectText"
        )[0].firstChild.firstChild.innerHTML.replace(/ /g, "_");
        return renderArticle(redirURL);
      }
      var e = document.getElementsByClassName("mw-parser-output");

      const alsoIndex = $("#See_also, #Notes, #References")
        .parent()
        .index();
      if (alsoIndex > 0) {
        $(e)
          .children()
          .slice(alsoIndex, $(e).children().length)
          .remove();
      }

      for (const elem of wikiHolder.querySelectorAll(
        "sup, excerpt, [rel='mw-deduplicated-inline-style'], [title='Name at birth'], [aria-labelledby='micro-periodic-table-title'], .barbox, .wikitable, .clade, .Expand_section, .nowrap, .IPA, .thumb, .mw-empty-elt, .mw-editsection, .nounderlines, .nomobile, .searchaux, #toc, .sidebar, .sistersitebox, .noexcerpt, #External_links, #Further_reading, .hatnote, .haudio, .portalbox, .mw-references-wrap, .infobox, .unsolved, .navbox, .metadata, .refbegin, .reflist, .mw-stack, #Notes, #References, .reference, .quotebox, .collapsible, .uncollapsed, .mw-collapsible, .mw-made-collapsible, .mbox-small, .mbox, #coordinates, .succession-box, .noprint, .mwe-math-element, .cs1-ws-icon"
      )) {
        elem.remove();
      }

      $(wikiHolder)
        .find("a, b")
        .each(function() {
          const elem = this;
          const parent = elem.parentNode;
          while (elem.firstChild) {
            parent.insertBefore(elem.firstChild, elem);
          }
          parent.removeChild(elem);
        });

      var bq = document.getElementsByTagName("blockquote");
      for (var i = 0; i < bq.length; i++) {
        bq[i].innerHTML = bq[i].innerHTML.replace(/<[^>]*>?/gm, "");
      }

      $(e[0])
        .find("[title]")
        .each(function() {
          this.removeAttribute("title");
        });
      $(e[0])
        .find(".mw-headline")
        .contents()
        .unwrap();
      var titleHolder = document.createElement("h1");
      var titleTxt = receivedJson.parse.title.replace(/_/g, " ");
      titleHolder.innerHTML = titleTxt;
      e[0].prepend(titleHolder);
      ans = titleTxt
        .replace(/ *\([^)]*\) */g, "")
        .normalizeGuess()
        .match(/\b(\w+)\b/g)
        .filter(function(el) {
          return commonWords.indexOf(el) < 0;
        });
      e[0].innerHTML = e[0].innerHTML
        .replace(/\(; /g, "(")
        .replace(/\(, /g, "(")
        .replace(/\(, /g, "(")
        .replace(/: ​;/g, ";")
        .replace(/ \(\) /g, " ")
        .replace(/<\/?span[^>]*>/g, "");
      $(e[0])
        .find("*")
        .removeAttr("class")
        .removeAttr("style");

      $(e[0])
        .find("p, blockquote, h1, h2, table, li, i, cite, span")
        .contents()
        .filter(function(i, el) {
          return el.nodeType === 3;
        })
        .each(function(i, el) {
          var $el = $(el);
          var replaced = $el
            .text()
            .replace(
              /([\.,:()\[\]?!;`\~\-\u2013\—&*"])/g,
              '<span class="punctuation">$1</span>'
            );
          el.replaceWith(replaced);
        });

      e[0].innerHTML = e[0].innerHTML
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(
          /(<span class="punctuation">.<\/span>)|(^|<\/?[^>]+>|\s+)|([^\s<]+)/g,
          '$1$2<span class="baffled">$3</span>'
        )
        .replace('<<span class="baffled">h1>', '<h1><span class="baffled">');
      $(e[0])
        .find("*:empty")
        .remove();

      baffled = {};
      $(".mw-parser-output span.baffled").each(function() {
        const original = this.innerText;
        const normText = original.normalizeGuess();
        if (commonWords.includes(normText)) {
          this.classList.remove("baffled");
        } else {
          this.innerText = "\u00A0".repeat(normText.length);
          baffled[normText] = baffled[normText] || [];
          baffled[normText].push([this, original]);
        }
      });

      document.getElementById("autoPlural").checked = pluralizing;

      if (hidingZero) {
        document.getElementById("hideZero").checked = true;
        HideZero();
      } else {
        document.getElementById("hideZero").checked = false;
        ShowZero();
      }

      wikiHolder.style.display = "flex";
    })
    .catch((err) => {
      console.error("Error in fetch", err);
      alert("Something went wrong while loading the page. Try refreshing.");
    });
}
Initialize();

function PerformGuess(guess) {
  clickThruIndex = 0;
  RemoveHighlights(false);
  guess = guess.normalizeGuess();
  if (commonWords.includes(guess)) return;
  if (!guessedWords.find(({ word }) => word == guess)) {
    guessedWordsRef.push({
      playerID: myPlayerID,
      word: guess,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    });
    $("#tableNav").scrollTop(0);
  } else {
    $(`tr[data-word='${guess}']`).addClass("row-highlight");
    $("#tableNav").scrollTop($(`tr[data-word='${guess}']`).position().top);
    currentlyHighlighted = guess;
    for (const [elem, original] of baffled[guess] || []) {
      elem.classList.add("highlighted");
    }
  }
}

function handleGuess({ word, playerID, timestamp }) {
  if (!playerMappings[playerID]) {
    playerMappings[playerID] =
      colors[Object.keys(playerMappings).length % colors.length];
  }
  let numHits = 0;
  if (baffled[word]) {
    RemoveHighlights(false);
    for (const [elem, original] of baffled[word]) {
      elem.classList.remove("baffled");
      elem.innerText = original;
      elem.style.color = playerMappings[playerID];
      numHits += 1;
      if (playerID == myPlayerID) {
        elem.classList.add("highlighted");
        currentlyHighlighted = word;
      }
    }
  }
  guessedWords.push({ word, playerID, timestamp, numHits });
  LogGuess(word, numHits, playerID);
  ans = ans.filter((_word) => _word != word);
  if (ans.length == 0) WinRound();
}

function LogGuess(guess, numHits, playerID) {
  if (hidingZero) {
    HideZero();
  }
  var newRow = guessLogBody.insertRow(0);
  newRow.class = "curGuess";
  newRow.setAttribute("data-word", guess);
  newRow.setAttribute("data-hits", numHits);

  if (playerID == myPlayerID) {
    newRow.classList.add("row-highlight");
  }

  newRow.innerHTML = `<td>${
    guessedWords.length
  }</td><td>${guess}</td><td class="tableHits">${numHits}</td>`;

  newRow.children[1].style.color = playerMappings[playerID];
}

function timeToString(time) {
  const seconds = Math.floor(time / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0)
    return `${hours} ${pluralize("hour", hours)} and ${minutes %
      60} ${pluralize("minute", minutes % 60)}`;
  else
    return `${minutes} ${pluralize("minute", minutes)} and ${seconds %
      60} ${pluralize("second", seconds % 60)}`;
}

function WinRound() {
  document.getElementById("userGuess").disabled = true;
  RemoveHighlights(false);
  for (const [elem, original] of Object.values(baffled).flat()) {
    elem.classList.remove("baffled");
    elem.innerText = original;
  }
  baffled = {};
  setTimeout(function() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  }, 10);

  const stats = {};
  for (const { word, playerID, numHits } of guessedWords) {
    stats[playerID] = stats[playerID] || { total: 0, words: 0, numHits: 0 };
    stats[playerID].total++;
    stats[playerID].words += numHits > 0 ? 1 : 0;
    stats[playerID].numHits += numHits;
  }
  const statsHTML = Object.entries(stats)
    .map(
      ([playerID, stat], index) =>
        // prettier-ignore
        `<span style="color: ${playerMappings[playerID]}">
          Player ${index + 1} guessed ${stat.words}/${stat.total}
          (${Math.round((stat.words / stat.total * 100))}%) correctly,
          revealing ${stat.numHits} words.
        </span>`
    )
    .join("<br />");
  console.log(stats, statsHTML);
  // prettier-ignore
  $("#winText").html(`
    <div>
    <p>
      Congratulations! You solved this article with
      ${guessedWords.length} ${pluralize("guess", guessedWords.length)} in
      ${timeToString(guessedWords[guessedWords.length - 1].timestamp - guessedWords[0].timestamp)}!
    </p>
    <p>
      ${statsHTML}
    </p>
    </div>
  `);

  $("#winText").css("display", "flex");

  SaveProgress();
}

function HideZero() {
  hidingZero = true;
  SaveProgress();
  $(".tableHits").each(function() {
    if (this.innerHTML == "0") {
      $(this)
        .parent()
        .addClass("hiddenRow");
    }
  });
}

function ShowZero() {
  hidingZero = false;
  SaveProgress();
  $(".hiddenRow").removeClass("hiddenRow");
}

function RemoveHighlights(clearCur) {
  if (clearCur) {
    currentlyHighlighted = null;
  }
  $(".highlighted").removeClass("highlighted");
  $(".superHighlighted").removeClass("superHighlighted");
  $(".row-highlight").removeClass("row-highlight");
}

function SaveProgress() {
  pluralizing = $("#autoPlural").is(":checked");
  save.prefs.hidingZero = hidingZero;
  save.prefs.hidingLog = hidingLog;
  save.prefs.pluralizing = pluralizing;
  localStorage.setItem(storageKey, JSON.stringify(save));
}

function eachPair(arr) {
  let result = [];
  for (let i = 0; i < arr.length - 1; i += 2) {
    result.push([arr[i], arr[i + 1]]);
  }
  if (arr.length % 2 !== 0) {
    result.push([arr[arr.length - 1]]);
  }
  return result;
}

function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, timeout);
  };
}

window.onload = function() {
  let currentArticleNum;
  let currentArticle;
  articlesPromise.then(() => {
    function categoryHTML([category, pages]) {
      return `<div class="col">
      <div class="form-check">
        <input class="form-check-input" type="checkbox" checked id="${category}" name="${category}">
        <label class="form-check-label" for="${category}">
          ${category} (${pages.length})
        </label>
      </div>
    </div>`;
    }
    $("#categories").empty();
    for (const pair of eachPair(Object.entries(articles))) {
      const row = `<div class="row">
      ${categoryHTML(pair[0])}
      ${pair[1] ? categoryHTML(pair[1]) : ""}
     </div>`;
      $("#categories").append(row);
    }
    $("#startGame button").prop("disabled", false);

    const hashed = Object.values(articles)
      .flat()
      .map((str) => [str.cyrb53(), str])
      .sort(([a, _], [b, __]) => a - b);
    const Mar_23_5am = 1679562000000;
    currentArticleNum = Math.floor((Date.now() - Mar_23_5am) / 86400000);
    currentArticle = hashed[currentArticleNum][1];
    const yesterdayArticle =
      currentArticleNum > 0 ? hashed[currentArticleNum - 1][1] : "";
    $("#dailyInfo").html(
      `(Daily Article #${currentArticleNum +
        1}, yesterday's article was <i>${yesterdayArticle.replaceAll(
        "_",
        " "
      )}</i>)`
    );
    $("#startDailyGame").prop("disabled", false);
  });

  $("#startGame").submit(function() {
    $("#newGameModal").modal("hide");
    const article = getRandomArticle(
      $(this)
        .serializeArray()
        .map(({ name, value }) => name)
    );
    NewGame(article);
    return false;
  });

  $("#startDailyGame").click(async function() {
    $("#newGameModal").modal("hide");
    NewGame(currentArticle);
    return false;
  });

  let lastVerifiedArticle;
  $("#customGame").on(
    "keyup keypress blur change",
    debounce(async function() {
      let article = $("#customGame").val();
      if (article.startsWith("https://en.wikipedia.org/wiki/")) {
        article = article.split("https://en.wikipedia.org/wiki/")[1];
      }
      const resp = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&titles=${article}`
      );
      const json = await resp.json();
      const valid = json.query && Object.keys(json.query.pages)[0] > 0;
      $("#startCustomGame button").prop("disabled", !valid);
      $("#preview")
        .attr("href", `https://en.wikipedia.org/wiki/${article}`)
        .toggle(valid);
      if (valid) lastVerifiedArticle = article;
      return false;
    })
  );

  $("#startCustomGame").submit(function() {
    $("#newGameModal").modal("hide");
    $("#customGame").val("");
    NewGame(lastVerifiedArticle);
    return false;
  });

  var input = document.getElementById("userGuess");

  input.addEventListener("keyup", function(event) {
    if (event.keyCode === 13 && event.shiftKey) {
      event.preventDefault();
      pluralizing = !$("#autoPlural").is(":checked");
      document.getElementById("submitGuess").click();
    } else if (event.keyCode === 13) {
      pluralizing = $("#autoPlural").is(":checked");
      document.getElementById("submitGuess").click();
    }
  });

  $("#submitGuess").click(function() {
    if (document.getElementById("userGuess").value != "") {
      var allGuesses = [
        document.getElementById("userGuess").value.replace(/\s/g, ""),
      ];

      if (pluralizing) {
        var pluralGuess = pluralize(allGuesses[0]);
        var singularGuess = pluralize.singular(allGuesses[0]);
        if (pluralGuess != allGuesses[0]) {
          allGuesses.push(pluralGuess);
        }
        if (singularGuess != allGuesses[0]) {
          allGuesses.push(singularGuess);
        }
      }
      allGuesses.forEach((word) => PerformGuess(word));

      pluralizing = false;
      document.getElementById("userGuess").value = "";
    }
  });

  $(function() {
    $("#hideZero").click(function() {
      if ($("#hideZero").is(":checked")) {
        HideZero();
      } else {
        ShowZero();
      }
    });
  });

  $(function() {
    $("#autoPlural").click(function() {
      pluralizing = $("#autoPlural").is(":checked");
    });
  });

  $("#backToTop").click(function() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  });

  $("#tableHolder").on("click", "tr", function(e) {
    e.preventDefault();
    const word = $(this).data("word");
    const hits = $(this).data("hits");

    if (hits > 0) {
      const allInstances = baffled[word].map(([elem, original]) => elem);
      if (currentlyHighlighted == null || currentlyHighlighted != word) {
        clickThruIndex = 0;
        RemoveHighlights(false);
        currentlyHighlighted = word;
        this.classList.add("row-highlight");
        for (const elem of allInstances) {
          elem.classList.add("highlighted");
        }
      }
      $(".superHighlighted").each(function() {
        this.classList.remove("superHighlighted");
      });
      allInstances[clickThruIndex % allInstances.length].classList.add(
        "superHighlighted"
      );
      allInstances[clickThruIndex % allInstances.length].scrollIntoView({
        behavior: "auto",
        block: "center",
        inline: "end",
      });
      clickThruIndex += 1;
    } else {
      RemoveHighlights(true);
    }
  });
};
