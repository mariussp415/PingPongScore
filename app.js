// =====================================================
// PINGSCORE
// =====================================================

let score1 = 0;
let score2 = 0;

let sets1 = 0;
let sets2 = 0;

let history = [];

let listening = false;
let matchFinished = false;

let recognition = null;
let wakeLock = null;
let audioContext = null;


// =====================================================
// ELEMENTER
// =====================================================

const listenButton = document.getElementById("listenButton");
const status = document.getElementById("status");


// =====================================================
// SCORE
// =====================================================

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

  if (matchFinished) {
    return;
  }

  saveHistory();

  if (player === 1) {
    score1++;
  } else {
    score2++;
  }

  playScoreSound();
  flashScore();

  checkSetWinner();
  updateDisplay();
}


// =====================================================
// SETT / KAMP
// =====================================================

function checkSetWinner() {

  const difference = Math.abs(score1 - score2);

  // SPILLER 1 VINNER SETT
  if (score1 >= 11 && difference >= 2) {

    sets1++;

    score1 = 0;
    score2 = 0;

    updateDisplay();

    if (sets1 >= 3) {
      endMatch(1);
      return;
    }

    announceSetWinner(1);
  }

  // SPILLER 2 VINNER SETT
  else if (score2 >= 11 && difference >= 2) {

    sets2++;

    score1 = 0;
    score2 = 0;

    updateDisplay();

    if (sets2 >= 3) {
      endMatch(2);
      return;
    }

    announceSetWinner(2);
  }
}


function announceSetWinner(player) {

  setTimeout(() => {

    status.textContent =
      `🏓 Spiller ${player} vant settet!`;

  }, 100);
}


function endMatch(player) {

  matchFinished = true;

  updateDisplay();

  status.textContent =
    `🏆 SPILLER ${player} VANT KAMPEN!`;

  listening = false;

  if (recognition) {
    try {
      recognition.stop();
    } catch (error) {
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

  if (history.length === 0) {
    status.textContent = "Ingenting å angre.";
    return;
  }

  const previous = history.pop();

  score1 = previous.score1;
  score2 = previous.score2;
  sets1 = previous.sets1;
  sets2 = previous.sets2;

  matchFinished = false;

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

  history = [];

  matchFinished = false;

  updateDisplay();

  status.textContent =
    "Ny kamp! Si stillingen.";

  if (listening) {
    listenButton.textContent = "🟢 Lytter...";
  } else {
    listenButton.textContent = "🎙️ Start lytting";
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
    word.toLowerCase().trim();

  if (numberWords[cleaned] !== undefined) {
    return numberWords[cleaned];
  }

  if (!isNaN(cleaned)) {
    return Number(cleaned);
  }

  return undefined;
}


// =====================================================
// MULIGE NESTE SCORER
// =====================================================

function getPossibleScores() {

  return [

    // Spiller 1 får poeng
    {
      player1: score1 + 1,
      player2: score2
    },

    // Spiller 2 får poeng
    {
      player1: score1,
      player2: score2 + 1
    },

    // Samme score
    {
      player1: score1,
      player2: score2
    }

  ];
}


// =====================================================
// NORMALISER TALE
// =====================================================

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


// =====================================================
// VANLIG SCORE-TOLKING
// =====================================================

function parseNormalScore(text) {

  const cleaned =
    normalizeSpeech(text);

  const parts =
    cleaned.split(" ");

  const numbers = [];

  for (const part of parts) {

    const number =
      wordToNumber(part);

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


// =====================================================
// SMART SCORE-TOLKING
//
// Eksempel:
//
// Du sier:
// "to null"
//
// iPhone hører:
// "20"
//
// Hvis nåværende score er 1-0:
//
// Mulige scorer:
//
// 2-0  → "20"
// 1-1  → "11"
//
// Dermed vet PingScore at "20" = 2-0.
// =====================================================

function parseSmartScore(text) {

  // Først prøver vi normal tale
  const normalScore =
    parseNormalScore(text);

  if (normalScore) {

    const possible =
      getPossibleScores();

    const valid =
      possible.some(score =>
        score.player1 === normalScore.player1 &&
        score.player2 === normalScore.player2
      );

    if (valid) {
      return normalScore;
    }
  }


  // Hvis iPhone har slått tallene sammen
  const cleaned =
    normalizeSpeech(text);

  const singleNumber =
    wordToNumber(cleaned);

  if (singleNumber === undefined) {
    return null;
  }

  const heardDigits =
    String(singleNumber);

  const possibleScores =
    getPossibleScores();


  for (const possible of possibleScores) {

    const combined =
      `${possible.player1}${possible.player2}`;

    if (combined === heardDigits) {

      return possible;
    }
  }

  return null;
}


// =====================================================
// SETT SCORE FRA STEMME
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
    possibleScores.some(score =>
      score.player1 === newScore1 &&
      score.player2 === newScore2
    );


  if (!valid) {

    status.textContent =
      `🤔 Hørte "${heardText}", men scoren passer ikke`;

    return;
  }


  // Samme score som før
  if (
    newScore1 === score1 &&
    newScore2 === score2
  ) {

    status.textContent =
      `👂 Hørte "${heardText}" – fortsatt ${score1}-${score2}`;

    return;
  }


  saveHistory();


  score1 = newScore1;
  score2 = newScore2;


  // Bekreftelse
  playScoreSound();
  flashScore();


  status.textContent =
    `👂 "${heardText}" → ✅ ${score1}-${score2}`;


  checkSetWinner();

  updateDisplay();
}


// =====================================================
// LYDBEKREFTELSE
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
      audioContext.state === "suspended"
    ) {

      audioContext.resume();
    }

  } catch (error) {

    console.log(
      "AudioContext kunne ikke startes:",
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
      audioContext.state === "suspended"
    ) {
      audioContext.resume();
    }


    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();


    oscillator.connect(gain);

    gain.connect(
      audioContext.destination
    );


    // Tone
    oscillator.frequency.value = 700;

    oscillator.type = "sine";


    // Volum
    gain.gain.setValueAtTime(
      0.12,
      audioContext.currentTime
    );


    // Fade raskt ut
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.08
    );


    oscillator.start();

    oscillator.stop(
      audioContext.currentTime + 0.08
    );

  } catch (error) {

    console.log(
      "Kunne ikke spille lyd:",
      error
    );
  }
}


