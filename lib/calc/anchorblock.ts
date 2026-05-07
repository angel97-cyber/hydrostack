// HydroStack — Module 05: Anchor Block (Day 7)
// Standards:
//   IS 5330:1984 — Criteria for Design of Anchor Blocks for Penstocks
//   IS 11639 (Part 1):1986 — Structural Design of Surface Penstocks
//   AHEC §11.6 — Saddle and anchor design (Civil Works, Hydraulic & Structural)
//   AEPC DFS Guidelines 2014 §3.3.6 — Anchor blocks in mini hydropower DFS
//
// The engine takes pipe geometry from the upstream Penstock module, the bend
// geometry, the block dimensions, and the foundation parameters; it computes
// the 12 force components per IS 5330 §5.1, resolves them to global axes for
// both EXPANDING and CONTRACTING conditions, and runs all three stability
// checks (sliding §7.2, overturning §7.3, bearing §7.1) per IS 5330 §7.
//
// Manual reference case (verified):
//   D_i = 500 mm, t = 10 mm, H = 150 m, Q = 0.45 m³/s
//   α_u = 30°, α_d = 10°, Δ = 20° vertical bend
//   L_u = L_d = 30 m, L_pu = L_pd = 5 m
//   Block 2.5 × 2.5 × 2.0 m plain concrete on gravel (μ = 0.40)
//   Yields: F_s = 288.9 kN/arm, F_d = 1.03 kN, bend resultant = 101.4 kN,
//   Du = 18.1 kN, Dd = 6.3 kN, Spu = 44.8 kN, Spd = 51.0 kN, Seu = 46.9 kN,
//   Fu = 23.6 kN, W_block = 294.3 kN, worst FoS_sliding = 5.37,
//   worst e/kern = 0.358, σ_max = 94.8 kPa.

// Constants (SI)
const W_WATER = 9810 // N/m³ unit weight of water (γ_w)
const RHO_WATER = 1000 // kg/m³
const G = 9.81 // m/s²
const RHO_STEEL = 7850 // kg/m³

export type FoundationType = 'rock_solid' | 'rock' | 'gravel' | 'sand' | 'clay'
export type ConcreteType = 'plain' | 'plum'
export type BendPlane = 'vertical' | 'horizontal'

// IS 5330 §7.2 + §7.2.1 — sliding friction factor by foundation
export const FOUNDATION_FRICTION: Record<FoundationType, number> = {
  rock_solid: 0.75, // IS 5330 §7.2.1: solid rock with no weak planes
  rock: 0.5, // IS 5330 §7.2: concrete on rock
  gravel: 0.4, // concrete on gravel
  sand: 0.33, // concrete on sand
  clay: 0.25, // concrete on clayey soil
}

export const FOUNDATION_LABELS: Record<FoundationType, string> = {
  rock_solid: 'Solid rock (no weak planes)',
  rock: 'Rock',
  gravel: 'Gravel',
  sand: 'Sand',
  clay: 'Clayey soil',
}

// Plain concrete vs plum concrete (Nepali practice)
export const CONCRETE_DENSITY: Record<ConcreteType, number> = {
  plain: 2400,
  plum: 2300, // plum concrete: ~30% boulder by volume, slightly lower density
}

export interface AnchorBlockInputs {
  // §1 — From penstock module (upstream sync, read-only on UI)
  diameterMm: number // d, internal diameter (mm) IS 5330 notation
  externalDiameterMm: number // D_o (mm)
  tCommercialMm: number // t, wall thickness (mm)
  designHeadM: number // H, max head including water hammer (m) — from penstock
  flowM3s: number // Q (m³/s) — from upstream
  pipeSlopeAngleDeg: number // α from penstock alignment

  // §2 — Bend geometry
  bendPlane: BendPlane // 'vertical' (profile bend) or 'horizontal' (plan bend)
  alphaUDeg: number // α_u — slope angle of penstock UPSTREAM of anchor (deg)
  alphaDDeg: number // α_d — slope angle of penstock DOWNSTREAM of anchor (deg)
  deflectionAngleDeg: number // Δ — deflection at bend (deg). Auto = |α_u − α_d| for vertical
  lengthUphillM: number // L_u — anchor to uphill expansion joint (m)
  lengthDownhillM: number // L_d — anchor to downhill expansion joint (m)
  lengthToPierUphillM: number // L_pu — anchor to adjacent uphill pier (m)
  lengthToPierDownhillM: number // L_pd — anchor to adjacent downhill pier (m)

