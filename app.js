// =====================================================
// PINGSCORE v12
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

// Når telefonen leser opp score,
// ignorerer vi mikrofonresultater.
let speakingScore = false;

// Litt ekstra tid etter opplesning slik at
// telefonen ikke registrerer ekko fra sin egen stemme.
let ignoreSpeechUntil = 0;

let recognition = null;
let wakeLock = null;
let audioContext = null;
let restartTimer = null;


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


  const player1Label =
    document.getElementById("player1Label");

  const player2Label =
    document.getElementById("player2Label");

  const scorePlayer1Name =
    document.getElementById("scorePlayer1Name");

  const scorePlayer2Name =
    document.getElementById("scorePlayer2Name");


  if (player1Label) {
    player1Label.textContent = player1Name;
  }

  if (player2Label) {
    player2Label.textContent = player2Name;
  }

  if (scorePlayer1Name) {
    scorePlayer1Name.textContent = player1Name;
  }

  if (scorePlayer2Name) {
    scorePlayer2Name.textContent = player2Name;
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
      Number(setsToWinSelect.value) || 5;

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

  const score1Element =
    document.getElementById("score1");

  const score2Element =
    document.getElementById("score2");

  const sets1Element =
    document.getElementById("sets1");

  const sets2Element =
    document.getElementById("sets2");


  if (score1Element) {
    score1Element.textContent = score1;
  }

  if (score2Element) {
    score2Element.textContent = score2;
  }

  if (sets1Element) {
    sets1Element.textContent = sets1;
  }

  if (sets2Element) {
    sets2Element.textContent = sets2;
  }


  updateSetHistory();
}


// =====================================================
// SETTHISTORIKK
// =====================================================

function updateSetHistory() {

  const container =
    document.getElementById("setHistory");

  if (!container) {
    return;
  }


  if (setHistory.length === 0) {

    container.innerHTML = `
      <span class="history-empty">
        Ingen sett ferdig ennå
      </span>
    `;

    return;
  }


  container.innerHTML = "";


  setHistory.forEach((set, index) => {

    const chip =
      document.createElement("div");

    chip.className =
      `set-chip winner-${set.winner}`;


    const winnerName =
      set.winner === 1
        ? player1Name
        : player2Name;


    chip.textContent =
      `${index + 1}. ${winnerName} ${set.score1}-${set.score2}`;


    container.appendChild(chip);
  });


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

  if (history.length === 0) {

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

  matchFinished = false;

  speakingScore = false;
  ignoreSpeechUntil = 0;


  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }


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
  } else {
    score2++;
  }


  handleAcceptedScore(
    "Manuelt poeng"
  );
}


// =====================================================
// FINN SETTVINNER
// =====================================================

