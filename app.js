// =====================================================
// PINGSCORE v11
// =====================================================

let score1 = 0;
let score2 = 0;

let sets1 = 0;
let sets2 = 0;

let player1Name = "Marius";
let player2Name = "Petter";

let setsToWin = 5;

let setHistory = [];
let history = [];

let listening = false;
let recognitionRunning = false;
let matchFinished = false;
let speakingScore = false;

let recognition = null;
let wakeLock = null;
let audioContext = null;
let restartTimer = null;


// =====================================================
// HTML-ELEMENTER
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


  const p1Label =
    document.getElementById(
      "player1Label"
    );

  const p2Label =
    document.getElementById(
      "player2Label"
    );

  const p1ScoreName =
    document.getElementById(
      "scorePlayer1Name"
    );

  const p2ScoreName =
    document.getElementById(
      "scorePlayer2Name"
    );


  if (p1Label) {
    p1Label.textContent =
      player1Name;
  }

  if (p2Label) {
    p2Label.textContent =
      player2Name;
  }

  if (p1ScoreName) {
    p1ScoreName.textContent =
      player1Name;
  }

  if (p2ScoreName) {
    p2ScoreName.textContent =
      player2Name;
  }


  localStorage.setItem(
    "pingscore-player1",
    player1Name
  );

  localStorage.setItem(
    "pingscore-player2",
    player2Name
  );
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
  }
);


// =====================================================
// DISPLAY
// =====================================================

function updateDisplay() {

  const s1 =
    document.getElementById(
      "score1"
    );

  const s2 =
    document.getElementById(
      "score2"
    );

  const set1 =
    document.getElementById(
      "sets1"
    );

  const set2 =
    document.getElementById(
      "sets2"
    );


  if (s1) {
    s1.textContent =
      score1;
  }

  if (s2) {
    s2.textContent =
      score2;
  }

  if (set1) {
    set1.textContent =
      sets1;
  }

  if (set2) {
    set2.textContent =
      sets2;
  }


  updateSetHistory();
}


// =====================================================
// SETTHISTORIKK
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
        `set-chip winner-${set.winner}`;


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
// HISTORY
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


  if (
    "speechSynthesis"
    in window
  ) {

    window
      .speechSynthesis
      .cancel();
  }


  speakingScore =
    false;


  updateDisplay();


  setStatus(
    "Ny kamp! Si scoren."
  );


  setListenButton(
    listening
      ? "🟢 Lytter..."
      : "🎙️ Start lytting"
  );
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


  playScoreSound();

  flashScore();


  const setWinner =
    getSetWinner();


  if (
    setWinner === 1
  ) {

    speakScore(
      "Åååååh, uff! Kjipt ass!"
    );

  }

  else {

    speakScore();
  }


  checkSetWinner();

  updateDisplay();
}


// =====================================================
// FINN SETTVINNER
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
// SETT / KAMP
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
    150
  );
}


// =====================================================
// KAMP FERDIG
// =====================================================

function endMatch(player) {

  matchFinished =
    true;

  listening =
    false;


  const name =
    player === 1
      ? player1Name
      : player2Name;


  setStatus(
    `🏆 ${name.toUpperCase()} VANT KAMPEN!`
  );


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
    numberWords[
      cleaned
    ] !== undefined
  ) {

    return numberWords[
      cleaned
    ];
  }


  if (
    cleaned !== "" &&
    !isNaN(cleaned)
  ) {

    return Number(
      cleaned
    );
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
    normalizeSpeech(
      text
    ).split(" ");


  const numbers = [];


  for (
    const part of parts
  ) {

    const number =
      wordToNumber(
        part
      );


    if (
      number !== undefined
    ) {

      numbers.push(
        number
      );
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
      `🤔 Hørte "${heardText}", men scoren passer ikke`
    );

    return;
  }


  if (
    newScore1 === score1 &&
    newScore2 === score2
  ) {

    setStatus(
      `👂 "${heardText}" – fortsatt ${score1}-${score2}`
    );

    return;
  }


  saveHistory();


  score1 =
    newScore1;

  score2 =
    newScore2;


  playScoreSound();

  flashScore();


  setStatus(
    `👂 "${heardText}" → ✅ ${score1}-${score2}`
  );


  const setWinner =
    getSetWinner();


  if (
    setWinner === 1
  ) {

    speakScore(
      "Åååååh, uff! Kjipt ass!"
    );

  }

  else {

    speakScore();
  }


  checkSetWinner();

  updateDisplay();
}


// =====================================================
// PIP-LYD
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

    console.log(
      "AudioContext-feil:",
      error
    );
  }
}


function playScoreSound() {

  try {

    if (!audioContext) {
      return;
    }


    if (
      audioContext.state ===
      "suspended"
    ) {

      audioContext.resume();
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
      0.08,
      audioContext.currentTime
    );


    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.06
    );


    oscillator.start();


    oscillator.stop(
      audioContext.currentTime + 0.06
    );

  }

  catch (error) {

    console.log(
      "Pip-feil:",
      error
    );
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

    restartRecognition();

    return;
  }


  speakingScore =
    true;


  // Mikrofon AV mens telefonen snakker
  if (
    recognition &&
    recognitionRunning
  ) {

    try {

      recognition.abort();

    }

    catch (error) {

      console.log(error);
    }
  }


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


      restartRecognition();
    };


  utterance.onerror =
    event => {

      console.log(
        "Opplesningsfeil:",
        event
      );


      speakingScore =
        false;


      restartRecognition();
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


  scoreboard
    .classList
    .remove(
      "score-flash"
    );


  void scoreboard.offsetWidth;


  scoreboard
    .classList
    .add(
      "score-flash"
    );
}


