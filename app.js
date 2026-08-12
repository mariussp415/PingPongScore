let score1 = 0;
let score2 = 0;

let sets1 = 0;
let sets2 = 0;

let history = [];

// -------------------------
// SCORE
// -------------------------

function updateDisplay() {
  document.getElementById("score1").textContent = score1;
  document.getElementById("score2").textContent = score2;

  document.getElementById("sets1").textContent = sets1;
  document.getElementById("sets2").textContent = sets2;
}

function saveHistory() {
  history.push({
    score1,
    score2,
    sets1,
    sets2
  });
}

function addPoint(player) {
  saveHistory();

  if (player === 1) {
    score1++;
  } else {
    score2++;
  }

  checkSetWinner();
  updateDisplay();
}

function checkSetWinner() {
  const difference = Math.abs(score1 - score2);

  if (score1 >= 11 && difference >= 2) {
    sets1++;
    score1 = 0;
    score2 = 0;
  }

  if (score2 >= 11 && difference >= 2) {
    sets2++;
    score1 = 0;
    score2 = 0;
  }
}

function undo() {
  if (history.length === 0) return;

  const previous = history.pop();

  score1 = previous.score1;
  score2 = previous.score2;
  sets1 = previous.sets1;
  sets2 = previous.sets2;

  updateDisplay();
}

function resetGame() {
  score1 = 0;
  score2 = 0;
  sets1 = 0;
  sets2 = 0;
  history = [];

  updateDisplay();

  document.getElementById("status").textContent =
    "Ny kamp! Si stillingen.";
}

// -------------------------
// NORSKE TALL
// -------------------------

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
  word = word.toLowerCase().trim();

  // Hvis talegjenkjenningen allerede gir oss et tall
  if (!isNaN(word)) {
    return Number(word);
  }

  return numberWords[word];
}

// -------------------------
// TOLK SCORE
// -------------------------

function parseScore(text) {
  let cleaned = text
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/-/g, " ")
    .replace(/\btil\b/g, " ")
    .replace(/\bmot\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = cleaned.split(" ");

  const numbers = [];

  for (const part of parts) {
    const number = wordToNumber(part);

    if (number !== undefined) {
      numbers.push(number);
    }
  }

  if (numbers.length < 2) {
    return null;
  }

  return {
    player1: numbers[0],
    player2: numbers[1]
  };
}

// -------------------------
// VALIDER SCORE
// -------------------------

function isValidNewScore(newScore1, newScore2) {

  // Tillat samme score
  if (newScore1 === score1 && newScore2 === score2) {
    return true;
  }

  // Spiller 1 fikk ett poeng
  if (
    newScore1 === score1 + 1 &&
    newScore2 === score2
  ) {
    return true;
  }

  // Spiller 2 fikk ett poeng
  if (
    newScore2 === score2 + 1 &&
    newScore1 === score1
  ) {
    return true;
  }

  // Når kampen nettopp starter, tillater vi at dere
  // sier en eksisterende score direkte.
  if (score1 === 0 && score2 === 0) {
    return true;
  }

  return false;
}

function setScoreFromVoice(newScore1, newScore2) {

  if (!isValidNewScore(newScore1, newScore2)) {
    document.getElementById("status").textContent =
      `⚠️ Hørte ${newScore1}-${newScore2}, men det passer ikke med ${score1}-${score2}`;

    return;
  }

  saveHistory();

  score1 = newScore1;
  score2 = newScore2;

  document.getElementById("status").textContent =
    `✅ Registrert ${score1}-${score2}`;

  checkSetWinner();
  updateDisplay();
}

// -------------------------
// TALEGJENKJENNING
// -------------------------

const SpeechRecognition =
  window.SpeechRecognition ||
  window.webkitSpeechRecognition;

let recognition = null;
let listening = false;

const listenButton =
  document.getElementById("listenButton");

const status =
  document.getElementById("status");

if (!SpeechRecognition) {

  listenButton.disabled = true;

  status.textContent =
    "❌ Denne nettleseren støtter ikke talegjenkjenning.";

} else {

  recognition = new SpeechRecognition();

  recognition.lang = "nb-NO";

  recognition.continuous = true;

  recognition.interimResults = false;

  recognition.maxAlternatives = 3;

  recognition.onstart = function () {

    listening = true;

    listenButton.textContent =
      "🟢 Lytter...";

    status.textContent =
      "Si stillingen, for eksempel «tre to»";
  };

  recognition.onresult = function (event) {

    const lastResult =
      event.results[event.results.length - 1];

    let foundScore = null;
    let heardText = "";

    // Vi prøver flere forslag fra talegjenkjenningen
    for (let i = 0; i < lastResult.length; i++) {

      const transcript =
        lastResult[i].transcript.trim();

      if (i === 0) {
        heardText = transcript;
      }

      const parsed =
        parseScore(transcript);

      if (parsed) {
        foundScore = parsed;
        break;
      }
    }

    console.log("Hørte:", heardText);

    if (!foundScore) {

      status.textContent =
        `🤔 Hørte: "${heardText}"`;

      return;
    }

    setScoreFromVoice(
      foundScore.player1,
      foundScore.player2
    );
  };

  recognition.onerror = function (event) {

    console.log(
      "Talegjenkjenningsfeil:",
      event.error
    );

    if (event.error === "not-allowed") {

      status.textContent =
        "❌ Mikrofontilgang ble ikke tillatt.";

      listening = false;

      listenButton.textContent =
        "🎙️ Start lytting";

    } else if (event.error === "no-speech") {

      status.textContent =
        "Hørte ingenting – prøv igjen.";

    } else {

      status.textContent =
        `Tale-feil: ${event.error}`;
    }
  };

  recognition.onend = function () {

    // På noen enheter avsluttes lyttingen automatisk.
    // Hvis brukeren fortsatt vil lytte, prøver vi å starte igjen.

    if (listening) {

      try {
        recognition.start();
      } catch (error) {
        console.log(error);
      }

    } else {

      listenButton.textContent =
        "🎙️ Start lytting";
    }
  };

  listenButton.addEventListener(
    "click",
    function () {

      if (!listening) {

        listening = true;

        try {
          recognition.start();
        } catch (error) {
          console.log(error);
        }

      } else {

        listening = false;

        recognition.stop();

        listenButton.textContent =
          "🎙️ Start lytting";

        status.textContent =
          "Lytting stoppet.";
      }
    }
  );
}

updateDisplay();