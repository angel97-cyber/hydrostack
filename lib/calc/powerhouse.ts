// HydroStack — Module 06: Powerhouse Sizing & Turbine Selection (Day 8)
// Standards:
//   AEPC DFS Guidelines 2014 §3.3.7 (Powerhouse), §3.3.8 (Tailrace),
//                            §3.4.7 (Turbine selection & sizing),
//                            §3.4.8 (Governors, valves, drive systems)
//   AEPC POHV 2008 — Procurement, Operation & Handling Verification
//                    (turbine selection envelopes for Pelton, Turgo,
//                     Crossflow, Francis used in Nepali micro/mini hydro)
//   AEPC Reference Micro Hydro Power Standard 2014 §2.3.1.7 (Powerhouse),
//                                                  §3.1.7 (Turbines),
//                                                  §3.1.8 (Drive systems)
//   AHEC §12 — Power House design (location, dimensioning, layout)
//   AHEC §1.6 — Performance evaluation and weighted efficiency
//
// Engine scope:
//   1. H_n (read from upstream penstock; otherwise compute defensively)
//   2. P_hydraulic = ρ·g·Q·H_n
//   3. Envelope-fit turbine selection (Pelton / Turgo / Crossflow / Francis)
//   4. Runner sizing per AEPC §3.4.7 for the chosen type
//   5. Synchronous & runaway speeds; specific speed
//   6. Setting elevation (Francis Thoma cavitation, otherwise above-tailwater)
//   7. Generator kVA rating snapped to a commercial size
//   8. Powerhouse footprint per AHEC §12 + AEPC §3.3.7
//
// Manual reference case (verified before coding):
//   H_gross = 100 m, Q = 0.15 m³/s, losses ≈ 5 m → H_n ≈ 95 m
//   P_hyd ≈ 139.8 kW · η_overall(Crossflow) ≈ 0.75 → P_installed ≈ 105 kW
//   Envelopes that fit: Pelton (multi-jet), Turgo, Crossflow (Francis fails)
//   Primary: Crossflow (Nepal sweet spot; locally manufactured for <500 kW)
//   D_runner = 300 mm standard, N_t ≈ 1300 rpm → belt drive to 1500 rpm gen
//   Specific speed ns ≈ 53 (within Crossflow envelope 42–200)
//   Generator 125 kVA, powerhouse ≈ 36 m² × 4 m height
//
// All math is dimensionally explicit. Field unit contracts (mm vs m, kW vs W,
// rpm vs rad/s) are encoded into the type names where ambiguous.

// ─── Physical constants ────────────────────────────────────────────────────
export const RHO_W = 1000.0           // kg/m³  · water density
export const G = 9.81                  // m/s²  · gravitational acceleration
export const ATM_PA = 101_325          // Pa     · standard atmosphere
export const VAPOR_PA_20C = 2_339      // Pa     · vapor pressure of water at 20 °C
export const FREQ_HZ_NEPAL = 50        // Hz     · grid frequency (Nepal & India)

// ─── Turbine type ──────────────────────────────────────────────────────────
export type TurbineType = 'pelton' | 'turgo' | 'crossflow' | 'francis'

// ─── Turbine envelopes (AEPC POHV 2008 + AEPC DFS 2014 §3.4.7.1) ───────────
// These are the operating envelopes commonly accepted in Nepali mini hydro.
// Pelton: H ≥ 100 m for single-jet, multi-jet (≥2 jets) accepts H ≥ 50 m.
// Turgo: 50 ≤ H ≤ 250 m, 0.05 ≤ Q ≤ 2 m³/s.
// Crossflow: 5 ≤ H ≤ 200 m, 0.02 ≤ Q ≤ 10 m³/s — the Nepali default.
// Francis: 20 ≤ H ≤ 300 m, Q > 0.5 m³/s (reaction; needs sufficient flow).
export interface TurbineEnvelope {
  hMin: number; hMax: number     // m
  qMin: number; qMax: number     // m³/s
  etaTypical: number             // 0–1, AEPC DFS 2014 Table 3.3 mid-band
  nsMin: number; nsMax: number   // metric specific speed (AEPC Table 3.4)
  runawayFactor: number          // n_runaway / n_rated
}
export const TURBINE_ENVELOPES: Record<TurbineType, TurbineEnvelope> = {
  pelton:    { hMin: 100, hMax: 1000, qMin: 0.005, qMax: 2.0,
               etaTypical: 0.85, nsMin: 8,  nsMax: 72,  runawayFactor: 1.8 },
  turgo:     { hMin:  50, hMax: 250,  qMin: 0.05,  qMax: 2.0,
               etaTypical: 0.82, nsMin: 20, nsMax: 70,  runawayFactor: 1.9 },
  crossflow: { hMin:   5, hMax: 200,  qMin: 0.02,  qMax: 10.0,
               etaTypical: 0.75, nsMin: 42, nsMax: 200, runawayFactor: 1.9 },
  francis:   { hMin:  20, hMax: 300,  qMin: 0.5,   qMax: 50.0,
               etaTypical: 0.88, nsMin: 60, nsMax: 350, runawayFactor: 2.0 },
}

// Standard runner sizes — Nepal market.
// Pelton PCDs from AEPC Reference MH Standard 2014 §3.1.7.1.
// Crossflow runner D up to 300 mm per AEPC Reference MH Standard 2014 §3.1.7.2.
const PELTON_PCDS_MM = [150, 200, 250, 300, 350, 400, 450, 500, 600, 800, 1000]
const CROSSFLOW_DIAMETERS_MM = [200, 250, 300, 400, 500]   // 300 is AEPC default

