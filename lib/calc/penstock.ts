// HydroStack — Module 04: Penstock (pure calculation engine)
//
// Sources (all read from project knowledge before this file was written):
//   - AEPC DFS Guidelines for Mini Hydropower Projects, 2014 §3.4.1
//       D_trial = 41·Q[l/s]^0.38 mm; total head loss ≤ 5 % of gross head;
//       MS for low-head flanged ≤60 m, otherwise welded; HDPE/GRP buried 1 m.
//   - AHEC-IITR/MNRE/SHP Standards, Civil Works — Hydraulic & Structural Design,
//       §11.4 (empirical D — Sarkaria, Bier, Fahlbusch),
//       §11.5.2.3 (Manning friction loss in pipes),
//       §11.5.2.4 (bend loss h = kb·V²/2g),
//       §11.5.2.5/6/7 (contraction, expansion, valve losses),
//       Table 11 (permissible stresses).
//   - IS 11625:1986 §4.4.1.2 (Manning n: steel 0.008–0.012, concrete 0.012–0.014),
//                  §4.5.2/4.5.3 (other losses),
//                  §6 (economic diameter — full formula not implemented;
//                      AEPC trial + empirical comparison used instead per §11.4).
//   - IS 11639 Part 1:1986 (surface penstocks — structural design):
//       §6.1.1 hoop stress S = P·r / t,
//       §8.2 minimum thickness D/500 cm,
//       §8.3 corrosion allowance NOT recommended for steel liners (paint instead);
//             industry practice in Nepal mini-hydro is 1.5 mm — toggleable here,
//       §9.1.1 normal-condition working stress: FoS 3 on UTS, AND maximum stress
//             ≤ 0.5·yield strength.
//   - IS 11639 Part 2:1995 §5.1.3 wave celerity a = 1425 / √(1 + d/(100·t))
//             (d, t in same units, m).
//   - Joukowski (1898): full surge ΔH = a·V/g — conservative for instantaneous
//             closure; partial closures attenuate per Allievi/Michaud but for
//             Mini-HP without detailed transient analysis the full Joukowski
//             surge is the standard design value.
//
// All formulas cite the originating standard inline. No invented constants.

// ─── Constants ───────────────────────────────────────────────────────────────

export const G       = 9.81    // m/s²  gravitational acceleration
export const RHO_W   = 1000    // kg/m³ density of water
export const A_SOUND = 1425    // m/s   speed of sound in water (IS 11639 Pt 2 §5.1.3)

// ─── Material catalogue ──────────────────────────────────────────────────────
//
// Allowable stress is computed at use-time per IS 11639 Pt 1 §9.1.1:
//   σ_allow_normal = min( UTS / 3 , 0.5 · fy )
// For non-metals (HDPE/GRP/uPVC) we follow ISO 12162 / IS practice and use
// MRS / Coverage factor as the design value.

export type PenstockMaterial =
  | 'ms_is2062'        // Mild Steel IS 2062 Grade E250 — primary structural steel
  | 'hdpe_pe100'       // HDPE PE100 — buried small/low-head schemes
  | 'upvc'             // uPVC — small heads, buried only
  | 'grp'              // GRP — buried, light, corrosion-free
  | 'ductile_iron'     // Ductile Iron IS 8329

export interface MaterialSpec {
  label:                string
  utsMpa:               number   // ultimate tensile strength, MPa (steels) — or MRS for HDPE
  fyMpa:                number   // yield strength, MPa (steels only — set equal to UTS for plastics)
  manningN:             number   // Manning's roughness coefficient
  defaultCorrosionMm:   number   // default corrosion allowance, mm
  density_kgm3:         number   // material density (anchor block / weight calcs)
  notes:                string
}

