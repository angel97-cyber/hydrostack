// HydroStack — Module 03: Headrace & Forebay (pure calculation engine)
//
// Sources (all read from project knowledge before this file was written):
//   - AEPC DFS Guidelines for Mini Hydropower Projects, 2014 §3.3.5 (canal/pipe)
//     and §3.3.4.3 (forebay)
//   - AEPC Reference Micro-Hydro Power Standard 2014 §2.3.1 (intake structures),
//     §2.3.2 (penstock head loss limit), §3.1.1.2 (fine trash rack)
//   - AHEC-IITR/MNRE/SHP Standards, Civil Works — Hydraulic & Structural Design,
//     §8.2 (canal lining, Manning's n Table 8), §9 (forebay), §7.5 (submergence
//     requirement of pressure conduits, Eq. h ≥ C·V·√D)
//   - IS:11388-1995 (trash rack head loss — Kirschmer formula, used for fine
//     rack at forebay)
//   - Standard open-channel hydraulics: Manning's equation Q = (1/n)·A·R^(2/3)·S^(1/2)
//
// All formulas cite the originating standard inline. No invented constants.

// ─── Constants ───────────────────────────────────────────────────────────────

export const G = 9.81 // m/s² gravitational acceleration

// ─── Conduit type catalogue ──────────────────────────────────────────────────
//
// Manning's roughness coefficients sourced from:
//   AHEC-IITR §8.2.4 Table 8 "Recommended Values of Rugosity Coefficient for
//   Rigid Boundaries" and §8.5.3.4 Table 9 (tunnel surfaces).
// HDPE/MS pipe values are the conventional industry values used in AEPC DFS
// reports and match Butchers et al. 2022 Nepal practice.
//
// Each entry exposes a recommended midpoint `nDefault` plus the [nMin, nMax]
// range for engineering judgement. The form auto-fills `nDefault` when the
// user picks a type but allows manual override (the AHEC table itself gives
// ranges rather than single values).

export type ConduitType =
  | 'earthen'
  | 'masonry'
  | 'concrete'
  | 'rcc'
  | 'hdpe'
  | 'mildSteel'

export interface ConduitSpec {
  label:    string
  nDefault: number
  nMin:     number
  nMax:     number
  /** Allowed cross-sections for this conduit type. */
  sections: Array<'rectangular' | 'trapezoidal' | 'circular'>
  /** AEPC §3.3.5.1 / AHEC §8.2 maximum permissible velocity (m/s). */
  vMax:     number
  /** Notes shown in the UI hint text. */
  hint:     string
}

export const CONDUIT_LIBRARY: Record<ConduitType, ConduitSpec> = {
  earthen: {
    label:    'Earthen (unlined)',
    nDefault: 0.0263, // AHEC Table 8: 0.0225–0.0300 → midpoint
    nMin:     0.0225,
    nMax:     0.0300,
    sections: ['trapezoidal'], // AEPC §3.3.5.1(h): trapezoidal only for unlined
    vMax:     0.7, // typical non-erosive velocity for unlined earth
    hint:     'AEPC §3.3.5.1(c): only allowed for Q ≤ 30 l/s in stable ground.',
  },
  masonry: {
    label:    'Stone masonry (1:4 lined)',
    nDefault: 0.021, // AHEC Table 8: rubble masonry 0.017–0.025 → mid
    nMin:     0.017,
    nMax:     0.025,
    sections: ['rectangular', 'trapezoidal'],
    vMax:     2.0,
    hint:     'AEPC §3.3.5.1(d): recommended for higher Q and unstable ground.',
  },
  concrete: {
    label:    'Plain concrete lined',
    nDefault: 0.0135, // AHEC Table 8: 0.013–0.014
    nMin:     0.013,
    nMax:     0.014,
    sections: ['rectangular', 'trapezoidal'],
    vMax:     2.5, // AHEC §8.2.4: limiting velocity 1.5–2.75 m/s
    hint:     'AHEC §8.2.4 limiting velocity 1.5–2.75 m/s for lined sections.',
  },
  rcc: {
    label:    'RCC channel',
    nDefault: 0.018, // AHEC §8.3.1: rugosity of RCC concrete = 0.018
    nMin:     0.013,
    nMax:     0.018,
    sections: ['rectangular'],
    vMax:     2.0, // AHEC §8.3: max permissible velocity in RCC = 2 m/s
    hint:     'AHEC §8.3.1: width:depth 1:1 to 1.5:1, vMax 2.0 m/s.',
  },
  hdpe: {
    label:    'HDPE pipe',
    nDefault: 0.009,
    nMin:     0.008,
    nMax:     0.011,
    sections: ['circular'],
    vMax:     3.0,
    hint:     'AEPC §3.3.5.2(a): bury at least 1 m into ground.',
  },
  mildSteel: {
    label:    'Mild steel pipe',
    nDefault: 0.012, // AHEC Table 8: steel 0.011, conservative for MS
    nMin:     0.011,
    nMax:     0.014,
    sections: ['circular'],
    vMax:     4.0,
    hint:     'AEPC §3.3.5.2(b): used as headrace-cum-penstock in many MiniHP.',
  },
}