// Standard commercial generator ratings (kVA) — common in Nepali market.
const STANDARD_KVA = [
  10, 12.5, 15, 20, 25, 30, 40, 50, 62.5, 75, 100, 125, 160,
  200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000,
]

// ─── Inputs ────────────────────────────────────────────────────────────────
export interface PowerhouseInputs {
  // Hydraulics (read from upstream; user can override here)
  qDesignM3s: number             // m³/s  · design discharge
  hGrossM: number                // m     · gross head
  hLossIntakeM: number           // m     · intake + settling losses (upstream)
  hLossHeadraceM: number         // m     · headrace + forebay losses (upstream)
  hLossPenstockM: number         // m     · penstock friction + minor losses

  // Turbine override (optional — if null, engine picks primary)
  turbineOverride: TurbineType | null

  // Generator design (Nepal grid 50 Hz)
  numberOfPoles: number          // even integer ≥2; pole-pairs = poles/2
  driveSystem: 'direct' | 'vbelt' | 'flat-belt' | 'gearbox'
  powerFactor: number            // typical 0.80 – 0.90, default 0.85

  // Pelton / Turgo specifics
  numberOfJets: number           // 1 or 2 horizontal-shaft, more vertical

  // Francis tailwater for setting elevation
  tailwaterMinElevationMasl: number  // m a.s.l. — minimum tailrace level
  siteElevationMasl: number          // m a.s.l. — affects atmospheric pressure
  waterTemperatureC: number          // °C, for vapor pressure correction

  // Powerhouse design
  designFloodLevelMasl: number   // m a.s.l. — 100-yr HFL (AEPC ≥30 kW)

  // Drive system efficiency override (optional)
  driveEfficiencyOverride: number | null   // 0–1; if null, use typical
}

// ─── Outputs ───────────────────────────────────────────────────────────────
export interface TurbineCandidate {
  type: TurbineType
  fits: boolean
  fitMargin: number              // 0–1; 1 = perfect centred fit
  reason: string                  // human-readable disposition
  efficiencyTypical: number       // 0–1
}

export interface RunnerSizing {
  type: TurbineType
  // Common
  syncSpeedRpm: number            // generator synchronous rpm
  turbineSpeedRpm: number         // turbine shaft rpm (may differ via belt)
  runawaySpeedRpm: number         // runner runaway rpm
  specificSpeedNs: number         // metric ns (AEPC formula)
  // Pelton / Turgo
  pcdMm?: number                  // pitch circle diameter
  jetDiameterMm?: number          // single jet diameter
  jetVelocityMs?: number          // m/s
  pcdJetRatio?: number             // PCD / d_jet  (target 10–14)
  numberOfJets?: number
  // Crossflow
  runnerDiameterMm?: number
  runnerWidthMm?: number          // including AEPC 20 % safety
  jetThicknessMm?: number
  // Francis
  runnerD3Mm?: number             // outlet diameter
  runnerHeightBMm?: number        // = 0.5·D3
  inletDiameterMm?: number
  spiralCaseAMm?: number
  spiralCaseBMm?: number
  spiralCaseCMm?: number
  draftTubePMm?: number
  draftTubeQMm?: number
  draftTubeXMm?: number
  // Francis cavitation / setting
  thomaSigma?: number              // dimensionless
  suctionHeadHsM?: number          // m, positive ⇒ runner above tailwater
  settingElevationMasl?: number    // m a.s.l. — runner C/L elevation
}

export interface GeneratorRating {
  shaftPowerKw: number              // turbine shaft → after η_turbine
  electricalPowerKw: number         // after η_drive · η_generator
  apparentPowerKva: number          // P_e / cos φ
  standardKvaSelected: number       // snapped to commercial size
  voltageVoltsLine: number          // 400 V LV typical for ≤200 kW Nepal
  syncSpeedRpm: number              // 60·f/(p/2) = 120·f/p
  poles: number
  efficiencyDrive: number
  efficiencyGenerator: number
  efficiencyOverall: number          // η_t · η_drive · η_gen
  powerFactor: number
}

export interface PowerhouseLayout {
  unitBayLengthM: number             // turbine + gen + governor + clearances
  unitBayWidthM: number              // turbine pit + operator passage
  unitBayAreaM2: number
  serviceBayAreaM2: number           // = 1 unit bay if multi-unit; smaller for single
  controlRoomAreaM2: number
  transformerPadAreaM2: number
  totalFootprintAreaM2: number       // covered floor area
  buildingHeightM: number            // = floor head room (AHEC min 4 m)
  craneHookHeightM: number           // top of crane lift
  requiredApproachElevationMasl: number   // ≥1 m above HFL
  approachAboveHflM: number          // computed offset
}

export interface HydraulicsResult {
  qDesignM3s: number
  hGrossM: number
  hLossTotalM: number
  hNetM: number
  hydraulicPowerKw: number
}

export interface PowerhouseOutputs {
  hydraulics: HydraulicsResult
  candidates: TurbineCandidate[]
  primary: TurbineType
  primaryRationale: string
  alternatives: TurbineType[]       // ordered by fit-score
  selected: TurbineType             // primary unless user overrode
  runner: RunnerSizing
  generator: GeneratorRating
  powerhouse: PowerhouseLayout
  warnings: string[]
  errors: string[]
}

