// HydroStack — Module 07: Energy Generation Table
// lib/calc/energy.ts
//
// Pure calculation engine. Computes the 12-month energy generation, plant
// factor, and firm energy from upstream hydrology + powerhouse outputs.
//
// Standards followed:
//   AEPC DFS 2014 §3.4.9, §4.4, §4.5     — primary methodology
//   AEPC POHV 2008                        — unit hydrograph fallback
//   AHEC-IITR §1.3 §3.0                   — power equation P = 9.81·η·Q·H
//   AHEC-IITR §1.10                       — projected vs actual generation format
//
// Key design decisions (cite-on-edit):
//   1. Riparian release default: 10 % of MIN monthly flow per AEPC §4.4 bullet 1
//      ("The minimum downstream release shall be taken as 10 % of the minimum
//      monthly inflow"). Two alternative methods exposed for engineer judgment:
//      'pct_mean_annual' (10 % of Q̄) and 'fixed' (user-entered m³/s).
//   2. Plant availability default: 96 % per AEPC §4.4 bullet 3 ("scheduled
//      outage and station consumption ≈ 4 % of generation of each month").
//   3. Technical minimum Q_min: 0.30·Q_design for Crossflow / Francis,
//      0.20·Q_design for multi-jet Pelton / Turgo (industry practice; HOMER &
//      AHEC §1.10 footnotes; below this turbine efficiency collapses and the
//      governor cannot maintain frequency on a grid-tied unit).
//   4. Power equation uses NET head and OVERALL efficiency from the
//      powerhouse module (η_overall = η_t · η_drive · η_gen). Head losses
//      already deducted upstream — do not deduct again here.
//   5. Firm energy: power dispatched at Q90 from the FDC, sustained 8760 h
//      ·availability. If hydrology FDC has Q90, use it; otherwise compute
//      Q90 from the 12-month series via Weibull p = i/(N+1).
//   6. Nepali calendar: Bikram Sambat months are nominally mid-month to
//      mid-month, so the cleanest grid-energy mapping for AEPC submissions
//      pairs each Gregorian month with the Nepali month that *contains its
//      first day* — Jan→Magh, Feb→Falgun, Mar→Chaitra, Apr→Baisakh, etc.
//      This matches the convention in NEA/AEPC monthly-generation reports.
//
// All flows in m³/s, heads in metres, powers in kW, energies in MWh.
//
// ───────────────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────────
// 1. Types
// ───────────────────────────────────────────────────────────────────────────

export type RiparianMethod = 'aepc_min_monthly' | 'pct_mean_annual' | 'fixed'

export interface EnergyInputs {
  // Hydraulic chain (chained from upstream modules; user can override)
  qDesignM3s: number
  hNetM: number
  etaOverall: number          // η_t · η_drive · η_gen (dimensionless 0-1)
  pInstalledKw: number        // electrical kW at design point

  // 12-month flow series (m³/s) — calendar order Jan..Dec
  monthlyFlows: number[]      // length 12

  // Optional FDC for firm-energy reference (probability of exceedance %)
  // Format: array of {p, q} with p ascending 0..100; both required.
  fdcPoints: { p: number; q: number }[]

  // Riparian release / environmental flow
  riparianMethod: RiparianMethod
  riparianFixedM3s: number    // used only when method = 'fixed'

  // Operational constraints
  plantAvailability: number   // 0-1, default 0.96 (AEPC §4.4)
  technicalMinFactor: number  // Q_min/Q_design, default 0.30

  // Turbine type (used to default technicalMinFactor when not overridden)
  turbineType: 'pelton' | 'turgo' | 'crossflow' | 'francis' | 'unknown'
}

export interface MonthRow {
  index: number               // 0..11 (Jan..Dec)
  english: string             // 'Jan'..'Dec'
  nepali: string              // 'Magh'..'Poush'
  daysInMonth: number
  qAvailableM3s: number
  qAfterRiparianM3s: number
  qPlantM3s: number           // 0 if below Q_min
  powerKw: number
  hoursOnline: number
  energyMwh: number
  plantFactorPercent: number  // E_m / (P_inst · h_total_month) · 100
  spillageM3s: number         // any flow above Q_design that bypasses turbine
}

export interface EnergyOutputs {
  // Effective inputs (after default fallbacks)
  inputsEffective: EnergyInputs
  qRiparianM3s: number
  qMinPlantM3s: number

