/* ============================================================
   STACKLE — app controller
   ============================================================ */

/* ---- CONFIG ---- */
const START_DATE = "2026-05-19";   // day-1 of Stackle
const TIPJAR_URL = null;
const PUZZLES_URL = "puzzles.json";

/* ---- DOM ---- */
const $ = (id) => document.getElementById(id);

/* ---- STATE ---- */
let TODAY_ISO   = null;
let PUZZLE_NO   = null;
let PUZZLE      = null;     // { title, subtitle, items: [correct order] }
let USER_ORDER  = [];       // current order in the DOM
let LOCKED      = false;
let SORTABLE    = null;

/* ============================================================
   BOOT
   ============================================================ */
init();

async function init() {
  // ---- 1. Wire ALL event handlers first ----
  // Do this before anything that could throw, so the UI is always at least navigable.

  document.querySelectorAll("#tipjar-link, #tipjar-link-2").forEach(a => {
  a.href = "#";
  a.onclick = (e) => { e.preventDefault(); showModal("modal-qr"); };
});

  $("open-stats").onclick = () => showModal("modal-stats");
  $("open-how").onclick   = (e) => { e.preventDefault(); showModal("modal-how"); };
  $("open-about").onclick = (e) => { e.preventDefault(); showModal("modal-about"); };
  $("submit-btn").onclick = onSubmit;
  $("share-btn").onclick  = onShare;
  $("view-streak").onclick = () => showModal("modal-stats");

  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => closeModals());
  document.querySelectorAll(".modal").forEach(m => {
    m.addEventListener("click", (e) => { if (e.target === m) closeModals(); });
  });

  // ---- 2. Figure out today's puzzle number ----
  const now = new Date();
  TODAY_ISO = isoDate(now);
  PUZZLE_NO = daysBetween(START_DATE, TODAY_ISO) + 1;
  if (PUZZLE_NO < 1) PUZZLE_NO = 1;

  $("puzzle-no").textContent   = `Stackle #${PUZZLE_NO}`;
  $("puzzle-date").textContent = formatDate(now);

  // ---- 3. Load puzzles ----
  let puzzles;
  try {
    const r = await fetch(PUZZLES_URL);
    if (!r.ok) throw new Error("HTTP " + r.status);
    puzzles = await r.json();
  } catch (e) {
    $("puzzle-title").textContent = "Couldn't load today's puzzle.";
    $("puzzle-subtitle").textContent = "Try refreshing in a moment.";
    return;
  }

  // cyclic index — Stackle runs forever
  const idx = ((PUZZLE_NO - 1) % puzzles.length + puzzles.length) % puzzles.length;
  PUZZLE = puzzles[idx];

  // ---- 4. Render & start countdown ----
  renderPuzzle(PUZZLE);

  const played = getTodayPlay(TODAY_ISO);
  if (played) restoreFromHistory(played);

  startCountdown();
}

/* ============================================================
   RENDER
   ============================================================ */
function renderPuzzle(p) {
  $("puzzle-title").textContent = p.title;
  $("puzzle-subtitle").textContent = p.subtitle;

  // shuffle for display (stable seeded shuffle by date so refresh keeps order)
  const seed = stringSeed(TODAY_ISO + "|" + PUZZLE_NO);
  const shuffled = seededShuffle([...p.items], seed);
  USER_ORDER = shuffled.slice();

  const stack = $("stack");
  stack.innerHTML = "";
  shuffled.forEach((item, i) => stack.appendChild(makeItem(item, i)));

  if (typeof Sortable !== "undefined") {
    SORTABLE = new Sortable(stack, {
      animation: 180,
      ghostClass: "ghost",
      chosenClass: "dragging",
      dragClass: "dragging",
      forceFallback: true,        // smoother on mobile
      fallbackTolerance: 4,
      onEnd: () => {
        USER_ORDER = Array.from(stack.children).map(li => li.dataset.value);
        updateRankNumbers();
      }
    });
  } else {
    console.warn("SortableJS missing; drag-and-drop disabled.");
    $("hint").textContent = "Drag is unavailable — try refreshing.";
  }
}

function makeItem(value, index) {
  const li = document.createElement("li");
  li.className = "stack-item";
  li.dataset.value = value;
  li.innerHTML = `
    <span class="rank-num">${index + 1}</span>
    <span class="label">${escapeHTML(value)}</span>
    <span class="grip" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>
    </span>`;
  return li;
}

function updateRankNumbers() {
  const items = $("stack").children;
  for (let i = 0; i < items.length; i++) {
    const r = items[i].querySelector(".rank-num");
    if (r) r.textContent = i + 1;
  }
}

/* ============================================================
   SUBMIT
   ============================================================ */
function onSubmit() {
  if (LOCKED) return;
  LOCKED = true;

  if (SORTABLE) { SORTABLE.option("disabled", true); }
  $("submit-btn").disabled = true;

  // score per slot: 0 = exact, 1 = off by 1, 2 = off by 2+
  const correct = PUZZLE.items;
  const results = USER_ORDER.map((val, i) => {
    const correctIdx = correct.indexOf(val);
    const delta = Math.abs(correctIdx - i);
    return Math.min(delta, 2);    // cap at 2 for color buckets
  });
  const score = results.filter(r => r === 0).length;

  // persist
  const newState = recordPlay(TODAY_ISO, PUZZLE_NO, score, results, USER_ORDER.slice());

  // animate result colors per row
  const items = Array.from($("stack").children);
  items.forEach((li, i) => {
    setTimeout(() => paintResult(li, results[i], i, correct), i * 140);
  });

  // reveal results panel after the last row
  setTimeout(() => showResults(score, results, newState.currentStreak), items.length * 140 + 280);
}