// ─── Default inputs ────────────────────────────────────────────────────────
export const POWERHOUSE_DEFAULTS: PowerhouseInputs = {
  qDesignM3s: 0.15,
  hGrossM: 100.0,
  hLossIntakeM: 0.30,
  hLossHeadraceM: 1.50,
  hLossPenstockM: 3.20,
  turbineOverride: null,
  numberOfPoles: 4,             // 1500 rpm sync — most common Nepal mfg
  driveSystem: 'vbelt',         // typical for crossflow & low-speed Pelton
  powerFactor: 0.85,
  numberOfJets: 1,
  tailwaterMinElevationMasl: 1000,
  siteElevationMasl: 1000,
  waterTemperatureC: 15,
  designFloodLevelMasl: 1002,   // 2 m above tailwater default
  driveEfficiencyOverride: null,
}

// ──────────────────────────────────────────────────────────────────────────
// Helper functions
// ──────────────────────────────────────────────────────────────────────────

/** Synchronous speed in rpm for given pole count and frequency.
 *  n_sync = 120·f / p  (where p = total poles, not pole pairs) */
export function syncSpeed(poles: number, freqHz = FREQ_HZ_NEPAL): number {
  return (120 * freqHz) / poles
}

/** Round generator kVA up to next commercial size. */
function snapToStandardKva(kva: number): number {
  for (const s of STANDARD_KVA) if (s >= kva) return s
  return STANDARD_KVA[STANDARD_KVA.length - 1]
}

/** Drive efficiency by type — typical Nepal manufacturer values. */
function defaultDriveEfficiency(t: PowerhouseInputs['driveSystem']): number {
  switch (t) {
    case 'direct':    return 0.99   // virtually no loss (AEPC §3.4.8.3)
    case 'vbelt':     return 0.95
    case 'flat-belt': return 0.93
    case 'gearbox':   return 0.97
  }
}

/** Generator efficiency by power range — typical synchronous machine, Nepal mfg. */
function generatorEfficiency(kw: number): number {
  if (kw <  20) return 0.86
  if (kw <  50) return 0.90
  if (kw < 200) return 0.93
  if (kw < 500) return 0.94
  return 0.95
}

/** Saturation vapor pressure (Pa) at temperature t (°C) — Antoine, simplified. */
function vaporPressurePa(tC: number): number {
  // Antoine equation for water 1–100 °C, P in mmHg:
  // log10(P) = A − B/(C+t),  A=8.07131, B=1730.63, C=233.426
  const log10P_mmHg = 8.07131 - 1730.63 / (233.426 + tC)
  const P_mmHg = Math.pow(10, log10P_mmHg)
  return P_mmHg * 133.322   // mmHg → Pa
}

/** Atmospheric pressure (Pa) at altitude (m a.s.l.) — barometric formula. */
function atmPressurePa(elevationMasl: number): number {
  // ISA: P(z) = P0 · (1 − Lz/T0)^(gM/RL)
  const T0 = 288.15
  const L = 0.0065
  const gM_RL = 5.25588
  return ATM_PA * Math.pow(1 - (L * elevationMasl) / T0, gM_RL)
}

// ──────────────────────────────────────────────────────────────────────────
// 1. Turbine envelope check & primary selection
// ──────────────────────────────────────────────────────────────────────────

/** Compute fit margin (0–1) for an envelope.
 *  1 = at the geometric centre of the envelope; 0 = on the boundary or outside.
 *  Negative means outside (clamped to 0 for selection but reported in reason). */
function envelopeFitMargin(
  H: number, Q: number, env: TurbineEnvelope,
): { fits: boolean; margin: number } {
  if (H < env.hMin || H > env.hMax) return { fits: false, margin: 0 }
  if (Q < env.qMin || Q > env.qMax) return { fits: false, margin: 0 }
  // Distance from each boundary, normalised
  const hMid = (env.hMin + env.hMax) / 2
  const qMid = (env.qMin + env.qMax) / 2
  const hRange = (env.hMax - env.hMin) / 2
  const qRange = (env.qMax - env.qMin) / 2
  const hDist = 1 - Math.abs(H - hMid) / hRange   // 1 at centre, 0 at edge
  // Use log-scale flow midpoint (envelopes span orders of magnitude in Q)
  const logQ = Math.log10(Q)
  const logQMid = (Math.log10(env.qMin) + Math.log10(env.qMax)) / 2
  const logQRange = (Math.log10(env.qMax) - Math.log10(env.qMin)) / 2
  const qDistLog = 1 - Math.abs(logQ - logQMid) / logQRange
  const margin = (hDist + qDistLog) / 2
  return { fits: true, margin: Math.max(0, Math.min(1, margin)) }
}

