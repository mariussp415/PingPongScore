// =====================================================
// PINGSCORE v21 - CLEAN TAPPABLE SCORE AREA
// =====================================================

// =====================================================
// SUPABASE / CLOUD
// =====================================================

const SUPABASE_URL = "https://tyyfootonnhlsmdlqkts.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_57BAgqhUwdyOtVLcr8-lFA_8ki8_gvS";
const APP_URL = "https://mariussp415.github.io/PingPongScore/";

const supabaseClient =
  window.supabase?.createClient
    ? window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        }
      )
    : null;

let currentUser = null;
let currentRivalryId = null;
let currentRivalryInviteCode = null;

let rivalryMembers = [];
let player1UserId = null;
let player2UserId = null;

let waitingPollTimer = null;
let cloudBusy = false;
let authBooted = false;

const CLOUD_OUTBOX_KEY = "pingscore-cloud-outbox-v18";
const LEGACY_BACKUP_KEY = "pingscore-legacy-history-backup-v18";
const LEGACY_IMPORT_DONE_KEY = "pingscore-legacy-import-done-v18";

function makeUuid() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
    /[xy]/g,
    character => {
      const random = Math.random() * 16 | 0;
      const value = character === "x"
        ? random
        : (random & 0x3) | 0x8;

      return value.toString(16);
    }
  );
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(String(value || ""));
}

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

const authScreen = document.getElementById("authScreen");
const rivalryScreen = document.getElementById("rivalryScreen");

const authEmailInput = document.getElementById("authEmail");
const authPasswordInput = document.getElementById("authPassword");
const authStatus = document.getElementById("authStatus");

const rivalrySetupCard = document.getElementById("rivalrySetupCard");
const rivalryWaitingCard = document.getElementById("rivalryWaitingCard");
const rivalryDisplayNameInput = document.getElementById("rivalryDisplayName");
const rivalryInviteInput = document.getElementById("rivalryInviteInput");
const rivalryStatus = document.getElementById("rivalryStatus");
const waitingInviteCode = document.getElementById("waitingInviteCode");

const cloudStatus = document.getElementById("cloudStatus");
const cloudDot = document.getElementById("cloudDot");
const homeInviteCode = document.getElementById("homeInviteCode");
const homeRivalryInfo = document.getElementById("homeRivalryInfo");
const importLegacyButton = document.getElementById("importLegacyButton");

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

  const formLabel = document.getElementById("h2hFormLabel");
  if (formLabel) {
    formLabel.textContent =
      `Siste 10 – fra ${player1Name} sitt perspektiv`;
  }

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



// =====================================================
// AUTH / RIVALISERING
// =====================================================

function setGateStatus(element, message, type = "") {
  if (!element) return;

  element.textContent = message;
  element.classList.remove("error", "success");

  if (type) {
    element.classList.add(type);
  }
}

function setCloudState(state, text) {
  if (cloudStatus) {
    cloudStatus.textContent = text;
  }

  if (cloudDot) {
    cloudDot.classList.remove("online", "syncing", "offline");
    cloudDot.classList.add(state);
  }
}

function hidePrimaryScreens() {
  authScreen?.classList.add("hidden");
  rivalryScreen?.classList.add("hidden");
  homeScreen?.classList.add("hidden");
  matchScreen?.classList.add("hidden");

  document.getElementById("historyScreen")?.classList.add("hidden");
  document.getElementById("h2hScreen")?.classList.add("hidden");
  closeWinnerPopup();
  closeMatchSetup();
}

function clearWaitingPoll() {
  if (waitingPollTimer) {
    clearInterval(waitingPollTimer);
    waitingPollTimer = null;
  }
}

function showAuthScreen(message = "") {
  clearWaitingPoll();
  stopVoiceForNavigation();

  hidePrimaryScreens();

  authScreen?.classList.remove("hidden");

  if (message) {
    setGateStatus(authStatus, message);
  }
}

