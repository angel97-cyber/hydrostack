/* ============================================================
   STACKLE — streak & stats (localStorage only)
   ============================================================ */

const STORAGE_KEY = "stackle.v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch (e) {
    return defaultState();
  }
}

function defaultState() {
  return {
    lastPlayedDate: null,
    currentStreak: 0,
    maxStreak: 0,
    totalPlayed: 0,
    totalScore: 0,
    distribution: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
    history: {}          // { "2026-05-17": { puzzleNo, score, results: [...] } }
  };
}

function saveState(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(aISO, bISO) {
  const a = new Date(aISO + "T00:00:00");
  const b = new Date(bISO + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

/* Record a finished puzzle. score 0-6. results = [0,1,2,...] per slot. */
function recordPlay(dateISO, puzzleNo, score, results, lockedOrder) {
  const s = loadState();

  // already played today? don't double-count
  if (s.history[dateISO]) return s;

  s.history[dateISO] = { puzzleNo, score, results, lockedOrder, ts: Date.now() };
  s.totalPlayed += 1;
  s.totalScore += score;
  s.distribution[score] = (s.distribution[score] || 0) + 1;

  // streak math
  if (s.lastPlayedDate) {
    const gap = daysBetween(s.lastPlayedDate, dateISO);
    if (gap === 1)       s.currentStreak += 1;
    else if (gap === 0)  { /* same day, no change */ }
    else                 s.currentStreak = 1;
  } else {
    s.currentStreak = 1;
  }
  s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
  s.lastPlayedDate = dateISO;

  saveState(s);
  return s;
}

function getTodayPlay(dateISO) {
  return loadState().history[dateISO] || null;
}

function getAverageScore() {
  const s = loadState();
  if (s.totalPlayed === 0) return "0.0";
  return (s.totalScore / s.totalPlayed).toFixed(1);
}