function paintResult(li, r, displayIdx, correct) {
  li.classList.add("locked");
  if (r === 0) li.classList.add("r-hit");
  else if (r === 1) li.classList.add("r-near");
  else li.classList.add("r-miss");

  // replace grip with delta indicator
  const grip = li.querySelector(".grip");
  if (grip) grip.remove();

  const value = li.dataset.value;
  const correctIdx = correct.indexOf(value);
  const signedDelta = correctIdx - displayIdx;   // positive = should be lower
  const arrow = signedDelta === 0 ? "✓" : (signedDelta > 0 ? `↓${signedDelta}` : `↑${-signedDelta}`);

  const tag = document.createElement("span");
  tag.className = "delta";
  tag.textContent = arrow;
  li.appendChild(tag);
}

function showResults(score, results, streak) {
  $("actions").hidden = true;
  $("results").hidden = false;
  $("score-number").innerHTML = `${score}<span class="score-total">/6</span>`;
  $("score-grid").textContent = results.map(r => r === 0 ? "🟩" : r === 1 ? "🟨" : "🟥").join("");
  $("score-blurb").textContent = blurbFor(score);

  // remember on the share button
  $("share-btn").dataset.shareText = buildShareText({
    puzzleNo: PUZZLE_NO,
    score,
    results,
    streak
  });
}
$("correct-reveal").hidden = false;
  $("reveal-btn").onclick = () => {
    $("correct-list").innerHTML = PUZZLE.items.map(item => `<li>${escapeHTML(item)}</li>`).join("");
    $("correct-list").hidden = false;
    $("reveal-btn").hidden = true;
  };
function blurbFor(score) {
  if (score === 6) return "A perfect stack. ✨";
  if (score === 5) return "Beautifully poured.";
  if (score === 4) return "Solid stack.";
  if (score === 3) return "Half settled, half stirred.";
  if (score === 2) return "Murky depths today.";
  if (score === 1) return "Almost in order.";
  return "The current took it. Come back tomorrow.";
}

/* ============================================================
   RESTORE (already-played-today)
   ============================================================ */
function restoreFromHistory(played) {
  LOCKED = true;
  $("submit-btn").disabled = true;
  if (SORTABLE) SORTABLE.option("disabled", true);

  // We need to render items in the user's locked order, not today's shuffle.
  // played.results align with the order at submit time, but we didn't save that order.
  // Workaround: re-derive by mapping each result-position back from the correct order.
  // Simpler: show items in shuffled order they're currently in, then paint based on stored results
  // by matching by current order — but the displayed order may differ from submitted.
  //
  // To keep faithful, we save USER_ORDER too.
  if (played.lockedOrder) {
    const stack = $("stack");
    stack.innerHTML = "";
    played.lockedOrder.forEach((v, i) => stack.appendChild(makeItem(v, i)));
  }

  const items = Array.from($("stack").children);
  items.forEach((li, i) => paintResult(li, played.results[i], i, PUZZLE.items));

  const state = loadState();
  showResults(played.score, played.results, state.currentStreak);
  $("hint").hidden = true;
}

/* ============================================================
   SHARE
   ============================================================ */
async function onShare() {
  const text = $("share-btn").dataset.shareText || "";
  const result = await copyShare(text);
  toast(result === "shared" ? "Shared!" : "Copied to clipboard");
}

function toast(msg) {
  const t = $("toast");
  $("toast-text").textContent = msg;
  t.hidden = false;
  setTimeout(() => t.hidden = true, 1700);
}

/* ============================================================
   STATS MODAL
   ============================================================ */
function showModal(id) {
  if (id === "modal-stats") populateStats();
  $(id).hidden = false;
}
function closeModals() {
  document.querySelectorAll(".modal").forEach(m => m.hidden = true);
}

function populateStats() {
  const s = loadState();
  $("stat-played").textContent = s.totalPlayed;
  $("stat-streak").textContent = s.currentStreak;
  $("stat-max").textContent    = s.maxStreak;
  $("stat-avg").textContent    = getAverageScore();

  const histo = $("histogram");
  histo.innerHTML = "";
  const maxCount = Math.max(1, ...Object.values(s.distribution));
  for (let i = 6; i >= 0; i--) {
    const c = s.distribution[i] || 0;
    const pct = c === 0 ? 4 : Math.max(8, Math.round((c / maxCount) * 100));
    const row = document.createElement("div");
    row.className = "histo-row";
    row.innerHTML = `
      <span class="label">${i}/6</span>
      <span class="bar">
        <span class="fill ${c === 0 ? 'empty' : ''}" style="width:${pct}%"></span>
        <span class="count">${c}</span>
      </span>`;
    histo.appendChild(row);
  }
}

/* ============================================================
   COUNTDOWN
   ============================================================ */
function startCountdown() {
  const el = $("countdown");
  if (!el) return;
  function tick() {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const diff = tomorrow - now;
    const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
    el.innerHTML = `Next Stackle in <strong>${h}:${m}:${s}</strong>`;
  }
  tick();
  setInterval(tick, 1000);
}

/* ============================================================
   UTILS
   ============================================================ */
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

function formatDate(d) {
  return d.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric"
  });
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function stringSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle(arr, seed) {
  // Mulberry32 PRNG seeded by `seed`
  let t = seed;
  function rand() {
    t = (t + 0x6D2B79F5) | 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  }
  // Fisher-Yates
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // guard: ensure the shuffle isn't already the correct order
  let same = true;
  for (let i = 0; i < a.length; i++) if (a[i] !== arr[i]) { same = false; break; }
  if (same) [a[0], a[1]] = [a[1], a[0]];
  return a;
}
