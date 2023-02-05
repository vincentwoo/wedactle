// prettier-ignore
const commonWords = ["a","aboard","about","above","across","after","against","along","amid","among","an","and","around","as","at","because","before","behind","below","beneath","beside","between","beyond","but","by","concerning","considering","despite","down","during","except","following","for","from","if","in","inside","into","is","it","like","minus","near","next","of","off","on","onto","opposite","or","out","outside","over","past","per","plus","regarding","round","save","since","than","the","through","till","to","toward","under","underneath","unlike","until","up","upon","versus","via","was","with","within","without"];

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import {
  getDatabase,
  get,
  set,
  ref,
  push,
  onChildAdded,
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

const db = getDatabase(
  initializeApp({
    apiKey: "AIzaSyCKuwvb-kN3FgzmGdp-n8KsDcfwsqXyEuM",
    databaseURL: "https://wedactle-default-rtdb.firebaseio.com",
  })
);

var wikiHolder = document.getElementById("wikiHolder");
var guessLogBody = document.getElementById("guessLogBody");
var baffled = [];
var guessedWords = [];
var ans = [];
var ansStr;
var guessCounter = 0;
var hidingZero = false;
var hidingLog = false;
var currentlyHighlighted;
var hitCounter = 0;
var currentAccuracy = -1;
var save = {};
var pageRevealed = false;
var clickThruIndex = 0;
var clickThruNodes = [];
var playerID;
var gameID = window.location.hash.slice(1).trim();
var pluralizing;
var infoModal = new bootstrap.Modal(document.getElementById("infoModal"));
var settingsModal = new bootstrap.Modal(
  document.getElementById("settingsModal")
);

function uuidv4() {
  return ([1e7] + 1e3 + 4e3 + 8e3 + 1e11).replace(/[018]/g, (c) =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

async function LoadSave() {
  if (localStorage.getItem("redactleSavet") === null) {
    localStorage.clear();
    playerID = uuidv4();
    save = JSON.parse(
      JSON.stringify({
        prefs: { hidingZero, hidingLog, pluralizing },
        id: { playerID },
      })
    );
  } else {
    save = JSON.parse(localStorage.getItem("redactleSavet"));
  }
  localStorage.setItem("redactleSavet", JSON.stringify(save));
  playerID = save.id.playerID;

  let article;
  if (gameID == "") {
    gameID = uuidv4();
    window.location.hash = "#" + gameID;
    article = await getRandomArticle();
    set(ref(db, `/${gameID}/article`), article);
  } else {
    article = (await get(ref(db, `/${gameID}/article`))).val();
  }

  await fetchData(article);

  onChildAdded(ref(db, `/${gameID}/guessedWords`), (data) => {
    const word = data.val();
    guessedWords.push(word);
    PerformGuess(word, true);
  });
}

async function getRandomArticle() {
  const randomURL =
    "https://randomincategory.toolforge.org/?category=All%20Wikipedia%20level-4%20vital%20articles&server=en.wikipedia.org&returntype=subject&debug=true";
  const resp = await fetch(randomURL);
  const text = await resp.text();
  return text
    .split("<br>")
    .at(-2)
    .split("Location: https://en.wikipedia.org/wiki/")[1];
}

async function fetchData(article) {
  return await fetch(
    "https://en.wikipedia.org/w/api.php?action=parse&format=json&page=" +
      article +
      "&prop=text&formatversion=2&origin=*"
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
        .replace(/\<small\>/g, "")
        .replace(/\<\/small\>/g, "")
        .replace(/–/g, "-")
        .replace(/<audio.*<\/audio>/g, "");
      wikiHolder.style.display = "none";
      wikiHolder.innerHTML = cleanText;
      var redirecting = document.getElementsByClassName("redirectMsg");
      if (redirecting.length > 0) {
        var redirURL = $(
          ".redirectText"
        )[0].firstChild.firstChild.innerHTML.replace(/ /g, "_");
        return fetchData(redirURL);
      }
      if (document.getElementById("See_also") != null) {
        var seeAlso = document.getElementById("See_also").parentNode;
      } else if (document.getElementById("Notes") != null) {
        var seeAlso = document.getElementById("Notes").parentNode;
      } else {
        var seeAlso = document.getElementById("References").parentNode;
      }
      var e = document.getElementsByClassName("mw-parser-output");
      const alsoIndex = Array.prototype.indexOf.call(
        seeAlso.parentNode.children,
        seeAlso
      );
      for (var i = alsoIndex; i < e[0].children.length; i++) {
        e[0].removeChild(e[0].children[i]);
      }
      var all_bad_elements = wikiHolder.querySelectorAll(
        "[rel='mw-deduplicated-inline-style'], [title='Name at birth'], [aria-labelledby='micro-periodic-table-title'], .barbox, .wikitable, .clade, .Expand_section, .nowrap, .IPA, .thumb, .mw-empty-elt, .mw-editsection, .nounderlines, .nomobile, .searchaux, #toc, .sidebar, .sistersitebox, .noexcerpt, #External_links, #Further_reading, .hatnote, .haudio, .portalbox, .mw-references-wrap, .infobox, .unsolved, .navbox, .metadata, .refbegin, .reflist, .mw-stack, #Notes, #References, .reference, .quotebox, .collapsible, .uncollapsed, .mw-collapsible, .mw-made-collapsible, .mbox-small, .mbox, #coordinates, .succession-box, .noprint, .mwe-math-element, .cs1-ws-icon"
      );

      for (var i = 0; i < all_bad_elements.length; i++) {
        all_bad_elements[i].remove();
      }

      var b = document.getElementsByTagName("b");
      while (b.length) {
        var parent = b[0].parentNode;
        while (b[0].firstChild) {
          parent.insertBefore(b[0].firstChild, b[0]);
        }
        parent.removeChild(b[0]);
      }
      var a = wikiHolder.getElementsByTagName("a");
      while (a.length) {
        var parent = a[0].parentNode;
        while (a[0].firstChild) {
          parent.insertBefore(a[0].firstChild, a[0]);
        }
        parent.removeChild(a[0]);
      }
      var bq = document.getElementsByTagName("blockquote");
      for (var i = 0; i < bq.length; i++) {
        bq[i].innerHTML = bq[i].innerHTML.replace(/<[^>]*>?/gm, "");
      }
      var s = document.getElementsByTagName("sup");
      while (s.length) {
        s[0].remove();
      }
      var ex = document.getElementsByClassName("excerpt");
      while (ex.length) {
        ex[0].remove();
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
      var titleTxt = article.replace(/_/g, " ");
      titleHolder.innerHTML = titleTxt;
      e[0].prepend(titleHolder);
      ansStr = titleTxt
        .replace(/ *\([^)]*\) */g, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      ans = ansStr.match(/\b(\w+)\b/g);
      ans = ans.filter(function(el) {
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
        .replace(/(<style.*<\/style>)/g, "")
        .replace(
          /(<span class="punctuation">.<\/span>)|(^|<\/?[^>]+>|\s+)|([^\s<]+)/g,
          '$1$2<span class="innerTxt">$3</span>'
        )
        .replace('<<span class="innerTxt">h1>', '<h1><span class="innerTxt">');
      $(e[0])
        .find("*:empty")
        .remove();
      wikiHolder.innerHTML = wikiHolder.innerHTML.replace(
        /<!--(?!>)[\S\s]*?-->/g,
        ""
      );
      $(".mw-parser-output span")
        .not(".punctuation")
        .each(function() {
          var txt = this.innerHTML
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
          if (!commonWords.includes(txt)) {
            this.classList.toggle("baffled");
            let b = baffle(this)
              .once()
              .set({
                characters: "abcd",
              });
            baffled.push([txt, b]);
          }
        });

      if (pluralizing) {
        document.getElementById("autoPlural").checked = true;
      } else {
        document.getElementById("autoPlural").checked = false;
      }

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
LoadSave();

function PerformGuess(guessedWord, populate) {
  if (!populate) {
    set(push(ref(db, `/${gameID}/guessedWords`)), guessedWord);
    return;
  }
  clickThruIndex = 0;
  RemoveHighlights(false);
  var normGuess = guessedWord
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!commonWords.includes(normGuess)) {
    if (!guessedWords.includes(guessedWord) || populate) {
      var numHits = 0;
      for (var i = 0; i < baffled.length; i++) {
        if (baffled[i][0] == normGuess) {
          baffled[i][1].reveal();
          baffled[i][1].elements[0].element.classList.remove("baffled");
          baffled[i][1].elements[0].element.setAttribute(
            "data-word",
            normGuess
          );
          numHits += 1;
          if (!populate) {
            baffled[i][1].elements[0].element.classList.add("highlighted");
            currentlyHighlighted = normGuess;
          }
        }
      }
      if (!populate) {
        guessCounter += 1;
        guessedWords.push([normGuess, numHits, guessCounter]);
        SaveProgress();
      }
      LogGuess([normGuess, numHits, guessCounter], populate);
    } else {
      $("tr[data-guess='" + normGuess + "']").addClass("table-secondary");
      $("tr[data-guess='" + normGuess + "']")[0].scrollIntoView();
      currentlyHighlighted = normGuess;
      $(".innerTxt").each(function() {
        if (
          this.innerHTML
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase() == normGuess
        ) {
          this.classList.add("highlighted");
        }
      });
    }
    if (ans.includes(normGuess)) {
      ans = ans.filter(function(e) {
        return e !== normGuess;
      });
    }
    if (ans.length == 0) {
      WinRound(populate);
    }
  }
}

function LogGuess(guess, populate) {
  if (hidingZero) {
    HideZero();
  }
  var newRow = guessLogBody.insertRow(0);
  newRow.class = "curGuess";
  newRow.setAttribute("data-guess", guess[0]);
  if (!populate) {
    newRow.classList.add("table-secondary");
  }
  if (guess[1] > 0) {
    hitCounter += 1;
  }
  if (!pageRevealed) {
    currentAccuracy = ((hitCounter / guessedWords.length) * 100).toFixed(2);
  }
  if (guess[1] > 0) {
    $(newRow).on("click", function(e) {
      e.preventDefault();
      var inTxt = this.getElementsByTagName("td")[1]
        .innerHTML.normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const allInstances = wikiHolder.querySelectorAll(
        '[data-word="' + inTxt + '"]'
      );
      if (currentlyHighlighted == null) {
        clickThruIndex = 0;
        currentlyHighlighted = inTxt;
        this.classList.add("table-secondary");
        $(".innerTxt").each(function() {
          if (
            this.innerHTML
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase() == currentlyHighlighted
          ) {
            $(this).addClass("highlighted");
          }
        });
      } else {
        if (inTxt == currentlyHighlighted) {
        } else {
          clickThruIndex = 0;
          RemoveHighlights(false);
          this.classList.add("table-secondary");
          $(".innerTxt").each(function() {
            if (
              this.innerHTML
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase() == inTxt
            ) {
              this.classList.add("highlighted");
            }
          });
          currentlyHighlighted = inTxt;
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
    });
  } else {
    $(newRow).on("click", function(e) {
      RemoveHighlights(true);
    });
  }
  newRow.innerHTML =
    "<td>" +
    guess[2] +
    "</td><td>" +
    guess[0] +
    '</td><td class="tableHits">' +
    guess[1] +
    "</td>";
  if (!populate) {
    newRow.scrollIntoView({
      behavior: "auto",
      block: "center",
      inline: "end",
    });
  }
}

function WinRound(populate) {
  document.getElementById("userGuess").disabled = true;
  if (!pageRevealed) {
    RevealPage();
  }
  var vicData;
  // $.ajax({
  //     type: "POST",
  //     url: "/vic.php",
  //     dataType: "text",
  //     data: {
  //         playerID: String(playerID),
  //         currentRedactle: redactleIndex,
  //         score: guessedWords.length,
  //         accuracy: parseInt(currentAccuracy * 100),
  //         token: token,
  //     },
  //     success: function(data) {
  //         vicData = JSON.parse(data);
  //     },
  //     error: function() {
  //         document.getElementById(
  //             "winText"
  //         ).innerHTML = `<h3>Congratulations, you solved Redactle #${redactleIndex +
  //             1}!</h3><ul><li>The answer was: ${ansStr}</li><li>You solved it in ${
  //             gameScores[redactleIndex]
  //         } guesses</li><li>Your accuracy was ${currentAccuracy}%</li><li>You have solved ${streakCount} consecutive Redactles</li></ul><p><a href="javascript:ShareResults();">Share your results</a></p>`;
  //         document.getElementById("winText").style.display = "block";
  //     },
  // }).then(function() {
  //     var globalStr;
  //     switch (vicData.length) {
  //         case 1:
  //             globalStr = "You are the only player to solve today's Redactle";
  //         default:
  //             globalStr = `Globally, ${
  //                 vicData.length
  //             } players have solved today's Redactle`;
  //     }
  //     var scores = [];
  //     var accs = [];
  //     for (var sc in vicData) {
  //         scores.push(vicData[sc].score);
  //         accs.push(vicData[sc].accuracy);
  //     }

  //     document.getElementById(
  //         "winText"
  //     ).innerHTML = `<h3>Congratulations, you solved Redactle #${redactleIndex +
  //         1}!</h3><ul><li>The answer was: ${ansStr}</li><li>You solved it in ${
  //         gameScores[redactleIndex]
  //     } guesses</li><li>Your accuracy was ${currentAccuracy}%</li><li>You have solved ${streakCount} consecutive Redactles</li></ul><h3>Global Stats</h3><ul><li>${globalStr} so far</li><li>Global Median: ${median(
  //         scores
  //     ).toFixed(2)} Guesses; ${(median(accs) / 100).toFixed(
  //         2
  //     )}% Accuracy</li><li>Global Average: ${average(scores).toFixed(
  //         2
  //     )} Guesses; ${(average(accs) / 100).toFixed(
  //         2
  //     )}% Accuracy</li></ul><p><a href="javascript:ShareResults();">Share your results</a></p>`;
  //     document.getElementById("winText").style.display = "block";
  // });

  SaveProgress();
}

function RevealPage() {
  RemoveHighlights(false);
  for (var i = 0; i < baffled.length; i++) {
    baffled[i][1].reveal();
    baffled[i][1].elements[0].element.classList.remove("baffled");
  }
  pageRevealed = true;
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
  $(".hiddenRow").each(function() {
    $(this).removeClass("hiddenRow");
  });
}

function RemoveHighlights(clearCur) {
  if (clearCur) {
    currentlyHighlighted = null;
  }
  $(".highlighted").each(function() {
    $(this).removeClass("highlighted");
  });
  $(".superHighlighted").each(function() {
    this.classList.remove("superHighlighted");
  });
  $("#guessLogBody")
    .find(".table-secondary")
    .each(function() {
      this.classList.remove("table-secondary");
    });
}

function SaveProgress() {
  if ($("#autoPlural").is(":checked")) {
    pluralizing = true;
  } else {
    pluralizing = false;
  }
  save.prefs.hidingZero = hidingZero;
  save.prefs.hidingLog = hidingLog;
  save.prefs.pluralizing = pluralizing;
  localStorage.setItem("redactleSavet", JSON.stringify(save));
}

window.onload = function() {
  var input = document.getElementById("userGuess");

  input.addEventListener("keyup", function(event) {
    if (event.keyCode === 13 && event.shiftKey) {
      event.preventDefault();
      if ($("#autoPlural").is(":checked")) {
        pluralizing = false;
      } else {
        pluralizing = true;
      }
      document.getElementById("submitGuess").click();
    } else {
      if (event.keyCode === 13) {
        if ($("#autoPlural").is(":checked")) {
          pluralizing = true;
        } else {
          pluralizing = false;
        }
        document.getElementById("submitGuess").click();
      }
    }
  });

  $("#submitGuess").click(function() {
    if (
      !document.getElementById("userGuess").value == "" ||
      !document.getElementById("userGuess").value ==
        document.getElementById("userGuess").defaultValue
    ) {
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
      for (var i = allGuesses.length - 1; i > -1; i--) {
        PerformGuess(allGuesses[i], false);
      }
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
      if ($("#autoPlural").is(":checked")) {
        pluralizing = true;
        SaveProgress();
      } else {
        pluralizing = false;
        SaveProgress();
      }
    });
  });

  $("#settingsBtn").click(function() {
    settingsModal.show();
    document.querySelector("body").style.overflow = "hidden";
    return false;
  });

  $("#infoBtn").click(function() {
    infoModal.show();
    document.querySelector("body").style.overflow = "hidden";
    return false;
  });

  $(".closeInfo").each(function() {
    $(this).click(function() {
      infoModal.hide();
      document.querySelector("body").style.overflow = "auto";
    });
  });

  $(".closeSettings").each(function() {
    $(this).click(function() {
      settingsModal.hide();
      document.querySelector("body").style.overflow = "auto";
    });
  });

  $("#backToTop").click(function() {
    document.body.scrollTop = 0;
    document.documentElement.scrollTop = 0;
  });

  window.onclick = function(event) {
    if (event.target == document.getElementById("infoModal")) {
      infoModal.hide();
      document.querySelector("body").style.overflow = "auto";
    }
    if (event.target == document.getElementById("settingsModal")) {
      settingsModal.hide();
      document.querySelector("body").style.overflow = "auto";
    }
  };
};