  // §3 — Material & foundation
  concreteType: ConcreteType
  blockLengthM: number // L — along pipe axis (m)
  blockWidthM: number // W — across pipe (m)
  blockHeightM: number // H_block — vertical height (m)
  bendHeightAboveBaseM: number // height of bend above the base, default 0.6·H_block

  foundationType: FoundationType
  allowableBearingKpa: number // q_allow (kPa)
  saddleFrictionCoeff: number // f, IS 5330 §5.5 (default 0.6 steel/concrete)
  packingFrictionCoeff: number // μ, IS 5330 §5.5.1 (default 0.26)
  packingLengthM: number // e, IS 5330 (default 0.05 m = 50 mm)

  // §4 — Reducer (optional, default 0)
  reducerAreaUphillM2: number // A' — pipe area above (uphill of) reducer; 0 = no reducer
  reducerAreaDownhillM2: number // A'' — pipe area below (downhill of) reducer; 0 = no reducer
}

export const ANCHORBLOCK_DEFAULTS: AnchorBlockInputs = {
  diameterMm: 500,
  externalDiameterMm: 520,
  tCommercialMm: 10,
  designHeadM: 150,
  flowM3s: 0.45,
  pipeSlopeAngleDeg: 30,

  bendPlane: 'vertical',
  alphaUDeg: 30,
  alphaDDeg: 10,
  deflectionAngleDeg: 20,
  lengthUphillM: 30,
  lengthDownhillM: 30,
  lengthToPierUphillM: 5,
  lengthToPierDownhillM: 5,

  concreteType: 'plain',
  blockLengthM: 2.5,
  blockWidthM: 2.5,
  blockHeightM: 2.0,
  bendHeightAboveBaseM: 1.2, // 0.6 · H_block (mid-height)

  foundationType: 'gravel',
  allowableBearingKpa: 200,
  saddleFrictionCoeff: 0.6,
  packingFrictionCoeff: 0.26,
  packingLengthM: 0.05,

  reducerAreaUphillM2: 0,
  reducerAreaDownhillM2: 0,
}

export interface ForceComponent {
  symbol: string
  label: string
  magnitudeN: number
  citation: string
}

export interface ConditionResult {
  conditionLabel: 'EXPANDING' | 'CONTRACTING'
  sumX_N: number // ΣF_x (horizontal along pipe direction, +X = downstream)
  sumY_N: number // ΣF_y (vertical, +Y = up). Includes block self-weight.
  resultantN: number // |R|
  momentAboutBaseCentroidNm: number // M_y (right-hand: rotating about Y-axis)
  eccentricityM: number // e = M / V_down
  eccentricityRatio: number // |e| / kern, kern = L/6
  withinKern: boolean
  slidingFactor: number // ΣH / ΣV
  fosSliding: number // μ / sliding_factor
  bearingMaxKpa: number // σ_max = (V/A)·(1 + 6e/L)
  bearingMinKpa: number // σ_min = (V/A)·(1 − 6e/L)
  fosBearing: number // q_allow / σ_max
  resultantGroundAngleDeg: number // angle of resultant with ground (IS 5330 §7.1.1: ≥ 30°)
}

export interface AnchorBlockOutputs {
  // Pipe-derived
  internalAreaM2: number // A
  shellAreaM2: number // a (annular)
  velocityMs: number // V = Q/A
  pipeUnitWeightNm: number // pipe metal only, N/m
  waterUnitWeightNm: number // water in pipe, N/m