// ─── Input / output types ────────────────────────────────────────────────────

export type SectionShape = 'rectangular' | 'trapezoidal' | 'circular'

export interface HeadraceInput {
  // §1 design flow comes from upstream module (read-only context)
  qDesign:        number  // m³/s

  // §2 conduit type
  conduitType:    ConduitType
  manningN:       number  // editable after auto-fill from CONDUIT_LIBRARY

  // §3 geometry
  shape:          SectionShape
  baseWidth:      number  // m (b for rect/trap)
  sideSlope:      number  // z (H:V) for trapezoidal — 0 for rectangular
  flowDepth:      number  // m (y)
  pipeDiameter:   number  // m (used when shape = circular)
  bedSlope:       number  // S (m/m), e.g. 0.001 = 1:1000
  length:         number  // m
  freeboard:      number  // m (only for open channel)

  // §4 minor losses
  bendCount:      number       // count
  kBendEach:      number       // K per bend
  kEntrance:      number       // K for inlet/transition
  kExit:          number       // K for outlet/exit transition

  // §5 forebay
  forebayLength:  number  // m
  forebayWidth:   number  // m
  forebayDepth:   number  // m (active water depth above penstock crown)
  forebayFreeboard: number // m
  penstockDiameter: number // m (D — used for submergence + bell-mouth velocity)

  // §5 fine trashrack at penstock entrance
  rackBarSpacing:  number  // mm (clear)
  rackBarThickness:number  // mm
  rackInclination: number  // deg from horizontal — AEPC: 70° (1:3 H:V)
  rackBarShape:    RackBarShape
  rackVelocity:    number  // m/s (approach velocity at rack — design target)

  // turbine type — drives rack spacing recommendation
  turbineType:     TurbineKind
  nozzleDiameter:  number  // m (Pelton)
  runnerClearance: number  // m (Crossflow / Francis blade gap)
}

export type TurbineKind = 'pelton' | 'crossflow' | 'francis' | 'unknown'

export type RackBarShape =
  | 'rectangularSquare'
  | 'rectangularRound'
  | 'circular'
  | 'airfoil'

// IS:11388-1995 / Kirschmer bar shape factor β (a.k.a. K_t shape factor).
// Values reproduced from the figure shown in AEPC DFS 2014 §3.4.6.
export const RACK_BAR_SHAPE_FACTORS: Record<RackBarShape, number> = {
  rectangularSquare: 2.42,  // sharp-edged rectangular bar
  rectangularRound:  1.83,  // rectangular with rounded upstream
  circular:          1.79,  // circular bar
  airfoil:           0.76,  // streamlined airfoil
}
export const RACK_BAR_SHAPE_LABELS: Record<RackBarShape, string> = {
  rectangularSquare: 'Rectangular (square edge)',
  rectangularRound:  'Rectangular (rounded edge)',
  circular:          'Circular',
  airfoil:           'Airfoil / streamlined',
}

export interface HeadraceWarning {
  code:     string
  severity: 'error' | 'warn' | 'info'
  message:  string
}

export interface HeadraceOutput {
  // §3 hydraulic geometry
  area:                  number   // A [m²]
  wettedPerimeter:       number   // P [m]
  hydraulicRadius:       number   // R [m]
  topWidth:              number   // T [m]
  velocity:              number   // V [m/s]
  qCapacity:             number   // m³/s — Manning capacity
  capacityRatio:         number   // qCapacity / qDesign (≥ 1.10 per AEPC)
  froude:                number   // Fr [-]
  flowRegime:            'subcritical' | 'critical' | 'supercritical'