export const PENSTOCK_MATERIALS: Record<PenstockMaterial, MaterialSpec> = {
  ms_is2062: {
    label: 'Mild Steel — IS 2062 Grade E250 (Fe 410)',
    utsMpa: 410,                                 // IS 2062 Grade E250 minimum UTS
    fyMpa:  250,                                 // IS 2062 Grade E250 minimum yield
    manningN: 0.012,                             // IS 11625 §4.4.1.2 upper of steel range
    defaultCorrosionMm: 1.5,                     // Nepal MH industry practice
    density_kgm3: 7850,
    notes: 'Default for Nepal mini-hydro. Welded for H>60 m, flanged otherwise (AEPC §3.4.1).',
  },
  hdpe_pe100: {
    label: 'HDPE — PE100',
    utsMpa: 10,                                  // ISO 12162 MRS for PE100
    fyMpa:  10,                                  // (no yield; design from MRS)
    manningN: 0.009,                             // industry value, smoother than MS
    defaultCorrosionMm: 0,                       // no corrosion
    density_kgm3: 950,
    notes: 'Buried at ≥1 m depth (AEPC §3.4.1). Use SDR-rated pipe.',
  },
  upvc: {
    label: 'uPVC',
    utsMpa: 25,                                  // typical PN16 design stress
    fyMpa:  25,
    manningN: 0.009,
    defaultCorrosionMm: 0,
    density_kgm3: 1400,
    notes: 'Buried only. Limited to low head and Q.',
  },
  grp: {
    label: 'GRP — Glass-Reinforced Plastic',
    utsMpa: 80,                                  // hoop tensile design — AHEC §11.1
    fyMpa:  80,
    manningN: 0.010,
    defaultCorrosionMm: 0,
    density_kgm3: 1900,                          // AHEC §11.1 Table SG 1.8–1.9
    notes: 'Light weight. Buried or above-ground. AHEC §11.1.',
  },
  ductile_iron: {
    label: 'Ductile Iron — IS 8329',
    utsMpa: 420,                                 // IS 8329 K9 minimum
    fyMpa:  300,                                 // IS 8329 K9 0.2 % proof stress
    manningN: 0.012,
    defaultCorrosionMm: 1.0,                     // factory-coated, lower than MS
    density_kgm3: 7100,
    notes: 'Spun-cast. AHEC §7.3.4. Pre-corrosion-coated.',
  },
}

/**
 * Allowable design stress under normal operation per IS 11639 Pt 1 §9.1.1:
 *   σ_allow = min( UTS / FoS_uts , 0.5 · fy )      with FoS_uts = 3.0
 *
 * Returns σ_allow in MPa.
 */
export function allowableStressNormal(mat: PenstockMaterial): number {
  const m = PENSTOCK_MATERIALS[mat]
  // For plastics (hdpe/upvc/grp) UTS is already set to the MRS-based design
  // value, so the 0.5·fy term doesn't bind.
  return Math.min(m.utsMpa / 3.0, 0.5 * m.fyMpa)
}

// ─── §1 Empirical / trial diameter formulae (AHEC §11.4 + AEPC §3.4.1) ──────
//
// Each function returns an internal pipe diameter in metres for the given
// design flow Q (m³/s) and rated head H (m). They are independent estimates
// — none is "right"; the engineer should look at the spread, pick a value
// in the band that gives V in 2–4 m/s, and verify hf ≤ 5 % of H_gross.

/** AEPC DFS 2014 §3.4.1: D = 41·Q[l/s]^0.38 mm.   Returns D in metres. */
export function diameterAEPC(Q_m3s: number): number {
  if (Q_m3s <= 0) return 0
  const Q_lps = Q_m3s * 1000
  return (41 * Math.pow(Q_lps, 0.38)) / 1000   // mm → m
}

/**
 * Sarkaria's formula 1958 — the discharge form (AHEC §11.4 (i)):
 *   D = 3.55 · ( Q² / (2·g·H) )^(1/4)
 * (this avoids needing a turbine HP estimate).
 */
export function diameterSarkaria(Q_m3s: number, H_m: number): number {
  if (Q_m3s <= 0 || H_m <= 0) return 0
  return 3.55 * Math.pow((Q_m3s * Q_m3s) / (2 * G * H_m), 0.25)
}