// =====================================================
// VISUELT BLINK
// =====================================================

function flashScore() {

  const scoreboard =
    document.querySelector(".scoreboard");

  if (!scoreboard) {
    return;
  }


  scoreboard.classList.remove(
    "score-flash"
  );


  // Restart animasjonen
  void scoreboard.offsetWidth;


  scoreboard.classList.add(
    "score-flash"
  );
}


// =====================================================
// HOLD SKJERMEN VÅKEN
// =====================================================

async function keepScreenAwake() {

  if (!("wakeLock" in navigator)) {

    console.log(
      "Wake Lock støttes ikke på denne enheten"
    );

    return;
  }


  try {

    wakeLock =
      await navigator.wakeLock.request(
        "screen"
      );

    console.log(
      "🔆 Skjermen holdes våken"
    );

  } catch (error) {

    console.log(
      "Wake Lock kunne ikke aktiveres:",
      error
    );
  }
}


document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState === "visible" &&
      listening
    ) {

      keepScreenAwake();
    }
  }
);


// =====================================================
// TALEGJENKJENNING
// =====================================================

const SpeechRecognition =

  window.SpeechRecognition ||
  window.webkitSpeechRecognition;


if (!SpeechRecognition) {

  listenButton.disabled = true;

  status.textContent =
    "❌ Talegjenkjenning støttes ikke i denne nettleseren.";

} else {

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


  // -----------------------------------------
  // START
  // -----------------------------------------

  recognition.onstart =
    function () {

      listening = true;

      listenButton.textContent =
        "🟢 Lytter...";

      status.textContent =
        "Si scoren, f.eks. «tre to»";
    };


  // -----------------------------------------
  // RESULTAT
  // -----------------------------------------

  recognition.onresult =
    function (event) {

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


      // Prøv flere forslag
      // fra talegjenkjenningen

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
          `Alternativ ${i + 1}:`,
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


      console.log(
        "Valgt:",
        heardText
      );


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


  // -----------------------------------------
  // FEIL
  // -----------------------------------------

  recognition.onerror =
    function (event) {

      console.log(
        "Speech error:",
        event.error
      );


      if (
        event.error ===
        "not-allowed"
      ) {

        status.textContent =
          "❌ Mikrofontilgang mangler.";

        listening =
          false;

        listenButton.textContent =
          "🎙️ Start lytting";
      }


      else if (
        event.error ===
        "no-speech"
      ) {

        console.log(
          "Ingen tale registrert"
        );
      }


      else if (
        event.error ===
        "aborted"
      ) {

        console.log(
          "Talegjenkjenningen ble stoppet"
        );
      }


      else {

        status.textContent =
          `⚠️ Tale-feil: ${event.error}`;
      }
    };


  // -----------------------------------------
  // TALEGJENKJENNING STOPPET
  // -----------------------------------------

  recognition.onend =
    function () {

      // Safari stopper ofte
      // SpeechRecognition av seg selv.
      // Derfor starter vi den igjen.

      if (
        listening &&
        !matchFinished
      ) {

        setTimeout(() => {

          try {

            recognition.start();

          } catch (error) {

            console.log(
              "Kunne ikke starte lytting igjen:",
              error
            );
          }

        }, 250);

      } else {

        listenButton.textContent =
          matchFinished
            ? "🏆 Kamp ferdig"
            : "🎙️ Start lytting";
      }
    };


  // -----------------------------------------
  // START / STOPP KNAPP
  // -----------------------------------------

  listenButton.addEventListener(
    "click",
    async function () {

      // Denne brukerinteraksjonen
      // låser opp lyd på iPhone
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

        } catch (error) {

          console.log(
            "Kunne ikke starte:",
            error
          );
        }

      } else {

        listening =
          false;


        try {

          recognition.stop();

        } catch (error) {

          console.log(error);
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
// START
// =====================================================

updateDisplay();