  // §4 head loss
  hFriction:             number   // m (Manning friction loss, full length)
  hMinor:                number   // m (sum of K·V²/2g)
  hHeadrace:             number   // m (total hf + h_minor)

  // §5 forebay
  forebayActiveStorageM3:    number
  forebayActiveStorageRequiredM3: number  // = 15 × qDesign per AEPC §3.3.4.3
  forebayResidenceTimeS:     number  // V/Q
  forebayMeanVelocity:       number  // m/s — should be < 0.5 (AHEC §9.3(c))

  // submergence (Gordon / AHEC §7.5)
  penstockVelocity:          number   // V at bell-mouth
  submergenceRequiredM:      number   // h ≥ C·V·√D (asymmetric, C=0.7245)
  submergenceProvidedM:      number   // = forebayDepth (above penstock crown)
  submergenceOk:             boolean

  // freeboard
  forebayFreeboardRequired:  number   // min(0.30, 0.5·d)
  forebayFreeboardOk:        boolean

  // §5 fine trashrack
  rackBlockageRatio:         number   // s/(s+t)
  rackOpenAreaRatio:         number   // = blockage
  rackHeadLossKirschmer:     number   // m  (IS:11388 / Kirschmer)
  rackRecommendedSpacingMm:  number   // half nozzle Ø or half blade gap
  rackSpacingOk:             boolean
  rackVelocityOk:            boolean

  warnings: HeadraceWarning[]
}

// ─── Geometry helpers ────────────────────────────────────────────────────────
//
// All standard open-channel-hydraulics geometry. No reference needed beyond
// any open-channel textbook, but the equations are the same ones cited in
// AHEC §8.2 and the AEPC POHV 2008 worked examples.

interface SectionGeometry {
  area:            number
  wettedPerimeter: number
  hydraulicRadius: number
  topWidth:        number  // free-surface width (used for Froude in non-rect)
  hydraulicDepth:  number  // D_h = A / T
}

function rectangularGeometry(b: number, y: number): SectionGeometry {
  const A = b * y
  const P = b + 2 * y
  return {
    area: A,
    wettedPerimeter: P,
    hydraulicRadius: A / P,
    topWidth: b,
    hydraulicDepth: y,
  }
}

function trapezoidalGeometry(b: number, y: number, z: number): SectionGeometry {
  // A = (b + z·y)·y;  P = b + 2·y·√(1+z²);  T = b + 2·z·y
  const A = (b + z * y) * y
  const P = b + 2 * y * Math.sqrt(1 + z * z)
  const T = b + 2 * z * y
  return {
    area: A,
    wettedPerimeter: P,
    hydraulicRadius: A / P,
    topWidth: T,
    hydraulicDepth: A / T,
  }
}

function circularFullGeometry(D: number): SectionGeometry {
  // Full-flowing circular pipe — used because headrace pipe is sized to run
  // full at design flow (AEPC §3.3.5.2 / AHEC §8.5.3.4 Manning for full pipes).
  const A = (Math.PI * D * D) / 4
  const P = Math.PI * D
  return {
    area: A,
    wettedPerimeter: P,
    hydraulicRadius: D / 4,
    topWidth: D,
    hydraulicDepth: D,
  }
}

// ─── Manning capacity ─────────────────────────────────────────────────────────
//
// V = (1/n) · R^(2/3) · S^(1/2)             — Manning's equation
// Q = V · A
// Source: AHEC §8.2.4 (channels) and §8.5.3.4 (full pipes), AEPC DFS 2014
// §3.3.5: "For computing head losses, Manning's equation is used for canal".

function manningVelocity(n: number, R: number, S: number): number {
  if (n <= 0 || R <= 0 || S <= 0) return 0
  return (1 / n) * Math.pow(R, 2 / 3) * Math.sqrt(S)
}

// ─── Friction head loss (full length) ────────────────────────────────────────
//
// hf = (V·n / R^(2/3))² · L      (algebraically equivalent to V²·n²·L / R^(4/3))
// Derived directly from Manning. Source: AHEC §8.2.4 / §8.5.3.4.

function manningFrictionLoss(V: number, n: number, R: number, L: number): number {
  if (R <= 0) return 0
  return (V * V * n * n * L) / Math.pow(R, 4 / 3)
}