function showRivalrySetup() {
  clearWaitingPoll();
  hidePrimaryScreens();

  rivalryScreen?.classList.remove("hidden");
  rivalrySetupCard?.classList.remove("hidden");
  rivalryWaitingCard?.classList.add("hidden");

  setGateStatus(rivalryStatus, "");

  if (
    rivalryDisplayNameInput &&
    !rivalryDisplayNameInput.value.trim()
  ) {
    const fallbackName =
      currentUser?.user_metadata?.display_name ||
      localStorage.getItem("pingscore-player1") ||
      "";

    rivalryDisplayNameInput.value = fallbackName;
  }
}

function showRivalryWaiting() {
  hidePrimaryScreens();

  rivalryScreen?.classList.remove("hidden");
  rivalrySetupCard?.classList.add("hidden");
  rivalryWaitingCard?.classList.remove("hidden");

  if (waitingInviteCode) {
    waitingInviteCode.textContent =
      currentRivalryInviteCode || "------";
  }

  clearWaitingPoll();

  waitingPollTimer = setInterval(() => {
    refreshRivalryState(true);
  }, 5000);
}

async function signUpUser() {
  if (!supabaseClient) {
    setGateStatus(
      authStatus,
      "Supabase-biblioteket kunne ikke lastes.",
      "error"
    );

    return;
  }

  const email = authEmailInput?.value.trim();
  const password = authPasswordInput?.value || "";

  if (!email || password.length < 6) {
    setGateStatus(
      authStatus,
      "Skriv inn e-post og et passord på minst 6 tegn.",
      "error"
    );

    return;
  }

  setGateStatus(authStatus, "Oppretter bruker…");

  const { data, error } =
    await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: APP_URL
      }
    });

  if (error) {
    setGateStatus(
      authStatus,
      error.message,
      "error"
    );

    return;
  }

  if (data.session) {
    setGateStatus(
      authStatus,
      "Bruker opprettet ✅",
      "success"
    );

    currentUser = data.user;
    await loadRivalryState();
    return;
  }

  setGateStatus(
    authStatus,
    "Bruker opprettet ✅ Sjekk e-posten og bekreft kontoen. Deretter kan du logge inn.",
    "success"
  );
}

async function signInUser() {
  if (!supabaseClient) {
    setGateStatus(
      authStatus,
      "Supabase-biblioteket kunne ikke lastes.",
      "error"
    );

    return;
  }

  const email = authEmailInput?.value.trim();
  const password = authPasswordInput?.value || "";

  if (!email || !password) {
    setGateStatus(
      authStatus,
      "Skriv inn e-post og passord.",
      "error"
    );

    return;
  }

  setGateStatus(authStatus, "Logger inn…");

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    setGateStatus(
      authStatus,
      error.message,
      "error"
    );

    return;
  }

  currentUser = data.user;

  setGateStatus(
    authStatus,
    "Innlogget ✅",
    "success"
  );

  await loadRivalryState();
}

async function signOutUser() {
  clearWaitingPoll();
  stopVoiceForNavigation();

  currentUser = null;
  currentRivalryId = null;
  currentRivalryInviteCode = null;

  rivalryMembers = [];
  player1UserId = null;
  player2UserId = null;

  if (supabaseClient) {
    await supabaseClient.auth.signOut();
  }

  showAuthScreen("Logget ut.");
}

async function createRivalry() {
  if (!supabaseClient || !currentUser) return;

  const displayName =
    rivalryDisplayNameInput?.value.trim();

  if (!displayName) {
    setGateStatus(
      rivalryStatus,
      "Skriv inn navnet ditt.",
      "error"
    );

    return;
  }

  setGateStatus(
    rivalryStatus,
    "Oppretter rivalisering…"
  );

  const { data, error } =
    await supabaseClient.rpc(
      "create_rivalry",
      {
        p_display_name: displayName
      }
    );

  if (error) {
    setGateStatus(
      rivalryStatus,
      error.message,
      "error"
    );

    return;
  }

  const created =
    Array.isArray(data)
      ? data[0]
      : data;

  currentRivalryId =
    created?.rivalry_id || null;

  currentRivalryInviteCode =
    created?.invite_code || null;

  await loadRivalryState();
}

