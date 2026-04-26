export default function HydropowerSchematic() {
  return (
    <svg
      viewBox="0 0 640 380"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto block"
      role="img"
      aria-label="Side-elevation schematic of a typical run-of-river mini-hydropower scheme"
    >
      <defs>
        {/* Hatch pattern for the mountain mass */}
        <pattern id="rockHatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(40)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="#a8a29e" strokeWidth="0.4" opacity="0.55" />
        </pattern>

        {/* Subtle drafting grid */}
        <pattern id="bgGrid" patternUnits="userSpaceOnUse" width="20" height="20">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e7e5e4" strokeWidth="0.4" />
        </pattern>

        <marker
          id="arrowDown"
          viewBox="0 0 10 10"
          refX="5"
          refY="9"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 1 1 L 5 9 L 9 1" fill="none" stroke="#1c1917" strokeWidth="1" />
        </marker>
        <marker
          id="arrowUp"
          viewBox="0 0 10 10"
          refX="5"
          refY="1"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 1 9 L 5 1 L 9 9" fill="none" stroke="#1c1917" strokeWidth="1" />
        </marker>
      </defs>

      {/* Background grid */}
      <rect width="640" height="380" fill="#fafaf9" />
      <rect width="640" height="380" fill="url(#bgGrid)" />

      {/* ===== Mountain mass ===== */}
      <path
        d="M 0 380 L 0 305 L 35 285 L 80 255 L 130 205 L 175 130 L 215 95 L 250 110 L 295 150 L 340 185 L 390 205 L 440 240 L 490 275 L 545 305 L 600 318 L 640 318 L 640 380 Z"
        fill="#f5f5f4"
      />
      <path
        d="M 0 380 L 0 305 L 35 285 L 80 255 L 130 205 L 175 130 L 215 95 L 250 110 L 295 150 L 340 185 L 390 205 L 440 240 L 490 275 L 545 305 L 600 318 L 640 318 L 640 380 Z"
        fill="url(#rockHatch)"
      />
      {/* Mountain outline */}
      <path
        d="M 0 305 L 35 285 L 80 255 L 130 205 L 175 130 L 215 95 L 250 110 L 295 150 L 340 185 L 390 205 L 440 240 L 490 275 L 545 305 L 600 318 L 640 318"
        fill="none"
        stroke="#57534e"
        strokeWidth="0.9"
      />

      {/* River source from peak */}
      <path
        d="M 215 95 Q 230 108 248 120 Q 263 128 277 134"
        stroke="#047857"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="215" cy="95" r="2.5" fill="#047857" />

      {/* ===== ① Intake structure ===== */}
      <rect x="270" y="128" width="20" height="11" fill="white" stroke="#1c1917" strokeWidth="1.4" />
      {/* gate marks */}
      <line x1="276" y1="129" x2="276" y2="138" stroke="#1c1917" strokeWidth="0.5" />
      <line x1="284" y1="129" x2="284" y2="138" stroke="#1c1917" strokeWidth="0.5" />

      {/* ===== ② Settling basin ===== */}
      <rect x="298" y="143" width="26" height="11" fill="white" stroke="#1c1917" strokeWidth="1.4" />
      {/* baffle plates */}
      <line x1="307" y1="144" x2="307" y2="153" stroke="#1c1917" strokeWidth="0.5" strokeDasharray="1.5 1.5" />
      <line x1="316" y1="144" x2="316" y2="153" stroke="#1c1917" strokeWidth="0.5" strokeDasharray="1.5 1.5" />

      {/* ===== ③ Headrace canal (parallel lines on slope) ===== */}
      <line x1="324" y1="148" x2="408" y2="200" stroke="#1c1917" strokeWidth="1.3" />
      <line x1="328" y1="142" x2="412" y2="194" stroke="#1c1917" strokeWidth="1.3" />
      {/* water inside */}
      <line x1="326" y1="145" x2="410" y2="197" stroke="#047857" strokeWidth="0.9" opacity="0.85" />

      {/* ===== ④ Forebay tank ===== */}
      <rect x="408" y="200" width="16" height="16" fill="white" stroke="#1c1917" strokeWidth="1.4" />
      <line x1="408" y1="205" x2="424" y2="205" stroke="#047857" strokeWidth="0.9" />

      {/* ===== ⑤ Penstock — three segments with anchor blocks ===== */}
      {/* Segment 1 */}
      <line x1="416" y1="216" x2="448" y2="245" stroke="#1c1917" strokeWidth="2.4" strokeLinecap="square" />
      {/* Anchor block 1 */}
      <rect x="442" y="241" width="11" height="11" fill="#1c1917" />
      <rect x="442" y="241" width="11" height="11" fill="none" stroke="#fafaf9" strokeWidth="0.6" />
      {/* Segment 2 */}
      <line x1="450" y1="248" x2="475" y2="270" stroke="#1c1917" strokeWidth="2.4" strokeLinecap="square" />
      {/* Anchor block 2 */}
      <rect x="469" y="266" width="11" height="11" fill="#1c1917" />
      <rect x="469" y="266" width="11" height="11" fill="none" stroke="#fafaf9" strokeWidth="0.6" />
      {/* Segment 3 */}
      <line x1="477" y1="273" x2="492" y2="288" stroke="#1c1917" strokeWidth="2.4" strokeLinecap="square" />

      {/* ===== ⑦ Powerhouse ===== */}
      <polygon points="486,288 540,288 540,310 486,310" fill="white" stroke="#1c1917" strokeWidth="1.6" />
      {/* roof line / mezzanine */}
      <line x1="486" y1="294" x2="540" y2="294" stroke="#1c1917" strokeWidth="0.7" />
      {/* turbine symbol */}
      <circle cx="500" cy="302" r="3.5" fill="none" stroke="#1c1917" strokeWidth="0.7" />
      <line x1="496.5" y1="302" x2="503.5" y2="302" stroke="#1c1917" strokeWidth="0.6" />
      <line x1="500" y1="298.5" x2="500" y2="305.5" stroke="#1c1917" strokeWidth="0.6" />
      {/* generator */}
      <rect x="510" y="298" width="14" height="9" fill="none" stroke="#1c1917" strokeWidth="0.7" />
      <text x="514" y="305" fontSize="6" fontFamily="ui-monospace, monospace" fill="#1c1917">
        G
      </text>

      {/* ===== ⑧ Tailrace ===== */}
      <path
        d="M 540 305 Q 575 314 605 318 L 640 320"
        stroke="#047857"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />

      {/* River downstream water surface (subtle) */}
      <line x1="540" y1="320" x2="640" y2="324" stroke="#047857" strokeWidth="0.6" strokeDasharray="3 3" opacity="0.5" />

      {/* ===== Component labels with leader lines ===== */}
      <g fontFamily="ui-monospace, monospace" fontSize="9.5" fill="#1c1917">
        {/* RIVER */}
        <text x="195" y="80" fill="#047857" fontSize="9" letterSpacing="0.1em">
          RIVER
        </text>

        {/* ① Intake */}
        <line x1="280" y1="128" x2="280" y2="108" stroke="#a8a29e" strokeWidth="0.5" />
        <text x="245" y="103">① Intake</text>

        {/* ② Settling basin */}
        <line x1="311" y1="143" x2="311" y2="123" stroke="#a8a29e" strokeWidth="0.5" />
        <text x="277" y="118">② Settling basin</text>

        {/* ③ Headrace */}
        <line x1="368" y1="172" x2="368" y2="155" stroke="#a8a29e" strokeWidth="0.5" />
        <text x="335" y="150">③ Headrace</text>

        {/* ④ Forebay */}
        <line x1="416" y1="200" x2="416" y2="180" stroke="#a8a29e" strokeWidth="0.5" />
        <text x="392" y="174">④ Forebay</text>

        {/* ⑤ Penstock */}
        <line x1="465" y1="258" x2="488" y2="240" stroke="#a8a29e" strokeWidth="0.5" />
        <text x="491" y="237">⑤ Penstock</text>

        {/* ⑥ Anchor blocks */}
        <line x1="448" y1="247" x2="395" y2="262" stroke="#a8a29e" strokeWidth="0.5" />
        <line x1="475" y1="272" x2="395" y2="262" stroke="#a8a29e" strokeWidth="0.5" />
        <text x="332" y="266" fill="#9a3412">⑥ Anchor blocks</text>

        {/* ⑦ Powerhouse */}
        <line x1="513" y1="288" x2="513" y2="270" stroke="#a8a29e" strokeWidth="0.5" />
        <text x="486" y="265">⑦ Powerhouse</text>

        {/* ⑧ Tailrace */}
        <text x="568" y="345" fill="#047857">⑧ Tailrace</text>
      </g>

      {/* ===== Dimension line — Gross head H ===== */}
      <g>
        {/* Horizontal extension lines */}
        <line x1="290" y1="138" x2="618" y2="138" stroke="#78716c" strokeWidth="0.4" strokeDasharray="2 3" />
        <line x1="513" y1="305" x2="618" y2="305" stroke="#78716c" strokeWidth="0.4" strokeDasharray="2 3" />
        {/* Vertical dimension line */}
        <line
          x1="612"
          y1="138"
          x2="612"
          y2="305"
          stroke="#1c1917"
          strokeWidth="0.7"
          markerStart="url(#arrowUp)"
          markerEnd="url(#arrowDown)"
        />
        <text
          x="618"
          y="225"
          fontSize="11"
          fontFamily="ui-monospace, monospace"
          fill="#1c1917"
          fontWeight="500"
        >
          H
        </text>
        <text
          x="618"
          y="238"
          fontSize="8"
          fontFamily="ui-monospace, monospace"
          fill="#78716c"
        >
          gross
        </text>
      </g>

      {/* ===== North arrow / scale corner ornament ===== */}
      <g transform="translate(40, 40)">
        <circle cx="0" cy="0" r="11" fill="white" stroke="#1c1917" strokeWidth="0.8" />
        <path d="M 0 -10 L 4 6 L 0 2 L -4 6 Z" fill="#1c1917" />
        <text
          x="0"
          y="-15"
          fontSize="8"
          fontFamily="ui-monospace, monospace"
          fill="#1c1917"
          textAnchor="middle"
        >
          N
        </text>
      </g>
    </svg>
  )
}