// =====================================================
// HOLD SKJERMEN VÅKEN
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

    console.log(
      "Wake Lock-feil:",
      error
    );
  }
}


document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState ===
        "visible"

      &&

      listening
    ) {

      keepScreenAwake();


      if (!speakingScore) {

        restartRecognition();
      }
    }
  }
);


// =====================================================
// TALEGJENKJENNING
// =====================================================

const SpeechRecognition =

  window.SpeechRecognition ||

  window.webkitSpeechRecognition;


// =====================================================
// RESTART-TIMER
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


// =====================================================
// ROBUST MIKROFON-RESTART
// =====================================================

function restartRecognition(
  attempt = 1
) {

  if (
    !listening ||
    matchFinished ||
    speakingScore ||
    !recognition
  ) {

    return;
  }


  if (
    recognitionRunning
  ) {

    setListenButton(
      "🟢 Lytter..."
    );

    return;
  }


  clearRestartTimer();


  const delay =
    attempt === 1
      ? 500
      : 900;


  restartTimer =
    setTimeout(
      () => {

        restartTimer =
          null;


        if (
          !listening ||
          matchFinished ||
          speakingScore ||
          recognitionRunning
        ) {

          return;
        }


        try {

          recognition.start();

        }

        catch (error) {

          console.log(
            `Restart ${attempt} feilet:`,
            error
          );


          if (
            attempt < 3
          ) {

            restartRecognition(
              attempt + 1
            );

          }

          else {

            listening =
              false;


            setListenButton(
              "🎙️ Start lytting"
            );


            setStatus(
              "🎙️ Trykk Start lytting for å fortsette"
            );
          }
        }

      },
      delay
    );
}


// =====================================================
// SETT OPP TALEGJENKJENNING
// =====================================================

if (
  !listenButton ||
  !status
) {

  console.error(
    "PingScore: listenButton eller status mangler i index.html"
  );

}

else if (
  !SpeechRecognition
) {

  listenButton.disabled =
    true;


  setStatus(
    "❌ Talegjenkjenning støttes ikke i denne nettleseren."
  );

}

else {

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


// =====================================================
// START
// =====================================================

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
        "Si scoren, f.eks. «tre to»"
      );


      console.log(
        "🎙️ Lytter"
      );
    };


// =====================================================
// RESULTAT
// =====================================================

  recognition.onresult =
    event => {

      if (speakingScore) {
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


        console.log(
          `Hørte alternativ ${i + 1}:`,
          transcript
        );


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


// =====================================================
// FEIL
// =====================================================

  recognition.onerror =
    event => {

      console.log(
        "Speech error:",
        event.error
      );


      if (
        event.error ===
          "not-allowed"

        ||

        event.error ===
          "service-not-allowed"
      ) {

        listening =
          false;


        recognitionRunning =
          false;


        setListenButton(
          "🎙️ Start lytting"
        );


        setStatus(
          "❌ Mikrofontilgang mangler."
        );


        return;
      }


      // Helt normalt når vi stopper
      // mikrofonen mens telefonen snakker
      if (
        event.error ===
        "aborted"
      ) {

        return;
      }


      if (
        event.error !==
        "no-speech"
      ) {

        setStatus(
          `⚠️ Tale-feil: ${event.error}`
        );
      }
    };


// =====================================================
// STOPPET
// =====================================================

  recognition.onend =
    () => {

      recognitionRunning =
        false;


      console.log(
        "🎙️ Talegjenkjenning avsluttet"
      );


      if (speakingScore) {
        return;
      }


      if (
        listening &&
        !matchFinished
      ) {

        restartRecognition();

      }

      else {

        setListenButton(

          matchFinished
            ? "🏆 Kamp ferdig"
            : "🎙️ Start lytting"

        );
      }
    };


// =====================================================
// START / STOPP KNAPP
// =====================================================

  listenButton.addEventListener(
    "click",
    async () => {

      setupAudio();


      // START
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

          console.log(
            "Start-feil:",
            error
          );


          restartRecognition();
        }
      }


      // STOPP
      else {

        listening =
          false;


        speakingScore =
          false;


        clearRestartTimer();


        if (
          "speechSynthesis"
          in window
        ) {

          window
            .speechSynthesis
            .cancel();
        }


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


        setStatus(
          "Lytting stoppet."
        );
      }
    }
  );
}


// =====================================================
// GJENOPPRETT NAVN / INNSTILLINGER
// =====================================================

const storedPlayer1 =
  localStorage.getItem(
    "pingscore-player1"
  );


const storedPlayer2 =
  localStorage.getItem(
    "pingscore-player2"
  );


const storedSets =
  localStorage.getItem(
    "pingscore-sets-to-win"
  );


if (player1NameInput) {

  player1NameInput.value =
    storedPlayer1 ||
    "Marius";
}


if (player2NameInput) {

  player2NameInput.value =
    storedPlayer2 ||
    "Petter";
}


if (setsToWinSelect) {

  setsToWin =
    storedSets
      ? Number(storedSets)
      : 5;


  setsToWinSelect.value =
    String(setsToWin);
}


updateNames();

updateDisplay();