/* ============================================================
   STACKLE — share builder
   Emits a Wordle-style emoji grid string and copies to clipboard.
   ============================================================ */

const EMOJI = {
  hit:  "🟩",
  near: "🟨",
  miss: "🟥"
};

function deltaToEmoji(d) {
  if (d === 0) return EMOJI.hit;
  if (d === 1) return EMOJI.near;
  return EMOJI.miss;
}

function buildShareText({ puzzleNo, score, results, streak }) {
  const grid = results.map(deltaToEmoji).join("");
  const lines = [
    `Stackle #${puzzleNo} — ${score}/6`,
    grid,
  ];
  if (streak && streak > 1) lines.push(`🔥 ${streak}-day streak`);
  lines.push(`usehydrostack.com`);
  return lines.join("\n");
}

async function copyShare(text) {
  // Prefer native share on mobile when available
  if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (e) {
      // user canceled — fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch (e) {
    // legacy fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return "copied";
  }
}