/** Build the candidate list and pick a primary. */
function selectTurbines(
  H: number, Q: number, P_hyd_kw: number, jets: number,
): {
  candidates: TurbineCandidate[]
  primary: TurbineType
  primaryRationale: string
  alternatives: TurbineType[]
} {
  const candidates: TurbineCandidate[] = (Object.keys(TURBINE_ENVELOPES) as TurbineType[])
    .map((type) => {
      let env = TURBINE_ENVELOPES[type]
      // Pelton: relax H lower bound to 50 m if multi-jet (≥2)
      if (type === 'pelton' && jets >= 2) {
        env = { ...env, hMin: 50 }
      }
      const { fits, margin } = envelopeFitMargin(H, Q, env)
      let reason: string
      if (fits) {
        reason = type === 'pelton' && jets >= 2
          ? `Multi-jet (${jets}) envelope: H ≥ 50 m, Q < ${env.qMax}/jet`
          : `Within envelope: H ${env.hMin}–${env.hMax} m, Q ${env.qMin}–${env.qMax} m³/s`
      } else if (H < env.hMin) reason = `Head ${H.toFixed(1)} m below ${type} minimum ${env.hMin} m`
      else if (H > env.hMax) reason = `Head ${H.toFixed(1)} m above ${type} maximum ${env.hMax} m`
      else if (Q < env.qMin) reason = `Flow ${Q.toFixed(3)} m³/s below ${type} minimum ${env.qMin} m³/s`
      else                   reason = `Flow ${Q.toFixed(3)} m³/s above ${type} maximum ${env.qMax} m³/s`
      return { type, fits, fitMargin: margin, reason, efficiencyTypical: env.etaTypical }
    })

  // Score: fit margin + Nepal context bonus + efficiency advantage
  // Nepal (per AEPC POHV 2008 + Butchers et al. 2022): Crossflow dominates the
  // micro/mini market because it is locally manufactured, simple, and cheaper.
  // Pelton is preferred only at high head (H ≥ 150 m) where jet impulse efficiency
  // dominates. Francis & Turgo are rarer in Nepal manufacturing.
  const score = candidates.map((c) => {
    if (!c.fits) return { ...c, score: -1 }
    let s = c.fitMargin
    // Nepal context bonus
    if (c.type === 'crossflow' && P_hyd_kw < 500) s += 0.30
    if (c.type === 'pelton' && H >= 150) s += 0.20
    if (c.type === 'francis' && Q >= 1.0) s += 0.15
    // Slight bonus for higher efficiency
    s += (c.efficiencyTypical - 0.75) * 0.30
    return { ...c, score: s }
  }).sort((a, b) => b.score - a.score)

  const fitsList = score.filter((c) => c.fits)
  if (fitsList.length === 0) {
    // Fallback: pick the highest-margin even if it doesn't fit (warn later)
    return {
      candidates,
      primary: 'crossflow',
      primaryRationale: `No envelope fully fits — Crossflow chosen as fallback (most permissive envelope per AEPC POHV 2008)`,
      alternatives: [],
    }
  }
  const primary = fitsList[0].type
  const alternatives = fitsList.slice(1).map((c) => c.type)
  let rationale: string
  if (primary === 'crossflow' && P_hyd_kw < 500) {
    rationale = `Crossflow primary at ${P_hyd_kw.toFixed(0)} kW: AEPC POHV 2008 sweet spot for Nepali micro/mini hydro — locally manufactured, simple maintenance, ${(TURBINE_ENVELOPES.crossflow.etaTypical * 100).toFixed(0)} % typical η.`
  } else if (primary === 'pelton') {
    rationale = `Pelton primary at H = ${H.toFixed(0)} m: high impulse efficiency at this head; AEPC DFS 2014 Table 3.2 (high-head category).`
  } else if (primary === 'francis') {
    rationale = `Francis primary: reaction turbine optimal at Q = ${Q.toFixed(2)} m³/s, H = ${H.toFixed(0)} m; highest typical η (88 %).`
  } else if (primary === 'turgo') {
    rationale = `Turgo primary: balanced impulse runner at H = ${H.toFixed(0)} m, Q = ${Q.toFixed(2)} m³/s.`
  } else {
    rationale = `${primary} chosen by envelope-fit margin and efficiency.`
  }
  return { candidates, primary, primaryRationale: rationale, alternatives }
}

// ──────────────────────────────────────────────────────────────────────────
// 2. Runner sizing per turbine type (AEPC DFS 2014 §3.4.7)
// ──────────────────────────────────────────────────────────────────────────

function sizePelton(
  Q: number, H: number, jets: number, syncRpm: number, P_shaft_kw: number,
): RunnerSizing {
  // AEPC §3.4.7: v_jet = Cd · √(2gH), Cd = 0.96
  const Cd = 0.96
  const v_jet = Cd * Math.sqrt(2 * G * H)
  // Q per jet → jet area → diameter
  const A_jet = Q / (jets * v_jet)             // m²
  const d_jet_m = Math.sqrt((4 * A_jet) / Math.PI)
  // Optimum bucket peripheral speed v_b = φ · v_jet, φ ≈ 0.46
  const phi = 0.46
  const v_b = phi * v_jet                      // m/s
  // PCD from N: PCD = 60·v_b / (π·N)
  const PCD_m = (60 * v_b) / (Math.PI * syncRpm)
  // Snap to nearest available standard PCD ≥ computed
  const PCD_mm = PELTON_PCDS_MM.find((p) => p >= PCD_m * 1000) ?? PELTON_PCDS_MM[PELTON_PCDS_MM.length - 1]
  // Specific speed per AEPC (metric, 1 unit): ns = N·√(1.4·P) / H^1.25
  const ns = syncRpm * Math.sqrt(1.4 * P_shaft_kw) / Math.pow(H, 1.25)
  return {
    type: 'pelton',
    syncSpeedRpm: syncRpm,
    turbineSpeedRpm: syncRpm,                 // direct-coupled assumption
    runawaySpeedRpm: syncRpm * TURBINE_ENVELOPES.pelton.runawayFactor,
    specificSpeedNs: ns,
    pcdMm: PCD_mm,
    jetDiameterMm: d_jet_m * 1000,
    jetVelocityMs: v_jet,
    pcdJetRatio: (PCD_mm / 1000) / d_jet_m,
    numberOfJets: jets,
  }
}