// ─── Forebay submergence (Gordon / AHEC) ─────────────────────────────────────
//
// h ≥ C · V · √D       AHEC §7.5, with
//   C = 0.7245  (asymmetric approach — conservative default, common in MiniHP)
//   C = 0.5434  (symmetric approach)
//   D = penstock diameter at bell mouth, V = velocity at that section
//
// For Pelton/Crossflow micro-hydro the AEPC DFS §3.3.5.2(d) gives the simpler
// rule  h_min = 1.5·V²/(2g). We compute BOTH and use the MAX as the
// design submergence — engineering convention is to take the more onerous.

const SUBMERGENCE_C_ASYMMETRIC = 0.7245

function submergenceRequired(V: number, D: number): number {
  // AHEC §7.5
  const ahec = SUBMERGENCE_C_ASYMMETRIC * V * Math.sqrt(D)
  // AEPC DFS §3.3.5.2(d)
  const aepc = (1.5 * V * V) / (2 * G)
  return Math.max(ahec, aepc)
}

// ─── Trashrack head loss (Kirschmer / IS:11388-1995) ─────────────────────────
//
// h_r = β · (t/s)^(4/3) · (V²/2g) · sin(α)
//   β = bar shape factor (Kirschmer)         — IS:11388-1995, AEPC §3.4.6
//   t = bar thickness, s = clear bar spacing
//   V = approach velocity through gross area
//   α = angle of bar inclination to horizontal (≈ 70° for AEPC 1:3 H:V)
//
// Note the AHEC §8.5.3.4 expression  K_t = 1.45 − 0.45·(an/at) − (an/at)²
// applies to tunnel-portal trash racks where v is the velocity in the *net*
// area; we keep IS:11388 as the primary design formula because the AEPC DFS
// 2014 explicitly cites it (§3.4.6).

function kirschmerHeadLoss(
  shape:    RackBarShape,
  t_mm:     number,
  s_mm:     number,
  V:        number,
  alphaDeg: number,
): number {
  if (s_mm <= 0 || t_mm < 0 || V <= 0) return 0
  const beta  = RACK_BAR_SHAPE_FACTORS[shape]
  const ratio = t_mm / s_mm
  const sinA  = Math.sin((alphaDeg * Math.PI) / 180)
  return beta * Math.pow(ratio, 4 / 3) * (V * V) / (2 * G) * sinA
}

// ─── Recommended fine-rack spacing per AEPC Reference Std 2014 §3.1.1.2 ──────
//
//   - Pelton:    s = 0.5 × nozzle diameter
//   - Crossflow: s = 0.5 × clearance between runner blades
//   - Francis:   s = 0.5 × clearance between runner blades
//   - Otherwise: 10–20 mm typical (use 15 mm midpoint)

function recommendedRackSpacingMm(
  turbine:          TurbineKind,
  nozzleMm:         number,  // [mm] — matches UI field unit
  bladeClearanceMm: number,  // [mm] — matches UI field unit
): number {
  // AEPC Reference Std 2014 §3.1.1.2: spacing = ½ nozzle Ø (Pelton),
  //                                             = ½ blade clearance (Crossflow/Francis).
  // Inputs are already in mm — no ×1000 conversion needed here.
  if (turbine === 'pelton'    && nozzleMm         > 0) return 0.5 * nozzleMm
  if (turbine === 'crossflow' && bladeClearanceMm > 0) return 0.5 * bladeClearanceMm
  if (turbine === 'francis'   && bladeClearanceMm > 0) return 0.5 * bladeClearanceMm
  return 15  // fallback midpoint of 10–20 mm range (AEPC §3.1.1.2)
}

// ─── Main calculation ────────────────────────────────────────────────────────