async function joinRivalry() {
  if (!supabaseClient || !currentUser) return;

  const displayName =
    rivalryDisplayNameInput?.value.trim();

  const inviteCode =
    rivalryInviteInput?.value.trim().toUpperCase();

  if (!displayName || !inviteCode) {
    setGateStatus(
      rivalryStatus,
      "Skriv inn navn og invitasjonskode.",
      "error"
    );

    return;
  }

  setGateStatus(
    rivalryStatus,
    "Kobler deg til rivaliseringen…"
  );

  const { data, error } =
    await supabaseClient.rpc(
      "join_rivalry",
      {
        p_invite_code: inviteCode,
        p_display_name: displayName
      }
    );

  if (error) {
    setGateStatus(
      rivalryStatus,
      error.message,
      "error"
    );

    return;
  }

  currentRivalryId = data;

  await loadRivalryState();
}

async function loadRivalryState() {
  if (!supabaseClient || !currentUser) {
    showAuthScreen();
    return;
  }

  setCloudState(
    "syncing",
    "Kobler til skyen…"
  );

  const {
    data: memberships,
    error: membershipError
  } =
    await supabaseClient
      .from("rivalry_members")
      .select("rivalry_id, display_name, joined_at")
      .eq("user_id", currentUser.id)
      .limit(1);

  if (membershipError) {
    console.error(membershipError);

    setCloudState(
      "offline",
      "Kunne ikke koble til"
    );

    showRivalrySetup();

    setGateStatus(
      rivalryStatus,
      membershipError.message,
      "error"
    );

    return;
  }

  if (!memberships?.length) {
    currentRivalryId = null;
    currentRivalryInviteCode = null;

    showRivalrySetup();
    return;
  }

  currentRivalryId =
    memberships[0].rivalry_id;

  await loadRivalryDetails();
}

async function loadRivalryDetails() {
  if (!supabaseClient || !currentRivalryId) return;

  const [
    rivalryResult,
    membersResult
  ] =
    await Promise.all([
      supabaseClient
        .from("rivalries")
        .select("id, invite_code, created_at")
        .eq("id", currentRivalryId)
        .limit(1),

      supabaseClient
        .from("rivalry_members")
        .select("rivalry_id, user_id, display_name, joined_at")
        .eq("rivalry_id", currentRivalryId)
        .order("joined_at", { ascending: true })
    ]);

  if (rivalryResult.error) {
    console.error(rivalryResult.error);
    setCloudState("offline", "Synk-feil");
    return;
  }

  if (membersResult.error) {
    console.error(membersResult.error);
    setCloudState("offline", "Synk-feil");
    return;
  }

  currentRivalryInviteCode =
    rivalryResult.data?.[0]?.invite_code || null;

  rivalryMembers =
    Array.isArray(membersResult.data)
      ? membersResult.data
      : [];

  if (rivalryMembers.length < 2) {
    showRivalryWaiting();
    return;
  }

  clearWaitingPoll();

  player1UserId =
    rivalryMembers[0].user_id;

  player2UserId =
    rivalryMembers[1].user_id;

  player1Name =
    rivalryMembers[0].display_name || "Spiller 1";

  player2Name =
    rivalryMembers[1].display_name || "Spiller 2";

  if (player1NameInput) {
    player1NameInput.value = player1Name;
  }

  if (player2NameInput) {
    player2NameInput.value = player2Name;
  }

  updateNames();

  if (homeInviteCode) {
    homeInviteCode.textContent =
      currentRivalryInviteCode || "------";
  }

  if (homeRivalryInfo) {
    const myName =
      currentUser.id === player1UserId
        ? player1Name
        : player2Name;

    homeRivalryInfo.textContent =
      `${myName} · felles statistikk i skyen`;
  }

  backupLegacyHistoryOnce();

  await syncOutbox();
  await loadCloudMatchHistory({
    silent: true
  });

  updateLegacyImportButton();

  setCloudState(
    "online",
    "Synkronisert"
  );

  showHomeScreen();
}

