// =====================================================
// PINGSCORE v17
// =====================================================

let score1 = 0;
let score2 = 0;
let sets1 = 0;
let sets2 = 0;

let player1Name = "Marius";
let player2Name = "Petter";
let setsToWin = 5;
let startingServer = 1;
let pendingSetsToWin = 5;

let setHistory = [];
let history = [];
let matchHistory = [];
let currentMatchHistoryId = null;
let matchStartTime = null;
let lastCompletedMatch = null;

let listening = false;
let recognitionRunning = false;
let speakingScore = false;
let ignoreSpeechUntil = 0;
let matchFinished = false;

let recognition = null;
let restartTimer = null;
let wakeLock = null;
let audioContext = null;

const listenButton = document.getElementById("listenButton");
const status = document.getElementById("status");
const player1NameInput = document.getElementById("player1NameInput");
const player2NameInput = document.getElementById("player2NameInput");
const setsToWinSelect = document.getElementById("setsToWin");
const startingServerSelect = document.getElementById("startingServer");

const homeScreen = document.getElementById("homeScreen");
const matchScreen = document.getElementById("matchScreen");
const activeMatchCard = document.getElementById("activeMatchCard");
const homeActiveMatchScore = document.getElementById("homeActiveMatchScore");
const homeActiveMatchMeta = document.getElementById("homeActiveMatchMeta");
const startMatchButton = document.getElementById("startMatchButton");
const matchSetup = document.getElementById("matchSetup");
const setupStep1 = document.getElementById("setupStep1");
const setupStep2 = document.getElementById("setupStep2");
const setupProgress = document.getElementById("setupProgress");

function setStatus(text) {
  if (status) status.textContent = text;
}