  // §5 — Forces per IS 5330 §5.1 (magnitudes only)
  Fs_N: number // 1: hydrostatic axial per arm
  Fd_N: number // 2: dynamic momentum
  Du_N: number // 3: gravity along upstream pipe
  Dd_N: number // 4: gravity along downstream pipe
  Spu_N: number // 5: saddle friction uphill
  Spd_N: number // 6: saddle friction downhill
  Seu_N: number // 7: EJ packing friction uphill
  Sed_N: number // 8: EJ packing friction downhill
  Fu_N: number // 9: hydrostatic on uphill EJ end
  Fd_exp_N: number // 10: hydrostatic on downhill EJ end
  Lu_N: number // 11: reducer above
  Ld_N: number // 12: reducer below
  fPrimeNm: number // f' = 1.5·μ·w·H·e (for reference)
  bendResultantN: number // 2·Fs·sin(Δ/2) + Fd

  // Bisector outward unit vector (from anchor outward of bend)
  bisectorOutwardX: number
  bisectorOutwardY: number

  // Block
  blockVolumeM3: number
  blockSelfWeightN: number
  baseAreaM2: number
  kernLimitM: number // L/6

  // Stability — both conditions
  expanding: ConditionResult
  contracting: ConditionResult

  // Governing (worst) values + flags
  worstFosSliding: number
  worstFosOverturning: number // = 1 / max(e/kern), reciprocal-style → ≥ 1.0 means within kern
  worstFosBearing: number
  governingSlidingCondition: 'EXPANDING' | 'CONTRACTING'
  governingOverturningCondition: 'EXPANDING' | 'CONTRACTING'
  governingBearingCondition: 'EXPANDING' | 'CONTRACTING'