function sizeTurgo(
  Q: number, H: number, jets: number, syncRpm: number, P_shaft_kw: number,
): RunnerSizing {
  // Turgo runs faster than Pelton at the same head; uses similar jet equation
  // but with bucket angle 20° → φ ≈ 0.46 still applies.
  // PCD/d_jet ratio is smaller (typical 4–7 vs 10–14 for Pelton).
  const Cd = 0.96
  const v_jet = Cd * Math.sqrt(2 * G * H)
  const A_jet = Q / (jets * v_jet)
  const d_jet_m = Math.sqrt((4 * A_jet) / Math.PI)
  // Turgo bucket-speed coefficient ≈ 0.47 (slightly higher than Pelton)
  const v_b = 0.47 * v_jet
  const PCD_m = (60 * v_b) / (Math.PI * syncRpm)
  const PCD_mm = PELTON_PCDS_MM.find((p) => p >= PCD_m * 1000) ?? PELTON_PCDS_MM[PELTON_PCDS_MM.length - 1]
  const ns = syncRpm * Math.sqrt(1.4 * P_shaft_kw) / Math.pow(H, 1.25)
  return {
    type: 'turgo',
    syncSpeedRpm: syncRpm,
    turbineSpeedRpm: syncRpm,
    runawaySpeedRpm: syncRpm * TURBINE_ENVELOPES.turgo.runawayFactor,
    specificSpeedNs: ns,
    pcdMm: PCD_mm,
    jetDiameterMm: d_jet_m * 1000,
    jetVelocityMs: v_jet,
    pcdJetRatio: (PCD_mm / 1000) / d_jet_m,
    numberOfJets: jets,
  }
}

function sizeCrossflow(
  Q: number, H: number, syncRpm: number, P_shaft_kw: number,
): RunnerSizing {
  // AEPC §3.4.7 Crossflow:
  // D_runner [m] = 40·√H / N_t (Ossberger empirical; N_t = turbine rpm)
  // Standard available D_runner = 300 mm (AEPC + Reference MH Standard 2014)
  // jet thickness t_jet = 0.10·D to 0.20·D (use 0.15·D centre)
  // Q_ss = 0.8 · Q_d (sub-stream effective flow, AEPC)
  // B = Q_ss / (t_jet · Cd · √(2gH)); +20 % safety on calculated B (AEPC).
  //
  // Strategy: pick the standard D ≥ ideal-D-at-syncRpm; recompute actual N_t.
  // If N_t < syncRpm, a belt drive is required (typical Nepali Crossflow).
  const D_ideal_m = (40 * Math.sqrt(H)) / syncRpm
  const D_mm = CROSSFLOW_DIAMETERS_MM.find((d) => d >= D_ideal_m * 1000) ?? 300
  const D_m = D_mm / 1000
  const N_t = (40 * Math.sqrt(H)) / D_m       // actual turbine rpm at chosen D
  const t_jet_ratio = 0.15
  const t_jet_m = t_jet_ratio * D_m
  const Cd = 0.97
  const Q_ss = 0.8 * Q                         // AEPC §3.4.7
  const B_calc_m = Q_ss / (t_jet_m * Cd * Math.sqrt(2 * G * H))
  const B_safe_m = B_calc_m * 1.20             // AEPC: +20 %
  // Specific speed at turbine rpm
  const ns = N_t * Math.sqrt(1.4 * P_shaft_kw) / Math.pow(H, 1.25)
  return {
    type: 'crossflow',
    syncSpeedRpm: syncRpm,
    turbineSpeedRpm: N_t,
    runawaySpeedRpm: N_t * TURBINE_ENVELOPES.crossflow.runawayFactor,
    specificSpeedNs: ns,
    runnerDiameterMm: D_mm,
    runnerWidthMm: B_safe_m * 1000,
    jetThicknessMm: t_jet_m * 1000,
  }
}