export function calculateHeadrace(inp: HeadraceInput): HeadraceOutput {
  const w: HeadraceWarning[] = []
  const conduit = CONDUIT_LIBRARY[inp.conduitType]

  // ── §3 geometry ─────────────────────────────────────────────────────────
  let geom: SectionGeometry
  if (inp.shape === 'circular') {
    geom = circularFullGeometry(inp.pipeDiameter)
  } else if (inp.shape === 'trapezoidal') {
    geom = trapezoidalGeometry(inp.baseWidth, inp.flowDepth, inp.sideSlope)
  } else {
    geom = rectangularGeometry(inp.baseWidth, inp.flowDepth)
  }

  // Manning velocity & capacity
  const V       = manningVelocity(inp.manningN, geom.hydraulicRadius, inp.bedSlope)
  const Qcap    = V * geom.area
  // AEPC §3.3.5.1(a): canal designed for 110–120% of design discharge
  const capRatio = inp.qDesign > 0 ? Qcap / inp.qDesign : 0

  // Froude (use hydraulic depth so it's correct for trapezoidal too)
  const Dh    = geom.hydraulicDepth > 0 ? geom.hydraulicDepth : 1e-9
  const Fr    = V / Math.sqrt(G * Dh)
  const regime: HeadraceOutput['flowRegime'] =
    Fr < 0.95 ? 'subcritical' : Fr > 1.05 ? 'supercritical' : 'critical'

  // ── §4 head losses ──────────────────────────────────────────────────────
  const hFriction = manningFrictionLoss(V, inp.manningN, geom.hydraulicRadius, inp.length)
  const sumK = (inp.bendCount * inp.kBendEach) + inp.kEntrance + inp.kExit
  // h_minor = ΣK · V²/(2g)   — standard local-loss formulation
  const hMinor    = sumK * (V * V) / (2 * G)
  const hHeadrace = hFriction + hMinor

  // ── §5 forebay sizing ───────────────────────────────────────────────────
  // Active storage = L × W × d (water volume above penstock crown)
  const forebayActive = inp.forebayLength * inp.forebayWidth * inp.forebayDepth
  // AEPC DFS 2014 §3.3.4.3(3): "At least 15 sec × Qd"
  const forebayActiveReq = 15 * inp.qDesign
  // residence time at design flow
  const tRes = inp.qDesign > 0 ? forebayActive / inp.qDesign : 0
  // mean velocity through forebay (used for sediment-tail check; AHEC §9.3(c)
  // requires < 0.5 m/s)
  const forebayCrossArea = inp.forebayWidth * inp.forebayDepth
  const Vforebay = forebayCrossArea > 0 ? inp.qDesign / forebayCrossArea : 0

  // ── submergence at penstock bell-mouth ─────────────────────────────────
  const penstockArea = (Math.PI * inp.penstockDiameter * inp.penstockDiameter) / 4
  const Vpenstock    = penstockArea > 0 ? inp.qDesign / penstockArea : 0
  const subReq       = submergenceRequired(Vpenstock, inp.penstockDiameter)
  const subProv      = inp.forebayDepth
  const submergenceOk = subProv >= subReq

  // ── freeboard (AEPC §3.3.4.3(4): 300 mm or half water depth, whichever is less)
  const fbReq = Math.min(0.30, 0.5 * inp.forebayDepth)
  const fbOk  = inp.forebayFreeboard >= fbReq

  // ── §5 fine trashrack ──────────────────────────────────────────────────
  // blockage (open) ratio = s / (s + t)
  const blockage = inp.rackBarSpacing / (inp.rackBarSpacing + inp.rackBarThickness)
  const hRack = kirschmerHeadLoss(
    inp.rackBarShape,
    inp.rackBarThickness,
    inp.rackBarSpacing,
    inp.rackVelocity,
    inp.rackInclination,
  )
  const rackRecMm = recommendedRackSpacingMm(
    inp.turbineType,
    inp.nozzleDiameter,
    inp.runnerClearance,
  )
  // AEPC Ref Std §3.1.1.2: clearance = 0.5 × nozzle diameter (Pelton) /
  // 0.5 × runner-blade clearance (Crossflow). Allow 25% tolerance.
  const rackSpacingOk = Math.abs(inp.rackBarSpacing - rackRecMm) <= 0.25 * rackRecMm
  // AEPC DFS §3.4.6 / Ref Std §3.1.1.2: fine rack approach velocity 0.6–1.0 m/s
  const rackVelocityOk = inp.rackVelocity >= 0.6 && inp.rackVelocity <= 1.0

  // ── Validation ─────────────────────────────────────────────────────────

  // capacity check (AEPC §3.3.5.1(a))
  if (capRatio < 1.10) {
    w.push({
      code: 'CAPACITY_LOW',
      severity: 'error',
      message:
        `Manning capacity ${Qcap.toFixed(3)} m³/s is only ${(capRatio * 100).toFixed(0)}% of design flow. ` +
        `AEPC §3.3.5.1(a) requires 110–120%. Increase section area, slope, or n choice.`,
    })
  } else if (capRatio > 1.30) {
    w.push({
      code: 'CAPACITY_OVERSIZED',
      severity: 'info',
      message:
        `Manning capacity is ${(capRatio * 100).toFixed(0)}% of design flow — section is generous; ` +
        `AEPC target 110–120%. Consider reducing for cost.`,
    })
  }

  // velocity bounds (AEPC §3.3.5.1(b) lower, AHEC Table 8 / type-specific upper)
  if (V < 0.30) {
    w.push({
      code: 'VEL_LOW',
      severity: 'warn',
      message:
        `Velocity ${V.toFixed(2)} m/s is below AEPC §3.3.5.1(b) self-cleaning minimum 0.30 m/s — ` +
        `silt will deposit in the headrace.`,
    })
  }
  if (V > conduit.vMax) {
    w.push({
      code: 'VEL_HIGH',
      severity: 'error',
      message:
        `Velocity ${V.toFixed(2)} m/s exceeds the permissible ${conduit.vMax.toFixed(2)} m/s for ${conduit.label} ` +
        `(AHEC §8.2.4 / §8.3) — erosion / cavitation risk.`,
    })
  }

  // Froude (AHEC §8.2.4 / open-channel design — keep subcritical)
  if (regime !== 'subcritical') {
    w.push({
      code: 'FROUDE_HIGH',
      severity: 'error',
      message:
        `Froude number Fr = ${Fr.toFixed(2)} (${regime}). Headrace must run subcritical (Fr < 1) ` +
        `to avoid hydraulic jumps. Reduce slope or increase depth.`,
    })
  } else if (Fr > 0.7) {
    w.push({
      code: 'FROUDE_MARGIN',
      severity: 'warn',
      message:
        `Fr = ${Fr.toFixed(2)} — close to critical. Allow margin for surface waves.`,
    })
  }

  // Manning n outside library range
  if (inp.manningN < conduit.nMin || inp.manningN > conduit.nMax) {
    w.push({
      code: 'N_OUT_OF_RANGE',
      severity: 'info',
      message:
        `Manning's n = ${inp.manningN.toFixed(4)} is outside the AHEC Table 8 range ` +
        `[${conduit.nMin}–${conduit.nMax}] for ${conduit.label}. Justify in DFS report.`,
    })
  }

  // freeboard check (AEPC §3.3.5.1(f))
  if (inp.shape !== 'circular' && inp.freeboard < Math.min(0.30, 0.5 * inp.flowDepth)) {
    w.push({
      code: 'CHANNEL_FB_LOW',
      severity: 'warn',
      message:
        `Channel freeboard ${(inp.freeboard * 1000).toFixed(0)} mm is below AEPC §3.3.5.1(f) ` +
        `minimum (300 mm or ½ water depth, whichever is less).`,
    })
  }

  // earthen canal Q gate (AEPC §3.3.5.1(c))
  if (inp.conduitType === 'earthen' && inp.qDesign > 0.030) {
    w.push({
      code: 'EARTHEN_OVERFLOW',
      severity: 'error',
      message:
        `AEPC §3.3.5.1(c): earthen unlined canals are only allowed for Q ≤ 30 l/s. ` +
        `Design flow is ${(inp.qDesign * 1000).toFixed(0)} l/s — switch to lined section.`,
    })
  }

  // forebay storage (AEPC §3.3.4.3(3))
  if (forebayActive < forebayActiveReq) {
    w.push({
      code: 'FOREBAY_STORAGE_LOW',
      severity: 'error',
      message:
        `Forebay active storage ${forebayActive.toFixed(1)} m³ is below the AEPC §3.3.4.3(3) ` +
        `minimum of 15·Q = ${forebayActiveReq.toFixed(1)} m³ (≈ ${tRes.toFixed(1)} s residence vs 15 s required).`,
    })
  }

  // forebay velocity (AHEC §9.3(c): < 0.5 m/s)
  if (Vforebay > 0.5) {
    w.push({
      code: 'FOREBAY_VEL_HIGH',
      severity: 'warn',
      message:
        `Forebay mean velocity ${Vforebay.toFixed(2)} m/s exceeds AHEC §9.3(c) limit of 0.5 m/s — ` +
        `widen the forebay so residual sediment can settle.`,
    })
  }

  // submergence (AHEC §7.5 / AEPC §3.3.5.2(d))
  if (!submergenceOk) {
    w.push({
      code: 'SUBMERGENCE_LOW',
      severity: 'error',
      message:
        `Submergence above penstock crown ${(subProv * 1000).toFixed(0)} mm is below required ` +
        `${(subReq * 1000).toFixed(0)} mm (AHEC §7.5 / AEPC §3.3.5.2(d)). Vortex / air entrainment risk — ` +
        `deepen the forebay floor at the penstock take-off.`,
    })
  }

  // freeboard (AEPC §3.3.4.3(4))
  if (!fbOk) {
    w.push({
      code: 'FOREBAY_FB_LOW',
      severity: 'warn',
      message:
        `Forebay freeboard ${(inp.forebayFreeboard * 1000).toFixed(0)} mm is below the AEPC ` +
        `§3.3.4.3(4) requirement (${(fbReq * 1000).toFixed(0)} mm).`,
    })
  }

  // rack spacing
  if (!rackSpacingOk) {
    w.push({
      code: 'RACK_SPACING_OFF',
      severity: 'warn',
      message:
        `Fine rack spacing ${inp.rackBarSpacing} mm differs from AEPC Ref Std §3.1.1.2 recommendation ` +
        `${rackRecMm.toFixed(1)} mm (½ nozzle Ø for Pelton, ½ blade clearance for Crossflow/Francis).`,
    })
  }

  // rack velocity
  if (!rackVelocityOk) {
    w.push({
      code: 'RACK_VEL_OUT',
      severity: 'warn',
      message:
        `Rack approach velocity ${inp.rackVelocity.toFixed(2)} m/s is outside AEPC §3.4.6 / ` +
        `Ref Std §3.1.1.2 design band 0.6–1.0 m/s.`,
    })
  }

  return {
    area:                    geom.area,
    wettedPerimeter:         geom.wettedPerimeter,
    hydraulicRadius:         geom.hydraulicRadius,
    topWidth:                geom.topWidth,
    velocity:                V,
    qCapacity:               Qcap,
    capacityRatio:           capRatio,
    froude:                  Fr,
    flowRegime:              regime,

    hFriction,
    hMinor,
    hHeadrace,

    forebayActiveStorageM3:         forebayActive,
    forebayActiveStorageRequiredM3: forebayActiveReq,
    forebayResidenceTimeS:          tRes,
    forebayMeanVelocity:            Vforebay,

    penstockVelocity:        Vpenstock,
    submergenceRequiredM:    subReq,
    submergenceProvidedM:    subProv,
    submergenceOk,

    forebayFreeboardRequired: fbReq,
    forebayFreeboardOk:       fbOk,

    rackBlockageRatio:        blockage,
    rackOpenAreaRatio:        blockage,
    rackHeadLossKirschmer:    hRack,
    rackRecommendedSpacingMm: rackRecMm,
    rackSpacingOk,
    rackVelocityOk,

    warnings: w,
  }
}

