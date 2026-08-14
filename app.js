// =====================================================
// PINGSCORE v13
// =====================================================

// AKTIV SCORE
let score1 = 0;
let score2 = 0;

// SETT I AKTIV KAMP
let sets1 = 0;
let sets2 = 0;

// NAVN
let player1Name = "Marius";
let player2Name = "Petter";

// FØRST TIL X SETT
let setsToWin = 5;

// SETT I AKTIV KAMP
let setHistory = [];

// ANGRE-HISTORIKK
let history = [];

// ALLE FERDIGE KAMPER
let matchHistory = [];

// Hvis en ferdig kamp blir angret,
// vet vi hvilken historikkpost som må fjernes.
let currentMatchHistoryId = null;


// TALE
let listening = false;
let recognitionRunning = false;
let speakingScore = false;
let ignoreSpeechUntil = 0;
let matchFinished = false;

let recognition = null;
let restartTimer = null;

let wakeLock = null;
let audioContext = null;


// =====================================================
// HTML
// =====================================================

const listenButton =
  document.getElementById("listenButton");

const status =
  document.getElementById("status");

const player1NameInput =
  document.getElementById("player1NameInput");

const player2NameInput =
  document.getElementById("player2NameInput");

const setsToWinSelect =
  document.getElementById("setsToWin");


// =====================================================
// SMÅ HJELPEFUNKSJONER
// =====================================================

function setStatus(text) {

  if (status) {
    status.textContent = text;
  }
}


function setListenButton(text) {

  if (listenButton) {
    listenButton.textContent = text;
  }
}


// =====================================================
// NAVN
// =====================================================

function updateNames() {

  player1Name =
    player1NameInput?.value.trim()
    || "Marius";

  player2Name =
    player2NameInput?.value.trim()
    || "Petter";


  document.getElementById(
    "player1Label"
  ).textContent =
    player1Name;


  document.getElementById(
    "player2Label"
  ).textContent =
    player2Name;


  document.getElementById(
    "scorePlayer1Name"
  ).textContent =
    player1Name;


  document.getElementById(
    "scorePlayer2Name"
  ).textContent =
    player2Name;


  localStorage.setItem(
    "pingscore-player1",
    player1Name
  );


  localStorage.setItem(
    "pingscore-player2",
    player2Name
  );


  saveCurrentGame();
}


player1NameInput?.addEventListener(
  "input",
  updateNames
);


player2NameInput?.addEventListener(
  "input",
  updateNames
);


// =====================================================
// ANTALL SETT
// =====================================================

setsToWinSelect?.addEventListener(
  "change",
  () => {

    setsToWin =
      Number(
        setsToWinSelect.value
      ) || 5;


    localStorage.setItem(
      "pingscore-sets-to-win",
      String(setsToWin)
    );


    saveCurrentGame();
  }
);


// =====================================================
// LAGRE AKTIV KAMP
// =====================================================

function saveCurrentGame() {

  const gameState = {

    score1,
    score2,

    sets1,
    sets2,

    player1Name,
    player2Name,

    setsToWin,

    setHistory,

    matchFinished,

    currentMatchHistoryId
  };


  localStorage.setItem(
    "pingscore-current-game",
    JSON.stringify(gameState)
  );
}


// =====================================================
// LAST AKTIV KAMP
// =====================================================

function loadCurrentGame() {

  const saved =
    localStorage.getItem(
      "pingscore-current-game"
    );


  if (!saved) {
    return;
  }


  try {

    const game =
      JSON.parse(saved);


    score1 =
      game.score1 ?? 0;

    score2 =
      game.score2 ?? 0;


    sets1 =
      game.sets1 ?? 0;

    sets2 =
      game.sets2 ?? 0;


    player1Name =
      game.player1Name
      || "Marius";


    player2Name =
      game.player2Name
      || "Petter";


    setsToWin =
      game.setsToWin ?? 5;


    setHistory =
      Array.isArray(
        game.setHistory
      )
        ? game.setHistory
        : [];


    matchFinished =
      game.matchFinished
      || false;


    currentMatchHistoryId =
      game.currentMatchHistoryId
      || null;

  }

  catch (error) {

    console.log(
      "Kunne ikke laste kamp:",
      error
    );
  }
}


// =====================================================
// KAMPHISTORIKK - LAGRE / LAST
// =====================================================