function sizeFrancis(
  Q: number, H: number, syncRpm: number, P_shaft_kw: number,
  inputs: PowerhouseInputs,
): RunnerSizing {
  // AEPC §3.4.7 Francis sizing relations (Schweiger–Gregori family):
  //   nq = N · √Q / H^0.75  (specific speed flow-based, metric)
  //   D3 [m] (outlet) = 84.5 · k_u · √H / N, where k_u ≈ 0.31·(nq/100)^0.5 + 0.31
  //   b  (height of runner) = 0.5 · D3
  //   D1 (inlet) = (0.4 + 94.5/nq) · D3
  //   Spiral case: A = (-0.0813 + 0.773·D3)·nq^0.1, etc.
  //   Draft tube: P = 0.428 + 2.812·D3, etc.
  //
  // Cavitation setting (Thoma):
  //   σ = 7.54e-5 · nq^1.41   [empirical Schweiger-Gregori for Francis]
  //   H_s_max [m] = (P_atm − P_vapor)/(ρ·g) − σ·H
  //   Z_setting = Z_tw + H_s   (positive H_s ⇒ runner above tailwater)
  const nq = (syncRpm * Math.sqrt(Q)) / Math.pow(H, 0.75)
  const k_u = 0.31 * Math.sqrt(nq / 100) + 0.31
  const D3_m = (84.5 * k_u * Math.sqrt(H)) / syncRpm
  const b_m = 0.5 * D3_m
  const D1_m = (0.4 + 94.5 / nq) * D3_m
  const A_m = (-0.0813 + 0.773 * D3_m) * Math.pow(nq, 0.1)
  const B_m = ( 0.362 + 1.889 * D3_m) * Math.pow(nq, 0.1)
  const C_m = ( 0.162 + 2.288 * D3_m) * Math.pow(nq, 0.1)
  const P_dt_m = 0.428 + 2.812 * D3_m
  const Q_dt_m = 0.273 + 0.670 * D3_m
  const X_dt_m = -0.568 + 2.741 * D3_m
  // Cavitation
  const sigma = 7.54e-5 * Math.pow(nq, 1.41)
  const Pa = atmPressurePa(inputs.siteElevationMasl)
  const Pv = vaporPressurePa(inputs.waterTemperatureC)
  const Hs_max = (Pa - Pv) / (RHO_W * G) - sigma * H
  const Z_setting = inputs.tailwaterMinElevationMasl + Hs_max
  const ns = syncRpm * Math.sqrt(1.4 * P_shaft_kw) / Math.pow(H, 1.25)
  return {
    type: 'francis',
    syncSpeedRpm: syncRpm,
    turbineSpeedRpm: syncRpm,                  // Francis usually direct-coupled
    runawaySpeedRpm: syncRpm * TURBINE_ENVELOPES.francis.runawayFactor,
    specificSpeedNs: ns,
    runnerD3Mm: D3_m * 1000,
    runnerHeightBMm: b_m * 1000,
    inletDiameterMm: D1_m * 1000,
    spiralCaseAMm: A_m * 1000,
    spiralCaseBMm: B_m * 1000,
    spiralCaseCMm: C_m * 1000,
    draftTubePMm: P_dt_m * 1000,
    draftTubeQMm: Q_dt_m * 1000,
    draftTubeXMm: X_dt_m * 1000,
    thomaSigma: sigma,
    suctionHeadHsM: Hs_max,
    settingElevationMasl: Z_setting,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 3. Generator rating
// ──────────────────────────────────────────────────────────────────────────

function sizeGenerator(
  P_hyd_kw: number, eta_t: number, inputs: PowerhouseInputs,
): GeneratorRating {
  const eta_drive = inputs.driveEfficiencyOverride ?? defaultDriveEfficiency(inputs.driveSystem)
  const P_shaft_kw = P_hyd_kw * eta_t
  const P_genmech_kw = P_shaft_kw * eta_drive
  const eta_gen = generatorEfficiency(P_genmech_kw)
  const P_elec_kw = P_genmech_kw * eta_gen
  const P_kva = P_elec_kw / inputs.powerFactor
  const standardKva = snapToStandardKva(P_kva)
  // Voltage: 400 V LV common Nepal up to ~250 kVA, 11 kV MV above
  const voltage = standardKva <= 250 ? 400 : 11_000
  return {
    shaftPowerKw: P_shaft_kw,
    electricalPowerKw: P_elec_kw,
    apparentPowerKva: P_kva,
    standardKvaSelected: standardKva,
    voltageVoltsLine: voltage,
    syncSpeedRpm: syncSpeed(inputs.numberOfPoles),
    poles: inputs.numberOfPoles,
    efficiencyDrive: eta_drive,
    efficiencyGenerator: eta_gen,
    efficiencyOverall: eta_t * eta_drive * eta_gen,
    powerFactor: inputs.powerFactor,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 4. Powerhouse footprint per AHEC §12 + AEPC §3.3.7
// ──────────────────────────────────────────────────────────────────────────

function sizePowerhouse(
  runner: RunnerSizing, gen: GeneratorRating, inputs: PowerhouseInputs,
): PowerhouseLayout {
  // AHEC §12.2: clearance between turbine/generator and walls = 1.5–2 m,
  // operator passage = 1.0–1.5 m, head room min 4 m per floor.
  // For sub-200 kW micro/mini: typically a single unit, no separate service bay.
  // We size the unit-bay footprint parametrically from runner geometry,
  // generator size and clearances.

  // Approximate machine footprints (m). These are conservative envelopes.
  let turbine_L = 1.2, turbine_W = 1.0
  if (runner.type === 'pelton' || runner.type === 'turgo') {
    const pcd = (runner.pcdMm ?? 300) / 1000
    turbine_L = 0.6 + 2.0 * pcd          // case + nozzle assembly
    turbine_W = 0.4 + 1.6 * pcd
  } else if (runner.type === 'crossflow') {
    const D = (runner.runnerDiameterMm ?? 300) / 1000
    const B = (runner.runnerWidthMm ?? 200) / 1000
    turbine_L = 0.4 + 1.5 * D + Math.max(0, B)   // axial direction = width + housing
    turbine_W = 0.5 + 2.0 * D
  } else if (runner.type === 'francis') {
    const D3 = (runner.runnerD3Mm ?? 300) / 1000
    const A = (runner.spiralCaseAMm ?? 300) / 1000
    turbine_L = A + 1.2 * D3
    turbine_W = A + 1.2 * D3
  }

  // Generator footprint (rough rule for synchronous machines @ 1500 rpm)
  const gen_L = 0.6 + 0.0035 * gen.standardKvaSelected   // m
  const gen_W = 0.5 + 0.0020 * gen.standardKvaSelected

  // Clearances
  const endClearance = 1.75   // AHEC: 1.5–2 m
  const passageWidth = 1.20   // AHEC: 1.0–1.5 m

  // Unit-bay length: turbine + drive + generator + governor + 2 end clearances
  const drive_L = inputs.driveSystem === 'direct' ? 0.0 : 0.8
  const governor_L = 0.6
  const unitBay_L = endClearance + turbine_L + drive_L + gen_L + governor_L + endClearance
  const unitBay_W = Math.max(turbine_W, gen_W) + passageWidth + 0.6   // + control side

  const unitBayArea = unitBay_L * unitBay_W

  // Service bay (AHEC §12.2: equal to one unit bay if 2–3 units; smaller for single)
  const serviceBayArea = unitBayArea * 0.40

  // Control room ≥ 6 m² for ≤200 kW; ~10 m² for higher
  const controlRoom = gen.standardKvaSelected <= 200 ? 6.0 : 10.0

  // Transformer pad (outdoor, conceptual): ~1.5 m² for ≤100 kVA, scaled
  const transformerPad = 1.5 + 0.005 * gen.standardKvaSelected

  // Total covered area
  const totalArea = unitBayArea + serviceBayArea + controlRoom

  // Building height — head room + crane
  const headRoom = 4.0                                      // AHEC §12.4.1 min
  const craneHook = headRoom + 0.5
  const buildingHeight = craneHook + 0.5

  // Approach level — AEPC §3.3.7 / AHEC §12.1: ≥ 1 m above HFL.
  // Reference MH Standard 2014 §2.3.1.7: 50-yr below 30 kW, 100-yr above.
  const requiredApproach = inputs.designFloodLevelMasl + 1.0
  const approachAboveHfl = requiredApproach - inputs.designFloodLevelMasl

  return {
    unitBayLengthM: unitBay_L,
    unitBayWidthM: unitBay_W,
    unitBayAreaM2: unitBayArea,
    serviceBayAreaM2: serviceBayArea,
    controlRoomAreaM2: controlRoom,
    transformerPadAreaM2: transformerPad,
    totalFootprintAreaM2: totalArea,
    buildingHeightM: buildingHeight,
    craneHookHeightM: craneHook,
    requiredApproachElevationMasl: requiredApproach,
    approachAboveHflM: approachAboveHfl,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// 5. Top-level compute
// ──────────────────────────────────────────────────────────────────────────

export function computePowerhouse(inputs: PowerhouseInputs): PowerhouseOutputs {
  const errors: string[] = []
  const warnings: string[] = []

  const Q = inputs.qDesignM3s
  const H_g = inputs.hGrossM
  const h_loss = (inputs.hLossIntakeM || 0) +
                 (inputs.hLossHeadraceM || 0) +
                 (inputs.hLossPenstockM || 0)
  const H_n = Math.max(0, H_g - h_loss)

  if (Q <= 0)        errors.push('Design flow Q must be positive.')
  if (H_g <= 0)      errors.push('Gross head H_gross must be positive.')
  if (H_n <= 0)      errors.push('Net head H_n is non-positive — head losses exceed gross head.')
  if (h_loss / H_g > 0.10) {
    warnings.push(`Total losses ${(h_loss / H_g * 100).toFixed(1)} % > 10 % of gross head — review upstream modules (AEPC limit 7 %).`)
  }
  if (inputs.numberOfPoles % 2 !== 0 || inputs.numberOfPoles < 2) {
    errors.push('Generator pole count must be an even integer ≥ 2.')
  }
  if (inputs.powerFactor < 0.5 || inputs.powerFactor > 1.0) {
    warnings.push(`Power factor ${inputs.powerFactor} outside typical range 0.80–0.90.`)
  }

  const P_hyd_kw = (RHO_W * G * Q * H_n) / 1000

  const hydraulics: HydraulicsResult = {
    qDesignM3s: Q,
    hGrossM: H_g,
    hLossTotalM: h_loss,
    hNetM: H_n,
    hydraulicPowerKw: P_hyd_kw,
  }

  // Turbine selection
  const sel = selectTurbines(H_n, Q, P_hyd_kw, inputs.numberOfJets)
  const selected: TurbineType = inputs.turbineOverride ?? sel.primary
  const env = TURBINE_ENVELOPES[selected]
  const eta_t = env.etaTypical

  if (inputs.turbineOverride && !sel.candidates.find((c) => c.type === selected && c.fits)) {
    warnings.push(`User-selected ${selected} is outside its AEPC POHV 2008 envelope — verify with manufacturer.`)
  }

  // Runner sizing
  const sync = syncSpeed(inputs.numberOfPoles)
  const P_shaft_kw = P_hyd_kw * eta_t

  let runner: RunnerSizing
  switch (selected) {
    case 'pelton':
      runner = sizePelton(Q, H_n, inputs.numberOfJets, sync, P_shaft_kw); break
    case 'turgo':
      runner = sizeTurgo(Q, H_n, inputs.numberOfJets, sync, P_shaft_kw); break
    case 'crossflow':
      runner = sizeCrossflow(Q, H_n, sync, P_shaft_kw); break
    case 'francis':
      runner = sizeFrancis(Q, H_n, sync, P_shaft_kw, inputs); break
  }

  // Specific-speed envelope check
  if (runner.specificSpeedNs < env.nsMin || runner.specificSpeedNs > env.nsMax) {
    warnings.push(`Specific speed ns = ${runner.specificSpeedNs.toFixed(1)} outside ${selected} range ${env.nsMin}–${env.nsMax} (AEPC Table 3.4) — adjust pole count or turbine type.`)
  }
  // Pelton PCD/d_jet ratio sanity (typical 10–14)
  if ((runner.type === 'pelton' || runner.type === 'turgo') && runner.pcdJetRatio !== undefined) {
    const minRatio = runner.type === 'pelton' ? 9 : 5
    const maxRatio = runner.type === 'pelton' ? 16 : 9
    if (runner.pcdJetRatio < minRatio) {
      warnings.push(`PCD/d_jet ratio ${runner.pcdJetRatio.toFixed(1)} < ${minRatio} — runner too small relative to jet; consider more jets, lower-speed gen, or a different turbine.`)
    } else if (runner.pcdJetRatio > maxRatio) {
      warnings.push(`PCD/d_jet ratio ${runner.pcdJetRatio.toFixed(1)} > ${maxRatio} — oversized PCD; consider fewer jets or higher-speed gen.`)
    }
  }
  // Crossflow width sanity (Reference MH Standard 2014 §3.1.7.2: standard widths up to 1000 mm)
  if (runner.type === 'crossflow' && runner.runnerWidthMm !== undefined) {
    if (runner.runnerWidthMm > 1000) {
      warnings.push(`Crossflow width ${runner.runnerWidthMm.toFixed(0)} mm > 1000 mm — exceeds Reference MH Standard 2014 standard widths; consider larger D or two units.`)
    } else if (runner.runnerWidthMm < 50) {
      warnings.push(`Crossflow width ${runner.runnerWidthMm.toFixed(0)} mm < 50 mm — very narrow runner; review jet-thickness ratio.`)
    }
  }
  // Francis cavitation safety
  if (runner.type === 'francis' && runner.suctionHeadHsM !== undefined) {
    if (runner.suctionHeadHsM < 0) {
      warnings.push(`Francis runner must be set ${(-runner.suctionHeadHsM).toFixed(2)} m below tailwater (negative H_s) to avoid cavitation — submerged setting required.`)
    } else if (runner.suctionHeadHsM > 4) {
      warnings.push(`Francis suction head H_s = ${runner.suctionHeadHsM.toFixed(2)} m unusually high — verify Thoma σ for the specific speed.`)
    }
  }

  // Generator
  const generator = sizeGenerator(P_hyd_kw, eta_t, inputs)

  // Generator-vs-shaft sanity: chosen kVA should not be wildly oversized OR undersized
  const overSizeRatio = generator.standardKvaSelected / generator.apparentPowerKva
  if (overSizeRatio > 1.40) {
    warnings.push(`Generator ${generator.standardKvaSelected} kVA is ${(overSizeRatio * 100 - 100).toFixed(0)} % above computed ${generator.apparentPowerKva.toFixed(1)} kVA — next-smaller commercial size may be more economical.`)
  }
  if (generator.apparentPowerKva > STANDARD_KVA[STANDARD_KVA.length - 1]) {
    warnings.push(`Required apparent power ${generator.apparentPowerKva.toFixed(0)} kVA exceeds the largest standard size in the library (${STANDARD_KVA[STANDARD_KVA.length - 1]} kVA) — multi-unit installation or special-order generator required.`)
  }
  // AEPC scope: mini hydropower is defined as 100 kW – 1000 kW; micro < 100 kW.
  // Above 1 MW is small hydro (different standards apply, e.g. IS 12800 series).
  if (generator.electricalPowerKw > 1000) {
    warnings.push(`Plant capacity ${generator.electricalPowerKw.toFixed(0)} kW exceeds the AEPC mini-hydropower upper bound of 1 MW — small-hydro standards (IS 12800 series, AEPC SHP guidelines) apply for design and licensing.`)
  }

  // Powerhouse footprint
  const powerhouse = sizePowerhouse(runner, generator, inputs)

  // Tailrace setting check (AEPC Reference MH Standard 2014 §2.3.1.8)
  if (runner.type === 'pelton' || runner.type === 'crossflow' || runner.type === 'turgo') {
    warnings.push(`Pelton/Crossflow/Turgo runner must be set ≥ 0.20 m above max tailwater (AEPC Reference MH Standard 2014 §2.3.1.8.a) — verify with manufacturer general arrangement.`)
  }
  // Powerhouse-above-flood check (AEPC §3.3.7 / Reference MH Standard §2.3.1.7.b)
  if (inputs.designFloodLevelMasl <= inputs.tailwaterMinElevationMasl) {
    warnings.push(`Design flood level (${inputs.designFloodLevelMasl} m) is at or below tailwater minimum (${inputs.tailwaterMinElevationMasl} m) — flood level input is suspect.`)
  }
  // Hoist requirement (Reference MH Standard 2014 §2.3.1.7.d): ≥50 kW must have hoist
  if (generator.electricalPowerKw >= 50) {
    warnings.push(`Plant ≥ 50 kW: a temporary or permanent hoist is required for turbine/generator installation and repair (Reference MH Standard 2014 §2.3.1.7.d).`)
  }

  return {
    hydraulics,
    candidates: sel.candidates,
    primary: sel.primary,
    primaryRationale: sel.primaryRationale,
    alternatives: sel.alternatives,
    selected,
    runner,
    generator,
    powerhouse,
    warnings,
    errors,
  }
}