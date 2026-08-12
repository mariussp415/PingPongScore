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

  document.getElementById("status").textContent =
    `↶ Tilbake til ${score1}-${score2}`;
}

function resetGame() {
  score1 = 0;
  score2 = 0;
  sets1 = 0;
  sets2 = 0;
  history = [];

  updateDisplay();

  document.getElementById("status").textContent =
    "Ny kamp!";
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
  const cleaned = word.toLowerCase().trim();

  if (numberWords[cleaned] !== undefined) {
    return numberWords[cleaned];
  }

  if (!isNaN(cleaned)) {
    return Number(cleaned);
  }

  return undefined;
}

// -------------------------
// MULIGE NESTE SCORER
// -------------------------

function getPossibleScores() {
  return [
    {
      player1: score1 + 1,
      player2: score2
    },
    {
      player1: score1,
      player2: score2 + 1
    },
    {
      player1: score1,
      player2: score2
    }
  ];
}

// -------------------------
// NORMALISER DET IPHONE HØRER
// -------------------------

function normalizeSpeech(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\btil\b/g, " ")
    .replace(/\bmot\b/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// -------------------------
// VANLIG PARSING
// -------------------------

function parseNormalScore(text) {
  const cleaned = normalizeSpeech(text);

  const parts = cleaned.split(" ");
  const numbers = [];

  for (const part of parts) {
    const number = wordToNumber(part);

    if (number !== undefined) {
      numbers.push(number);
    }
  }

  if (numbers.length >= 2) {
    return {
      player1: numbers[0],
      player2: numbers[1]
    };
  }

  return null;
}

// -------------------------
// SMART SCORE-TOLKING
// -------------------------

function parseSmartScore(text) {
  // Først prøver vi vanlig parsing
  const normalScore = parseNormalScore(text);

  if (normalScore) {
    return normalScore;
  }

  const cleaned = normalizeSpeech(text);

  // Hvis talegjenkjenningen bare returnerte ett tall,
  // for eksempel "10", "20", "73" osv.
  const singleNumber = wordToNumber(cleaned);

  if (singleNumber === undefined) {
    return null;
  }

  const heardDigits = String(singleNumber);

  const possibleScores = getPossibleScores();

  // Vi sammenligner det iPhone hørte med
  // de eneste scorene som faktisk kan være riktige.
  for (const possible of possibleScores) {
    const combined =
      `${possible.player1}${possible.player2}`;

    if (combined === heardDigits) {
      return possible;
    }
  }

  return null;
}

// -------------------------
// SETT SCORE
// -------------------------

function setScoreFromVoice(newScore1, newScore2, heardText) {
  const possibleScores = getPossibleScores();

  const valid = possibleScores.some(
    score =>
      score.player1 === newScore1 &&
      score.player2 === newScore2
  );

  if (!valid) {
    document.getElementById("status").textContent =
      `🤔 Hørte "${heardText}", men scoren passer ikke`;

    return;
  }

  // Hvis den hørte samme score, trenger vi ikke lagre historikk.
  if (newScore1 === score1 && newScore2 === score2) {
    document.getElementById("status").textContent =
      `👂 Hørte "${heardText}" – fortsatt ${score1}-${score2}`;

    return;
  }

  saveHistory();

  score1 = newScore1;
  score2 = newScore2;

  document.getElementById("status").textContent =
    `👂 "${heardText}" → ✅ ${score1}-${score2}`;

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
    "❌ Talegjenkjenning støttes ikke.";
} else {
  recognition = new SpeechRecognition();

  recognition.lang = "nb-NO";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;

  recognition.onstart = function () {
    listening = true;

    listenButton.textContent =
      "🟢 Lytter...";

    status.textContent =
      "Si scoren, f.eks. «tre to»";
  };

  recognition.onresult = function (event) {
    const lastResult =
      event.results[event.results.length - 1];

    let heardText =
      lastResult[0].transcript.trim();

    let foundScore = null;

    // Prøv flere forslag fra talegjenkjenningen
    for (let i = 0; i < lastResult.length; i++) {
      const transcript =
        lastResult[i].transcript.trim();

      console.log(
        `Alternativ ${i + 1}:`,
        transcript
      );

      const parsed =
        parseSmartScore(transcript);

      if (parsed) {
        foundScore = parsed;
        heardText = transcript;
        break;
      }
    }

    console.log("Valgt:", heardText);

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

  recognition.onerror = function (event) {
    console.log(
      "Talegjenkjenningsfeil:",
      event.error
    );

    if (event.error === "not-allowed") {
      status.textContent =
        "❌ Mikrofontilgang mangler.";

      listening = false;

      listenButton.textContent =
        "🎙️ Start lytting";
    }

    else if (event.error === "no-speech") {
      console.log("Ingen tale registrert");
    }

    else if (event.error === "aborted") {
      console.log("Talegjenkjenning stoppet");
    }

    else {
      status.textContent =
        `⚠️ Tale-feil: ${event.error}`;
    }
  };

  recognition.onend = function () {
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