function loadMatchHistory() {

  const saved =
    localStorage.getItem(
      "pingscore-match-history"
    );


  if (!saved) {

    matchHistory = [];

    return;
  }


  try {

    const parsed =
      JSON.parse(saved);


    matchHistory =
      Array.isArray(parsed)
        ? parsed
        : [];

  }

  catch (error) {

    matchHistory = [];

    console.log(
      "Kunne ikke laste kamphistorikk:",
      error
    );
  }
}


function saveMatchHistory() {

  localStorage.setItem(
    "pingscore-match-history",
    JSON.stringify(matchHistory)
  );
}


// =====================================================
// DISPLAY
// =====================================================

function updateDisplay() {

  document.getElementById(
    "score1"
  ).textContent =
    score1;


  document.getElementById(
    "score2"
  ).textContent =
    score2;


  document.getElementById(
    "sets1"
  ).textContent =
    sets1;


  document.getElementById(
    "sets2"
  ).textContent =
    sets2;


  updateSetHistory();


  // AUTOMATISK LAGRING
  saveCurrentGame();
}


// =====================================================
// SETTHISTORIKK - AKTIV KAMP
// =====================================================

function updateSetHistory() {

  const container =
    document.getElementById(
      "setHistory"
    );


  if (!container) {
    return;
  }


  if (
    setHistory.length === 0
  ) {

    container.innerHTML =
      `
      <span class="history-empty">
        Ingen sett ferdig ennå
      </span>
      `;

    return;
  }


  container.innerHTML = "";


  setHistory.forEach(
    (set, index) => {

      const chip =
        document.createElement(
          "div"
        );


      chip.className =
        "set-chip";


      const winnerName =
        set.winner === 1
          ? player1Name
          : player2Name;


      chip.textContent =
        `${index + 1}. ${winnerName} ${set.score1}-${set.score2}`;


      container.appendChild(
        chip
      );
    }
  );


  container.scrollLeft =
    container.scrollWidth;
}


// =====================================================
// SAVE FOR ANGRE
// =====================================================

function saveHistory() {

  history.push({

    score1,
    score2,

    sets1,
    sets2,

    setHistory:
      setHistory.map(
        set => ({ ...set })
      ),

    matchFinished
  });
}


// =====================================================
// MANUELT POENG
// =====================================================

function addPoint(player) {

  if (matchFinished) {
    return;
  }


  saveHistory();


  if (player === 1) {
    score1++;
  }

  else {
    score2++;
  }


  handleAcceptedScore(
    ""
  );
}


// =====================================================
// SETTVINNER
// =====================================================

function getSetWinner() {

  const difference =
    Math.abs(
      score1 - score2
    );


  if (
    score1 >= 11 &&
    difference >= 2 &&
    score1 > score2
  ) {

    return 1;
  }


  if (
    score2 >= 11 &&
    difference >= 2 &&
    score2 > score1
  ) {

    return 2;
  }


  return null;
}


// =====================================================
// ET GODKJENT POENG
// =====================================================

function handleAcceptedScore(
  heardText = ""
) {

  playScoreSound();

  flashScore();


  const setWinner =
    getSetWinner();


  if (heardText) {

    setStatus(
      `👂 "${heardText}" → ✅ ${score1}-${score2}`
    );
  }


  if (
    setWinner === 1
  ) {

    speakScore(
      "Ouuufffff! Kjipt ass!"
    );

  }

  else {

    speakScore();
  }


  checkSetWinner();

  updateDisplay();
}


// =====================================================
// SETT FERDIG
// =====================================================

function checkSetWinner() {

  const winner =
    getSetWinner();


  if (!winner) {
    return;
  }


  const finalScore1 =
    score1;

  const finalScore2 =
    score2;


  setHistory.push({

    winner,

    score1:
      finalScore1,

    score2:
      finalScore2
  });


  if (winner === 1) {

    sets1++;

  }

  else {

    sets2++;
  }


  score1 = 0;
  score2 = 0;


  updateDisplay();


  if (
    sets1 >= setsToWin
  ) {

    endMatch(1);

    return;
  }


  if (
    sets2 >= setsToWin
  ) {

    endMatch(2);

    return;
  }


  const winnerName =
    winner === 1
      ? player1Name
      : player2Name;


  setTimeout(
    () => {

      if (!matchFinished) {

        setStatus(
          `🏓 ${winnerName} vant settet!`
        );
      }

    },
    350
  );
}


// =====================================================
// KAMP FERDIG
// =====================================================