function setListenButton(text) {
  if (listenButton) listenButton.textContent = text;
}

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function formatDuration(ms) {
  if (!ms || ms < 0) return "Tid ikke registrert";
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${totalMinutes} min`;
  if (minutes === 0) return `${hours} t`;
  return `${hours} t ${minutes} min`;
}

function updateNames() {
  player1Name = player1NameInput?.value.trim() || "Marius";
  player2Name = player2NameInput?.value.trim() || "Petter";

  const map = {
    player1Label: player1Name,
    player2Label: player2Name,
    scorePlayer1Name: player1Name,
    scorePlayer2Name: player2Name,
    historyPlayer1Name: player1Name,
    historyPlayer2Name: player2Name,
    h2hPlayer1Name: player1Name,
    h2hPlayer2Name: player2Name,
    setupServer1Name: player1Name,
    setupServer2Name: player2Name
  };

  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  if (startingServerSelect) {
    const option1 = startingServerSelect.querySelector('option[value="1"]');
    const option2 = startingServerSelect.querySelector('option[value="2"]');
    if (option1) option1.textContent = player1Name;
    if (option2) option2.textContent = player2Name;
  }

  localStorage.setItem("pingscore-player1", player1Name);
  localStorage.setItem("pingscore-player2", player2Name);
  saveCurrentGame();
  updateServerIndicator();
}

player1NameInput?.addEventListener("input", updateNames);
player2NameInput?.addEventListener("input", updateNames);

setsToWinSelect?.addEventListener("change", () => {
  setsToWin = Number(setsToWinSelect.value) || 5;
  localStorage.setItem("pingscore-sets-to-win", String(setsToWin));
  saveCurrentGame();
});

startingServerSelect?.addEventListener("change", () => {
  startingServer = Number(startingServerSelect.value) === 2 ? 2 : 1;
  localStorage.setItem("pingscore-starting-server", String(startingServer));
  saveCurrentGame();
  updateServerIndicator();
});


function hasActiveMatch() {
  return (
    !matchFinished &&
    Boolean(
      matchStartTime ||
      score1 ||
      score2 ||
      sets1 ||
      sets2 ||
      setHistory.length
    )
  );
}

function updateHomeScreen() {
  const active = hasActiveMatch();

  activeMatchCard?.classList.toggle("hidden", !active);

  if (homeActiveMatchScore) {
    homeActiveMatchScore.textContent =
      `${player1Name} ${sets1}–${sets2} ${player2Name}`;
  }

  if (homeActiveMatchMeta) {
    homeActiveMatchMeta.textContent =
      `Poeng ${score1}–${score2} · Først til ${setsToWin}`;
  }

  if (startMatchButton) {
    startMatchButton.textContent =
      active ? "＋ Start ny kamp" : "🏓 Start kamp";
  }

  const target = document.getElementById("liveMatchTarget");
  if (target) {
    target.textContent = `Først til ${setsToWin} sett`;
  }
}

function stopVoiceForNavigation() {
  listening = false;
  clearRestartTimer();

  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }

  speakingScore = false;

  if (recognition && recognitionRunning) {
    try {
      recognition.stop();
    } catch (error) {
      console.log(error);
    }
  }

  setListenButton("🎙️ Start lytting");
}

function showHomeScreen() {
  stopVoiceForNavigation();

  homeScreen?.classList.remove("hidden");
  matchScreen?.classList.add("hidden");

  updateHomeScreen();
}

function showMatchScreen() {
  homeScreen?.classList.add("hidden");
  matchScreen?.classList.remove("hidden");

  updateDisplay();
}

function continueMatch() {
  if (hasActiveMatch()) {
    showMatchScreen();
  } else {
    openMatchSetup();
  }
}

function setSetupStep(step) {
  const first = step === 1;

  setupStep1?.classList.toggle("hidden", !first);
  setupStep2?.classList.toggle("hidden", first);

  if (setupProgress) {
    setupProgress.textContent = first ? "1 av 2" : "2 av 2";
  }
}

function openMatchSetup() {
  if (hasActiveMatch()) {
    const confirmed = confirm(
      "Du har en pågående kamp. Starter du en ny kamp, nullstilles den pågående kampen. Ferdige kamper i historikken beholdes."
    );

    if (!confirmed) return;
  }

  pendingSetsToWin = setsToWin || 5;
  setSetupStep(1);
  matchSetup?.classList.remove("hidden");
}

function closeMatchSetup() {
  matchSetup?.classList.add("hidden");
}

function chooseSetTarget(value) {
  pendingSetsToWin = [3, 4, 5].includes(Number(value))
    ? Number(value)
    : 5;

  setSetupStep(2);
}

function setupBack() {
  setSetupStep(1);
}

function startConfiguredMatch(server) {
  closeWinnerPopup();
  stopVoiceForNavigation();

  setsToWin = pendingSetsToWin;
  startingServer = Number(server) === 2 ? 2 : 1;

  score1 = 0;
  score2 = 0;
  sets1 = 0;
  sets2 = 0;

  setHistory = [];
  history = [];

  matchFinished = false;
  currentMatchHistoryId = null;
  lastCompletedMatch = null;

  // Nå starter kampklokken når dere faktisk trykker Start kamp.
  matchStartTime = Date.now();

  localStorage.setItem("pingscore-sets-to-win", String(setsToWin));
  localStorage.setItem("pingscore-starting-server", String(startingServer));

  if (setsToWinSelect) {
    setsToWinSelect.value = String(setsToWin);
  }

  if (startingServerSelect) {
    startingServerSelect.value = String(startingServer);
  }

  closeMatchSetup();
  updateDisplay();
  showMatchScreen();

  const serverName = startingServer === 1 ? player1Name : player2Name;
  setStatus(`🏓 ${serverName} server først`);
  setListenButton("🎙️ Start lytting");
}

function ensureMatchStarted() {
  if (!matchStartTime) {
    matchStartTime = Date.now();
    saveCurrentGame();
  }
}

function getCurrentSetStartingServer() {
  const completedSets = setHistory.length;
  if (completedSets % 2 === 0) return startingServer;
  return startingServer === 1 ? 2 : 1;
}

function getCurrentServer() {
  const setStartServer = getCurrentSetStartingServer();
  const totalPoints = score1 + score2;
  const switchCount = totalPoints < 20
    ? Math.floor(totalPoints / 2)
    : 10 + (totalPoints - 20);

  if (switchCount % 2 === 0) return setStartServer;
  return setStartServer === 1 ? 2 : 1;
}

function updateServerIndicator() {
  const server1 = document.getElementById("server1");
  const server2 = document.getElementById("server2");
  const currentServer = getCurrentServer();

  server1?.classList.toggle("active", currentServer === 1 && !matchFinished);
  server2?.classList.toggle("active", currentServer === 2 && !matchFinished);

  const serveBanner = document.getElementById("serveBanner");
  if (serveBanner) {
    const serverName = currentServer === 1 ? player1Name : player2Name;
    serveBanner.textContent = matchFinished
      ? "🏁 Kamp ferdig"
      : `🏓 ${serverName} server`;
  }

  if (startingServerSelect) {
    const matchHasStarted = Boolean(matchStartTime || score1 || score2 || setHistory.length);
    startingServerSelect.disabled = matchHasStarted;
  }
}

function saveCurrentGame() {
  const gameState = {
    score1,
    score2,
    sets1,
    sets2,
    player1Name,
    player2Name,
    setsToWin,
    startingServer,
    setHistory,
    matchFinished,
    currentMatchHistoryId,
    matchStartTime
  };

  localStorage.setItem("pingscore-current-game", JSON.stringify(gameState));
}

function loadCurrentGame() {
  const saved = localStorage.getItem("pingscore-current-game");
  if (!saved) return;

  try {
    const game = JSON.parse(saved);
    score1 = game.score1 ?? 0;
    score2 = game.score2 ?? 0;
    sets1 = game.sets1 ?? 0;
    sets2 = game.sets2 ?? 0;
    player1Name = game.player1Name || "Marius";
    player2Name = game.player2Name || "Petter";
    setsToWin = game.setsToWin ?? 5;
    startingServer = game.startingServer === 2 ? 2 : 1;
    setHistory = Array.isArray(game.setHistory) ? game.setHistory : [];
    matchFinished = Boolean(game.matchFinished);
    currentMatchHistoryId = game.currentMatchHistoryId || null;
    matchStartTime = game.matchStartTime || null;
  } catch (error) {
    console.log("Kunne ikke laste kamp:", error);
  }
}

function loadMatchHistory() {
  const saved = localStorage.getItem("pingscore-match-history");
  if (!saved) {
    matchHistory = [];
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    matchHistory = Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    matchHistory = [];
    console.log("Kunne ikke laste kamphistorikk:", error);
  }
}

function saveMatchHistory() {
  localStorage.setItem("pingscore-match-history", JSON.stringify(matchHistory));
}

function updateDisplay() {
  const ids = {
    score1,
    score2,
    sets1,
    sets2
  };

  Object.entries(ids).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  updateSetHistory();
  updateServerIndicator();
  updateHomeScreen();
  saveCurrentGame();
}

function updateSetHistory() {
  const container = document.getElementById("setHistory");
  if (!container) return;

  if (setHistory.length === 0) {
    container.innerHTML = '<span class="history-empty">Ingen sett ferdig ennå</span>';
    return;
  }

  container.innerHTML = "";
  setHistory.forEach((set, index) => {
    const chip = document.createElement("div");
    chip.className = `set-chip winner-${set.winner}`;
    const winnerName = set.winner === 1 ? player1Name : player2Name;
    chip.textContent = `${index + 1}. ${winnerName} ${set.score1}-${set.score2}`;
    container.appendChild(chip);
  });
  container.scrollLeft = container.scrollWidth;
}

function saveHistory() {
  history.push({
    score1,
    score2,
    sets1,
    sets2,
    setHistory: setHistory.map(set => ({ ...set })),
    matchFinished,
    matchStartTime
  });
}

function addPoint(player) {
  if (matchFinished) return;
  ensureMatchStarted();
  saveHistory();

  if (player === 1) score1++;
  else score2++;

  handleAcceptedScore("");
}

function getSetWinner() {
  const difference = Math.abs(score1 - score2);

  if (score1 >= 11 && difference >= 2 && score1 > score2) return 1;
  if (score2 >= 11 && difference >= 2 && score2 > score1) return 2;
  return null;
}

function handleAcceptedScore(heardText = "") {
  playScoreSound();
  flashScore();

  const setWinner = getSetWinner();

  if (heardText) {
    setStatus(`👂 "${heardText}" → ✅ ${score1}-${score2}`);
  }

  if (setWinner === 1) speakScore("Ouuufffff! Kjipt ass!");
  else speakScore();

  checkSetWinner();
  updateDisplay();
}

function checkSetWinner() {
  const winner = getSetWinner();
  if (!winner) return;

  const finalScore1 = score1;
  const finalScore2 = score2;

  setHistory.push({ winner, score1: finalScore1, score2: finalScore2 });

  if (winner === 1) sets1++;
  else sets2++;

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

  const winnerName = winner === 1 ? player1Name : player2Name;
  setTimeout(() => {
    if (!matchFinished) setStatus(`🏓 ${winnerName} vant settet!`);
  }, 350);
}

function endMatch(player) {
  if (matchFinished) return;

  matchFinished = true;

  const winnerName =
    player === 1
      ? player1Name
      : player2Name;

  const now = Date.now();

  const durationMs =
    matchStartTime
      ? now - matchStartTime
      : null;

  const matchId =
    `${now}-${Math.random().toString(36).slice(2, 8)}`;

  currentMatchHistoryId = matchId;

  const completedMatch = {
    id: matchId,
    timestamp: now,
    startTimestamp: matchStartTime,
    durationMs,

    player1: player1Name,
    player2: player2Name,

    winner: winnerName,
    winnerSide: player,

    sets1,
    sets2,
    setsToWin,
    startingServer,

    sets: setHistory.map(set => ({ ...set }))
  };

  lastCompletedMatch = completedMatch;

  matchHistory.push(completedMatch);

  saveMatchHistory();
  saveCurrentGame();

  renderMatchHistory();
  renderHeadToHead();
  updateHomeScreen();

  setStatus(
    `🏆 ${winnerName.toUpperCase()} VANT KAMPEN! · ${formatDuration(durationMs)}`
  );

  listening = false;
  clearRestartTimer();

  if (recognition && recognitionRunning) {
    try {
      recognition.stop();
    } catch (error) {
      console.log(error);
    }
  }

  setListenButton("🏆 Kamp ferdig");
  updateServerIndicator();

  // Litt forsinkelse gjør at siste poeng/settskifte rekker å vises
  // før vinnerkortet kommer opp.
  setTimeout(() => {
    showWinnerPopup(completedMatch);
  }, 450);
}

function undo() {
  closeWinnerPopup();

  if (history.length === 0) {
    setStatus("Ingenting å angre.");
    return;
  }

  if (matchFinished && currentMatchHistoryId) {
    matchHistory = matchHistory.filter(match => match.id !== currentMatchHistoryId);
    saveMatchHistory();
    currentMatchHistoryId = null;
    lastCompletedMatch = null;
  }

  const previous = history.pop();
  score1 = previous.score1;
  score2 = previous.score2;
  sets1 = previous.sets1;
  sets2 = previous.sets2;
  setHistory = previous.setHistory.map(set => ({ ...set }));
  matchFinished = previous.matchFinished;
  matchStartTime = previous.matchStartTime || matchStartTime;

  updateDisplay();
  renderMatchHistory();
  renderHeadToHead();
  setStatus(`↶ Tilbake til ${score1}-${score2}`);
  setListenButton("🎙️ Start lytting");
}

function resetGame() {
  closeWinnerPopup();

  score1 = 0;
  score2 = 0;
  sets1 = 0;
  sets2 = 0;
  setHistory = [];
  history = [];
  matchFinished = false;
  currentMatchHistoryId = null;
  matchStartTime = null;
  lastCompletedMatch = null;
  speakingScore = false;
  ignoreSpeechUntil = 0;

  if ("speechSynthesis" in window) window.speechSynthesis.cancel();

  updateDisplay();
  setStatus("Ny kamp!");
  setListenButton(listening ? "🟢 Lytter..." : "🎙️ Start lytting");
  updateHomeScreen();
}

function openHistory() {
  renderMatchHistory();
  document.getElementById("historyScreen")?.classList.remove("hidden");
}

function closeHistory() {
  document.getElementById("historyScreen")?.classList.add("hidden");
}

function openHeadToHead() {
  renderHeadToHead();
  document.getElementById("h2hScreen")?.classList.remove("hidden");
}

function closeHeadToHead() {
  document.getElementById("h2hScreen")?.classList.add("hidden");
}


function showWinnerPopup(matchData) {
  const popup = document.getElementById("winnerPopup");
  const name = document.getElementById("winnerNamePopup");
  const score = document.getElementById("winnerScorePopup");
  const duration = document.getElementById("winnerDurationPopup");

  if (!popup || !name || !score || !duration || !matchData) return;

  name.textContent = String(matchData.winner || "").toUpperCase();
  score.textContent = `${matchData.sets1}–${matchData.sets2} i sett`;
  duration.textContent = `⏱ ${formatDuration(matchData.durationMs)}`;

  popup.classList.remove("hidden");
}

function closeWinnerPopup() {
  document.getElementById("winnerPopup")?.classList.add("hidden");
}

function rematchFromPopup() {
  closeWinnerPopup();

  // Samme kampformat, men den andre spilleren får første serve.
  const nextServer = startingServer === 1 ? 2 : 1;
  startConfiguredRematch(nextServer);
}

function startConfiguredRematch(server) {
  stopVoiceForNavigation();

  startingServer = Number(server) === 2 ? 2 : 1;

  score1 = 0;
  score2 = 0;
  sets1 = 0;
  sets2 = 0;

  setHistory = [];
  history = [];

  matchFinished = false;
  currentMatchHistoryId = null;
  lastCompletedMatch = null;

  // Rematch starter med en gang knappen trykkes.
  matchStartTime = Date.now();

  localStorage.setItem(
    "pingscore-sets-to-win",
    String(setsToWin)
  );

  localStorage.setItem(
    "pingscore-starting-server",
    String(startingServer)
  );

  if (setsToWinSelect) {
    setsToWinSelect.value = String(setsToWin);
  }

  if (startingServerSelect) {
    startingServerSelect.value = String(startingServer);
  }

  updateDisplay();
  showMatchScreen();

  const serverName =
    startingServer === 1
      ? player1Name
      : player2Name;

  setStatus(`🔁 Rematch – ${serverName} server først`);
  setListenButton("🎙️ Start lytting");
}

function samePlayerPair(match) {
  const current1 = normalizeName(player1Name);
  const current2 = normalizeName(player2Name);
  const match1 = normalizeName(match.player1);
  const match2 = normalizeName(match.player2);

  return (
    (current1 === match1 && current2 === match2) ||
    (current1 === match2 && current2 === match1)
  );
}

function getMatchPerspective(match) {
  const current1 = normalizeName(player1Name);
  const match1 = normalizeName(match.player1);
  const direct = current1 === match1;

  return {
    sets1: direct ? match.sets1 : match.sets2,
    sets2: direct ? match.sets2 : match.sets1,
    winnerSide: normalizeName(match.winner) === normalizeName(player1Name) ? 1 : 2
  };
}

function getRelevantMatches() {
  return matchHistory.filter(samePlayerPair);
}

function renderMatchHistory() {
  const historyPlayer1 = document.getElementById("historyPlayer1Name");
  const historyPlayer2 = document.getElementById("historyPlayer2Name");
  const wins1Element = document.getElementById("overallWins1");
  const wins2Element = document.getElementById("overallWins2");
  const list = document.getElementById("matchHistoryList");

  if (!list) return;
  if (historyPlayer1) historyPlayer1.textContent = player1Name;
  if (historyPlayer2) historyPlayer2.textContent = player2Name;

  const relevantMatches = getRelevantMatches();
  let wins1 = 0;
  let wins2 = 0;

  relevantMatches.forEach(match => {
    const perspective = getMatchPerspective(match);
    if (perspective.winnerSide === 1) wins1++;
    else wins2++;
  });

  if (wins1Element) wins1Element.textContent = wins1;
  if (wins2Element) wins2Element.textContent = wins2;

  list.innerHTML = "";

  if (relevantMatches.length === 0) {
    list.innerHTML = '<div class="no-matches">Ingen kamper lagret ennå 🏓</div>';
    return;
  }

  [...relevantMatches]
    .sort((a, b) => b.timestamp - a.timestamp)
    .forEach(match => {
      const date = new Date(match.timestamp);
      const dateText = date.toLocaleDateString("nb-NO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
      const timeText = date.toLocaleTimeString("nb-NO", {
        hour: "2-digit",
        minute: "2-digit"
      });
      const perspective = getMatchPerspective(match);
      const setsText = Array.isArray(match.sets)
        ? match.sets.map(set => `${set.score1}-${set.score2}`).join(" · ")
        : "";
      const winnerName = perspective.winnerSide === 1 ? player1Name : player2Name;

      const card = document.createElement("div");
      card.className = "match-card";
      card.innerHTML = `
        <div class="match-top">
          <span>${dateText} · ${timeText}</span>
          <span>⏱ ${formatDuration(match.durationMs)}</span>
        </div>
        <div class="match-result">
          <span>${player1Name}</span>
          <span class="match-result-score">${perspective.sets1}–${perspective.sets2}</span>
          <span>${player2Name}</span>
        </div>
        <div class="match-winner">🏆 ${winnerName}</div>
        <div class="match-sets">${setsText || "Ingen settdetaljer"}</div>
      `;
      list.appendChild(card);
    });
}

function renderHeadToHead() {
  const relevantMatches = [...getRelevantMatches()].sort((a, b) => b.timestamp - a.timestamp);

  let wins1 = 0;
  let wins2 = 0;
  let totalSets1 = 0;
  let totalSets2 = 0;
  const durations = [];

  relevantMatches.forEach(match => {
    const p = getMatchPerspective(match);
    if (p.winnerSide === 1) wins1++;
    else wins2++;
    totalSets1 += Number(p.sets1 || 0);
    totalSets2 += Number(p.sets2 || 0);
    if (match.durationMs > 0) durations.push(match.durationMs);
  });

  const totalMatches = wins1 + wins2;
  const rate1 = totalMatches ? Math.round((wins1 / totalMatches) * 100) : 0;
  const rate2 = totalMatches ? Math.round((wins2 / totalMatches) * 100) : 0;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText("h2hPlayer1Name", player1Name);
  setText("h2hPlayer2Name", player2Name);
  setText("h2hWins1", wins1);
  setText("h2hWins2", wins2);
  setText("h2hRate1", `${rate1}%`);
  setText("h2hRate2", `${rate2}%`);
  setText("h2hSets1", totalSets1);
  setText("h2hSets2", totalSets2);

  const avgDuration = durations.length
    ? durations.reduce((sum, ms) => sum + ms, 0) / durations.length
    : null;
  setText("h2hAverageDuration", avgDuration ? formatDuration(avgDuration) : "–");

  let streakText = "Ingen kamper ennå";
  if (relevantMatches.length) {
    const firstWinner = getMatchPerspective(relevantMatches[0]).winnerSide;
    let streak = 0;
    for (const match of relevantMatches) {
      if (getMatchPerspective(match).winnerSide === firstWinner) streak++;
      else break;
    }
    const streakName = firstWinner === 1 ? player1Name : player2Name;
    streakText = `${streakName}: ${streak} på rad 🔥`;
  }
  setText("h2hStreak", streakText);

  const form = document.getElementById("h2hForm");
  if (form) {
    form.innerHTML = "";
    if (!relevantMatches.length) {
      form.textContent = "–";
    } else {
      relevantMatches.slice(0, 10).reverse().forEach(match => {
        const p = getMatchPerspective(match);
        const badge = document.createElement("span");
        badge.className = `form-badge ${p.winnerSide === 1 ? "win" : "loss"}`;
        badge.textContent = p.winnerSide === 1 ? "W" : "L";
        form.appendChild(badge);
      });
    }
  }
}

function clearAllHistory() {
  closeWinnerPopup();

  const confirmed = confirm(
    `Er du sikker? Dette sletter all lagret historikk mellom ${player1Name} og ${player2Name} og nullstiller den aktive kampen.`
  );
  if (!confirmed) return;

  matchHistory = [];
  score1 = 0;
  score2 = 0;
  sets1 = 0;
  sets2 = 0;
  setHistory = [];
  history = [];
  matchFinished = false;
  currentMatchHistoryId = null;
  matchStartTime = null;
  lastCompletedMatch = null;

  localStorage.removeItem("pingscore-match-history");
  localStorage.removeItem("pingscore-current-game");

  updateDisplay();
  renderMatchHistory();
  renderHeadToHead();
  setStatus("Historikken er nullstilt 🏓");
  setListenButton("🎙️ Start lytting");
  updateHomeScreen();
}

// =====================================================
// STEMME / SCORE-TOLKING
// =====================================================

const numberWords = {
  null: 0,
  zero: 0,
  en: 1,
  "én": 1,
  ett: 1,
  to: 2,
  tre: 3,
  fire: 4,
  fem: 5,
  seks: 6,
  sju: 7,
  syv: 7,
  "åtte": 8,
  ni: 9,
  ti: 10,
  elleve: 11,
  tolv: 12,
  tretten: 13,
  fjorten: 14,
  femten: 15,
  seksten: 16,
  sytten: 17,
  atten: 18,
  nitten: 19,
  tjue: 20
};

function wordToNumber(word) {
  const cleaned = word.toLowerCase().trim();
  if (numberWords[cleaned] !== undefined) return numberWords[cleaned];
  if (cleaned !== "" && !isNaN(cleaned)) return Number(cleaned);
  return undefined;
}

function getPossibleScores() {
  return [
    { player1: score1 + 1, player2: score2 },
    { player1: score1, player2: score2 + 1 },
    { player1: score1, player2: score2 }
  ];
}

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

function parseNormalScore(text) {
  const parts = normalizeSpeech(text).split(" ");
  const numbers = [];

  for (const part of parts) {
    const number = wordToNumber(part);
    if (number !== undefined) numbers.push(number);
  }

  if (numbers.length >= 2) {
    return { player1: numbers[0], player2: numbers[1] };
  }
  return null;
}

function parseSmartScore(text) {
  const possibleScores = getPossibleScores();
  const normalScore = parseNormalScore(text);

  if (normalScore) {
    const valid = possibleScores.some(
      score => score.player1 === normalScore.player1 && score.player2 === normalScore.player2
    );
    if (valid) return normalScore;
  }

  const cleaned = normalizeSpeech(text);
  const singleNumber = wordToNumber(cleaned);
  if (singleNumber === undefined) return null;

  const heardDigits = String(singleNumber);
  for (const possible of possibleScores) {
    if (`${possible.player1}${possible.player2}` === heardDigits) return possible;
  }

  return null;
}

function setScoreFromVoice(newScore1, newScore2, heardText) {
  if (matchFinished) return;

  const valid = getPossibleScores().some(
    score => score.player1 === newScore1 && score.player2 === newScore2
  );

  if (!valid) {
    setStatus(`🤔 Hørte "${heardText}"`);
    return;
  }

  if (newScore1 === score1 && newScore2 === score2) return;

  ensureMatchStarted();
  saveHistory();
  score1 = newScore1;
  score2 = newScore2;
  handleAcceptedScore(heardText);
}

function setupAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioContext) audioContext = new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume();
  } catch (error) {
    console.log(error);
  }
}

function playScoreSound() {
  try {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.frequency.value = 700;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.07, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.05);
  } catch (error) {
    console.log(error);
  }
}

function speakScore(extraText = "") {
  if (!("speechSynthesis" in window)) return;

  speakingScore = true;
  window.speechSynthesis.cancel();

  let spokenScore = `${score1} til ${score2}`;
  if (extraText) spokenScore += `. ${extraText}`;

  const utterance = new SpeechSynthesisUtterance(spokenScore);
  utterance.lang = "nb-NO";
  utterance.rate = 1.2;
  utterance.volume = 1;

  utterance.onend = () => {
    speakingScore = false;
    ignoreSpeechUntil = Date.now() + 700;
    if (listening && !recognitionRunning && !matchFinished) restartRecognition();
  };

  utterance.onerror = () => {
    speakingScore = false;
    ignoreSpeechUntil = Date.now() + 500;
  };

  window.speechSynthesis.speak(utterance);
}

function flashScore() {
  const scoreboard = document.querySelector(".scoreboard");
  if (!scoreboard) return;
  scoreboard.classList.remove("score-flash");
  void scoreboard.offsetWidth;
  scoreboard.classList.add("score-flash");
}

async function keepScreenAwake() {
  if (!("wakeLock" in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch (error) {
    console.log(error);
  }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

function clearRestartTimer() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
}

function restartRecognition() {
  if (!listening || matchFinished || recognitionRunning || !recognition) return;

  clearRestartTimer();
  restartTimer = setTimeout(() => {
    try {
      recognition.start();
    } catch (error) {
      console.log(error);
    }
  }, 700);
}

if (SpeechRecognition && listenButton) {
  recognition = new SpeechRecognition();
  recognition.lang = "nb-NO";
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 5;

  recognition.onstart = () => {
    recognitionRunning = true;
    listening = true;
    setListenButton("🟢 Lytter...");
    setStatus("Si scoren");
  };

  recognition.onresult = event => {
    if (speakingScore || Date.now() < ignoreSpeechUntil) return;

    const lastResult = event.results[event.results.length - 1];
    let heardText = lastResult[0].transcript.trim();
    let foundScore = null;

    for (let i = 0; i < lastResult.length; i++) {
      const transcript = lastResult[i].transcript.trim();
      const parsed = parseSmartScore(transcript);
      if (parsed) {
        foundScore = parsed;
        heardText = transcript;
        break;
      }
    }

    if (!foundScore) {
      setStatus(`🤔 Hørte "${heardText}"`);
      return;
    }

    setScoreFromVoice(foundScore.player1, foundScore.player2, heardText);
  };

  recognition.onerror = event => {
    if (event.error === "not-allowed") {
      listening = false;
      recognitionRunning = false;
      setStatus("❌ Mikrofontilgang mangler");
      setListenButton("🎙️ Start lytting");
    }
  };

  recognition.onend = () => {
    recognitionRunning = false;
    if (listening && !matchFinished && !speakingScore) restartRecognition();
  };

  listenButton.addEventListener("click", async () => {
    setupAudio();

    if (!listening) {
      if (matchFinished) return;
      listening = true;
      await keepScreenAwake();
      try {
        recognition.start();
      } catch (error) {
        restartRecognition();
      }
    } else {
      listening = false;
      clearRestartTimer();
      if (recognitionRunning) {
        try { recognition.stop(); } catch (error) { console.log(error); }
      }
      setListenButton("🎙️ Start lytting");
      setStatus("Lytting stoppet.");
    }
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && listening) {
    keepScreenAwake();
    if (!recognitionRunning && !speakingScore) restartRecognition();
  }
});

// =====================================================
// LAST INN ALT
// =====================================================

loadMatchHistory();
loadCurrentGame();

const storedPlayer1 = localStorage.getItem("pingscore-player1");
const storedPlayer2 = localStorage.getItem("pingscore-player2");
const storedSets = localStorage.getItem("pingscore-sets-to-win");
const storedStartingServer = localStorage.getItem("pingscore-starting-server");

if (!matchStartTime && !score1 && !score2 && !setHistory.length) {
  if (storedPlayer1) player1Name = storedPlayer1;
  if (storedPlayer2) player2Name = storedPlayer2;
  if (storedSets) setsToWin = Number(storedSets) || 5;
  if (storedStartingServer) startingServer = Number(storedStartingServer) === 2 ? 2 : 1;
}

if (player1NameInput) player1NameInput.value = player1Name;
if (player2NameInput) player2NameInput.value = player2Name;
if (setsToWinSelect) setsToWinSelect.value = String(setsToWin);
if (startingServerSelect) startingServerSelect.value = String(startingServer);

updateNames();
updateDisplay();
renderMatchHistory();
renderHeadToHead();
updateHomeScreen();

// Forsiden vises alltid når PingScore åpnes.
// En pågående kamp kan fortsettes med ett trykk.
showHomeScreen();

if (matchFinished) setListenButton("🏆 Kamp ferdig");