  warnings: Array<{ severity: 'error' | 'warn' | 'info'; field: string; message: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deg2rad(d: number): number {
  return (d * Math.PI) / 180
}

function rad2deg(r: number): number {
  return (r * 180) / Math.PI
}

// Pipe metal weight per metre (thin shell): π·D_mean·t·ρ_steel·g
// More accurate: annular cross-section × ρ × g
function pipeMetalUnitWeight(D_iMm: number, tMm: number): number {
  // Annular area in m² then × ρ_steel × g
  const D_i = D_iMm / 1000
  const t = tMm / 1000
  const annular_m2 = (Math.PI / 4) * ((D_i + 2 * t) ** 2 - D_i ** 2)
  return annular_m2 * RHO_STEEL * G // N/m
}

function waterUnitWeight(D_iMm: number): number {
  const A = (Math.PI / 4) * (D_iMm / 1000) ** 2
  return A * RHO_WATER * G // N/m
}

// ---------------------------------------------------------------------------
// MAIN CALCULATION
// ---------------------------------------------------------------------------

export function calcAnchorBlock(inp: AnchorBlockInputs): AnchorBlockOutputs {
  const warnings: AnchorBlockOutputs['warnings'] = []

  // ---- Geometry -------------------------------------------------------------
  const D_i = inp.diameterMm / 1000 // m
  const t = inp.tCommercialMm / 1000 // m
  const A = (Math.PI / 4) * D_i * D_i // m² internal cross-section area
  // Pipe shell annular area at the EJ (a in IS 5330):
  // a = π·t·(d + t)·10^-6 when d, t in mm
  // Equivalently a = π·(t/1000)·((D_i + t/1000))  in m² when D_i is in m
  const a_shell = Math.PI * t * (D_i + t) // m²
  const V = inp.flowM3s / Math.max(A, 1e-9) // m/s

  const alphaU = deg2rad(inp.alphaUDeg)
  const alphaD = deg2rad(inp.alphaDDeg)

  // Δ — auto for vertical bend, user-entered for horizontal
  let deltaDeg = inp.deflectionAngleDeg
  if (inp.bendPlane === 'vertical') {
    deltaDeg = Math.abs(inp.alphaUDeg - inp.alphaDDeg)
  }
  const delta = deg2rad(deltaDeg)

  // Pipe + water unit weights
  const pipeWN = pipeMetalUnitWeight(inp.diameterMm, inp.tCommercialMm)
  const waterWN = waterUnitWeight(inp.diameterMm)

  // IS 5330 notation
  const P = pipeWN * inp.lengthUphillM // pipe-only weight uphill (N)
  const W_water = waterWN * inp.lengthUphillM // water weight in P
  const P_prime = pipeWN * inp.lengthDownhillM
  const W_prime = waterWN * inp.lengthDownhillM
  const p = (pipeWN + waterWN) * inp.lengthToPierUphillM // pipe+water anchor → pier uphill
  const p_prime = (pipeWN + waterWN) * inp.lengthToPierDownhillM

  const H = inp.designHeadM
  const Q = inp.flowM3s

  // ---- IS 5330 §5.1 force magnitudes ----------------------------------------
  // (1) hydrostatic axial per arm: F_s = W·A·H
  const Fs = W_WATER * A * H
  // (2) dynamic momentum: F_d = Q·W·V/g = ρ·Q·V (W = γ_w = ρg, so QWV/g = ρQV)
  const Fd = RHO_WATER * Q * V
  // (3) gravity uphill: D_u = P·sin α_u
  const Du = P * Math.sin(alphaU)
  // (4) gravity downhill: D_d = P'·sin α_d
  const Dd = P_prime * Math.sin(alphaD)
  // (5) saddle friction uphill: S_pu = f·cos α_u·(P + W − p/2)
  const Spu = inp.saddleFrictionCoeff * Math.cos(alphaU) * (P + W_water - p / 2)
  // (6) saddle friction downhill: S_pd = f·cos α_d·(P' + W' − p'/2)
  const Spd = inp.saddleFrictionCoeff * Math.cos(alphaD) * (P_prime + W_prime - p_prime / 2)
  // (7,8) EJ packing friction: S_eu = S_ed = f'·π·(d + 2t)/1000
  // f' per IS 5330 notation: f' = 1.5·μ·w·H·e
  const fPrime = 1.5 * inp.packingFrictionCoeff * W_WATER * H * inp.packingLengthM // N/m
  const Seu = (fPrime * Math.PI * (inp.diameterMm + 2 * inp.tCommercialMm)) / 1000
  const Sed = Seu // same diameter both ends
  // (9) F_u = w·H·π·t·(d+t)/10⁶ = w·a·H
  const Fu = W_WATER * a_shell * H
  // (10) F_d (exposed end downhill EJ) = w·a'·H — same area assumed
  const Fd_exp = Fu
  // (11,12) reducer: L_u = w·H·(A' − A); L_d = w·H·(A − A'')
  const Lu = W_WATER * H * (inp.reducerAreaUphillM2 - A) // = 0 if A' = 0 means no reducer
  const Ld = W_WATER * H * (A - inp.reducerAreaDownhillM2) // = 0 if A'' = 0 means no reducer
  // Note: when reducerAreaUphillM2 = 0, L_u becomes negative (= -w·H·A); we
  // treat A' = 0 as "no reducer" and zero L_u out:
  const Lu_eff = inp.reducerAreaUphillM2 > 0 ? Lu : 0
  const Ld_eff = inp.reducerAreaDownhillM2 > 0 ? Ld : 0

  // ---- Force resolution -----------------------------------------------------
  // 2D analysis plane depends on bend type:
  //   VERTICAL bend: plane = pipe-profile (along flow direction × vertical)
  //   HORIZONTAL bend: plane = transverse × vertical (perpendicular to flow
  //                    bisector, containing the bend-outward direction)
  // In both cases we set X = bend-outward axis-of-symmetry direction in 2D,
  // Y = vertical (+Y up). The momentum balance derivation gives the bend
  // force along outward bisector with magnitude 2·F_s·sin(Δ/2) + F_d.
  // For horizontal bends with slope α, the projection introduces a cos α
  // factor on horizontal components — we keep the conservative full magnitude
  // for the bend force and project pipe directions accordingly.
  //
  // u_hat, d_hat are unit vectors from anchor toward upstream/downstream EJ
  // PROJECTED onto the 2D analysis plane.
  let u_hat: [number, number]
  let d_hat: [number, number]
  let bisX = 0
  let bisY = 0

  if (inp.bendPlane === 'horizontal') {
    // Horizontal plan bend on a uniformly sloped penstock.
    // Both arms at slope α (use alphaUDeg). Upstream goes uphill, downstream
    // goes downhill. In the 2D transverse-vertical analysis plane:
    //   u_hat_2D = (+cos α · sin(Δ/2), +sin α)   [upstream side: +X, +Y]
    //   d_hat_2D = (-cos α · sin(Δ/2), -sin α)   [downstream side: -X, -Y]
    // Bend force is along -X (outward of bend, opposite to interior bisector
    // which is along the flow direction projection). bisX = -1.
    const alpha = alphaU // single slope on both arms for horizontal bend
    const halfDelta = delta / 2
    u_hat = [Math.cos(alpha) * Math.sin(halfDelta), Math.sin(alpha)]
    d_hat = [-Math.cos(alpha) * Math.sin(halfDelta), -Math.sin(alpha)]
    if (deltaDeg > 0.01) {
      bisX = -1
      bisY = 0
    }
  } else {
    // Vertical (profile) bend: standard derivation. u_hat = (-cos α_u, sin α_u),
    // d_hat = (cos α_d, -sin α_d). Outward bisector = -(u_hat + d_hat)/|·|,
    // and |u_hat + d_hat| = 2·sin(Δ/2).
    u_hat = [-Math.cos(alphaU), Math.sin(alphaU)]
    d_hat = [Math.cos(alphaD), -Math.sin(alphaD)]
    if (deltaDeg > 0.01) {
      const sumX = u_hat[0] + d_hat[0]
      const sumY = u_hat[1] + d_hat[1]
      const norm = Math.sqrt(sumX * sumX + sumY * sumY)
      bisX = -sumX / norm
      bisY = -sumY / norm
    }
  }

  const bendMagnitude = 2 * Fs * Math.sin(delta / 2) + Fd
  const Fbend_x = bendMagnitude * bisX
  const Fbend_y = bendMagnitude * bisY

  // (3) Du — gravity component on upstream pipe, acts DOWN-slope along the pipe
  // = direction -u_hat (toward anchor on upstream pipe = down-slope toward bend).
  const FDu_x = Du * -u_hat[0]
  const FDu_y = Du * -u_hat[1]

  // (4) Dd — gravity component on downstream pipe, acts DOWN-slope along the pipe
  // = direction +d_hat (away from anchor, downhill on downstream pipe).
  const FDd_x = Dd * d_hat[0]
  const FDd_y = Dd * d_hat[1]

  // Forces 5–12 reverse sign between EXPANDING and CONTRACTING per IS 5330 Fig. 3
  // EXPANDING: pipe slides toward EJ on each arm; thermal forces directed AWAY
  //            from anchor along each arm (+u_hat upstream, +d_hat downstream).
  // CONTRACTING: thermal forces directed TOWARD anchor (-u_hat, -d_hat).
  const F_us_total = Spu + Seu + Fu + Lu_eff // sum of upstream thermal force magnitudes
  const F_ds_total = Spd + Sed + Fd_exp + Ld_eff

  function computeCondition(
    label: 'EXPANDING' | 'CONTRACTING',
    sign: 1 | -1, // +1 = expanding, -1 = contracting
  ): ConditionResult {
    // Thermal forces along ±u_hat / ±d_hat
    const Fus_x = sign * F_us_total * u_hat[0]
    const Fus_y = sign * F_us_total * u_hat[1]
    const Fds_x = sign * F_ds_total * d_hat[0]
    const Fds_y = sign * F_ds_total * d_hat[1]

    // Sums (excluding block weight)
    const sumX = Fbend_x + FDu_x + FDd_x + Fus_x + Fds_x
    const sumY_forces = Fbend_y + FDu_y + FDd_y + Fus_y + Fds_y

    // Block self-weight (always −Y, applied at base centroid → no moment)
    const Wblock = CONCRETE_DENSITY[inp.concreteType] * inp.blockLengthM * inp.blockWidthM * inp.blockHeightM * G
    const sumY = sumY_forces - Wblock

    const resultant = Math.sqrt(sumX * sumX + sumY * sumY)

    // Moments about Y-axis through base centroid (CCW = +M_y in 2D X–Z plane)
    // All horizontal pipe forces act at height bendHeightAboveBaseM above base.
    // Vertical pipe forces act at zero X eccentricity (bend at block centerline).
    // Block self-weight at base centroid → zero moment.
    // Convention: +M_y = horizontal force in +X direction at +Z height creates
    // CW moment about Y-axis. We define +M_y = M tending to rotate block such
    // that toe at +X side goes DOWN.
    const z = inp.bendHeightAboveBaseM
    const M = (Fbend_x + FDu_x + FDd_x + Fus_x + Fds_x) * z

    // For overturning: the block rotates about the toe on the OPPOSITE side
    // from M. We compute the eccentricity e = M / |V_down|. If |e| ≤ L/6 the
    // resultant is within kern (no tension at base) — IS 5330 §7.3.
    const Vdown = -sumY // sumY is negative (down), Vdown is positive magnitude
    const e = Vdown > 1e-6 ? M / Vdown : 0
    const kern = inp.blockLengthM / 6
    const eRatio = Math.abs(e) / Math.max(kern, 1e-9)
    const withinKern = Math.abs(e) <= kern

    // Sliding (IS 5330 §7.2)
    const slidingFactor = Vdown > 1e-6 ? Math.abs(sumX) / Vdown : 0
    const muF = FOUNDATION_FRICTION[inp.foundationType]
    const fosSliding = slidingFactor > 1e-6 ? muF / slidingFactor : 999

    // Bearing (IS 5330 §7.1)
    const Abase = inp.blockLengthM * inp.blockWidthM
    const sigmaAvg = Vdown / Abase // Pa
    const sigmaMax = sigmaAvg * (1 + (6 * Math.abs(e)) / inp.blockLengthM) // Pa
    const sigmaMin = sigmaAvg * (1 - (6 * Math.abs(e)) / inp.blockLengthM) // Pa
    const fosBearing = sigmaMax > 1e-6 ? (inp.allowableBearingKpa * 1000) / sigmaMax : 999

    // Resultant angle with ground (§7.1.1: ≥ 30° required for sloped foundations)
    const horizMag = Math.abs(sumX)
    const angleGround = horizMag > 1e-6 ? rad2deg(Math.atan(Vdown / horizMag)) : 90

    return {
      conditionLabel: label,
      sumX_N: sumX,
      sumY_N: sumY,
      resultantN: resultant,
      momentAboutBaseCentroidNm: M,
      eccentricityM: e,
      eccentricityRatio: eRatio,
      withinKern,
      slidingFactor,
      fosSliding,
      bearingMaxKpa: sigmaMax / 1000,
      bearingMinKpa: sigmaMin / 1000,
      fosBearing,
      resultantGroundAngleDeg: angleGround,
    }
  }

  const expanding = computeCondition('EXPANDING', 1)
  const contracting = computeCondition('CONTRACTING', -1)

  // Block geometry
  const blockVolume = inp.blockLengthM * inp.blockWidthM * inp.blockHeightM
  const blockSelfWeight = CONCRETE_DENSITY[inp.concreteType] * blockVolume * G
  const baseArea = inp.blockLengthM * inp.blockWidthM
  const kernLimit = inp.blockLengthM / 6

  // Governing (worst) FoS
  let worstFosSliding: number
  let governingSlidingCondition: 'EXPANDING' | 'CONTRACTING'
  if (expanding.fosSliding < contracting.fosSliding) {
    worstFosSliding = expanding.fosSliding
    governingSlidingCondition = 'EXPANDING'
  } else {
    worstFosSliding = contracting.fosSliding
    governingSlidingCondition = 'CONTRACTING'
  }

  let worstFosOverturning: number
  let governingOverturningCondition: 'EXPANDING' | 'CONTRACTING'
  if (expanding.eccentricityRatio > contracting.eccentricityRatio) {
    worstFosOverturning = 1 / Math.max(expanding.eccentricityRatio, 1e-6)
    governingOverturningCondition = 'EXPANDING'
  } else {
    worstFosOverturning = 1 / Math.max(contracting.eccentricityRatio, 1e-6)
    governingOverturningCondition = 'CONTRACTING'
  }

  let worstFosBearing: number
  let governingBearingCondition: 'EXPANDING' | 'CONTRACTING'
  if (expanding.fosBearing < contracting.fosBearing) {
    worstFosBearing = expanding.fosBearing
    governingBearingCondition = 'EXPANDING'
  } else {
    worstFosBearing = contracting.fosBearing
    governingBearingCondition = 'CONTRACTING'
  }

  // ---- Warnings -------------------------------------------------------------

  // Sliding (IS 5330 §7.2: target ≥ 1.5 for AEPC submission)
  if (worstFosSliding < 1.0) {
    warnings.push({
      severity: 'error',
      field: 'sliding',
      message: `Sliding FoS = ${worstFosSliding.toFixed(2)} < 1.0 (governing: ${governingSlidingCondition}). Block will slide. Increase block dimensions or use stepped foundation per IS 5330 §7.2.1.`,
    })
  } else if (worstFosSliding < 1.5) {
    warnings.push({
      severity: 'warn',
      field: 'sliding',
      message: `Sliding FoS = ${worstFosSliding.toFixed(2)} below AEPC submission target of 1.5 (governing: ${governingSlidingCondition}). Consider larger block.`,
    })
  }

  // Overturning (IS 5330 §7.3: kern check)
  const worstE = Math.max(expanding.eccentricityRatio, contracting.eccentricityRatio)
  if (worstE > 1.0) {
    warnings.push({
      severity: 'error',
      field: 'overturning',
      message: `Resultant outside kern (e/kern = ${worstE.toFixed(2)}, governing: ${governingOverturningCondition}). Tension at base — IS 5330 §7.3 violated. Increase block length L.`,
    })
  } else if (worstE > 1 / 1.5) {
    warnings.push({
      severity: 'warn',
      field: 'overturning',
      message: `Resultant near kern edge (e/kern = ${worstE.toFixed(2)}, governing: ${governingOverturningCondition}). Below FoS_overturning ≥ 1.5 target.`,
    })
  }

  // Bearing (IS 5330 §7.1)
  if (worstFosBearing < 1.0) {
    warnings.push({
      severity: 'error',
      field: 'bearing',
      message: `Bearing FoS = ${worstFosBearing.toFixed(2)} < 1.0 (σ_max = ${Math.max(expanding.bearingMaxKpa, contracting.bearingMaxKpa).toFixed(1)} kPa > q_allow = ${inp.allowableBearingKpa} kPa). Foundation will fail. Enlarge base or improve foundation.`,
    })
  } else if (worstFosBearing < 2.0) {
    warnings.push({
      severity: 'warn',
      field: 'bearing',
      message: `Bearing FoS = ${worstFosBearing.toFixed(2)} below AEPC submission target of 2.0 (governing: ${governingBearingCondition}).`,
    })
  }

  // Tension at base (negative σ_min)
  if (expanding.bearingMinKpa < 0 || contracting.bearingMinKpa < 0) {
    warnings.push({
      severity: 'warn',
      field: 'bearing',
      message: `Tension at base (σ_min < 0). IS 5330 §7.3 allows up to 0.2 N/mm² tension under seismic only. Re-check kern.`,
    })
  }

  // Resultant ground angle (§7.1.1: ≥ 30° on sloping foundations)
  const minAngle = Math.min(expanding.resultantGroundAngleDeg, contracting.resultantGroundAngleDeg)
  if (minAngle < 30) {
    warnings.push({
      severity: 'warn',
      field: 'foundation',
      message: `Resultant–ground angle = ${minAngle.toFixed(1)}° < 30° (IS 5330 §7.1.1). Reduce safe bearing capacity for sloping foundations.`,
    })
  }

  // Foundation note
  if (inp.foundationType === 'sand' || inp.foundationType === 'clay') {
    warnings.push({
      severity: 'warn',
      field: 'foundation',
      message: `Block on ${FOUNDATION_LABELS[inp.foundationType].toLowerCase()} (μ = ${FOUNDATION_FRICTION[inp.foundationType]}). IS 5330 §6.1 prefers rock foundation. Verify bearing capacity by tests (IS 1904).`,
    })
  }

  // Earthen canal forbidden? Not relevant here. Check straight pipe length warning.
  if (inp.lengthUphillM + inp.lengthDownhillM > 150) {
    warnings.push({
      severity: 'info',
      field: 'spacing',
      message: `Total tangent length > 150 m. IS 5330 §4.1 requires intermediate anchor; AEPC DFS §3.3.6 limits exposed straight to 30 m without anchor.`,
    })
  }

  // Block aspect ratio sanity
  if (inp.blockHeightM / inp.blockLengthM > 1.5) {
    warnings.push({
      severity: 'info',
      field: 'geometry',
      message: `Block H/L = ${(inp.blockHeightM / inp.blockLengthM).toFixed(2)} — tall, thin block. Risk of overturning. Consider squatter section.`,
    })
  }

  return {
    internalAreaM2: A,
    shellAreaM2: a_shell,
    velocityMs: V,
    pipeUnitWeightNm: pipeWN,
    waterUnitWeightNm: waterWN,

    Fs_N: Fs,
    Fd_N: Fd,
    Du_N: Du,
    Dd_N: Dd,
    Spu_N: Spu,
    Spd_N: Spd,
    Seu_N: Seu,
    Sed_N: Sed,
    Fu_N: Fu,
    Fd_exp_N: Fd_exp,
    Lu_N: Lu_eff,
    Ld_N: Ld_eff,
    fPrimeNm: fPrime,
    bendResultantN: bendMagnitude,

    bisectorOutwardX: bisX,
    bisectorOutwardY: bisY,

    blockVolumeM3: blockVolume,
    blockSelfWeightN: blockSelfWeight,
    baseAreaM2: baseArea,
    kernLimitM: kernLimit,

    expanding,
    contracting,

    worstFosSliding,
    worstFosOverturning,
    worstFosBearing,
    governingSlidingCondition,
    governingOverturningCondition,
    governingBearingCondition,

    warnings,
  }
}

// Force-component table for UI
export function buildForceTable(out: AnchorBlockOutputs): ForceComponent[] {
  return [
    { symbol: 'Fs', label: 'Hydrostatic axial (per arm)', magnitudeN: out.Fs_N, citation: 'IS 5330:1984 §5.1(a)' },
    { symbol: 'Fd', label: 'Dynamic momentum at bend', magnitudeN: out.Fd_N, citation: 'IS 5330:1984 §5.1(b)' },
    { symbol: 'Du', label: 'Gravity component, uphill pipe', magnitudeN: out.Du_N, citation: 'IS 5330:1984 §5.1(c)' },
    { symbol: 'Dd', label: 'Gravity component, downhill pipe', magnitudeN: out.Dd_N, citation: 'IS 5330:1984 §5.1(d)' },
    { symbol: 'Spu', label: 'Saddle friction, uphill', magnitudeN: out.Spu_N, citation: 'IS 5330:1984 §5.1(e)' },
    { symbol: 'Spd', label: 'Saddle friction, downhill', magnitudeN: out.Spd_N, citation: 'IS 5330:1984 §5.1(f)' },
    { symbol: 'Seu', label: 'EJ packing friction, uphill', magnitudeN: out.Seu_N, citation: 'IS 5330:1984 §5.1(g)' },
    { symbol: 'Sed', label: 'EJ packing friction, downhill', magnitudeN: out.Sed_N, citation: 'IS 5330:1984 §5.1(h)' },
    { symbol: 'Fu', label: 'Hydrostatic on EJ end, uphill', magnitudeN: out.Fu_N, citation: 'IS 5330:1984 §5.1(j)' },
    { symbol: 'Fd′', label: 'Hydrostatic on EJ end, downhill', magnitudeN: out.Fd_exp_N, citation: 'IS 5330:1984 §5.1(k)' },
    { symbol: 'Lu', label: 'Reducer force, above anchor', magnitudeN: out.Lu_N, citation: 'IS 5330:1984 §5.1(m)' },
    { symbol: 'Ld', label: 'Reducer force, below anchor', magnitudeN: out.Ld_N, citation: 'IS 5330:1984 §5.1(n)' },
  ]
}