async function refreshRivalryState(silent = false) {
  if (!silent) {
    setCloudState(
      "syncing",
      "Oppdaterer…"
    );
  }

  await loadRivalryState();
}


// =====================================================
// CLOUD HISTORY
// =====================================================

function getOutbox() {
  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          CLOUD_OUTBOX_KEY
        ) || "[]"
      );

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function saveOutbox(items) {
  localStorage.setItem(
    CLOUD_OUTBOX_KEY,
    JSON.stringify(items)
  );
}

function queueMatchForCloud(match) {
  const outbox = getOutbox();

  if (
    !outbox.some(
      item => item.id === match.id
    )
  ) {
    outbox.push(match);
  }

  saveOutbox(outbox);
}

function backupLegacyHistoryOnce() {
  if (
    localStorage.getItem(
      LEGACY_BACKUP_KEY
    )
  ) {
    return;
  }

  try {
    const raw =
      localStorage.getItem(
        "pingscore-match-history"
      );

    if (!raw) return;

    const parsed = JSON.parse(raw);

    if (
      Array.isArray(parsed) &&
      parsed.length
    ) {
      localStorage.setItem(
        LEGACY_BACKUP_KEY,
        JSON.stringify(parsed)
      );
    }
  } catch (error) {
    console.log(
      "Kunne ikke sikkerhetskopiere lokal historikk:",
      error
    );
  }
}

function updateLegacyImportButton() {
  if (!importLegacyButton) return;

  let hasLegacy = false;

  try {
    const parsed =
      JSON.parse(
        localStorage.getItem(
          LEGACY_BACKUP_KEY
        ) || "[]"
      );

    hasLegacy =
      Array.isArray(parsed) &&
      parsed.length > 0;
  } catch {
    hasLegacy = false;
  }

  const importDone =
    localStorage.getItem(
      LEGACY_IMPORT_DONE_KEY
    ) === "1";

  importLegacyButton.classList.toggle(
    "hidden",
    !hasLegacy || importDone
  );
}

function databaseRowToMatch(row) {
  const winnerSide =
    row.winner_user_id ===
    row.player1_user_id
      ? 1
      : 2;

  const startingServerSide =
    row.starting_server_user_id ===
    row.player2_user_id
      ? 2
      : 1;

  return {
    id: row.id,

    timestamp:
      new Date(
        row.played_at
      ).getTime(),

    startTimestamp:
      row.duration_ms
        ? new Date(
            row.played_at
          ).getTime() -
          Number(row.duration_ms)
        : null,

    durationMs:
      row.duration_ms != null
        ? Number(row.duration_ms)
        : null,

    player1:
      row.player1_name,

    player2:
      row.player2_name,

    player1UserId:
      row.player1_user_id,

    player2UserId:
      row.player2_user_id,

    winner:
      winnerSide === 1
        ? row.player1_name
        : row.player2_name,

    winnerSide,

    sets1:
      Number(row.sets1 || 0),

    sets2:
      Number(row.sets2 || 0),

    setsToWin:
      Number(row.sets_to_win || 5),

    startingServer:
      startingServerSide,

    sets:
      Array.isArray(row.sets)
        ? row.sets
        : [],

    createdBy:
      row.created_by,

    cloudSynced: true
  };
}

