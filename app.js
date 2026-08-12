// =====================================================
// PINGSCORE
// =====================================================

let score1 = 0;
let score2 = 0;

let sets1 = 0;
let sets2 = 0;

let history = [];

let listening = false;
let recognitionRunning = false;
let matchFinished = false;
let speakingScore = false;

let recognition = null;
let wakeLock = null;
let audioContext = null;


// =====================================================
// HTML-ELEMENTER
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
// SETTVINNER
// =====================================================

function getSetWinner() {
  const difference = Math.abs(score1 - score2);

  if (difference < 2) {
    return null;
  }

  if (score1 >= 11 && score1 > score2) {
    return 1;
  }

  if (score2 >= 11 && score2 > score1) {
    return 2;
  }

  return null;
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
  }, 150);
}


function endMatch(player) {
  matchFinished = true;
  listening = false;

  updateDisplay();

  status.textContent =
    `🏆 SPILLER ${player} VANT KAMPEN!`;

  if (recognition && recognitionRunning) {
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
    status.textContent =
      "Ingenting å angre.";
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

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  speakingScore = false;

  updateDisplay();

  status.textContent =
    "Ny kamp! Si stillingen.";

  if (listening) {
    listenButton.textContent =
      "🟢 Lytter...";
  } else {
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
// iPhone kan f.eks. høre:
// "to null" som "20"
//
// Hvis score er 1-0 vet PingScore:
//
// 2-0 = "20"
// 1-1 = "11"
//
// Derfor blir "20" tolket som 2-0.
// =====================================================

function parseSmartScore(text) {
  const normalScore =
    parseNormalScore(text);

  if (normalScore) {
    const possibleScores =
      getPossibleScores();

    const valid =
      possibleScores.some(score =>
        score.player1 === normalScore.player1 &&
        score.player2 === normalScore.player2
      );

    if (valid) {
      return normalScore;
    }
  }


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
    possibleScores.some(score =>
      score.player1 === newScore1 &&
      score.player2 === newScore2
    );


  if (!valid) {
    status.textContent =
      `🤔 Hørte "${heardText}", men scoren passer ikke`;

    return;
  }


  // Samme score som allerede står
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


  playScoreSound();
  flashScore();


  status.textContent =
    `👂 "${heardText}" → ✅ ${score1}-${score2}`;


  // Må sjekkes før scoren nullstilles
  const setWinner =
    getSetWinner();


  // Spiller 1 vinner sett 😈
  if (setWinner === 1) {
    speakScore(
      "Åååååh, uff! Kjipt ass!"
    );
  } else {
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

    if (audioContext.state === "suspended") {
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

    if (audioContext.state === "suspended") {
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


    oscillator.frequency.value = 700;

    oscillator.type = "sine";


    gain.gain.setValueAtTime(
      0.10,
      audioContext.currentTime
    );


    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.07
    );


    oscillator.start();


    oscillator.stop(
      audioContext.currentTime + 0.07
    );

  } catch (error) {
    console.log(
      "Kunne ikke spille lyd:",
      error
    );
  }
}


// =====================================================
// ROBUST RESTART AV MIKROFON
// =====================================================

function restartRecognition(attempt = 1) {
  if (
    !listening ||
    matchFinished ||
    speakingScore ||
    !recognition
  ) {
    return;
  }


  // Hvis mikrofonen allerede kjører,
  // trenger vi ikke starte på nytt.
  if (recognitionRunning) {
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

      console.log(
        `🎙️ Mikrofon restart forsøk ${attempt}`
      );

    } catch (error) {

      console.log(
        `Restart forsøk ${attempt} feilet:`,
        error
      );


      // Safari kan trenge litt ekstra tid.
      if (attempt < 3) {
        restartRecognition(
          attempt + 1
        );
      }

      else {
        status.textContent =
          "🎙️ Trykk Start lytting for å fortsette";

        listenButton.textContent =
          "🎙️ Start lytting";

        listening = false;
      }
    }

  }, delay);
}


// =====================================================
// SI SCOREN HØYT
// =====================================================

function speakScore(extraText = "") {
  if (!("speechSynthesis" in window)) {
    restartRecognition();
    return;
  }


  speakingScore = true;


  // Stopp mikrofonen mens telefonen snakker.
  // Ellers kan den høre sin egen stemme.
  if (recognition && recognitionRunning) {
    try {
      recognition.abort();
    } catch (error) {
      console.log(
        "Kunne ikke stoppe mikrofon:",
        error
      );
    }
  }


  window.speechSynthesis.cancel();


  let spokenScore =
    `${score1} til ${score2}`;


  if (extraText) {
    spokenScore +=
      `. ${extraText}`;
  }


  console.log(
    "🔊 Telefonen sier:",
    spokenScore
  );


  const utterance =
    new SpeechSynthesisUtterance(
      spokenScore
    );


  utterance.lang =
    "nb-NO";


  utterance.rate =
    1.20;


  utterance.pitch =
    1;


  utterance.volume =
    1;


  utterance.onstart =
    function () {

      console.log(
        "🔊 Opplesning startet"
      );
    };


  utterance.onend =
    function () {

      console.log(
        "🔊 Opplesning ferdig"
      );


      speakingScore =
        false;


      // Viktig iPhone-fix:
      // mikrofonen startes igjen etter
      // at stemmen er helt ferdig.
      restartRecognition();
    };


  utterance.onerror =
    function (event) {

      console.log(
        "Feil ved opplesning:",
        event
      );


      speakingScore =
        false;


      restartRecognition();
    };


  window.speechSynthesis.speak(
    utterance
  );
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


if (!SpeechRecognition) {

  listenButton.disabled = true;


  status.textContent =
    "❌ Talegjenkjenning støttes ikke i denne nettleseren.";

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
// MIKROFON STARTET
// =====================================================

  recognition.onstart =
    function () {

      recognitionRunning =
        true;


      listening =
        true;


      console.log(
        "🎙️ Mikrofon aktiv"
      );


      listenButton.textContent =
        "🟢 Lytter...";


      status.textContent =
        "Si scoren, f.eks. «tre to»";
    };


// =====================================================
// RESULTAT
// =====================================================

  recognition.onresult =
    function (event) {

      // Ikke registrer noe mens
      // telefonen leser opp scoren.
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


// =====================================================
// FEIL
// =====================================================

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


        recognitionRunning =
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

        // Dette skjer med vilje når
        // telefonen skal si scoren.
        console.log(
          "🎙️ Mikrofon midlertidig stoppet"
        );
      }


      else {

        console.log(
          "Annen tale-feil:",
          event.error
        );
      }
    };


// =====================================================
// MIKROFON STOPPET
// =====================================================

  recognition.onend =
    function () {

      recognitionRunning =
        false;


      console.log(
        "🎙️ Mikrofon avsluttet"
      );


      // Hvis telefonen leser opp score,
      // skal speakScore() håndtere restart.
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

        listenButton.textContent =
          matchFinished
            ? "🏆 Kamp ferdig"
            : "🎙️ Start lytting";
      }
    };


// =====================================================
// START / STOPP-KNAPP
// =====================================================

  listenButton.addEventListener(
    "click",
    async function () {

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

        } catch (error) {

          console.log(
            "Kunne ikke starte:",
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


        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }


        if (
          recognition &&
          recognitionRunning
        ) {

          try {

            recognition.stop();

          } catch (error) {

            console.log(error);
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
// START APP
// =====================================================

updateDisplay();