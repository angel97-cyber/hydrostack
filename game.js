/* ────────────────────────────────────────────────────────────────
   HydroStack — Daily Liquid Sort Puzzle
   Pure JS, no dependencies, no backend.
   ────────────────────────────────────────────────────────────────*/

const COLORS = [
  '#FF6B6B', // coral
  '#4ECDC4', // teal
  '#FFE66D', // yellow
  '#A78BFA', // lavender
  '#86EFAC', // mint
  '#FB923C', // orange (reserved for harder modes)
];

const CAPACITY    = 4;     // liquids per tube
const NUM_COLORS  = 5;     // colors in play
const EMPTY_TUBES = 2;     // working-space tubes
const LAUNCH_DATE = new Date('2026-05-17T00:00:00');

/* ─── Color → emoji map for share grid ──────────────────────── */
const EMOJI = {
  '#FF6B6B': '🟥',
  '#4ECDC4': '🟦',
  '#FFE66D': '🟨',
  '#A78BFA': '🟪',
  '#86EFAC': '🟩',
  '#FB923C': '🟧',
};

/* ─── Seeded RNG (Mulberry32) ───────────────────────────────── */
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function todaysSeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function todaysPuzzleNumber() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const launch = new Date(LAUNCH_DATE); launch.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((today - launch) / 86400000) + 1);
}

/* ─── Pure game logic ───────────────────────────────────────── */
function topColor(tube) { return tube[tube.length - 1]; }

function topRunCount(tube) {
  if (tube.length === 0) return 0;
  const c = topColor(tube);
  let n = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === c; i--) n++;
  return n;
}

function isLegalPour(state, from, to) {
  if (from === to) return false;
  const src = state[from], dst = state[to];
  if (src.length === 0) return false;
  if (dst.length >= CAPACITY) return false;
  if (dst.length > 0 && topColor(dst) !== topColor(src)) return false;
  return true;
}

function pour(state, from, to) {
  const ns  = state.map(t => [...t]);
  const src = ns[from], dst = ns[to];
  const run = topRunCount(src);
  const room = CAPACITY - dst.length;
  const moves = Math.min(run, room);
  for (let i = 0; i < moves; i++) dst.push(src.pop());
  return ns;
}

function isSolved(state) {
  return state.every(t =>
    t.length === 0 ||
    (t.length === CAPACITY && t.every(c => c === t[0]))
  );
}

/* ─── Puzzle generation ─────────────────────────────────────── */
function generatePuzzle(seed) {
  const rng = mulberry32(seed);
  const palette = COLORS.slice(0, NUM_COLORS);
  const liquids = [];
  for (const c of palette) for (let i = 0; i < CAPACITY; i++) liquids.push(c);

  // Fisher–Yates shuffle, then check we didn't accidentally make a trivial puzzle
  for (let attempt = 0; attempt < 20; attempt++) {
    for (let i = liquids.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [liquids[i], liquids[j]] = [liquids[j], liquids[i]];
    }
    // Reject if any colored tube is already solved (boring start)
    let trivial = false;
    for (let i = 0; i < NUM_COLORS; i++) {
      const tube = liquids.slice(i * CAPACITY, (i + 1) * CAPACITY);
      if (tube.every(c => c === tube[0])) { trivial = true; break; }
    }
    if (!trivial) break;
  }

  const tubes = [];
  for (let i = 0; i < NUM_COLORS; i++) {
    tubes.push(liquids.slice(i * CAPACITY, (i + 1) * CAPACITY));
  }
  for (let i = 0; i < EMPTY_TUBES; i++) tubes.push([]);
  return tubes;
}

/* ─── localStorage helpers ──────────────────────────────────── */
const LS = {
  get totalSolved() { return Number(localStorage.getItem('hs.totalSolved') || 0); },
  set totalSolved(v) { localStorage.setItem('hs.totalSolved', v); },
  get streak()      { return Number(localStorage.getItem('hs.streak') || 0); },
  set streak(v)     { localStorage.setItem('hs.streak', v); },
  get lastSolvedDay() { return localStorage.getItem('hs.lastDay') || ''; },
  set lastSolvedDay(v) { localStorage.setItem('hs.lastDay', v); },
  todaysResult() {
    const v = localStorage.getItem('hs.daily.' + todaysPuzzleNumber());
    return v ? JSON.parse(v) : null;
  },
  saveTodaysResult(moves) {
    localStorage.setItem('hs.daily.' + todaysPuzzleNumber(),
      JSON.stringify({ moves, date: new Date().toISOString() }));
  }
};

/* ─── State ─────────────────────────────────────────────────── */
const state = {
  mode: 'daily',
  tubes: [],
  selected: null,
  moves: 0,
  history: [],
  won: false,
};

/* ─── DOM refs ──────────────────────────────────────────────── */
const $tubes     = document.getElementById('tubes');
const $moves     = document.getElementById('moveCount');
const $undo      = document.getElementById('undoBtn');
const $puzzleNum = document.getElementById('puzzleNum');
const $streak    = document.getElementById('streakNum');
const $modal     = document.getElementById('modal');