// ─── Sensible defaults ───────────────────────────────────────────────────────

export const HEADRACE_DEFAULTS: Omit<HeadraceInput, 'qDesign'> = {
  conduitType:    'masonry',          // most common in Nepal MiniHP
  manningN:       CONDUIT_LIBRARY.masonry.nDefault,
  shape:          'rectangular',
  baseWidth:      1.0,
  sideSlope:      0,
  flowDepth:      0.6,
  pipeDiameter:   0.5,
  bedSlope:       0.001,              // 1:1000 — typical headrace slope
  length:         500,
  freeboard:      0.3,

  bendCount:      4,
  kBendEach:      0.20,
  kEntrance:      0.50,
  kExit:          1.00,

  forebayLength:  6,
  forebayWidth:   3,
  forebayDepth:   2,
  forebayFreeboard: 0.3,
  penstockDiameter: 0.4,

  rackBarSpacing:    20,    // mm — fine rack midpoint
  rackBarThickness:  10,    // mm
  rackInclination:   72,    // ≈ 1:3 H:V (AEPC §3.1.1.2 places fine rack at 70°)
  rackBarShape:      'rectangularRound',
  rackVelocity:      0.8,   // m/s — mid of 0.6–1.0 band

  turbineType:     'crossflow',
  nozzleDiameter:  100,   // mm (100 mm = typical small Pelton nozzle)
  runnerClearance:  40,   // mm (40 mm = typical Crossflow blade clearance)
}