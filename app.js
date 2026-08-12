// =====================================================
// PINGSCORE
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
// SPILLERNAVN
// =====================================================

function updateNames() {

  player1Name =
    player1NameInput.value.trim() ||
    "Spiller 1";

  player2Name =
    player2NameInput.value.trim() ||
    "Spiller 2";


  document.getElementById(
    "player1Label"
  ).textContent = player1Name;


  document.getElementById(
    "player2Label"
  ).textContent = player2Name;


  document.getElementById(
    "scorePlayer1Name"
  ).textContent = player1Name;


  document.getElementById(
    "scorePlayer2Name"
  ).textContent = player2Name;


  localStorage.setItem(
    "pingscore-player1",
    player1Name
  );


  localStorage.setItem(
    "pingscore-player2",
    player2Name
  );
}


player1NameInput.addEventListener(
  "input",
  updateNames
);


player2NameInput.addEventListener(
  "input",
  updateNames
);


// =====================================================
// ANTALL SETT
// =====================================================

setsToWinSelect.addEventListener(
  "change",
  function () {

    setsToWin =
      Number(
        setsToWinSelect.value
      );

    localStorage.setItem(
      "pingscore-sets-to-win",
      setsToWin
    );

  }
);


// =====================================================
// DISPLAY
// =====================================================

function updateDisplay() {

  document.getElementById(
    "score1"
  ).textContent = score1;


  document.getElementById(
    "score2"
  ).textContent = score2;


  document.getElementById(
    "sets1"
  ).textContent = sets1;


  document.getElementById(
    "sets2"
  ).textContent = sets2;


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


  if (setHistory.length === 0) {

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


      chip.innerHTML =
        `
        Sett ${index + 1}
        <strong>
          ${winnerName}
        </strong>
        ${set.score1}-${set.score2}
        `;


      container.appendChild(
        chip
      );
    }
  );


  container.scrollLeft =
    container.scrollWidth;
}


// =====================================================
// HISTORY / ANGRE
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


  playScoreSound();

  flashScore();


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


  if (difference < 2) {
    return null;
  }


  if (
    score1 >= 11 &&
    score1 > score2
  ) {

    return 1;
  }


  if (
    score2 >= 11 &&
    score2 > score1
  ) {

    return 2;
  }


  return null;
}


// =====================================================
// SETT
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


  announceSetWinner(
    winner
  );
}


// =====================================================
// SETTVINNER STATUS
// =====================================================

function announceSetWinner(player) {

  const name =
    player === 1
      ? player1Name
      : player2Name;


  setTimeout(() => {

    status.textContent =
      `🏓 ${name} vant settet!`;

  }, 150);
}


// =====================================================
// KAMP FERDIG
// =====================================================

function endMatch(player) {

  matchFinished = true;

  listening = false;


  const name =
    player === 1
      ? player1Name
      : player2Name;


  status.textContent =
    `🏆 ${name.toUpperCase()} VANT KAMPEN!`;


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


  listenButton.textContent =
    "🏆 Kamp ferdig";
}


// =====================================================
// ANGRE
// =====================================================