/* ─── Render ────────────────────────────────────────────────── */
function render() {
  $tubes.innerHTML = '';

  state.tubes.forEach((tube, idx) => {
    const el = document.createElement('div');
    el.className = 'tube' + (state.selected === idx ? ' selected' : '');
    el.dataset.idx = idx;

    tube.forEach(color => {
      const layer = document.createElement('div');
      layer.className = 'layer';
      layer.style.background = color;
      el.appendChild(layer);
    });

    el.addEventListener('click', () => onTubeClick(idx));
    $tubes.appendChild(el);
  });

  $moves.textContent = state.moves;
  $undo.disabled = state.history.length === 0 || state.won;
  $puzzleNum.textContent = state.mode === 'daily' ? '#' + todaysPuzzleNumber() : '∞';
  $streak.textContent = LS.streak;
}

/* ─── Interaction ───────────────────────────────────────────── */
function onTubeClick(idx) {
  if (state.won) return;

  if (state.selected === null) {
    if (state.tubes[idx].length === 0) return;
    state.selected = idx;
    return render();
  }

  if (state.selected === idx) {
    state.selected = null;
    return render();
  }

  const from = state.selected, to = idx;
  if (isLegalPour(state.tubes, from, to)) {
    state.history.push(state.tubes.map(t => [...t]));
    state.tubes = pour(state.tubes, from, to);
    state.moves++;
    state.selected = null;
    render();
    if (isSolved(state.tubes)) setTimeout(onWin, 280);
  } else {
    state.selected = state.tubes[idx].length === 0 ? null : idx;
    render();
  }
}

function undo() {
  if (state.history.length === 0 || state.won) return;
  state.tubes = state.history.pop();
  state.moves = Math.max(0, state.moves - 1);
  state.selected = null;
  render();
}

/* ─── Win flow ──────────────────────────────────────────────── */
function onWin() {
  state.won = true;
  LS.totalSolved = LS.totalSolved + 1;

  if (state.mode === 'daily') {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (!LS.todaysResult()) {
      if (LS.lastSolvedDay === yesterday) LS.streak = LS.streak + 1;
      else if (LS.lastSolvedDay !== today) LS.streak = 1;
      LS.lastSolvedDay = today;
      LS.saveTodaysResult(state.moves);
    }
  }

  document.getElementById('winMoves').textContent  = state.moves;
  document.getElementById('winStreak').textContent = LS.streak;
  document.getElementById('winTotal').textContent  = LS.totalSolved;
  document.getElementById('shareGrid').textContent = buildShareText();
  $modal.classList.add('show');
  spawnConfetti();
}

function buildShareText() {
  const num = state.mode === 'daily' ? '#' + todaysPuzzleNumber() : 'Free Play';
  const colors = state.tubes.filter(t => t.length > 0).map(t => t[0]);
  const grid = colors.map(c => EMOJI[c] || '⬜').join('');
  const streakLine = state.mode === 'daily' && LS.streak > 1 ? ` · 🔥${LS.streak}` : '';
  return `HydroStack ${num}\n${state.moves} moves${streakLine}\n${grid}\nusehydrostack.com`;
}

function spawnConfetti() {
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    c.style.animationDelay = (Math.random() * 0.4) + 's';
    c.style.animationDuration = (2.2 + Math.random() * 2) + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 4500);
  }
}

/* ─── Game setup ────────────────────────────────────────────── */
function startDaily() {
  state.mode = 'daily';
  state.tubes = generatePuzzle(todaysSeed());
  resetEphemeral();
}

function startFree() {
  state.mode = 'free';
  state.tubes = generatePuzzle(Math.floor(Math.random() * 1e9));
  resetEphemeral();
}

function resetEphemeral() {
  state.selected = null;
  state.moves = 0;
  state.history = [];
  state.won = false;
  $modal.classList.remove('show');
  render();
}

function resetPuzzle() {
  if (state.mode === 'daily') startDaily();
  else startFree();
}

/* ─── Events ────────────────────────────────────────────────── */
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('resetBtn').addEventListener('click', resetPuzzle);
document.getElementById('freeBtn').addEventListener('click', startFree);
document.getElementById('dailyBtn').addEventListener('click', startDaily);
document.getElementById('closeModalBtn').addEventListener('click', () =>
  $modal.classList.remove('show'));
document.getElementById('nextBtn').addEventListener('click', () => {
  $modal.classList.remove('show');
  startFree();
});
document.getElementById('shareBtn').addEventListener('click', () => {
  const text = buildShareText();
  const btn  = document.getElementById('shareBtn');
  const prev = btn.textContent;

  const done = () => {
    btn.textContent = '✓ Copied';
    setTimeout(() => btn.textContent = prev, 1800);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
});

function fallbackCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); cb(); } catch (e) {}
  document.body.removeChild(ta);
}

/* ─── Boot ──────────────────────────────────────────────────── */
if (LS.todaysResult()) {
  startFree();
} else {
  startDaily();
}