function matchToDatabaseRow(match) {
  if (
    !currentUser ||
    !currentRivalryId ||
    !player1UserId ||
    !player2UserId
  ) {
    return null;
  }

  const winnerSide =
    match.winnerSide === 2
      ? 2
      : 1;

  const serverSide =
    match.startingServer === 2
      ? 2
      : 1;

  const timestamp =
    match.timestamp ||
    Date.now();

  return {
    id:
      isUuid(match.id)
        ? match.id
        : makeUuid(),

    rivalry_id:
      currentRivalryId,

    created_by:
      currentUser.id,

    played_at:
      new Date(
        timestamp
      ).toISOString(),

    duration_ms:
      match.durationMs ?? null,

    sets_to_win:
      Number(
        match.setsToWin || 5
      ),

    starting_server_user_id:
      serverSide === 1
        ? player1UserId
        : player2UserId,

    winner_user_id:
      winnerSide === 1
        ? player1UserId
        : player2UserId,

    player1_user_id:
      player1UserId,

    player2_user_id:
      player2UserId,

    player1_name:
      player1Name,

    player2_name:
      player2Name,

    sets1:
      Number(match.sets1 || 0),

    sets2:
      Number(match.sets2 || 0),

    sets:
      Array.isArray(match.sets)
        ? match.sets
        : []
  };
}

async function syncOutbox() {
  if (
    !supabaseClient ||
    !currentUser ||
    !currentRivalryId ||
    cloudBusy
  ) {
    return;
  }

  let outbox = getOutbox();

  if (!outbox.length) {
    return;
  }

  cloudBusy = true;

  setCloudState(
    "syncing",
    "Synkroniserer…"
  );

  const remaining = [];

  for (const pendingMatch of outbox) {
    const row =
      matchToDatabaseRow(
        pendingMatch
      );

    if (!row) {
      remaining.push(
        pendingMatch
      );

      continue;
    }

    const {
      error
    } =
      await supabaseClient
        .from("matches")
        .insert(row);

    if (
      error &&
      error.code !== "23505"
    ) {
      console.error(
        "Kunne ikke synkronisere kamp:",
        error
      );

      remaining.push(
        pendingMatch
      );
    }
  }

  saveOutbox(remaining);

  cloudBusy = false;

  if (remaining.length) {
    setCloudState(
      "offline",
      `${remaining.length} kamp venter på synk`
    );
  } else {
    setCloudState(
      "online",
      "Synkronisert"
    );
  }
}