/**
 * Sarkaria's formula 1958 — the power form (AHEC §11.4 (i)):
 *   D = 0.62 · P^0.43 / H^0.65        [P = rated metric HP, H = m]
 * Computes P from Q, H and an assumed turbine efficiency η_t (default 0.85).
 */
export function diameterSarkariaPower(
  Q_m3s: number,
  H_m: number,
  etaTurbine = 0.85,
): number {
  if (Q_m3s <= 0 || H_m <= 0) return 0
  const P_kW = etaTurbine * RHO_W * G * Q_m3s * H_m / 1000        // hydraulic kW
  const P_metricHP = P_kW / 0.7355                                // 1 metric HP = 0.7355 kW
  return (0.62 * Math.pow(P_metricHP, 0.43)) / Math.pow(H_m, 0.65)
}

/**
 * P. J. Bier USBR-1958 (AHEC §11.4 (iii)):
 *   D = 0.466 · (P / H)^0.176        [P = metric HP, H = m]
 */
export function diameterBier1958(
  Q_m3s: number,
  H_m: number,
  etaTurbine = 0.85,
): number {
  if (Q_m3s <= 0 || H_m <= 0) return 0
  const P_kW = etaTurbine * RHO_W * G * Q_m3s * H_m / 1000
  const P_metricHP = P_kW / 0.7355
  return 0.466 * Math.pow(P_metricHP / H_m, 0.176)
}

/**
 * Fahlbusch (Water Power Feb 1987) — steel-lined conduits (AHEC §11.4 (v)):
 *   Ds = 1.12 · H^(-0.12) · Q^0.45
 */
export function diameterFahlbuschSteel(Q_m3s: number, H_m: number): number {
  if (Q_m3s <= 0 || H_m <= 0) return 0
  return 1.12 * Math.pow(H_m, -0.12) * Math.pow(Q_m3s, 0.45)
}

/**
 * Fahlbusch (Water Power Feb 1987) — concrete-lined conduits (AHEC §11.4 (v)):
 *   Dc = 0.62 · Q^0.48
 */
export function diameterFahlbuschConcrete(Q_m3s: number): number {
  if (Q_m3s <= 0) return 0
  return 0.62 * Math.pow(Q_m3s, 0.48)
}

/**
 * P. J. Bier USBR-1949 permissible velocity (AHEC §11.4 (ii)):
 *   V_perm = 0.125 · √(2·g·H)
 * Returns the corresponding minimum diameter D = √(4Q / (π · V_perm)).
 */
export function diameterBier1949(Q_m3s: number, H_m: number): number {
  if (Q_m3s <= 0 || H_m <= 0) return 0
  const V_perm = 0.125 * Math.sqrt(2 * G * H_m)
  return Math.sqrt((4 * Q_m3s) / (Math.PI * V_perm))
}

/** Bier-1949 permissible velocity in m/s (used as a sanity ceiling, not a target). */
export function bierPermissibleVelocity(H_m: number): number {
  if (H_m <= 0) return 0
  return 0.125 * Math.sqrt(2 * G * H_m)
}

// ─── §2 Hydraulic helpers ────────────────────────────────────────────────────

/** Mean velocity through a circular pipe flowing full. */
export function pipeVelocity(Q_m3s: number, D_m: number): number {
  if (D_m <= 0) return 0
  return Q_m3s / ((Math.PI * D_m * D_m) / 4)
}

/**
 * Manning friction head loss in a full circular pipe (AHEC §11.5.2.3):
 *   hf = V² · n² · L / R^(4/3)        where R = D/4 for full circular section.
 */
export function frictionLossManning(
  V_ms: number,
  n: number,
  L_m: number,
  D_m: number,
): number {
  if (V_ms <= 0 || D_m <= 0 || L_m <= 0) return 0
  const R = D_m / 4
  return (V_ms * V_ms * n * n * L_m) / Math.pow(R, 4 / 3)
}

// ─── §3 Wave celerity, Joukowski surge, iterative thickness design ──────────