  // 12-month table
  rows: MonthRow[]

  // Annual aggregates
  annualEnergyMwh: number
  plantFactorPercent: number      // weighted: E_a / (P_inst · 8760)
  loadFactorAveragePercent: number // mean of monthly PF (unweighted)

  // Firm energy (90 % exceedance)
  q90M3s: number
  qFirmAfterRiparianM3s: number
  firmPowerKw: number
  firmEnergyMwh: number
  firmPlantFactorPercent: number

  // Seasonality markers
  dryMonthIndex: number           // lowest energy month
  wetMonthIndex: number           // highest energy month

  // Diagnostics
  warnings: string[]
  errors: string[]
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Constants & calendar
// ───────────────────────────────────────────────────────────────────────────

/** Acceleration of gravity, m/s². AHEC §1.3 §3.0 power equation. */
const G = 9.81

/** Days per Gregorian month (non-leap; 8760 hr / 365 day basis per AEPC §4.5). */
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const

export const ENGLISH_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/**
 * Nepali (Bikram Sambat) months mapped to the Gregorian month that contains
 * each BS month's first day. Bikram Sambat months run mid-month to mid-month
 * relative to the Gregorian calendar; this pairing is the convention used in
 * NEA / AEPC monthly generation reports so the energy table reads correctly
 * in DFS submissions.
 *
 *  Gregorian        | BS month (begins ~mid-prev-Gregorian)
 *  Jan (15-Jan→…)   | Magh
 *  Feb              | Falgun
 *  Mar              | Chaitra
 *  Apr (14-Apr→…)   | Baisakh
 *  May              | Jestha
 *  Jun              | Ashadh
 *  Jul              | Shrawan
 *  Aug              | Bhadra
 *  Sep              | Ashwin
 *  Oct              | Kartik
 *  Nov              | Mangsir
 *  Dec              | Poush
 */
export const NEPALI_MONTHS = [
  'Magh', 'Falgun', 'Chaitra', 'Baisakh', 'Jestha', 'Ashadh',
  'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush',
] as const

// ───────────────────────────────────────────────────────────────────────────
// 3. Helpers
// ───────────────────────────────────────────────────────────────────────────

/** Hydraulic power at the generator terminal (kW) — AHEC §1.3 §3.0. */
export function powerKw(qM3s: number, hNetM: number, etaOverall: number): number {
  if (qM3s <= 0 || hNetM <= 0 || etaOverall <= 0) return 0
  return G * qM3s * hNetM * etaOverall
}

/** Mean of an array; 0 for empty. */
function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

/** Linear interpolation of Q at a given exceedance probability p (%). */
function interpolateFdc(fdc: { p: number; q: number }[], targetP: number): number {
  if (fdc.length === 0) return 0
  // Sort ascending by p so we can scan
  const sorted = [...fdc].sort((a, b) => a.p - b.p)
  if (targetP <= sorted[0].p) return sorted[0].q
  if (targetP >= sorted[sorted.length - 1].p) return sorted[sorted.length - 1].q
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (targetP >= a.p && targetP <= b.p) {
      const frac = (targetP - a.p) / (b.p - a.p)
      return a.q + frac * (b.q - a.q)
    }
  }
  return sorted[sorted.length - 1].q
}

/**
 * Compute Q90 from a 12-month flow series via Weibull plotting position.
 * For N=12 monthly values sorted descending, exceedance p_i = i/(N+1) × 100.
 */
function q90FromMonthly(monthlyFlows: number[]): number {
  if (monthlyFlows.length === 0) return 0
  const sorted = [...monthlyFlows].sort((a, b) => b - a)   // descending
  const N = sorted.length
  // Weibull plotting positions for each rank i ∈ 1..N
  const fdc: { p: number; q: number }[] = sorted.map((q, i) => ({
    p: ((i + 1) / (N + 1)) * 100,
    q,
  }))
  return interpolateFdc(fdc, 90)
}

/**
 * Resolve the riparian release in m³/s from the user-selected method.
 *  - 'aepc_min_monthly' : 10 % of min monthly flow      (AEPC §4.4 default)
 *  - 'pct_mean_annual'  : 10 % of mean annual flow      (legacy practice)
 *  - 'fixed'            : explicit value                (special hydrology)
 */