async function loadCloudMatchHistory(
  { silent = false } = {}
) {
  if (
    !supabaseClient ||
    !currentRivalryId
  ) {
    return false;
  }

  if (!silent) {
    setCloudState(
      "syncing",
      "Oppdaterer…"
    );
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from("matches")
      .select("*")
      .eq(
        "rivalry_id",
        currentRivalryId
      )
      .order(
        "played_at",
        { ascending: true }
      );

  if (error) {
    console.error(
      "Kunne ikke hente kamper:",
      error
    );

    setCloudState(
      "offline",
      "Kunne ikke oppdatere"
    );

    return false;
  }

  const cloudMatches =
    (data || []).map(
      databaseRowToMatch
    );

  const pending = getOutbox();

  const knownIds =
    new Set(
      cloudMatches.map(
        match => match.id
      )
    );

  const pendingOnly =
    pending.filter(
      match =>
        !knownIds.has(match.id)
    );

  matchHistory = [
    ...cloudMatches,
    ...pendingOnly
  ];

  matchHistory.sort(
    (a, b) =>
      Number(a.timestamp || 0) -
      Number(b.timestamp || 0)
  );

  saveMatchHistory();

  setCloudState(
    pendingOnly.length
      ? "syncing"
      : "online",
    pendingOnly.length
      ? `${pendingOnly.length} kamp venter på synk`
      : "Synkronisert"
  );

  return true;
}

async function refreshCloudData() {
  if (!currentRivalryId) return;

  setCloudState(
    "syncing",
    "Oppdaterer…"
  );

  await syncOutbox();
  await loadRivalryDetails();

  renderMatchHistory();
  renderHeadToHead();
  updateHomeScreen();
}

async function refreshHistory() {
  await syncOutbox();
  await loadCloudMatchHistory();

  renderMatchHistory();
}

async function refreshHeadToHead() {
  await syncOutbox();
  await loadCloudMatchHistory();

  renderHeadToHead();
}

async function deleteCloudMatch(matchId) {
  if (
    !supabaseClient ||
    !currentRivalryId ||
    !matchId
  ) {
    return false;
  }

  // Fjern også fra lokal synk-kø hvis kampen ikke rakk å nå skyen.
  const outbox =
    getOutbox().filter(
      match =>
        match.id !== matchId
    );

  saveOutbox(outbox);

  if (!isUuid(matchId)) {
    return true;
  }

  const {
    error
  } =
    await supabaseClient
      .from("matches")
      .delete()
      .eq("id", matchId)
      .eq(
        "rivalry_id",
        currentRivalryId
      );

  if (error) {
    console.error(
      "Kunne ikke fjerne kamp fra skyen:",
      error
    );

    return false;
  }

  return true;
}

async function deleteMatchFromHistory(matchId) {
  const match =
    matchHistory.find(
      item =>
        item.id === matchId
    );

  if (!match) return;

  // RLS-regelen vår tillater bare at personen som registrerte kampen
  // sletter den. Derfor vises knappen bare på egne kamper.
  if (
    match.createdBy &&
    currentUser &&
    match.createdBy !== currentUser.id
  ) {
    alert(
      "Denne kampen ble registrert av den andre spilleren og kan ikke slettes fra din konto."
    );

    return;
  }

  const perspective =
    getMatchPerspective(match);

  const confirmed =
    confirm(
      `Slette kampen ${player1Name} ${perspective.sets1}–${perspective.sets2} ${player2Name}?`
    );

  if (!confirmed) return;

  setCloudState(
    "syncing",
    "Sletter kamp…"
  );

  const deleted =
    await deleteCloudMatch(
      matchId
    );

  if (!deleted) {
    setCloudState(
      "offline",
      "Kunne ikke slette"
    );

    alert(
      "Kunne ikke slette kampen. Prøv igjen."
    );

    return;
  }

  matchHistory =
    matchHistory.filter(
      item =>
        item.id !== matchId
    );

  if (
    currentMatchHistoryId === matchId
  ) {
    currentMatchHistoryId = null;
    lastCompletedMatch = null;
    saveCurrentGame();
  }

  saveMatchHistory();

  // Hent fasiten fra Supabase igjen slik at begge enheter får samme resultat.
  await loadCloudMatchHistory({
    silent: true
  });

  renderMatchHistory();
  renderHeadToHead();
  updateHomeScreen();

  setCloudState(
    "online",
    "Synkronisert"
  );
}

async function importLegacyHistory() {
  if (
    !currentRivalryId ||
    !player1UserId ||
    !player2UserId
  ) {
    return;
  }

  let legacy = [];

  try {
    legacy =
      JSON.parse(
        localStorage.getItem(
          LEGACY_BACKUP_KEY
        ) || "[]"
      );
  } catch {
    legacy = [];
  }

  if (
    !Array.isArray(legacy) ||
    !legacy.length
  ) {
    updateLegacyImportButton();
    return;
  }

  const confirmed =
    confirm(
      `Importere ${legacy.length} gamle lokale kamper til den felles PingScore-historikken?`
    );

  if (!confirmed) return;

  setCloudState(
    "syncing",
    "Importerer gammel historikk…"
  );

  const rows = legacy.map(match => {
    let winnerSide =
      Number(match.winnerSide);

    if (
      winnerSide !== 1 &&
      winnerSide !== 2
    ) {
      winnerSide =
        normalizeName(match.winner) ===
        normalizeName(player2Name)
          ? 2
          : 1;
    }

    const normalized = {
      ...match,
      id:
        isUuid(match.id)
          ? match.id
          : makeUuid(),

      winnerSide,

      player1:
        player1Name,

      player2:
        player2Name
    };

    return matchToDatabaseRow(
      normalized
    );
  }).filter(Boolean);

  if (!rows.length) return;

  const {
    error
  } =
    await supabaseClient
      .from("matches")
      .insert(rows);

  if (error) {
    console.error(error);

    setCloudState(
      "offline",
      "Import feilet"
    );

    alert(
      `Kunne ikke importere: ${error.message}`
    );

    return;
  }

  localStorage.setItem(
    LEGACY_IMPORT_DONE_KEY,
    "1"
  );

  updateLegacyImportButton();

  await loadCloudMatchHistory();

  renderMatchHistory();
  renderHeadToHead();

  alert(
    "Den gamle historikken er nå lagret i skyen ✅"
  );
}


// =====================================================
// STARTUP
// =====================================================

async function bootCloudApp() {
  if (authBooted) return;
  authBooted = true;

  if (!supabaseClient) {
    showAuthScreen(
      "Kunne ikke laste Supabase. Sjekk internettforbindelsen og prøv igjen."
    );

    return;
  }

  setGateStatus(
    authStatus,
    "Sjekker innlogging…"
  );

  const {
    data,
    error
  } =
    await supabaseClient.auth.getSession();

  if (error) {
    console.error(error);
    showAuthScreen(
      "Kunne ikke hente innlogging."
    );

    return;
  }

  currentUser =
    data.session?.user || null;

  if (currentUser) {
    await loadRivalryState();
  } else {
    showAuthScreen("");
  }

  supabaseClient.auth.onAuthStateChange(
    (event, session) => {
      if (
        event === "SIGNED_OUT"
      ) {
        currentUser = null;

        if (
          !authScreen?.classList.contains(
            "hidden"
          )
        ) {
          return;
        }

        showAuthScreen("Logget ut.");
        return;
      }

      if (
        session?.user &&
        (
          !currentUser ||
          currentUser.id !==
          session.user.id
        )
      ) {
        currentUser =
          session.user;

        setTimeout(() => {
          loadRivalryState();
        }, 0);
      }
    }
  );
}


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

  authScreen?.classList.add("hidden");
  rivalryScreen?.classList.add("hidden");

  homeScreen?.classList.remove("hidden");
  matchScreen?.classList.add("hidden");

  updateHomeScreen();
}