/**
 * IS 11639 Part 2:1995 §5.1.3 — pressure-wave velocity in a free penstock:
 *   a = 1425 / √( 1 + D / (100 · t) )      [D, t in metres]
 *
 * For a pipe concreted in solid rock, IS 11639 Pt 2 §5.1.3 (ii) sets a = 1425
 * directly (use waveCelerityRockEmbedded() below).
 */
export function waveCelerity(D_m: number, t_m: number): number {
  if (D_m <= 0 || t_m <= 0) return A_SOUND
  return A_SOUND / Math.sqrt(1 + D_m / (100 * t_m))
}

/** Joukowski full surge: ΔH = a · V / g.  Returns ΔH in metres. */
export function joukowskiSurge(a_ms: number, V_ms: number): number {
  return (a_ms * V_ms) / G
}

/**
 * Iteratively design the wall thickness for a steel penstock per
 * IS 11639 Part 1 §6.1.1 with Joukowski surge (IS 11639 Pt 2 §5.1.3) and
 * the §8.2 minimum thickness rule.
 *
 * Loop:  guess t → a(t) → ΔH = a·V/g → H_d → t_req = (ρgH_d)·r / σ_allow
 *        t_new = t_req + corrosion → repeat until |t_new - t| < tol.
 *
 * Final design thickness = max(t_new, t_min D/500) and rounded up to
 * the next available commercial plate thickness in `commercial_mm`.
 */
export interface ThicknessSolution {
  tReqMm:           number    // structural requirement (corrosion already added)
  tMinMm:           number    // IS 11639 Pt 1 §8.2 minimum
  tDesignMm:        number    // governing design value (mm)
  tCommercialMm:    number    // rounded up to commercial plate
  iterations:       number
  converged:        boolean
  waveCelerity:     number    // m/s
  surgeHeadM:       number    // ΔH (m)
  designHeadM:      number    // H_static + ΔH
  designPressureMpa:number    // ρ·g·H_d (MPa)
  allowableStressMpa: number
  criticalTimeS:    number    // 2L/a — boundary between Joukowski & Michaud (s)
  closureMode:      'joukowski' | 'michaud'   // which formula governed
}

// Standard Indian commercial MS plate thicknesses (mm). Smaller pipes typically
// use 4–8 mm, larger heads need 10–16 mm. Round-up improves manufacturability.
const COMMERCIAL_PLATE_MM = [4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32]

/**
 * Surge head selector — Joukowski vs Michaud.
 *
 * Joukowski (1898): ΔH = a·V/g — instantaneous closure, conservative upper bound.
 * Michaud (gradual closure): ΔH = 2·L·V / (g·T_c)
 *   Valid when T_c > T_critical = 2·L/a  [AHEC §11.5.2.9 / IS 12967 standard practice]
 *   When T_c ≤ T_critical the wave reflects before the valve finishes closing and
 *   Joukowski still governs.
 *
 * closureTimeS = 0 → always use Joukowski (default conservative).
 */
function computeSurge(
  a_ms: number,
  V_ms: number,
  L_m:  number,
  closureTimeS: number,
): { dH: number; criticalTimeS: number; mode: 'joukowski' | 'michaud' } {
  const T_crit = (a_ms > 0 && L_m > 0) ? (2 * L_m / a_ms) : 0
  if (closureTimeS > 0 && T_crit > 0 && closureTimeS > T_crit) {
    // Michaud gradual closure: ΔH = 2·L·V / (g·T_c)
    return { dH: (2 * L_m * V_ms) / (G * closureTimeS), criticalTimeS: T_crit, mode: 'michaud' }
  }
  // Joukowski instantaneous
  return { dH: (a_ms * V_ms) / G, criticalTimeS: T_crit, mode: 'joukowski' }
}