function endMatch(player) {

  if (matchFinished) {
    return;
  }


  matchFinished =
    true;


  const winnerName =
    player === 1
      ? player1Name
      : player2Name;


  // UNIK ID
  const matchId =
    `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;


  currentMatchHistoryId =
    matchId;


  // LAGRE HELE KAMPEN
  const completedMatch = {

    id:
      matchId,

    timestamp:
      Date.now(),

    player1:
      player1Name,

    player2:
      player2Name,

    winner:
      winnerName,

    sets1,
    sets2,

    setsToWin,

    sets:
      setHistory.map(
        set => ({
          ...set
        })
      )
  };


  matchHistory.push(
    completedMatch
  );


  saveMatchHistory();

  saveCurrentGame();


  setStatus(
    `🏆 ${winnerName.toUpperCase()} VANT KAMPEN!`
  );


  // Om mikrofon faktisk fungerer,
  // stopper vi den her.
  listening =
    false;


  if (
    recognition &&
    recognitionRunning
  ) {

    try {

      recognition.stop();

    }

    catch (error) {

      console.log(error);
    }
  }


  setListenButton(
    "🏆 Kamp ferdig"
  );
}


// =====================================================
// ANGRE
// =====================================================

function undo() {

  if (
    history.length === 0
  ) {

    setStatus(
      "Ingenting å angre."
    );

    return;
  }


  // Hvis kampen akkurat ble lagret som ferdig
  // og vi angrer siste poeng, fjern kampen igjen.
  if (
    matchFinished &&
    currentMatchHistoryId
  ) {

    matchHistory =
      matchHistory.filter(
        match =>
          match.id !==
          currentMatchHistoryId
      );


    saveMatchHistory();


    currentMatchHistoryId =
      null;
  }


  const previous =
    history.pop();


  score1 =
    previous.score1;

  score2 =
    previous.score2;


  sets1 =
    previous.sets1;

  sets2 =
    previous.sets2;


  setHistory =
    previous.setHistory.map(
      set => ({ ...set })
    );


  matchFinished =
    previous.matchFinished;


  updateDisplay();


  setStatus(
    `↶ Tilbake til ${score1}-${score2}`
  );
}


// =====================================================
// NY KAMP
// =====================================================

function resetGame() {

  score1 = 0;
  score2 = 0;

  sets1 = 0;
  sets2 = 0;

  setHistory = [];
  history = [];

  matchFinished =
    false;

  currentMatchHistoryId =
    null;


  speakingScore =
    false;

  ignoreSpeechUntil =
    0;


  if (
    "speechSynthesis"
    in window
  ) {

    window
      .speechSynthesis
      .cancel();
  }


  updateDisplay();


  setStatus(
    "Ny kamp!"
  );


  setListenButton(
    listening
      ? "🟢 Lytter..."
      : "🎙️ Start lytting"
  );
}


// =====================================================
// HISTORIKK-SKJERM
// =====================================================

function openHistory() {

  renderMatchHistory();


  const screen =
    document.getElementById(
      "historyScreen"
    );


  screen.classList.remove(
    "hidden"
  );
}


function closeHistory() {

  const screen =
    document.getElementById(
      "historyScreen"
    );


  screen.classList.add(
    "hidden"
  );
}

// =====================================================
// NULLSTILL ALL HISTORIKK
// =====================================================

function clearAllHistory() {

  const confirmed =
    confirm(
      "Er du sikker? Dette sletter alle lagrede kamper mellom Marius og Petter og nullstiller stillingen."
    );


  if (!confirmed) {
    return;
  }


  // Slett alle ferdige kamper
  matchHistory = [];


  // Nullstill aktiv kamp
  score1 = 0;
  score2 = 0;

  sets1 = 0;
  sets2 = 0;

  setHistory = [];
  history = [];

  matchFinished = false;

  currentMatchHistoryId = null;


  // Slett lagret data
  localStorage.removeItem(
    "pingscore-match-history"
  );

  localStorage.removeItem(
    "pingscore-current-game"
  );


  // Oppdater skjermen
  updateDisplay();

  renderMatchHistory();


  setStatus(
    "Historikken er nullstilt 🏓"
  );


  setListenButton(
    "🎙️ Start lytting"
  );
}


// =====================================================
// SAMME SPILLERPAR?
// =====================================================

function samePlayerPair(match) {

  const current1 =
    player1Name
      .trim()
      .toLowerCase();


  const current2 =
    player2Name
      .trim()
      .toLowerCase();


  const match1 =
    match.player1
      .trim()
      .toLowerCase();


  const match2 =
    match.player2
      .trim()
      .toLowerCase();


  return (

    (
      current1 === match1 &&
      current2 === match2
    )

    ||

    (
      current1 === match2 &&
      current2 === match1
    )
  );
}


// =====================================================
// RENDER HISTORIKK
// =====================================================

function renderMatchHistory() {

  const historyPlayer1 =
    document.getElementById(
      "historyPlayer1Name"
    );


  const historyPlayer2 =
    document.getElementById(
      "historyPlayer2Name"
    );


  const wins1Element =
    document.getElementById(
      "overallWins1"
    );


  const wins2Element =
    document.getElementById(
      "overallWins2"
    );


  const list =
    document.getElementById(
      "matchHistoryList"
    );


  historyPlayer1.textContent =
    player1Name;


  historyPlayer2.textContent =
    player2Name;


  // Bare kamper mellom de to aktive spillerne
  const relevantMatches =
    matchHistory.filter(
      samePlayerPair
    );


  let wins1 = 0;
  let wins2 = 0;


  relevantMatches.forEach(
    match => {

      if (
        match.winner.toLowerCase() ===
        player1Name.toLowerCase()
      ) {

        wins1++;
      }


      if (
        match.winner.toLowerCase() ===
        player2Name.toLowerCase()
      ) {

        wins2++;
      }
    }
  );


  wins1Element.textContent =
    wins1;


  wins2Element.textContent =
    wins2;


  list.innerHTML = "";


  if (
    relevantMatches.length === 0
  ) {

    list.innerHTML =
      `
      <div class="no-matches">
        Ingen kamper lagret ennå 🏓
      </div>
      `;

    return;
  }


  // NYEST FØRST
  const sorted =
    [...relevantMatches]
      .sort(
        (a, b) =>
          b.timestamp -
          a.timestamp
      );


  sorted.forEach(
    match => {

      const date =
        new Date(
          match.timestamp
        );


      const dateText =
        date.toLocaleDateString(
          "nb-NO",
          {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          }
        );


      const timeText =
        date.toLocaleTimeString(
          "nb-NO",
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        );


      const setsText =
        match.sets
          .map(
            set =>
              `${set.score1}-${set.score2}`
          )
          .join(" · ");


      const card =
        document.createElement(
          "div"
        );


      card.className =
        "match-card";


      card.innerHTML =
        `
        <div class="match-top">

          <span>
            ${dateText}
          </span>

          <span>
            ${timeText}
          </span>

        </div>


        <div class="match-result">

          <span>
            ${match.player1}
          </span>

          <span class="match-result-score">
            ${match.sets1}–${match.sets2}
          </span>

          <span>
            ${match.player2}
          </span>

        </div>


        <div class="match-winner">
          🏆 ${match.winner}
        </div>


        <div class="match-sets">
          ${setsText}
        </div>
        `;


      list.appendChild(
        card
      );
    }
  );
}


// =====================================================
// NORSKE TALL
// =====================================================

const numberWords = {

  "null": 0,
  "zero": 0,

  "en": 1,
  "én": 1,
  "ett": 1,

  "to": 2,
  "tre": 3,
  "fire": 4,
  "fem": 5,
  "seks": 6,

  "sju": 7,
  "syv": 7,

  "åtte": 8,
  "ni": 9,

  "ti": 10,
  "elleve": 11,
  "tolv": 12,

  "tretten": 13,
  "fjorten": 14,
  "femten": 15,
  "seksten": 16,
  "sytten": 17,
  "atten": 18,
  "nitten": 19,
  "tjue": 20
};


function wordToNumber(word) {

  const cleaned =
    word
      .toLowerCase()
      .trim();


  if (
    numberWords[cleaned]
    !== undefined
  ) {

    return numberWords[cleaned];
  }


  if (
    cleaned !== "" &&
    !isNaN(cleaned)
  ) {

    return Number(cleaned);
  }


  return undefined;
}


// =====================================================
// MULIGE NESTE SCORER
// =====================================================

function getPossibleScores() {

  return [

    {
      player1:
        score1 + 1,

      player2:
        score2
    },

    {
      player1:
        score1,

      player2:
        score2 + 1
    },

    {
      player1:
        score1,

      player2:
        score2
    }
  ];
}


// =====================================================
// NORMALISER TALE
// =====================================================

function normalizeSpeech(text) {

  return text

    .toLowerCase()

    .replace(
      /[.,!?]/g,
      ""
    )

    .replace(
      /\btil\b/g,
      " "
    )

    .replace(
      /\bmot\b/g,
      " "
    )

    .replace(
      /-/g,
      " "
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim();
}


// =====================================================
// VANLIG SCORE
// =====================================================

function parseNormalScore(text) {

  const parts =
    normalizeSpeech(text)
      .split(" ");


  const numbers = [];


  for (
    const part of parts
  ) {

    const number =
      wordToNumber(part);


    if (
      number !== undefined
    ) {

      numbers.push(number);
    }
  }


  if (
    numbers.length >= 2
  ) {

    return {

      player1:
        numbers[0],

      player2:
        numbers[1]
    };
  }


  return null;
}


// =====================================================
// SMART SCORE
// =====================================================

function parseSmartScore(text) {

  const possibleScores =
    getPossibleScores();


  const normalScore =
    parseNormalScore(
      text
    );


  if (normalScore) {

    const valid =
      possibleScores.some(
        score =>

          score.player1 ===
            normalScore.player1

          &&

          score.player2 ===
            normalScore.player2
      );


    if (valid) {

      return normalScore;
    }
  }


  const cleaned =
    normalizeSpeech(
      text
    );


  const singleNumber =
    wordToNumber(
      cleaned
    );


  if (
    singleNumber === undefined
  ) {

    return null;
  }


  const heardDigits =
    String(
      singleNumber
    );


  for (
    const possible
    of possibleScores
  ) {

    const combined =
      `${possible.player1}${possible.player2}`;


    if (
      combined ===
      heardDigits
    ) {

      return possible;
    }
  }


  return null;
}


// =====================================================
// SCORE FRA STEMME
// =====================================================

function setScoreFromVoice(
  newScore1,
  newScore2,
  heardText
) {

  if (matchFinished) {
    return;
  }


  const possibleScores =
    getPossibleScores();


  const valid =
    possibleScores.some(
      score =>

        score.player1 ===
          newScore1

        &&

        score.player2 ===
          newScore2
    );


  if (!valid) {

    setStatus(
      `🤔 Hørte "${heardText}"`
    );

    return;
  }


  if (
    newScore1 === score1 &&
    newScore2 === score2
  ) {

    return;
  }


  saveHistory();


  score1 =
    newScore1;

  score2 =
    newScore2;


  handleAcceptedScore(
    heardText
  );
}


// =====================================================
// PIP
// =====================================================

function setupAudio() {

  try {

    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;


    if (!AudioContext) {
      return;
    }


    if (!audioContext) {

      audioContext =
        new AudioContext();
    }


    if (
      audioContext.state ===
      "suspended"
    ) {

      audioContext.resume();
    }

  }

  catch (error) {

    console.log(error);
  }
}


function playScoreSound() {

  try {

    if (!audioContext) {
      return;
    }


    const oscillator =
      audioContext
        .createOscillator();


    const gain =
      audioContext
        .createGain();


    oscillator.connect(
      gain
    );


    gain.connect(
      audioContext.destination
    );


    oscillator.frequency.value =
      700;


    oscillator.type =
      "sine";


    gain.gain.setValueAtTime(
      0.07,
      audioContext.currentTime
    );


    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.05
    );


    oscillator.start();


    oscillator.stop(
      audioContext.currentTime + 0.05
    );

  }

  catch (error) {

    console.log(error);
  }
}


// =====================================================
// SI SCOREN
// =====================================================

function speakScore(
  extraText = ""
) {

  if (
    !(
      "speechSynthesis"
      in window
    )
  ) {

    return;
  }


  speakingScore =
    true;


  window
    .speechSynthesis
    .cancel();


  let spokenScore =
    `${score1} til ${score2}`;


  if (extraText) {

    spokenScore +=
      `. ${extraText}`;
  }


  const utterance =
    new SpeechSynthesisUtterance(
      spokenScore
    );


  utterance.lang =
    "nb-NO";


  utterance.rate =
    1.2;


  utterance.volume =
    1;


  utterance.onend =
    () => {

      speakingScore =
        false;


      ignoreSpeechUntil =
        Date.now() + 700;


      if (
        listening &&
        !recognitionRunning &&
        !matchFinished
      ) {

        restartRecognition();
      }
    };


  utterance.onerror =
    () => {

      speakingScore =
        false;


      ignoreSpeechUntil =
        Date.now() + 500;
    };


  window
    .speechSynthesis
    .speak(
      utterance
    );
}


// =====================================================
// BLINK
// =====================================================

function flashScore() {

  const scoreboard =
    document.querySelector(
      ".scoreboard"
    );


  if (!scoreboard) {
    return;
  }


  scoreboard.classList.remove(
    "score-flash"
  );


  void scoreboard.offsetWidth;


  scoreboard.classList.add(
    "score-flash"
  );
}


// =====================================================
// WAKE LOCK
// =====================================================

async function keepScreenAwake() {

  if (
    !(
      "wakeLock"
      in navigator
    )
  ) {

    return;
  }


  try {

    wakeLock =
      await navigator
        .wakeLock
        .request(
          "screen"
        );

  }

  catch (error) {

    console.log(error);
  }
}


// =====================================================
// TALEGJENKJENNING
// =====================================================

const SpeechRecognition =

  window.SpeechRecognition ||

  window.webkitSpeechRecognition;


// =====================================================
// RESTART
// =====================================================

function clearRestartTimer() {

  if (restartTimer) {

    clearTimeout(
      restartTimer
    );


    restartTimer =
      null;
  }
}


function restartRecognition() {

  if (
    !listening ||
    matchFinished ||
    recognitionRunning ||
    !recognition
  ) {

    return;
  }


  clearRestartTimer();


  restartTimer =
    setTimeout(
      () => {

        try {

          recognition.start();

        }

        catch (error) {

          console.log(error);
        }

      },
      700
    );
}


// =====================================================
// SPEECH SETUP
// =====================================================

if (
  SpeechRecognition &&
  listenButton
) {

  recognition =
    new SpeechRecognition();


  recognition.lang =
    "nb-NO";


  recognition.continuous =
    true;


  recognition.interimResults =
    false;


  recognition.maxAlternatives =
    5;


  recognition.onstart =
    () => {

      recognitionRunning =
        true;


      listening =
        true;


      setListenButton(
        "🟢 Lytter..."
      );


      setStatus(
        "Si scoren"
      );
    };


  recognition.onresult =
    event => {

      if (speakingScore) {
        return;
      }


      if (
        Date.now() <
        ignoreSpeechUntil
      ) {

        return;
      }


      const lastResult =
        event.results[
          event.results.length - 1
        ];


      let heardText =
        lastResult[0]
          .transcript
          .trim();


      let foundScore =
        null;


      for (
        let i = 0;
        i < lastResult.length;
        i++
      ) {

        const transcript =
          lastResult[i]
            .transcript
            .trim();


        const parsed =
          parseSmartScore(
            transcript
          );


        if (parsed) {

          foundScore =
            parsed;


          heardText =
            transcript;


          break;
        }
      }


      if (!foundScore) {

        setStatus(
          `🤔 Hørte "${heardText}"`
        );

        return;
      }


      setScoreFromVoice(

        foundScore.player1,

        foundScore.player2,

        heardText
      );
    };


  recognition.onerror =
    event => {

      console.log(
        "Speech:",
        event.error
      );


      if (
        event.error ===
        "not-allowed"
      ) {

        listening =
          false;


        recognitionRunning =
          false;


        setStatus(
          "❌ Mikrofontilgang mangler"
        );
      }
    };


  recognition.onend =
    () => {

      recognitionRunning =
        false;


      if (
        listening &&
        !matchFinished &&
        !speakingScore
      ) {

        restartRecognition();
      }
    };


  listenButton.addEventListener(
    "click",
    async () => {

      setupAudio();


      if (!listening) {

        if (matchFinished) {
          return;
        }


        listening =
          true;


        await keepScreenAwake();


        try {

          recognition.start();

        }

        catch (error) {

          restartRecognition();
        }

      }

      else {

        listening =
          false;


        clearRestartTimer();


        if (
          recognitionRunning
        ) {

          try {

            recognition.stop();

          }

          catch (error) {

            console.log(error);
          }
        }


        setListenButton(
          "🎙️ Start lytting"
        );
      }
    }
  );
}


// =====================================================
// LAST INN ALT
// =====================================================

// 1. GAMLE KAMPER
loadMatchHistory();


// 2. AKTIV KAMP
loadCurrentGame();


// 3. INPUT-FELT
if (player1NameInput) {

  player1NameInput.value =
    player1Name;
}


if (player2NameInput) {

  player2NameInput.value =
    player2Name;
}


if (setsToWinSelect) {

  setsToWinSelect.value =
    String(setsToWin);
}


// 4. UI
updateNames();

updateDisplay();


// Hvis kampen allerede var ferdig
if (matchFinished) {

  setListenButton(
    "🏆 Kamp ferdig"
  );
}