function getSetWinner() {

  const difference =
    Math.abs(score1 - score2);


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

function handleAcceptedScore(heardText = "") {

  playScoreSound();

  flashScore();


  const setWinner =
    getSetWinner();


  if (heardText) {

    setStatus(
      `👂 "${heardText}" → ✅ ${score1}-${score2}`
    );
  }


  // Telefonen sier scoren FØR den eventuelt
  // nullstilles etter settslutt.
  if (setWinner === 1) {

    speakScore(
      "Ouuufffff! Kjipt ass!"
    );

  } else {

    speakScore();
  }


  checkSetWinner();

  updateDisplay();
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
  } else {
    sets2++;
  }


  score1 = 0;
  score2 = 0;


  updateDisplay();


  if (sets1 >= setsToWin) {

    endMatch(1);

    return;
  }


  if (sets2 >= setsToWin) {

    endMatch(2);

    return;
  }


  const winnerName =
    winner === 1
      ? player1Name
      : player2Name;


  setTimeout(() => {

    if (!matchFinished) {

      setStatus(
        `🏓 ${winnerName} vant settet!`
      );
    }

  }, 400);
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
    word.toLowerCase().trim();


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

    // Marius får poeng
    {
      player1: score1 + 1,
      player2: score2
    },

    // Petter får poeng
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


  for (const part of parts) {

    const number =
      wordToNumber(part);


    if (
      number !== undefined
    ) {

      numbers.push(number);
    }
  }


  if (numbers.length >= 2) {

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


  // Først vanlig:
  // "tre to"
  const normalScore =
    parseNormalScore(text);


  if (normalScore) {

    const valid =
      possibleScores.some(score =>

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


  // Deretter iPhone-varianter:
  //
  // "ett null" -> "10"
  // "to null" -> "20"
  // "sju tre" -> "73"

  const cleaned =
    normalizeSpeech(text);


  const singleNumber =
    wordToNumber(cleaned);


  if (
    singleNumber === undefined
  ) {
    return null;
  }


  const heardDigits =
    String(singleNumber);


  for (
    const possible
    of possibleScores
  ) {

    const combined =
      `${possible.player1}${possible.player2}`;


    if (
      combined === heardDigits
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
    possibleScores.some(score =>

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


  // Samme score som allerede står
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

    console.log(
      "AudioContext:",
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
      audioContext.createOscillator();


    const gain =
      audioContext.createGain();


    oscillator.connect(gain);

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

    console.log(
      "Pip:",
      error
    );
  }
}


// =====================================================
// TELEFONEN SIER SCOREN
// =====================================================
//
// VIKTIG ENDRING I v12:
//
// Vi stopper IKKE mikrofonen her.
//
// I stedet fortsetter SpeechRecognition,
// men recognition.onresult ignorerer alt
// mens speakingScore === true.
//
// Dette bør være mye mer stabilt på iPhone.
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


  speakingScore = true;


  window
    .speechSynthesis
    .cancel();


  let spokenScore =
    `${score1} til ${score2}`;


  if (extraText) {

    spokenScore +=
      `. ${extraText}`;
  }


  console.log(
    "🔊 Sier:",
    spokenScore
  );


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


  utterance.onstart =
    () => {

      speakingScore =
        true;
    };


  utterance.onend =
    () => {

      speakingScore =
        false;


      // Ignorer eventuelt ekko
      // i 700 ms etter opplesning.
      ignoreSpeechUntil =
        Date.now() + 700;


      // Hvis Safari avsluttet mikrofonen
      // av seg selv under opplesningen,
      // prøver vi å starte igjen.
      if (
        listening &&
        !recognitionRunning &&
        !matchFinished
      ) {

        restartRecognition();
      }
    };


  utterance.onerror =
    event => {

      console.log(
        "TTS-feil:",
        event
      );


      speakingScore =
        false;


      ignoreSpeechUntil =
        Date.now() + 500;


      if (
        listening &&
        !recognitionRunning &&
        !matchFinished
      ) {

        restartRecognition();
      }
    };


  window
    .speechSynthesis
    .speak(
      utterance
    );
}


// =====================================================
// SCORE-BLINK
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

    console.log(
      "Wake Lock:",
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


function restartRecognition(
  attempt = 1
) {

  if (
    !listening ||
    matchFinished ||
    recognitionRunning ||
    !recognition
  ) {

    return;
  }


  clearRestartTimer();


  const delay =
    attempt === 1
      ? 600
      : 1000;


  restartTimer =
    setTimeout(() => {

      restartTimer =
        null;


      if (
        !listening ||
        matchFinished ||
        recognitionRunning
      ) {
        return;
      }


      try {

        recognition.start();

        console.log(
          "🎙️ Restartet"
        );

      }

      catch (error) {

        console.log(
          `Restart ${attempt}:`,
          error
        );


        if (attempt < 3) {

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
            "🎙️ Trykk Start lytting"
          );
        }
      }

    }, delay);
}


// =====================================================
// OPPSETT TALEGJENKJENNING
// =====================================================

if (
  !listenButton ||
  !status
) {

  console.error(
    "PingScore mangler nødvendige HTML-elementer."
  );

}

else if (
  !SpeechRecognition
) {

  listenButton.disabled =
    true;


  setStatus(
    "❌ Talegjenkjenning støttes ikke."
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
        "Si scoren"
      );


      console.log(
        "🎙️ Mikrofon aktiv"
      );
    };


// =====================================================
// RESULTAT
// =====================================================

  recognition.onresult =
    event => {

      // VIKTIG:
      // Ignorer telefonens egen stemme.
      if (speakingScore) {

        console.log(
          "🔇 Ignorerer mens telefonen snakker"
        );

        return;
      }


      // Ignorer litt ekko rett etterpå.
      if (
        Date.now() <
        ignoreSpeechUntil
      ) {

        console.log(
          "🔇 Ignorerer ekko"
        );

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
          `👂 Alt ${i + 1}:`,
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
        "🎙️ Speech error:",
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


      if (
        event.error !==
        "no-speech"
      ) {

        console.log(
          "SpeechRecognition:",
          event.error
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
        "🎙️ Mikrofonøkten sluttet"
      );


      if (
        listening &&
        !matchFinished
      ) {

        // Hvis telefonen fortsatt snakker,
        // venter speakScore() med restart.
        if (!speakingScore) {

          restartRecognition();
        }

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
// KNAPP
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
            "Start:",
            error
          );


          restartRecognition();
        }
      }


      // STOPP
      else {

        listening =
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


        speakingScore =
          false;


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
// TILBAKE FRA BAKGRUNN
// =====================================================

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


      if (
        !recognitionRunning &&
        !speakingScore
      ) {

        restartRecognition();
      }
    }
  }
);


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