export function designThickness(
  D_mm:           number,
  V_ms:           number,
  H_static_m:     number,
  material:       PenstockMaterial,
  corrosionMm?:   number,
  rockEmbedded:   boolean = false,
  lengthM:        number = 500,
  closureTimeS:   number = 0,
): ThicknessSolution {
  const D_m = D_mm / 1000
  const r_m = D_m / 2
  const sigma_allow_Mpa = allowableStressNormal(material)
  const sigma_allow_Pa  = sigma_allow_Mpa * 1e6
  const corr            = corrosionMm ?? PENSTOCK_MATERIALS[material].defaultCorrosionMm

  // Initial guess: D/500 (IS 11639 §8.2) — physically reasonable.
  let t_m  = (D_m / 500) > 0.004 ? (D_m / 500) : 0.004    // never below 4 mm
  let a_ms = 0
  let dH_m = 0
  let H_d  = 0
  let t_req_m = 0
  let iter = 0
  let converged = false

  let criticalTimeS = 0
  let closureMode: 'joukowski' | 'michaud' = 'joukowski'

  for (iter = 0; iter < 50; iter++) {
    a_ms = rockEmbedded ? A_SOUND : waveCelerity(D_m, t_m)
    const surge = computeSurge(a_ms, V_ms, lengthM, closureTimeS)
    dH_m         = surge.dH
    criticalTimeS = surge.criticalTimeS
    closureMode   = surge.mode
    H_d      = H_static_m + dH_m
    const P_d_Pa = RHO_W * G * H_d
    // IS 11639 Pt 1 §6.1.1 hoop stress: t = P·r / σ
    t_req_m  = (P_d_Pa * r_m) / sigma_allow_Pa
    const t_new = t_req_m + corr / 1000

    if (Math.abs(t_new - t_m) < 1e-5) {     // 0.01 mm tolerance
      t_m = t_new
      converged = true
      break
    }
    t_m = t_new
  }

  const t_min_m  = D_m / 500                                 // IS 11639 §8.2
  const t_struct_mm = (t_req_m + corr / 1000) * 1000         // already in mm
  const t_design_mm = Math.max(t_struct_mm, t_min_m * 1000)

  // Round up to commercial plate
  let t_comm_mm = t_design_mm
  for (const p of COMMERCIAL_PLATE_MM) {
    if (p >= t_design_mm) { t_comm_mm = p; break }
  }
  if (t_comm_mm < t_design_mm) {                              // off the chart
    t_comm_mm = Math.ceil(t_design_mm)
  }

  return {
    tReqMm:           t_struct_mm,
    tMinMm:           t_min_m * 1000,
    tDesignMm:        t_design_mm,
    tCommercialMm:    t_comm_mm,
    iterations:       iter + 1,
    converged,
    waveCelerity:     a_ms,
    surgeHeadM:       dH_m,
    designHeadM:      H_d,
    designPressureMpa:(RHO_W * G * H_d) / 1e6,
    allowableStressMpa: sigma_allow_Mpa,
    criticalTimeS,
    closureMode,
  }
}

// ─── Module IO contracts ─────────────────────────────────────────────────────

export interface PenstockInput {
  // §1 design flow & head come from upstream modules — set by server
  qDesign:       number    // m³/s
  grossHead:     number    // m
  hIntakeLoss:   number    // m  (from intake module; 0 if not yet saved)
  hHeadrace:     number    // m  (from headrace module; 0 if not yet saved)

  // §2 material & geometry
  material:      PenstockMaterial
  diameterMm:    number    // INTERNAL diameter, mm
  lengthM:       number    // along-pipe length, m
  slopeAngleDeg: number    // β — penstock slope, degrees
  manningN:      number    // editable; auto-filled from material on change
  rockEmbedded:  boolean   // for buried-in-rock pipes (a = 1425 m/s)

  // §3 thickness override
  corrosionMm:        number   // editable; defaults from material
  thicknessOverrideMm: number  // 0 = auto from designThickness()
  closureTimeS:       number   // 0 = Joukowski; >T_critical = Michaud gradual closure

  // §4 minor loss coefficients (∑K analogue per Day-5 pattern)
  kEntrance:     number    // 0.5 sharp · 0.05 bell-mouth (AHEC §11.5.2.1/2)
  bendCount:     number    // total number of bends
  kBendEach:     number    // 0.10–0.25 typical for R/D ≥ 4 (AHEC §11.5.2.4)
  kValve:        number    // butterfly fully-open ≈ 0.1–0.3 (AHEC §11.5.2.7 Fig 59)
  kContraction:  number    // 0.1 (10° flare) → 0.5 (sudden) (AHEC §11.5.2.5)