function resolveRiparian(inp: EnergyInputs): number {
  if (inp.monthlyFlows.length === 0 && inp.riparianMethod !== 'fixed') return 0
  switch (inp.riparianMethod) {
    case 'aepc_min_monthly':
      return 0.10 * Math.min(...inp.monthlyFlows)
    case 'pct_mean_annual':
      return 0.10 * mean(inp.monthlyFlows)
    case 'fixed':
      return Math.max(0, inp.riparianFixedM3s)
  }
}

/** Default technical minimum factor by turbine type (industry norms). */
export function defaultTechnicalMin(t: EnergyInputs['turbineType']): number {
  switch (t) {
    case 'pelton':
    case 'turgo':
      return 0.20
    case 'crossflow':
    case 'francis':
      return 0.30
    case 'unknown':
    default:
      return 0.30
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Main calculation
// ───────────────────────────────────────────────────────────────────────────

export function computeEnergy(inputs: EnergyInputs): EnergyOutputs {
  const warnings: string[] = []
  const errors: string[] = []

  // ── Validate / normalize inputs ───────────────────────────────────────────
  const flows = inputs.monthlyFlows.length === 12
    ? inputs.monthlyFlows.map(v => Math.max(0, v))
    : new Array(12).fill(0)

  if (inputs.monthlyFlows.length === 0) {
    warnings.push(
      'No monthly flow series from hydrology module — enter the 12-month flow ' +
      'series manually before relying on these results.'
    )
  } else if (inputs.monthlyFlows.length !== 12) {
    warnings.push(
      `Hydrology returned ${inputs.monthlyFlows.length} values instead of 12 ` +
      '— missing months treated as zero flow.'
    )
  }

  if (inputs.qDesignM3s <= 0) errors.push('Q_design must be positive.')
  if (inputs.hNetM <= 0) errors.push('Net head must be positive.')
  if (inputs.etaOverall <= 0 || inputs.etaOverall > 1)
    errors.push('Overall efficiency must be in (0, 1].')
  if (inputs.plantAvailability < 0 || inputs.plantAvailability > 1)
    errors.push('Plant availability must be in [0, 1].')

  // ── Riparian release & technical minimum ─────────────────────────────────
  const qRip = resolveRiparian(inputs)
  const qMinPlant = inputs.technicalMinFactor * inputs.qDesignM3s

  // Riparian sanity check — flag months where the mandatory release exceeds
  // available flow (project is infeasible in that month under that release).
  const monthsRiparianViolates: string[] = []
  flows.forEach((q, i) => {
    if (q > 0 && qRip >= q) monthsRiparianViolates.push(ENGLISH_MONTHS[i])
  })
  if (monthsRiparianViolates.length > 0) {
    warnings.push(
      `Riparian release (${qRip.toFixed(3)} m³/s) ≥ available flow in ` +
      `${monthsRiparianViolates.join(', ')} — project infeasible in these ` +
      'months under current release rule. Re-examine hydrology or release.'
    )
  }

  // ── Per-month energy table (AEPC §4.5: E = days · 24 h · P) ──────────────
  const rows: MonthRow[] = flows.map((qAvail, i) => {
    const days = DAYS_IN_MONTH[i]
    const qAfter = Math.max(0, qAvail - qRip)
    const qPlant = qAfter < qMinPlant ? 0 : Math.min(qAfter, inputs.qDesignM3s)
    const spill = Math.max(0, qAfter - inputs.qDesignM3s)
    const P = powerKw(qPlant, inputs.hNetM, inputs.etaOverall)
    const hours = days * 24 * inputs.plantAvailability
    const E = (P * hours) / 1000   // kWh → MWh
    const monthHoursTotal = days * 24
    const PF_m = inputs.pInstalledKw > 0
      ? ((E * 1000) / (inputs.pInstalledKw * monthHoursTotal)) * 100
      : 0
    return {
      index: i,
      english: ENGLISH_MONTHS[i],
      nepali: NEPALI_MONTHS[i],
      daysInMonth: days,
      qAvailableM3s: qAvail,
      qAfterRiparianM3s: qAfter,
      qPlantM3s: qPlant,
      powerKw: P,
      hoursOnline: hours,
      energyMwh: E,
      plantFactorPercent: PF_m,
      spillageM3s: spill,
    }
  })

  // ── Annual aggregates ─────────────────────────────────────────────────────
  const E_annual = rows.reduce((s, r) => s + r.energyMwh, 0)
  const PF_annual = inputs.pInstalledKw > 0
    ? ((E_annual * 1000) / (inputs.pInstalledKw * 8760)) * 100
    : 0
  const LF_avg = mean(rows.map(r => r.plantFactorPercent))

  // Dry / wet month identification
  let dryIdx = 0, wetIdx = 0
  rows.forEach((r, i) => {
    if (r.energyMwh < rows[dryIdx].energyMwh) dryIdx = i
    if (r.energyMwh > rows[wetIdx].energyMwh) wetIdx = i
  })

  // ── Firm energy at 90 % exceedance ────────────────────────────────────────
  // Prefer FDC from hydrology (typically built from longer record). Fall
  // back to the 12-month series via Weibull plotting position when the FDC
  // is absent or empty.
  const q90 = inputs.fdcPoints.length > 0
    ? interpolateFdc(inputs.fdcPoints, 90)
    : q90FromMonthly(flows)
  const q90AfterRip = Math.max(0, q90 - qRip)
  const qFirmPlant = q90AfterRip < qMinPlant
    ? 0
    : Math.min(q90AfterRip, inputs.qDesignM3s)
  const firmPowerKw = powerKw(qFirmPlant, inputs.hNetM, inputs.etaOverall)
  const firmEnergyMwh = (firmPowerKw * 8760 * inputs.plantAvailability) / 1000
  const firmPF = inputs.pInstalledKw > 0
    ? (firmPowerKw / inputs.pInstalledKw) * 100
    : 0

  // ── Diagnostic warnings (load-factor regime, firm capacity) ──────────────
  if (PF_annual > 0 && PF_annual < 35) {
    warnings.push(
      `Plant factor ${PF_annual.toFixed(1)} % is low — site appears flow-limited; ` +
      'consider reducing Q_design to raise utilisation.'
    )
  }
  if (PF_annual > 70) {
    warnings.push(
      `Plant factor ${PF_annual.toFixed(1)} % is very high — design Q may be ` +
      'too conservative. Check spillage in monsoon months; a larger Q_design ' +
      'could capture more energy.'
    )
  }
  if (firmEnergyMwh === 0 && E_annual > 0) {
    warnings.push(
      `Firm energy = 0 — Q90 (${q90.toFixed(3)} m³/s) after riparian release ` +
      `is below the technical minimum (${qMinPlant.toFixed(3)} m³/s). No firm ` +
      'capacity available; dry-season generation cannot be guaranteed.'
    )
  }

  // Spillage diagnostic — sum monsoon spillage for the engineer's eye
  const totalSpillM3 = rows.reduce(
    (s, r) => s + r.spillageM3s * r.daysInMonth * 86400, 0
  )
  if (totalSpillM3 > 0 && PF_annual > 65) {
    warnings.push(
      `Total annual spillage ≈ ${(totalSpillM3 / 1e6).toFixed(2)} Mm³ — ` +
      'a portion of monsoon flow bypasses the turbine.'
    )
  }

  return {
    inputsEffective: { ...inputs, monthlyFlows: flows },
    qRiparianM3s: qRip,
    qMinPlantM3s: qMinPlant,
    rows,
    annualEnergyMwh: E_annual,
    plantFactorPercent: PF_annual,
    loadFactorAveragePercent: LF_avg,
    q90M3s: q90,
    qFirmAfterRiparianM3s: q90AfterRip,
    firmPowerKw,
    firmEnergyMwh,
    firmPlantFactorPercent: firmPF,
    dryMonthIndex: dryIdx,
    wetMonthIndex: wetIdx,
    warnings,
    errors,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// 5. Default inputs (used when nothing is upstream — shouldn't normally fire)
// ───────────────────────────────────────────────────────────────────────────

export const ENERGY_DEFAULTS: EnergyInputs = {
  qDesignM3s: 0.15,
  hNetM: 95,
  etaOverall: 0.66,
  pInstalledKw: 92.26,
  monthlyFlows: [
    0.10, 0.08, 0.07, 0.08, 0.12, 0.18,
    0.35, 0.40, 0.32, 0.20, 0.14, 0.11,
  ],
  fdcPoints: [],
  riparianMethod: 'aepc_min_monthly',
  riparianFixedM3s: 0.0,
  plantAvailability: 0.96,
  technicalMinFactor: 0.30,
  turbineType: 'unknown',
}