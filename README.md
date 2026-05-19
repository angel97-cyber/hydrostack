# Stackle

The daily ranking puzzle. Stack six things in the right order — one shot, one minute, one share.

Live at **[usehydrostack.com](https://usehydrostack.com)**.

---

## What it is

Wordle for rankings. Every day, players get one puzzle: six items they have to drag into the correct order, top to bottom (most → least, oldest → newest, etc.). One submit per day. Each slot is scored:

| Glyph | Meaning |
|-------|---------|
| 🟩 | Exact position |
| 🟨 | Off by 1 |
| 🟥 | Off by 2 or more |

Players share an emoji grid, build streaks, and come back tomorrow.

---

## Stack

Pure static. No build step. No framework. No backend. No database.

- **HTML / CSS / Vanilla JS**
- **[SortableJS](https://github.com/SortableJS/Sortable)** — drag-and-drop (vendored at `sortable.min.js`)
- **localStorage** — streak + history (lives only in the player's browser)
- **Google Fonts** — Fraunces, IBM Plex Sans, JetBrains Mono (loaded over CDN)

That's it. Drag the folder onto Vercel, Netlify, or any static host.

---

## Files

```
.
├── index.html         page markup, modals, footer
├── style.css          liquid-stratigraphy theme, mobile-first
├── app.js             puzzle loader, drag-drop wiring, scoring, countdown
├── streak.js          localStorage state, streak math, stats aggregation
├── share.js           emoji grid builder + clipboard / native share
├── sortable.min.js    drag-and-drop library (44 kB, vendored)
├── puzzles.json       60 puzzles, items stored in correct order
├── favicon.svg        stacked-bars mark
├── og.png             1200×630 share preview
└── README.md
```

---

## Deploy

Any static host works. Easiest:

```bash
# Vercel
npx vercel --prod

# Or with Git: push to GitHub, import in vercel.com, done.
# Or drag the whole folder into netlify.com.
```

There is **no build step**. No `npm install`. No environment variables. The whole game is the folder you see.

---

## Customize

### 1. Tip jar link

In `app.js`, line ~7:

```js
const TIPJAR_URL = "#";   // ← put your Stripe Payment Link or Ko-fi URL here
```

This wires up both the footer "Tip the builder ☕" link and the About-modal tip link.

### 2. Start date

In `app.js`, line ~6:

```js
const START_DATE = "2026-05-17";   // day-1 of Stackle
```

This is the date of puzzle #1. Don't change it after launch — it breaks everyone's puzzle numbering. The game cycles forever: when day-61 hits, it loops back to puzzle index 0.

### 3. OG image domain

In `index.html`, the `og:url` and `og:image` meta tags hardcode `usehydrostack.com`. Find/replace if you change domain.

### 4. Color palette

All colors are CSS variables at the top of `style.css`:

```css
--abyss:   #001426;   /* darkest background    */
--deep:    #06304a;
--mid:     #0e527b;
--shallow: #1d6da6;
--surf:    #45c4d7;   /* primary accent / cyan */
--foam:    #d9efee;
--ink:     #f4ede4;
--hit:     #6ee7a0;   /* 🟩 exact   */
--near:    #fbbf24;   /* 🟨 off by 1 */
--miss:    #ef6f6f;   /* 🟥 off by 2 */
```

---

## Adding more puzzles

Append to `puzzles.json`. The schema is dead simple:

```json
{
  "title": "Largest countries by area",
  "subtitle": "Rank from largest to smallest",
  "category": "Geography",
  "items": ["Russia", "Canada", "United States", "China", "Brazil", "Australia"]
}
```

**Items are stored in the correct order, top first.** The app shuffles them for display using a date-seeded PRNG, so refreshing keeps the order stable. The shuffle is guaranteed not to land on the correct order.

The app cycles through puzzles using `(days_since_start) mod (count)`, so the game never runs out — it just loops. To launch with truly unique daily puzzles for N days, just have N puzzles in the file. Add more whenever you want; the cycle picks them up automatically.

### Tips for good puzzles

- **Pick rankings with clear, defensible answers.** Population, area, height, release date — things players can look up. Avoid anything where reasonable people disagree.
- **Six items, not seven.** The format is fixed.
- **Mix difficulty.** A "Star Wars films by release date" puzzle is easier than "Largest African countries by area." Aim for a spread so newcomers stay hooked.
- **Avoid ambiguous ties.** If two items are within 0.1% on the metric, swap one out.

---

## How scoring works (in code)

```js
results = USER_ORDER.map((value, displayIdx) => {
  const correctIdx = correctOrder.indexOf(value);
  const delta = Math.abs(correctIdx - displayIdx);
  return Math.min(delta, 2);   // capped — anything 2+ buckets to 🟥
});
score = results.filter(r => r === 0).length;   // count of perfect slots, 0–6
```

That's the whole scoring engine. 7 lines.

---

## Streak rules

In `streak.js`:

- Submit today, didn't play yesterday → streak resets to 1
- Submit today, played yesterday → streak += 1
- Skip a day → streak resets next time you play
- Max streak is sticky (best ever)
- All counters live in `localStorage` under the key `stackle.v1`

There is no server. There is no recovery if a player clears their browser. That's the trade for zero infrastructure.

---

## Monetization hooks (suggested order)

1. **Tip jar** (set `TIPJAR_URL` above) — Stripe Payment Link or Ko-fi. Day 1.
2. **$5 archive unlock** — once you have 30+ puzzles, sell access to the back catalog. Static HTML behind a Gumroad / LemonSqueezy paywall is fine.
3. **Sponsored slot** — once daily active users cross ~500, sell the bottom footer line to a relevant brand for $50–200/month.
4. **White-label "Stackle for your brand"** — sell branded versions at $99 to companies who want a quick engagement piece for their audience.

---

## License

MIT. Built solo. Tip jar appreciated.

— Stackle, by [@usehydrostack](https://usehydrostack.com)