function showMatchScreen() {
  authScreen?.classList.add("hidden");
  rivalryScreen?.classList.add("hidden");

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

  const matchId = makeUuid();

  currentMatchHistoryId = matchId;

  const completedMatch = {
    id: matchId,
    timestamp: now,
    startTimestamp: matchStartTime,
    durationMs,

    player1: player1Name,
    player2: player2Name,

    player1UserId,
    player2UserId,

    winner: winnerName,
    winnerSide: player,

    sets1,
    sets2,
    setsToWin,
    startingServer,

    sets:
      setHistory.map(
        set => ({ ...set })
      ),

    cloudSynced: false
  };

  lastCompletedMatch =
    completedMatch;

  matchHistory.push(
    completedMatch
  );

  saveMatchHistory();
  saveCurrentGame();

  queueMatchForCloud(
    completedMatch
  );

  renderMatchHistory();
  renderHeadToHead();
  updateHomeScreen();

  setStatus(
    `🏆 ${winnerName.toUpperCase()} VANT KAMPEN! · ${formatDuration(durationMs)}`
  );

  listening = false;
  clearRestartTimer();

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

  setListenButton(
    "🏆 Kamp ferdig"
  );

  updateServerIndicator();

  syncOutbox()
    .then(() =>
      loadCloudMatchHistory({
        silent: true
      })
    )
    .then(() => {
      renderMatchHistory();
      renderHeadToHead();
    })
    .catch(error => {
      console.error(
        "Bakgrunnssynk feilet:",
        error
      );
    });

  setTimeout(() => {
    showWinnerPopup(
      completedMatch
    );
  }, 450);
}