function undo() {

  if (
    history.length === 0
  ) {

    status.textContent =
      "Ingenting å angre.";

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


  status.textContent =
    `↶ Tilbake til ${score1}-${score2}`;
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


  status.textContent =
    "Ny kamp!";


  if (listening) {

    listenButton.textContent =
      "🟢 Lytter...";

  }

  else {

    listenButton.textContent =
      "🎙️ Start lytting";
  }
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
// NORMAL SCORE
// =====================================================

function parseNormalScore(text) {

  const cleaned =
    normalizeSpeech(
      text
    );


  const parts =
    cleaned.split(" ");


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

  const normalScore =
    parseNormalScore(
      text
    );


  if (normalScore) {

    const possibleScores =
      getPossibleScores();


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


  const possibleScores =
    getPossibleScores();


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

  if (
    matchFinished
  ) {

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

    status.textContent =
      `🤔 Hørte "${heardText}", men scoren passer ikke`;

    return;
  }


  if (
    newScore1 === score1
    &&
    newScore2 === score2
  ) {

    status.textContent =
      `👂 "${heardText}" – fortsatt ${score1}-${score2}`;

    return;
  }


  saveHistory();


  score1 =
    newScore1;


  score2 =
    newScore2;


  playScoreSound();

  flashScore();


  status.textContent =
    `👂 "${heardText}" → ✅ ${score1}-${score2}`;


  const setWinner =
    getSetWinner();


  // Hvis Marius / spiller 1 vinner sett
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
// LYD
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
      error
    );
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

    console.log(error);
  }
}


// =====================================================
// RESTART MIKROFON
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

    listenButton.textContent =
      "🟢 Lytter...";

    return;
  }


  const delay =
    attempt === 1
      ? 600
      : 900;


  setTimeout(() => {

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

      if (
        attempt < 3
      ) {

        restartRecognition(
          attempt + 1
        );

      }

      else {

        status.textContent =
          "🎙️ Trykk Start lytting";


        listenButton.textContent =
          "🎙️ Start lytting";


        listening =
          false;
      }
    }

  }, delay);
}


// =====================================================
// SI SCORE
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


  if (
    recognition &&
    recognitionRunning
  ) {

    try {

      recognition.abort();

    }

    catch (error) {

      console.log(
        error
      );
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
    function () {

      speakingScore =
        false;


      restartRecognition();
    };


  utterance.onerror =
    function () {

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

    console.log(
      error
    );
  }
}


// =====================================================
// SPEECH RECOGNITION
// =====================================================

const SpeechRecognition =

  window.SpeechRecognition ||

  window.webkitSpeechRecognition;


if (!SpeechRecognition) {

  listenButton.disabled =
    true;


  status.textContent =
    "❌ Talegjenkjenning støttes ikke.";

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


  recognition.onstart =
    function () {

      recognitionRunning =
        true;


      listening =
        true;


      listenButton.textContent =
        "🟢 Lytter...";


      status.textContent =
        "Si scoren";
    };


  recognition.onresult =
    function (event) {

      if (
        speakingScore
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

        status.textContent =
          `🤔 Hørte "${heardText}"`;

        return;
      }


      setScoreFromVoice(

        foundScore.player1,

        foundScore.player2,

        heardText

      );
    };


  recognition.onerror =
    function (event) {

      if (
        event.error ===
        "not-allowed"
      ) {

        listening =
          false;


        recognitionRunning =
          false;


        status.textContent =
          "❌ Mikrofontilgang mangler.";


        listenButton.textContent =
          "🎙️ Start lytting";
      }
    };


  recognition.onend =
    function () {

      recognitionRunning =
        false;


      if (
        speakingScore
      ) {

        return;
      }


      if (
        listening &&
        !matchFinished
      ) {

        restartRecognition();

      }

      else {

        listenButton.textContent =
          matchFinished
            ? "🏆 Kamp ferdig"
            : "🎙️ Start lytting";
      }
    };


  listenButton.addEventListener(
    "click",
    async function () {

      setupAudio();


      if (!listening) {

        if (
          matchFinished
        ) {

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


        speakingScore =
          false;


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

            console.log(
              error
            );
          }
        }


        listenButton.textContent =
          "🎙️ Start lytting";


        status.textContent =
          "Lytting stoppet.";
      }
    }
  );
}


// =====================================================
// GJENOPPRETT INNSTILLINGER
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


if (storedPlayer1) {

  player1NameInput.value =
    storedPlayer1;
}


if (storedPlayer2) {

  player2NameInput.value =
    storedPlayer2;
}


if (storedSets) {

  setsToWin =
    Number(
      storedSets
    );


  setsToWinSelect.value =
    storedSets;
}


updateNames();

updateDisplay();