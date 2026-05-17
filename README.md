# HydroStack

**A daily liquid sort puzzle. Pour, sort, share. New puzzle every day.**

Live at [usehydrostack.com](https://usehydrostack.com).

---

## What this is

A web-first puzzle game in the spirit of Wordle, using the **water-sort mechanic** that has hundreds of millions of installs on mobile app stores (Water Sort Puzzle, Ball Sort, etc.). Difference: no app to install, plays in any browser, one global puzzle per day, Wordle-style emoji share grid, and a streak counter that pulls players back daily.

The product is one HTML file, one CSS file, one JS file. No backend. No database. Vercel free tier serves it forever. Zero ongoing cost.

---

## Why this can earn money

The water-sort mechanic is **proven addictive at scale**. Top mobile clones earn $50k–$500k a month from ads alone. Nothing comparable exists for the web in the daily-puzzle format.

Edge over mobile clones:
1. **Daily puzzle** — same global puzzle for everyone, like Wordle. Drives daily return + sharing.
2. **Free + instant** — no app install, plays on any phone or laptop in two seconds.
3. **Shareable result** — Wordle-style emoji grid people post to Twitter, WhatsApp, group chats. Each share is a free ad.
4. **Cheap to run** — zero backend, zero monthly cost.

**Realistic 6-month outcome with steady promotion: $200–$2,000/month.** Best case ($5k+/month) requires one viral moment and consistent posting.

---

## Monetization, in order of difficulty

### 1. Google AdSense (easiest, do first)
Apply at [adsense.google.com](https://adsense.google.com) the day you launch. Approval usually takes 1–4 weeks. Once approved, paste their `<script>` tag right before `</body>` in `index.html`. AdSense auto-places one banner. Done.

**Earnings:** ~$1–4 per 1,000 pageviews. So 10k pageviews/month → $10–40. 100k → $100–400.

### 2. Stripe Payment Link for "HydroStack Plus" (highest leverage)
No signup, no accounts, no backend. Pure Stripe.

1. Create a Stripe account → Payment Links → New Link.
2. Product: "HydroStack Plus", one-time $4.99.
3. Configure success URL to redirect back to `usehydrostack.com/#thanks`.
4. Add a "Get Plus" button on the site linking to the Stripe Payment Link.
5. When someone pays, Stripe emails them a license code (configure in Stripe dashboard → "Email customers"). They paste it into a code field on the site. Site checks the code matches an expected hash pattern → flips `localStorage.setItem('hs.plus', 'true')` → unlocks features.

**Plus unlocks** (build these one at a time after launch):
- Unlock all themes (sunset, neon, pastel, retro)
- Hint button (1 hint per puzzle)
- Statistics page
- Removes ads

**Math:** 50,000 monthly visitors × 0.5% conversion = 250 buyers × $5 = **$1,250/month**.

### 3. "Buy me a coffee" donation button (zero work)
[buymeacoffee.com](https://buymeacoffee.com) — set up in 5 minutes. Add link to footer. People who love the game tip $3–10. Some side-project games make $200/month from this alone.

---

## How to advertise

The product carries 90% of its own advertising. Every emoji share grid is a free ad. Every link someone sends a friend is a free ad. Your job is to **light the initial spark**.

### Launch day (one Saturday morning, 8am–2pm Nepal time)

**Reddit** — biggest single-day driver. One successful post = 5k–30k visitors.
- **r/WebGames** (primary): "I made a daily liquid-sort puzzle that plays in your browser"
- **r/SideProject, r/incremental_games, r/playmygame, r/somethingimade, r/InternetIsBeautiful**

Tailor each title slightly. Don't paste the same text. In comments, be the maker, not a marketer. Reply to every comment for the first 6 hours.

**Hacker News** — Show HN: "HydroStack – a daily liquid-sort puzzle in your browser". Post Tuesday or Wednesday around 8pm Nepal time (8am ET). Be ready to answer technical questions about the puzzle generation.

**TikTok / Instagram Reels** — highest possible ceiling. One viral video = 100k+ visitors.
- Record 15 seconds of someone solving a puzzle satisfyingly. ASMR vibe.
- Caption: "the most satisfying daily puzzle. usehydrostack.com"
- Hashtags: `#dailypuzzle #wordlestyle #oddlysatisfying #browsergame #puzzlegame`
- Post 3 different short videos in the first week.

**Twitter / X** — post your own daily share grid:
```
HydroStack #1
14 moves
🟥🟦🟨🟪🟩
usehydrostack.com
```
Reply to anyone posting Wordle, Connections, or Strands results with: "If you like daily puzzles, you'll love this →"

**Product Hunt** — schedule a Tuesday launch. Get 3–5 friends ready to upvote at 12:01am PT.

**Local Nepal / FB groups** — Facebook groups for Kathmandu engineers, Tribhuvan University students, etc. Casual share: "made this puzzle game over the weekend, try today's."

### After launch: one share angle a week

This is what most makers skip. They ship and stop posting. Don't be them.

Each week, post one new angle:
- "Today's #42 is brutal — bet you can't solve it in under 30 moves"
- "10,000 people played yesterday — here's the average move count"
- "I added a hard mode for Plus users"
- "Halloween-themed palette is live this week"

Each post is a fresh reason to return and a fresh reason for someone to share. 52 fresh angles a year.

---

## What to build next (in order of revenue per hour of work)

1. **Themes** — easiest premium feature. Just swap the COLORS array based on selected theme. CSS-only work.
2. **Sound effects** — pour sound, satisfying win chime using Web Audio API. One evening.
3. **Hard mode** — 6 colors, 1 empty tube. Same daily puzzle # but harder variant, Plus only.
4. **Email reminder service** — free tier of ConvertKit / Buttondown. Optional sign-up. "Want a daily reminder for tomorrow's puzzle?" Sends a 5am email. Triples retention.
5. **Achievements** — "Solved 7 days in a row", "Solved under 15 moves", etc. Pure localStorage, free dopamine, makes the game stickier.
6. **Hint system** — Plus-only. One hint per puzzle. Highlight the next legal pour.

---

## Tech notes

- Pure HTML/CSS/JS, no build step, no npm.
- `index.html`, `style.css`, `game.js` — three files.
- State lives in `localStorage`. No accounts, no server, no privacy concerns.
- Daily puzzle seed = `YYYYMMDD` of local date. Puzzles are deterministic — anyone playing today gets the same puzzle.
- Puzzle generation is deterministic Fisher–Yates shuffle of `(NUM_COLORS × CAPACITY)` colored units across `NUM_COLORS + EMPTY_TUBES` tubes.

To deploy: push to `main`, Vercel auto-deploys. **Vercel framework preset must be set to "Other"** (not Next.js) since this is plain static HTML.

---

## Honest expectations

- 70% chance: side income, **$50–300/month** within 6 months. Real, not life-changing.
- 20% chance: solid hit, **$500–3,000/month**. Worth replacing other income with.
- 10% chance: viral breakthrough, **$5,000+/month**. Build a portfolio of 5–10 similar daily-puzzle sites and earn from each.

The biggest predictor isn't the product — it's whether you keep posting fresh angles every week for 6 months. Most makers quit after week 2. Don't.

---

When you hit your first $100 month, message me. We plan the second site.