function undo() {
  closeWinnerPopup();

  if (history.length === 0) {
    setStatus("Ingenting å angre.");
    return;
  }

  if (matchFinished && currentMatchHistoryId) {
    const matchIdToDelete =
      currentMatchHistoryId;

    matchHistory =
      matchHistory.filter(
        match =>
          match.id !== matchIdToDelete
      );

    saveMatchHistory();

    deleteCloudMatch(
      matchIdToDelete
    );

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

async function openHistory() {
  renderMatchHistory();

  document
    .getElementById("historyScreen")
    ?.classList.remove("hidden");

  await syncOutbox();
  await loadCloudMatchHistory({
    silent: true
  });

  renderMatchHistory();
}

function closeHistory() {
  document.getElementById("historyScreen")?.classList.add("hidden");
}

async function openHeadToHead() {
  renderHeadToHead();

  document
    .getElementById("h2hScreen")
    ?.classList.remove("hidden");

  await syncOutbox();
  await loadCloudMatchHistory({
    silent: true
  });

  renderHeadToHead();
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
  if (currentRivalryId) {
    return matchHistory;
  }

  return matchHistory.filter(
    samePlayerPair
  );
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

        ${
          !match.createdBy ||
          match.createdBy === currentUser?.id
            ? `
              <button
                class="delete-match-button"
                onclick="deleteMatchFromHistory('${match.id}')"
              >
                🗑 Slett kamp
              </button>
            `
            : ""
        }
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

async function clearAllHistory() {
  const confirmed =
    confirm(
      "Vil du slette kampene du selv har registrert fra den felles historikken? Dette kan ikke angres."
    );

  if (!confirmed) return;

  if (
    supabaseClient &&
    currentRivalryId &&
    currentUser
  ) {
    const { error } =
      await supabaseClient
        .from("matches")
        .delete()
        .eq(
          "rivalry_id",
          currentRivalryId
        )
        .eq(
          "created_by",
          currentUser.id
        );

    if (error) {
      alert(
        `Kunne ikke slette: ${error.message}`
      );

      return;
    }
  }

  saveOutbox([]);

  await loadCloudMatchHistory({
    silent: true
  });

  resetGame();
  renderMatchHistory();
  renderHeadToHead();

  setStatus(
    "Dine registrerte kamper er slettet."
  );
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
// LAST INN LOKAL TILSTAND + START CLOUD
// =====================================================

loadMatchHistory();
loadCurrentGame();

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

const storedStartingServer =
  localStorage.getItem(
    "pingscore-starting-server"
  );

if (
  !matchStartTime &&
  !score1 &&
  !score2 &&
  !setHistory.length
) {
  if (storedPlayer1) {
    player1Name =
      storedPlayer1;
  }

  if (storedPlayer2) {
    player2Name =
      storedPlayer2;
  }

  if (storedSets) {
    setsToWin =
      Number(storedSets) || 5;
  }

  if (storedStartingServer) {
    startingServer =
      Number(storedStartingServer) === 2
        ? 2
        : 1;
  }
}

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

if (startingServerSelect) {
  startingServerSelect.value =
    String(startingServer);
}

updateNames();
updateDisplay();
renderMatchHistory();
renderHeadToHead();
updateHomeScreen();

if (matchFinished) {
  setListenButton(
    "🏆 Kamp ferdig"
  );
}

// Ikke vis lokal forside før vi vet hvem som er logget inn.
homeScreen?.classList.add("hidden");
matchScreen?.classList.add("hidden");
rivalryScreen?.classList.add("hidden");
authScreen?.classList.remove("hidden");

bootCloudApp();