  // §5 turbine efficiency for installed-capacity recompute
  etaOverall:    number    // η_t · η_g · η_tx — typically 0.75–0.85
}

export interface PenstockWarning {
  severity: 'info' | 'warn' | 'error'
  message:  string
}

export interface PenstockOutput {
  // §2 diameter recommendations
  diameterAEPC_m:               number
  diameterSarkaria_m:           number
  diameterBier1958_m:           number
  diameterFahlbuschSteel_m:     number
  diameterFahlbuschConcrete_m:  number
  diameterBier1949_m:           number
  bierPermissibleVelocity:      number

  // §3 thickness
  thickness:                    ThicknessSolution
  thicknessSelectedMm:          number    // user override OR commercial
  externalDiameterMm:           number    // = D + 2·t (used by anchor block)

  // §4 hydraulics
  velocity:                     number    // m/s
  velocityHeadM:                number    // V²/(2g)
  hFrictionM:                   number
  hEntranceM:                   number
  hBendsM:                      number
  hValveM:                      number
  hContractionM:                number
  hMinorM:                      number
  hPenstockM:                   number    // total
  headLossPctOfGross:           number

  // §5 net head & power
  hNetM:                        number
  installedCapacityKw:          number
  hydraulicPowerKw:             number    // ρgQH_net (no efficiency)

  // §6 mass / weight (used by anchor block module)
  pipeWeightKgPerM:             number
  waterWeightKgPerM:            number
  totalWeightKgPerM:            number

  warnings:                     PenstockWarning[]
}

// ─── Master calculator ───────────────────────────────────────────────────────

