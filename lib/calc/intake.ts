/**
 * HydroStack — Module 02: Intake & Settling Basin
 *
 * Pure TypeScript calculation engine. No I/O. No React.
 *
 * Engineering standards:
 *   AEPC DFS Guidelines for Mini Hydropower Projects, 2014  §3.3.3, §3.3.4, §3.4.6
 *   AEPC Reference Micro-Hydro Power Standard, 2014         §2.3.1, §2.3.2
 *   AHEC-IITR/MNRE/SHP Standards, Civil Works               §8.8
 *   IS 11388:1995  Trashracks for hydroelectric power stations
 *
 * Units throughout: SI (m, m³/s, kg, Pa·s, m/s)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Physical constants
// ─────────────────────────────────────────────────────────────────────────────

export const G = 9.81                    // m/s²
export const RHO_WATER_DEFAULT  = 1000   // kg/m³, fresh water
export const RHO_SEDIMENT_DEFAULT = 2650 // kg/m³, quartz sand
export const MU_WATER_DEFAULT   = 0.001  // Pa·s, dynamic viscosity at ~20 °C

export const AEPC_SCOUR_LIMIT_M_S = 0.3  // AEPC DFS 2014 §3.3.4.2
export const FLUSHING_INTERVAL_HOURS = 12 // AEPC DFS 2014 §3.3.4.2
export const LW_MIN = 4                   // AEPC DFS 2014 §3.3.4.2
export const LW_MAX = 10
export const RACK_INCLINATION_DEFAULT_DEG = 71.565 // atan(3) — 3V:1H

// ─────────────────────────────────────────────────────────────────────────────
// Trash rack bar-shape factors — IS:11388-1995 / AEPC DFS 2014 Fig. 3.6
// Kirschmer: hr = K · (t/b)^(4/3) · sin(α) · V²/(2g)
// ─────────────────────────────────────────────────────────────────────────────

export type RackBarShape =
  | 'rectangular'
  | 'rect_round_us'
  | 'rect_round_both'
  | 'semi_circular'
  | 'elliptic'
  | 'streamlined'

export const RACK_BAR_SHAPE_FACTORS: Record<RackBarShape, number> = {
  rectangular:    2.42,
  rect_round_us:  1.83,
  rect_round_both: 1.67,
  semi_circular:  1.035,
  elliptic:       0.92,
  streamlined:    0.76,
}

export const RACK_BAR_SHAPE_LABELS: Record<RackBarShape, string> = {
  rectangular:     'Rectangular (sharp)          K = 2.42',
  rect_round_us:   'Rect. round upstream face    K = 1.83',
  rect_round_both: 'Rect. round both faces       K = 1.67',
  semi_circular:   'Semi-circular ends           K = 1.04',
  elliptic:        'Elliptic section             K = 0.92',
  streamlined:     'Fully streamlined            K = 0.76',
}

// ─────────────────────────────────────────────────────────────────────────────
// Input / Output types
// ─────────────────────────────────────────────────────────────────────────────

export interface IntakeInput {
  // From hydrology (locked in UI)
  qDesign:   number   // m³/s
  grossHead: number   // m

  // Diversion — AEPC DFS 2014 §3.3.3 recommends 10–20% extra for flushing
  flushingMargin: number  // dimensionless, e.g. 0.15 = 15%

  // Settling basin
  basinWidth:       number  // m
  basinFlowDepth:   number  // m — active (flow) zone only
  basinSludgeDepth: number  // m — dead storage below flow zone
  basinFreeBoard:   number  // m

  // Sediment / water properties
  rhoSediment: number  // kg/m³
  rhoWater:    number  // kg/m³
  muWater:     number  // Pa·s

  // Trash rack
  rackBarSpacing:      number        // mm  clear spacing b
  rackBarThickness:    number        // mm  bar thickness t
  rackApproachVelocity: number       // m/s
  rackInclinationDeg:  number        // ° from horizontal
  rackBarShape:        RackBarShape
}

export interface ValidationFlag {
  severity: 'info' | 'warn' | 'error'
  code:     string
  message:  string
}

export interface IntakeOutput {
  // §1 Diversion
  qDiverted: number
  qFlushing: number

  // §2 Grain size
  designGrainSize_mm: number
  trapEfficiency_pct: number
  grainHeadBand:      string

  // §3 Settling velocity
  settlingVelocityStokes: number  // m/s
  reynoldsParticle:       number
  isStokesValid:          boolean
  ahecFlowThroughLimit:   number  // m/s — AHEC §8.8.1.2 V = a·√d

  // §4 Basin geometry
  surfaceArea:          number  // m²
  basinLength:          number  // m
  basinTotalDepth:      number  // m
  flowVelocity:         number  // m/s
  overflowRate:         number  // m/s  Q/As
  froudeNumber:         number
  lwRatio:              number
  scourLimitVelocity:   number  // m/s — governing (min of AEPC & AHEC)
  sedimentStorageVolume: number // m³

  // §5 Trash rack
  rackGrossArea:           number  // m²
  rackNetArea:             number  // m²
  blockageRatio:           number  // φ = b/(b+t)
  rackVelocityNet:         number  // m/s
  rackHeadLossKirschmer:   number  // m
  rackKShape:              number
  rackHeadLossAhec:        number  // m  (cross-check)

  warnings: ValidationFlag[]
}

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Grain size per AEPC DFS Guidelines 2014 §3.3.4.2 Table 3.1
// Higher head → finer particle settled (more turbine abrasion at high velocity)
// ─────────────────────────────────────────────────────────────────────────────

export function designGrainSize(grossHead: number): {
  d_mm: number
  efficiency_pct: number
  band: string
} {
  if (grossHead <= 10)  return { d_mm: 0.50, efficiency_pct: 90, band: '≤ 10 m' }
  if (grossHead <= 50)  return { d_mm: 0.30, efficiency_pct: 90, band: '10–50 m' }
  if (grossHead <= 100) return { d_mm: 0.25, efficiency_pct: 90, band: '50–100 m' }
  if (grossHead <= 300) return { d_mm: 0.20, efficiency_pct: 90, band: '100–300 m' }
  return                       { d_mm: 0.15, efficiency_pct: 90, band: '> 300 m' }
}

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Stokes settling velocity (laminar, Re_p < 1)
//      Vs = (ρs − ρw) · g · d² / (18 · μ)
// ─────────────────────────────────────────────────────────────────────────────

export function stokesSettlingVelocity(
  d_mm: number,
  rhoS = RHO_SEDIMENT_DEFAULT,
  rhoW = RHO_WATER_DEFAULT,
  mu   = MU_WATER_DEFAULT,
): number {
  const d = d_mm / 1000
  return ((rhoS - rhoW) * G * d * d) / (18 * mu)
}

export function particleReynolds(
  Vs: number, d_mm: number,
  rhoW = RHO_WATER_DEFAULT, mu = MU_WATER_DEFAULT,
): number {
  return (rhoW * Vs * (d_mm / 1000)) / mu
}

// AHEC-IITR §8.8.1.2: V_through = a · √d  (d in mm, V in m/s)
// a = 0.44 for 0.1 < d < 1 mm;  0.36 for d > 1 mm
export function ahecFlowThroughVelocity(d_mm: number): number {
  const a = d_mm > 1 ? 0.36 : 0.44
  return a * Math.sqrt(d_mm)
}

// ─────────────────────────────────────────────────────────────────────────────
// §4 — Camp surface-area criterion:  As = Q / Vs
// Overflow rate Q/As ≡ Vs → particle settles if Vs ≥ Q/As
// ─────────────────────────────────────────────────────────────────────────────

export function settlingSurfaceArea(Q: number, Vs: number): number {
  return Vs > 0 ? Q / Vs : Infinity
}

// ─────────────────────────────────────────────────────────────────────────────
// §5 — Kirschmer trash-rack head loss — IS:11388-1995 / AEPC DFS 2014 §3.4.6
//      hr = K · (t/b)^(4/3) · sin(α) · V²/(2g)
// ─────────────────────────────────────────────────────────────────────────────

export function kirschmerHeadLoss(
  V: number, t_mm: number, b_mm: number,
  alphaDeg: number, K: number,
): number {
  if (b_mm <= 0) return Infinity
  const alpha = (alphaDeg * Math.PI) / 180
  return K * Math.pow(t_mm / b_mm, 4 / 3) * Math.sin(alpha) * (V * V) / (2 * G)
}

// AHEC §8.5.3.4(b) cross-check: Kt = 1.45 − 0.45·φ − φ²
export function ahecRackHeadLoss(
  V_net: number, phi: number,
): { K: number; hf: number } {
  const K  = 1.45 - 0.45 * phi - phi * phi
  const hf = K * (V_net * V_net) / (2 * G)
  return { K, hf }
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level orchestration
// ─────────────────────────────────────────────────────────────────────────────

export function calculateIntake(input: IntakeInput): IntakeOutput {
  const warnings: ValidationFlag[] = []

  // §1 — Diversion
  const qDiverted = input.qDesign * (1 + input.flushingMargin)
  const qFlushing  = qDiverted - input.qDesign
  if (input.flushingMargin < 0.10 || input.flushingMargin > 0.25) {
    warnings.push({ severity: 'warn', code: 'flushing_out_of_range',
      message: `Flushing margin ${(input.flushingMargin * 100).toFixed(0)}% is outside AEPC's 10–20% range.` })
  }

  // §2 — Grain size
  const grain = designGrainSize(input.grossHead)
  const d_mm  = grain.d_mm

  // §3 — Settling velocity
  const Vs      = stokesSettlingVelocity(d_mm, input.rhoSediment, input.rhoWater, input.muWater)
  const Re_p    = particleReynolds(Vs, d_mm, input.rhoWater, input.muWater)
  const ahecV   = ahecFlowThroughVelocity(d_mm)
  if (Re_p >= 1) {
    warnings.push({ severity: 'warn', code: 'stokes_invalid',
      message: `Re_particle = ${Re_p.toFixed(2)} ≥ 1. Stokes overestimates Vs in transitional regime — AHEC Table 12 preferred for d ≥ 0.3 mm.` })
  }

  // §4 — Basin
  const As       = settlingSurfaceArea(qDiverted, Vs)
  const W        = Math.max(input.basinWidth, 0.1)
  const D        = Math.max(input.basinFlowDepth, 0.1)
  const L        = As / W
  const V_basin  = qDiverted / (W * D)
  const V_ovflow = qDiverted / As          // = Vs by construction
  const Fr       = V_basin / Math.sqrt(G * D)
  const lw       = L / W
  const scour    = Math.min(AEPC_SCOUR_LIMIT_M_S, ahecV)

  if (V_basin > scour) {
    warnings.push({ severity: 'warn', code: 'scour',
      message: `V_basin ${V_basin.toFixed(3)} m/s > scour limit ${scour.toFixed(3)} m/s — increase width or depth.` })
  }
  if (Fr >= 1) {
    warnings.push({ severity: 'error', code: 'supercritical',
      message: `Fr = ${Fr.toFixed(2)} ≥ 1 — supercritical flow. Increase basin depth.` })
  } else if (Fr > 0.5) {
    warnings.push({ severity: 'warn', code: 'high_fr',
      message: `Fr = ${Fr.toFixed(2)} > 0.5 — approaching critical. Consider deeper basin.` })
  }
  if (lw < LW_MIN) {
    warnings.push({ severity: 'warn', code: 'lw_low',
      message: `L/W = ${lw.toFixed(1)} < ${LW_MIN} — basin too short for effective settling. Reduce width.` })
  } else if (lw > LW_MAX) {
    warnings.push({ severity: 'info', code: 'lw_high',
      message: `L/W = ${lw.toFixed(1)} > ${LW_MAX} — could increase width to shorten basin.` })
  }

  const totalDepth       = D + input.basinSludgeDepth + input.basinFreeBoard
  const sludgeVolume     = W * L * input.basinSludgeDepth

  // §5 — Trash rack
  const Vr        = input.rackApproachVelocity
  const A_gross   = qDiverted / Vr
  const b         = input.rackBarSpacing
  const t         = input.rackBarThickness
  const phi       = b / (b + t)
  const A_net     = A_gross * phi
  const V_net     = Vr / phi
  const K_shape   = RACK_BAR_SHAPE_FACTORS[input.rackBarShape]
  const hr_kirsch = kirschmerHeadLoss(Vr, t, b, input.rackInclinationDeg, K_shape)
  const ahec      = ahecRackHeadLoss(V_net, phi)

  if (Vr > 1.0) {
    warnings.push({ severity: 'warn', code: 'rack_v_high',
      message: `Approach velocity ${Vr.toFixed(2)} m/s > AEPC coarse-rack limit 1.0 m/s.` })
  }
  if (b > 75) {
    warnings.push({ severity: 'warn', code: 'rack_spacing',
      message: `Bar spacing ${b} mm > AEPC coarse-rack maximum 75 mm.` })
  }

  return {
    qDiverted, qFlushing,
    designGrainSize_mm: d_mm, trapEfficiency_pct: grain.efficiency_pct, grainHeadBand: grain.band,
    settlingVelocityStokes: Vs, reynoldsParticle: Re_p, isStokesValid: Re_p < 1, ahecFlowThroughLimit: ahecV,
    surfaceArea: As, basinLength: L, basinTotalDepth: totalDepth,
    flowVelocity: V_basin, overflowRate: V_ovflow, froudeNumber: Fr,
    lwRatio: lw, scourLimitVelocity: scour, sedimentStorageVolume: sludgeVolume,
    rackGrossArea: A_gross, rackNetArea: A_net, blockageRatio: phi,
    rackVelocityNet: V_net, rackHeadLossKirschmer: hr_kirsch,
    rackKShape: K_shape, rackHeadLossAhec: ahec.hf,
    warnings,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

export const INTAKE_DEFAULTS: Omit<IntakeInput, 'qDesign' | 'grossHead'> = {
  flushingMargin:       0.15,
  basinWidth:           1.5,
  basinFlowDepth:       1.2,
  basinSludgeDepth:     0.4,
  basinFreeBoard:       0.3,
  rhoSediment:          RHO_SEDIMENT_DEFAULT,
  rhoWater:             RHO_WATER_DEFAULT,
  muWater:              MU_WATER_DEFAULT,
  rackBarSpacing:       50,
  rackBarThickness:     10,
  rackApproachVelocity: 0.8,
  rackInclinationDeg:   RACK_INCLINATION_DEFAULT_DEG,
  rackBarShape:         'rectangular',
}