export function calculatePenstock(i: PenstockInput): PenstockOutput {
  const w: PenstockWarning[] = []
  const Q  = i.qDesign
  const H_static = i.grossHead - i.hIntakeLoss - i.hHeadrace
  const D_m = i.diameterMm / 1000

  // Empirical diameter spread
  const dAEPC      = diameterAEPC(Q)
  const dSarkaria  = diameterSarkaria(Q, H_static)
  const dBier1958  = diameterBier1958(Q, H_static)
  const dFahlSteel = diameterFahlbuschSteel(Q, H_static)
  const dFahlConc  = diameterFahlbuschConcrete(Q)
  const dBier1949  = diameterBier1949(Q, H_static)
  const vBierPerm  = bierPermissibleVelocity(H_static)

  // Velocity
  const V          = pipeVelocity(Q, D_m)
  const Vh         = (V * V) / (2 * G)

  // Iterative thickness — must come before any hf calc that depends on
  // commercial plate (the user may override).
  const thickness  = designThickness(
    i.diameterMm, V, H_static, i.material,
    i.corrosionMm, i.rockEmbedded,
    i.lengthM, i.closureTimeS,
  )
  const tSelectedMm = i.thicknessOverrideMm > 0
    ? i.thicknessOverrideMm
    : thickness.tCommercialMm

  // Hydraulic losses (AHEC §11.5.2.x)
  const hFriction   = frictionLossManning(V, i.manningN, i.lengthM, D_m)
  const hEntrance   = i.kEntrance    * Vh
  const hBends      = i.bendCount    * i.kBendEach * Vh
  const hValve      = i.kValve       * Vh
  const hContract   = i.kContraction * Vh
  const hMinor      = hEntrance + hBends + hValve + hContract
  const hPenstock   = hFriction + hMinor

  const hLossPct    = i.grossHead > 0 ? (hPenstock / i.grossHead) * 100 : 0

  // Net head & power
  const hNet        = i.grossHead - i.hIntakeLoss - i.hHeadrace - hPenstock
  const P_h_kW      = (RHO_W * G * Q * Math.max(hNet, 0)) / 1000
  const P_inst_kW   = i.etaOverall * P_h_kW

  // Pipe & water weight per metre (for anchor block + saddle design)
  const t_m         = tSelectedMm / 1000
  const D_o_m       = D_m + 2 * t_m
  const A_steel     = (Math.PI / 4) * (D_o_m * D_o_m - D_m * D_m)
  const A_water     = (Math.PI / 4) * D_m * D_m
  const wPipe_kgm   = A_steel * PENSTOCK_MATERIALS[i.material].density_kgm3
  const wWater_kgm  = A_water * RHO_W

  // ─── Engineering checks → warnings ──────────────────────────────────────
  if (Q <= 0)
    w.push({ severity: 'error',
      message: 'Design flow is zero. Save the hydrology module first.' })
  if (i.grossHead <= 0)
    w.push({ severity: 'error',
      message: 'Gross head is zero. Save the hydrology module first.' })
  if (H_static <= 0 && Q > 0)
    w.push({ severity: 'error',
      message: 'Static head reaching the penstock is non-positive — upstream losses exceed gross head. Re-check intake/headrace results.' })

  // AEPC §3.4.1 (5) — total losses ≤ 5 % of gross head
  if (hLossPct > 5 && hLossPct <= 7)
    w.push({ severity: 'warn',
      message: `Penstock head loss ${hLossPct.toFixed(2)} % of gross head exceeds AEPC 5 % target. Increase D or justify economically (AEPC §3.4.1.5).` })
  if (hLossPct > 7)
    w.push({ severity: 'error',
      message: `Penstock head loss ${hLossPct.toFixed(2)} % of gross head — well above AEPC 5 % target. Increase pipe diameter.` })

  // Velocity bands. Industry practice for MS Mini-HP is 2–4 m/s; Bier-1949 is
  // an upper sanity ceiling (≈ 0.125·√(2gH)).
  if (V > 0 && V < 2.0)
    w.push({ severity: 'info',
      message: `Velocity ${V.toFixed(2)} m/s is below the 2–4 m/s industry band — pipe diameter may be oversized.` })
  if (V > 4.0 && V <= vBierPerm)
    w.push({ severity: 'warn',
      message: `Velocity ${V.toFixed(2)} m/s exceeds the 2–4 m/s industry band but is within Bier-1949 permissible (${vBierPerm.toFixed(2)} m/s). Consider increasing diameter.` })
  if (V > vBierPerm && vBierPerm > 0)
    w.push({ severity: 'error',
      message: `Velocity ${V.toFixed(2)} m/s exceeds Bier-1949 permissible velocity ${vBierPerm.toFixed(2)} m/s (AHEC §11.4 (ii)). Pipe is undersized.` })

  // Surge / thickness sanity
  if (!thickness.converged)
    w.push({ severity: 'warn',
      message: 'Thickness iteration did not converge in 50 steps. Increase trial diameter or check inputs.' })
  if (i.thicknessOverrideMm > 0 && i.thicknessOverrideMm < thickness.tDesignMm)
    w.push({ severity: 'error',
      message: `Selected thickness ${i.thicknessOverrideMm.toFixed(1)} mm is below the IS 11639 design value ${thickness.tDesignMm.toFixed(1)} mm.` })

  // IS 11639 Pt 1 §9.1.1 max stress check via thickness (defensive)
  const sigmaUsedMpa = (thickness.designPressureMpa * (D_m / 2)) / (tSelectedMm / 1000)
  const fy = PENSTOCK_MATERIALS[i.material].fyMpa
  if (sigmaUsedMpa > 0.5 * fy && i.material === 'ms_is2062')
    w.push({ severity: 'error',
      message: `Hoop stress ${sigmaUsedMpa.toFixed(1)} MPa exceeds 0.5·fy = ${(0.5 * fy).toFixed(0)} MPa (IS 11639 Pt 1 §9.1.1). Increase thickness.` })

  // AEPC §3.4.1: flanged MS only ≤ 60 m head
  if (i.material === 'ms_is2062' && i.grossHead > 60)
    w.push({ severity: 'info',
      message: 'Gross head > 60 m — site welding recommended over flanged joints (AEPC §3.4.1).' })

  // AEPC §3.4.1: HDPE/GRP must be buried
  if ((i.material === 'hdpe_pe100' || i.material === 'grp' || i.material === 'upvc') && !i.rockEmbedded)
    w.push({ severity: 'info',
      message: 'HDPE / uPVC / GRP penstocks must be buried at ≥1 m depth (AEPC §3.4.1).' })

  // Slope angle sanity
  if (i.slopeAngleDeg < 0 || i.slopeAngleDeg > 60)
    w.push({ severity: 'warn',
      message: `Slope angle ${i.slopeAngleDeg.toFixed(0)}° is outside the typical 0–60° range. Verify site profile.` })

  // Diameter spread informational note
  if (Q > 0 && H_static > 0) {
    const dAvg = (dAEPC + dSarkaria + dBier1958 + dFahlSteel) / 4
    const deviation = Math.abs(D_m - dAvg) / dAvg
    if (deviation > 0.30)
      w.push({ severity: 'info',
        message: `Selected D = ${(D_m * 1000).toFixed(0)} mm differs by ${(deviation * 100).toFixed(0)} % from the empirical-average ${(dAvg * 1000).toFixed(0)} mm. Confirm choice is intentional.` })
  }

  // Bend count sanity
  if (i.bendCount < 0 || i.bendCount > 20)
    w.push({ severity: 'warn',
      message: `Bend count ${i.bendCount} is outside typical 0–20 range.` })

  // Net head sanity
  if (hNet <= 0 && Q > 0)
    w.push({ severity: 'error',
      message: 'Net head is non-positive — total losses exceed gross head. Increase diameter.' })

  return {
    diameterAEPC_m:              dAEPC,
    diameterSarkaria_m:          dSarkaria,
    diameterBier1958_m:          dBier1958,
    diameterFahlbuschSteel_m:    dFahlSteel,
    diameterFahlbuschConcrete_m: dFahlConc,
    diameterBier1949_m:          dBier1949,
    bierPermissibleVelocity:     vBierPerm,

    thickness,
    thicknessSelectedMm:  tSelectedMm,
    externalDiameterMm:   i.diameterMm + 2 * tSelectedMm,

    velocity:             V,
    velocityHeadM:        Vh,
    hFrictionM:           hFriction,
    hEntranceM:           hEntrance,
    hBendsM:              hBends,
    hValveM:              hValve,
    hContractionM:        hContract,
    hMinorM:              hMinor,
    hPenstockM:           hPenstock,
    headLossPctOfGross:   hLossPct,

    hNetM:                hNet,
    installedCapacityKw:  P_inst_kW,
    hydraulicPowerKw:     P_h_kW,

    pipeWeightKgPerM:     wPipe_kgm,
    waterWeightKgPerM:    wWater_kgm,
    totalWeightKgPerM:    wPipe_kgm + wWater_kgm,

    warnings:             w,
  }
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const PENSTOCK_DEFAULTS: Omit<PenstockInput,
  'qDesign' | 'grossHead' | 'hIntakeLoss' | 'hHeadrace'
> = {
  material:           'ms_is2062',
  diameterMm:         500,                    // 0.5 m typical Mini-HP
  lengthM:            500,                    // m
  slopeAngleDeg:      30,                     // typical hill slope
  manningN:           PENSTOCK_MATERIALS.ms_is2062.manningN,
  rockEmbedded:       false,

  corrosionMm:        PENSTOCK_MATERIALS.ms_is2062.defaultCorrosionMm,
  thicknessOverrideMm: 0,                     // 0 = auto
  closureTimeS:        0,                     // 0 = Joukowski (conservative); set to governor T_c for Michaud

  kEntrance:          0.50,                   // sharp inlet (default conservative)
  bendCount:          3,
  kBendEach:          0.20,                   // R/D ≈ 2, smooth bends
  kValve:             0.20,                   // butterfly fully open
  kContraction:       0.20,                   // gradual contraction at bifurcation/reducer

  etaOverall:         0.78,                   // 0.85 turb · 0.94 gen · 0.97 tx
}