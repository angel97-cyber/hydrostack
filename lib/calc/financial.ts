// HydroStack — Module 08: Financial Model (pure calculation engine)
// lib/calc/financial.ts
//
// Sources (all read from project knowledge before this file was written):
//   - AEPC DFS Guidelines for Mini Hydropower Projects, 2014:
//       §1.6.1 NEA PPA tariff (Rs 8.40 dry / 4.80 wet, 3% escalation 5 years,
//              25-year PPA period, 80% exceedance for 100–1000 kW projects)
//       §1.6.2 / §5.11 / §5.12 / §5.13 / §7
//       Table 7.1 NEA Tariff and 3% escalation for 5 years (years 1–6)
//       Royalty exempt (Electricity Act 2065 §21) for ≤1000 kW
//       Income tax exempt (Income Tax Act 2058) for ≤1000 kW
//       Annex C BoQ summary format
//   - AHEC-IITR/MNRE/SHP Standards §1.5 Project Cost Estimation
//   - AHEC-IITR/MNRE/SHP Standards §1.6 Economic & Financial Analysis:
//       §4.4 D:E ratio 70:30, §4.6 discount factor, §5 IRR/NPV/BCR
//       §7 tariff determination, Table 12 DSCR computation
//   - Butchers et al. 2022 (Development Engineering 7, 100097):
//       Eq.2 COST_Crossflow = 5399·P^0.837·H^-0.530 ($)
//       Eq.3 COST_Pelton    = 7765·P^0.552·H^-0.237 ($)
//       Note: paper states these cover full EM excl. penstock; HydroStack
//       splits into B1/B2/B3 line items per AEPC BoQ format — the resulting
//       EM total is conservative (high) which is the safe direction for DFS.
//   - Electricity Act 2065 §21 (royalty schedule for >1 MW)
//   - AEPC RE Subsidy Policy 2069 (40% baseline, 60% cap mini-hydro)

// ─── Constants ───────────────────────────────────────────────────────────────

/** Standard NEA PPA tariff per AEPC DFS 2014 Table 7.1 (NPR/kWh) */
const NEA_DRY_BASE_NPR_PER_KWH = 8.40   // Poush-Chaitra (Dec-Mar)
const NEA_WET_BASE_NPR_PER_KWH = 4.80   // Baisakh-Mangsir (Apr-Nov)

/** AEPC DFS 2014 Table 7.1 — explicit 6-year tariff schedule.
 *  Year 7+ frozen at year-6 (plateau) values. Year 26+ post-PPA captive (50%). */
const AEPC_TARIFF_TABLE = {
  dry: [8.40, 8.65, 8.90, 9.16, 9.41, 9.66] as const,
  wet: [4.80, 4.94, 5.09, 5.23, 5.38, 5.52] as const,
}

/** PPA period per AEPC DFS 2014 §1.6.1 */
const PPA_TERM_YEARS = 25

/** Post-PPA captive tariff fraction (assumed half of frozen plateau).
 *  AEPC DFS 2014 is silent post-PPA; this is a conservative engineering
 *  assumption — real rate depends on captive/community sale arrangement. */
const POST_PPA_TARIFF_FRACTION = 0.50

/** Dry-season month indices (0-based). Poush–Chaitra ≈ Dec/Jan/Feb/Mar.
 *  Source: AEPC DFS 2014 §1.6.1 — "Rs 8.4/kWh for Poush–Chaitra". */
const DRY_MONTH_INDICES = new Set<number>([11, 0, 1, 2])
//                                        Dec  Jan Feb Mar (0-based)

/** Royalty schedule for >1000 kW per Electricity Act 2065 §21 +
 *  Electricity Act 2049/2074 amendments (capacity + energy royalty,
 *  step-up after 15 years). Editable in inputs. */
const DEFAULT_ROYALTY_OVER_1MW = {
  capacityFirst15NprPerKw: 100,    // Rs/kW year-1 to year-15
  capacityAfter15NprPerKw: 1000,   // Rs/kW year-16+
  energyFirst15Pct: 1.85,          // % of revenue year-1 to year-15
  energyAfter15Pct: 10.00,         // % of revenue year-16+
}

/** Royalty threshold per Electricity Act 2065 §21 (cited in AEPC DFS §1.6.2) */
const ROYALTY_EXEMPT_KW = 1000
/** Income tax threshold per Income Tax Act 2058 (cited in AEPC DFS §7) */
const TAX_EXEMPT_KW = 1000

/** Tax regime for >1000 kW per Income Tax Act 2058 with RE incentive period */
const RE_INCENTIVE_YEARS = 10
const CORPORATE_TAX_RATE_AFTER_INCENTIVE = 0.25
/** Depreciation rate per AEPC DFS 2014 §7 (4% straight-line on total CapEx) */
const DEPRECIATION_RATE_SLM = 0.04

/** Discount rates per AEPC DFS 2014 §7.3 + AHEC §1.6 §4.6 */
const DISCOUNT_RATE_AEPC_BCR = 0.06     // for NPV/BCR (Capital cost minus subsidy)
const DISCOUNT_RATE_EQUITY = 0.12       // typical equity hurdle rate

const FX_DEFAULT_NPR_PER_USD = 133.5

// ─── Public types ────────────────────────────────────────────────────────────

export type TurbineType = 'pelton' | 'turgo' | 'crossflow' | 'francis'

export interface CapExLineItemInput {
  /** Editable NPR amount; if undefined, formula default is used. */
  amountNpr?: number
}

export interface FinancialInputs {
  // ─── Upstream chained values (read-only in UI, but kept here as the
  //     calculation source of truth so the engine is pure) ─────────────────
  pInstalledKw: number          // from powerhouse.generator.electricalPowerKw
  hNetM: number                 // from powerhouse.hydraulics.hNetM
  turbine: TurbineType          // from powerhouse.selected
  generatorKva: number          // from powerhouse.generator.standardKvaSelected

  annualEnergyMwh: number       // from energy.annualEnergyMwh
  firmEnergyMwh: number         // from energy.firmEnergyMwh
  monthlyEnergyMwh: number[]    // from energy.rows[12].energyMwh (length 12,
                                //   index 0 = Jan/Magh, ...; mapping by english month)
  monthsEnglish: string[]       // from energy.rows[12].english (length 12)

  penstockTotalWeightKgPerM: number  // from penstock.totalWeightKgPerM
  penstockExternalDiameterMm: number // from penstock.externalDiameterMm
  penstockLengthM: number       // from penstock inputs.lengthM (or H_gross/sin45° fallback)
  hGrossM: number               // for fallback length calc + powerhouse footprint
  powerhouseFootprintM2: number // from powerhouse.layout.totalFootprintAreaM2

  // ─── Currency & engineering judgment ─────────────────────────────────────
  fxNprPerUsd: number

  // ─── CapEx line items (editable; 12 rows) ───────────────────────────────
  /** A1 Headworks (weir + intake + gravel trap), NPR */
  a1HeadworksNpr?: number
  /** A2 Settling basin, NPR */
  a2SettlingNpr?: number
  /** A3 Headrace canal/pipe, NPR */
  a3HeadraceNpr?: number
  /** A4 Forebay, NPR */
  a4ForebayNpr?: number
  /** A5 Penstock fabrication + transport + installation, NPR */
  a5PenstockNpr?: number
  /** Steel rate for A5 default calc, NPR/kg (rolled MS plate Nepal) */
  steelRateNprPerKg: number
  /** A6 Anchor blocks + saddle supports, NPR */
  a6AnchorsNpr?: number
  /** A7 Powerhouse building (RCC), NPR */
  a7PowerhouseNpr?: number
  /** Powerhouse RCC rate for A7 default, NPR/m² */
  powerhouseRateNprPerM2: number
  /** A8 Tailrace channel, NPR */
  a8TailraceNpr?: number

  /** B1 Turbine + governor + inlet valve, NPR */
  b1TurbineNpr?: number
  /** B2 Generator + AVR + exciter, NPR */
  b2GeneratorNpr?: number
  /** Generator rate for B2 default, NPR/kVA */
  generatorRateNprPerKva: number
  /** B3 Switchgear + control panel + metering, NPR */
  b3SwitchgearNpr?: number

  /** C1 Transmission line, NPR (default = km × kV-class rate) */
  c1TransmissionNpr?: number
  transmissionLengthKm: number
  transmissionVoltageKv: 11 | 33
  /** C2 Access road, NPR (default = km × terrain rate) */
  c2AccessRoadNpr?: number
  accessRoadLengthKm: number
  accessRoadTerrain: 'jeepTrack' | 'blasting'

  /** D1 Engineering + supervision %, on (A+B+C) — AEPC DFS §5 */
  d1EngineeringSupervisionPct: number
  /** D2 Contingency %, on (A+B+C+D1) — AEPC DFS §5 (10% civil + 5% EM weighted ≈ 9%) */
  d2ContingencyPct: number
  /** D3 Land acquisition + compensation, NPR */
  d3LandAcquisitionNpr: number
  /** D4 Environmental mitigation, NPR */
  d4EnvironmentalNpr: number
  /** D5 IDC computed; bank rate used in default formula */
  bankInterestRatePct: number    // % p.a.

  // ─── OpEx ────────────────────────────────────────────────────────────────
  /** O&M as % of total CapEx (AEPC DFS §5.13: 1.5–3.0%) */
  oAndMPctOfCapEx: number        // %
  /** Insurance as % of total CapEx (AEPC DFS §7.3: 0.5%) */
  insurancePctOfCapEx: number    // %
  /** OpEx escalation %/yr (AEPC DFS §7) */
  oAndMEscalationPct: number     // %
  /** Land lease NPR/yr (default 0) */
  landLeaseNprPerYear: number
  /** NEA wheeling NPR/yr (default 0) */
  wheelingNprPerYear: number

  // Royalty (only applied if pInstalledKw > 1000)
  royaltyOver1MW: typeof DEFAULT_ROYALTY_OVER_1MW

  // ─── Tariff (editable; defaults from AEPC DFS Table 7.1) ────────────────
  dryTariffNprPerKwh: number
  wetTariffNprPerKwh: number
  tariffEscalationPct: number    // % per year for first 5 op years (default 3)
  tariffEscalationYears: number  // (default 5)
  /** PPA term in years (AEPC: 25) */
  ppaTermYears: number
  /** Post-PPA captive tariff fraction of plateau */
  postPpaTariffFraction: number

  // ─── Cashflow horizon & financing ────────────────────────────────────────
  /** Years from start until COD (1, 2, or 3). Operations begin at year=constructionYears. */
  constructionYears: number
  /** Disbursement schedule, length = constructionYears + 1 (allows
   *  spillover into COD year for final commissioning costs).
   *  Default for 2-yr construction: [0.35, 0.45, 0.20] per AEPC DFS §6. */
  disbursementSchedule: number[]
  /** Project life in operating years (default 30) */
  projectLifeYears: number
  /** Subsidy as % of total CapEx (AEPC RE Policy 2069: 40% baseline, 60% cap) */
  subsidyPctOfCapEx: number
  /** Subsidy split: 60% at COD, 40% after 1-yr POV */
  subsidyAtCodFraction: number
  subsidyAtPovFraction: number
  /** Revenue ramp in first 3 op years */
  revenueRampYear1: number       // 0.60
  revenueRampYear2: number       // 0.80
  revenueRampYear3: number       // 1.00
  /** Debt financing toggle */
  debtEnabled: boolean
  /** Debt fraction of (total CapEx − subsidy) */
  debtFraction: number           // 0.70
  /** Loan tenor years post-COD */
  loanTenorYears: number         // 10
}

export interface CapExBreakdown {
  // Civil (A1-A8)
  a1HeadworksNpr: number
  a2SettlingNpr: number
  a3HeadraceNpr: number
  a4ForebayNpr: number
  a5PenstockNpr: number
  a6AnchorsNpr: number
  a7PowerhouseNpr: number
  a8TailraceNpr: number
  civilSubtotalNpr: number

  // Electromechanical (B1-B3)
  b1TurbineNpr: number
  b2GeneratorNpr: number
  b3SwitchgearNpr: number
  emSubtotalNpr: number

  // Transmission + Access (C1-C2)
  c1TransmissionNpr: number
  c2AccessRoadNpr: number
  cSubtotalNpr: number

  // Indirect (D1-D5)
  d1EngineeringNpr: number
  d2ContingencyNpr: number
  d3LandAcquisitionNpr: number
  d4EnvironmentalNpr: number
  d5IdcNpr: number
  dSubtotalNpr: number

  // Totals
  directCostNpr: number          // A + B + C
  totalCapExNpr: number          // direct + D
  totalCapExUsd: number
  specificCostNprPerKw: number
  specificCostUsdPerKw: number

  // Financing breakdown
  subsidyNpr: number
  netCapExNpr: number            // total − subsidy
  equityNpr: number
  debtNpr: number
}

export interface CashflowRow {
  year: number                   // 0-based from project start
  operatingYear: number          // 1-based from COD; 0 if construction
  capexOutflow: number           // negative
  subsidyReceipt: number         // positive
  revenue: number                // positive
  opex: number                   // negative-magnitude (stored positive, treat as outflow)
  royalty: number                // positive (stored positive, treat as outflow)
  taxPayable: number             // positive (stored positive, treat as outflow)
  depreciation: number           // tax-shield only (no cash effect, FYI)
  debtInterest: number           // positive
  debtPrincipal: number          // positive
  debtService: number            // interest + principal
  debtBalance: number            // outstanding at year end
  ncfBeforeFinancing: number     // for IRR_project (no debt; subsidy IN; tax/royalty applied)
  ncfAfterFinancing: number      // for IRR_equity (debt service applied; equity outflow during construction)
  cumulativeNcfBefore: number
  cumulativeNcfAfter: number
  effectiveTariffNprPerKwh: number  // weighted average for the year
  energyMwh: number              // ramped (60/80/100% ×) annualEnergyMwh
}

export interface SensitivityRow {
  scenario: string
  irrProjectPct: number
  npv6Cr: number
  paybackYears: number
}

export type WarningLevel = 'info' | 'warn' | 'critical'

export interface FinancialWarning {
  level: WarningLevel
  code: string
  message: string
}

export interface FinancialOutputs {
  capex: CapExBreakdown
  // Revenue diagnostics (Year 1 of operations, undiscounted)
  annualRevenueYr1Npr: number
  dryEnergyMwh: number
  wetEnergyMwh: number
  blendedTariffNprPerKwh: number
  // Annual cashflow array
  cashflows: CashflowRow[]
  // Headline metrics
  irrProjectPct: number          // %
  irrEquityPct: number           // % (NaN if debt disabled)
  npvAt6Cr: number               // NPR crore (1 cr = 10^7 NPR)
  npvAt12Cr: number              // NPR crore
  bcrAt6: number
  paybackSimpleYears: number
  paybackDiscountedYears: number  // at 12%
  lcoeNprPerKwh: number          // at 6%
  dscrMin: number                // (NaN if debt disabled)
  dscrAvg: number                // (NaN if debt disabled)
  tariffBreakevenNprPerKwh: number  // tariff at which IRR_project = 12%
  // Operational metrics for display
  isBelowRoyaltyThreshold: boolean
  isBelowTaxThreshold: boolean
  // One-way sensitivity scenarios
  sensitivity: SensitivityRow[]
  // Warnings & lender checklist
  warnings: FinancialWarning[]
  lenderChecklist: { label: string; passed: boolean; note: string }[]
}

// ─── Defaults ────────────────────────────────────────────────────────────────

export const FINANCIAL_DEFAULTS: FinancialInputs = {
  pInstalledKw: 92,
  hNetM: 95,
  turbine: 'crossflow',
  generatorKva: 115,
  annualEnergyMwh: 605.21,
  firmEnergyMwh: 100,
  monthlyEnergyMwh: [40.86, 28.97, 27.68, 35, 50, 70, 85, 90, 80, 60, 50, 45.25],
  // Default English month order Jan..Dec (will be replaced from upstream).
  monthsEnglish: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ],
  penstockTotalWeightKgPerM: 70,
  penstockExternalDiameterMm: 350,
  penstockLengthM: 250,
  hGrossM: 100,
  powerhouseFootprintM2: 60,
  fxNprPerUsd: FX_DEFAULT_NPR_PER_USD,

  // CapEx defaults left undefined → engine fills via formulas
  steelRateNprPerKg: 180,            // Butchers 2022: rolled MS plate Nepal
  powerhouseRateNprPerM2: 35_000,    // AHEC §12, hill construction rate
  generatorRateNprPerKva: 12_000,
  transmissionLengthKm: 5,
  transmissionVoltageKv: 11,
  accessRoadLengthKm: 2,
  accessRoadTerrain: 'jeepTrack',

  d1EngineeringSupervisionPct: 6,    // AEPC DFS 2014 §5
  d2ContingencyPct: 9,               // AEPC DFS 2014 §5.11 (civil 10% + EM 5%, weighted)
  d3LandAcquisitionNpr: 200_000,
  d4EnvironmentalNpr: 200_000,
  bankInterestRatePct: 10,           // Nepal development bank typical

  oAndMPctOfCapEx: 2.5,              // AEPC DFS §5.13
  insurancePctOfCapEx: 0.5,          // AEPC DFS §7.3
  oAndMEscalationPct: 5,             // Nepal construction inflation ~6%, AEPC §7
  landLeaseNprPerYear: 0,
  wheelingNprPerYear: 0,
  royaltyOver1MW: { ...DEFAULT_ROYALTY_OVER_1MW },

  dryTariffNprPerKwh: NEA_DRY_BASE_NPR_PER_KWH,
  wetTariffNprPerKwh: NEA_WET_BASE_NPR_PER_KWH,
  tariffEscalationPct: 3,
  tariffEscalationYears: 5,
  ppaTermYears: PPA_TERM_YEARS,
  postPpaTariffFraction: POST_PPA_TARIFF_FRACTION,

  constructionYears: 2,
  disbursementSchedule: [0.35, 0.45, 0.20],
  projectLifeYears: 30,
  subsidyPctOfCapEx: 40,
  subsidyAtCodFraction: 0.60,
  subsidyAtPovFraction: 0.40,
  revenueRampYear1: 0.60,
  revenueRampYear2: 0.80,
  revenueRampYear3: 1.00,
  debtEnabled: true,
  debtFraction: 0.70,
  loanTenorYears: 10,
}

// ─── Math helpers ────────────────────────────────────────────────────────────

const isFinitePositive = (n: number): boolean => Number.isFinite(n) && n > 0
const safe = (n: number, fallback = 0): number => (Number.isFinite(n) ? n : fallback)

/** Robust IRR for both conventional and non-conventional cashflows.
 *  Strategy:
 *    1. Multiple Newton-Raphson seeds (covers most well-behaved cases).
 *    2. If NR fails → scan a dense grid of rates from -50% to +500%
 *       looking for the first sign change in NPV(r), then bisect.
 *    3. Returns NaN only when NPV has no real root in [-0.50, 5.0]
 *       — covers all economically meaningful cases.
 *  Non-conventional (multi-sign-change) cashflows may have multiple IRRs;
 *  this algorithm returns the smallest positive root, which is the
 *  developer-relevant answer (lender/equity hurdle comparison).
 */
function computeIrr(cashflows: number[]): number {
  if (cashflows.length < 2) return NaN
  const hasNeg = cashflows.some((c) => c < 0)
  const hasPos = cashflows.some((c) => c > 0)
  if (!hasNeg || !hasPos) return NaN

  const npvAt = (rate: number): number => {
    let n = 0
    for (let t = 0; t < cashflows.length; t++) {
      n += cashflows[t] / Math.pow(1 + rate, t)
    }
    return n
  }

  // ── Phase 1: Newton-Raphson with multiple seeds ──
  const seeds = [0.10, 0.05, 0.15, 0.20, 0.0, -0.05, 0.25, 0.50, -0.10]
  for (const seed of seeds) {
    let r = seed
    let lastR = r
    let converged = false
    for (let i = 0; i < 200; i++) {
      let npv = 0
      let dnpv = 0
      for (let t = 0; t < cashflows.length; t++) {
        const denom = Math.pow(1 + r, t)
        npv += cashflows[t] / denom
        if (t > 0) dnpv += -t * cashflows[t] / Math.pow(1 + r, t + 1)
      }
      if (Math.abs(dnpv) < 1e-12) break
      const rNew = r - npv / dnpv
      if (!Number.isFinite(rNew) || rNew < -0.95 || rNew > 50) break
      if (Math.abs(rNew - r) < 1e-7) {
        r = rNew
        converged = true
        break
      }
      lastR = r
      r = rNew
    }
    if (converged) {
      // Verify NPV is genuinely zero (not an oscillation artifact)
      const check = npvAt(r)
      // Tolerance: 0.001% of largest cashflow magnitude
      const tol = Math.max(1, Math.max(...cashflows.map(Math.abs)) * 1e-5)
      if (Math.abs(check) < tol && r > -0.95 && r < 50) {
        return r
      }
    }
  }

  // ── Phase 2: dense grid scan for sign change, then bisection ──
  // Scan in 1% steps from -50% to +500% — for any economically meaningful
  // hydropower project, the IRR (if any) lies in this range.
  const grid: number[] = []
  for (let r = -0.50; r <= 5.00 + 1e-9; r += 0.01) grid.push(r)
  for (let i = 0; i < grid.length - 1; i++) {
    const a = grid[i], b = grid[i + 1]
    const fa = npvAt(a), fb = npvAt(b)
    if (Number.isFinite(fa) && Number.isFinite(fb) && fa * fb < 0) {
      // Bisect [a, b] to high precision
      let lo = a, hi = b, fLo = fa
      for (let j = 0; j < 100; j++) {
        const mid = (lo + hi) / 2
        const fMid = npvAt(mid)
        if (Math.abs(fMid) < 1) return mid
        if (fMid * fLo < 0) {
          hi = mid
        } else {
          lo = mid
          fLo = fMid
        }
      }
      return (lo + hi) / 2
    }
  }
  return NaN
}

/** Standard NPV: Σ CF[t] / (1+r)^t */
function computeNpv(cashflows: number[], rate: number): number {
  let npv = 0
  for (let t = 0; t < cashflows.length; t++) {
    npv += cashflows[t] / Math.pow(1 + rate, t)
  }
  return npv
}

// ─── CapEx defaults via formulas (AEPC + Butchers + AHEC) ────────────────────

/** Butchers 2022 Eq.2/3 — EM cost in USD as f(P_kW, H_net_m).
 *  Used as default for B1 (turbine). Note: the source paper covers full EM
 *  excl. penstock; HydroStack splits into B1/B2/B3 (AEPC BoQ), so the
 *  resulting EM total is conservative — acceptable for DFS / lender-side. */
function butchersEmCostUsd(P: number, H: number, t: TurbineType): number {
  if (P <= 0 || H <= 0) return 0
  switch (t) {
    case 'pelton':
    case 'turgo':
      return 7765 * Math.pow(P, 0.552) * Math.pow(H, -0.237)   // Eq.3
    case 'crossflow':
    case 'francis':
    default:
      return 5399 * Math.pow(P, 0.837) * Math.pow(H, -0.530)   // Eq.2
  }
}

/** Transmission line rate per AEPC DFS 2014 §5 / Nepal 2024 market */
function transmissionRatePerKm(kv: 11 | 33): number {
  return kv === 33 ? 4_500_000 : 2_500_000
}
function accessRoadRatePerKm(terrain: 'jeepTrack' | 'blasting'): number {
  return terrain === 'blasting' ? 6_000_000 : 3_500_000
}

/** Build a full CapEx breakdown from inputs, applying defaults where
 *  user-overrides are absent.
 *
 *  IDC (D5) is computed self-consistently per AEPC DFS 2014 §5.12:
 *    IDC = direct_total × bank_rate / 2 × constructionYears
 *  This linear approximation matches the AHEC IDC computation table which
 *  ramps debt across construction quarters and applies interest to
 *  average outstanding balance. */
function buildCapEx(i: FinancialInputs): CapExBreakdown {
  const P = i.pInstalledKw
  const Hnet = i.hNetM

  // ── A. Civil ──
  const a1 = i.a1HeadworksNpr ?? (800_000 + 4_500 * P)         // AEPC DFS Ch.5
  const a2 = i.a2SettlingNpr ?? (250_000 + 1_200 * P)
  const a3 = i.a3HeadraceNpr ?? (600_000 + 3_000 * P)
  const a4 = i.a4ForebayNpr ?? (180_000 + 900 * P)
  // A5 penstock: steel kg × NPR/kg (Butchers 2022 §3 — local steel × volume)
  const a5Default = i.penstockTotalWeightKgPerM * i.penstockLengthM * i.steelRateNprPerKg
  const a5 = i.a5PenstockNpr ?? a5Default
  const a6 = i.a6AnchorsNpr ?? (120_000 + 500 * P)
  // A7 powerhouse: footprint × NPR/m² (AHEC §12, RCC hill rate)
  const a7Default = i.powerhouseFootprintM2 * i.powerhouseRateNprPerM2
  const a7 = i.a7PowerhouseNpr ?? a7Default
  const a8 = i.a8TailraceNpr ?? (80_000 + 300 * P)
  const civilSubtotal = a1 + a2 + a3 + a4 + a5 + a6 + a7 + a8

  // ── B. Electromechanical ──
  const b1Default = butchersEmCostUsd(P, Hnet, i.turbine) * i.fxNprPerUsd
  const b1 = i.b1TurbineNpr ?? b1Default
  const b2Default = i.generatorKva * i.generatorRateNprPerKva
  const b2 = i.b2GeneratorNpr ?? b2Default
  const b3 = i.b3SwitchgearNpr ?? (350_000 + 1_500 * P)
  const emSubtotal = b1 + b2 + b3

  // ── C. Transmission + Access ──
  const c1Default = i.transmissionLengthKm * transmissionRatePerKm(i.transmissionVoltageKv)
  const c1 = i.c1TransmissionNpr ?? c1Default
  const c2Default = i.accessRoadLengthKm * accessRoadRatePerKm(i.accessRoadTerrain)
  const c2 = i.c2AccessRoadNpr ?? c2Default
  const cSubtotal = c1 + c2

  const directCost = civilSubtotal + emSubtotal + cSubtotal

  // ── D. Indirect ──
  const d1 = directCost * (i.d1EngineeringSupervisionPct / 100)              // AEPC §5
  const d2 = (directCost + d1) * (i.d2ContingencyPct / 100)                  // AEPC §5.11
  const d3 = i.d3LandAcquisitionNpr
  const d4 = i.d4EnvironmentalNpr
  // IDC: depends on subsidy + debt structure → compute on direct + indirect (excl. IDC)
  const preIdcTotal = directCost + d1 + d2 + d3 + d4
  // Subsidy reduces financing need; debt is on residual
  const subsidy = preIdcTotal * (i.subsidyPctOfCapEx / 100)
  const netToFinance = Math.max(0, preIdcTotal - subsidy)
  const debtBase = i.debtEnabled ? netToFinance * i.debtFraction : 0
  // IDC linear approximation per AEPC DFS §5.12
  const d5 = debtBase * (i.bankInterestRatePct / 100) * (i.constructionYears / 2)
  const dSubtotal = d1 + d2 + d3 + d4 + d5

  const totalCapEx = directCost + dSubtotal
  // After IDC is added to total, recompute subsidy on total (some practice
  // includes IDC in subsidy base, some doesn't — AEPC RE Policy 2069 is
  // ambiguous; using inclusive base here is the developer-friendly choice)
  const finalSubsidy = totalCapEx * (i.subsidyPctOfCapEx / 100)
  const finalNetCapEx = Math.max(0, totalCapEx - finalSubsidy)
  const equity = i.debtEnabled ? finalNetCapEx * (1 - i.debtFraction) : finalNetCapEx
  const debt = i.debtEnabled ? finalNetCapEx * i.debtFraction : 0

  return {
    a1HeadworksNpr: a1,
    a2SettlingNpr: a2,
    a3HeadraceNpr: a3,
    a4ForebayNpr: a4,
    a5PenstockNpr: a5,
    a6AnchorsNpr: a6,
    a7PowerhouseNpr: a7,
    a8TailraceNpr: a8,
    civilSubtotalNpr: civilSubtotal,
    b1TurbineNpr: b1,
    b2GeneratorNpr: b2,
    b3SwitchgearNpr: b3,
    emSubtotalNpr: emSubtotal,
    c1TransmissionNpr: c1,
    c2AccessRoadNpr: c2,
    cSubtotalNpr: cSubtotal,
    d1EngineeringNpr: d1,
    d2ContingencyNpr: d2,
    d3LandAcquisitionNpr: d3,
    d4EnvironmentalNpr: d4,
    d5IdcNpr: d5,
    dSubtotalNpr: dSubtotal,
    directCostNpr: directCost,
    totalCapExNpr: totalCapEx,
    totalCapExUsd: totalCapEx / i.fxNprPerUsd,
    specificCostNprPerKw: P > 0 ? totalCapEx / P : 0,
    specificCostUsdPerKw: P > 0 ? totalCapEx / i.fxNprPerUsd / P : 0,
    subsidyNpr: finalSubsidy,
    netCapExNpr: finalNetCapEx,
    equityNpr: equity,
    debtNpr: debt,
  }
}

// ─── Tariff schedule (AEPC DFS 2014 Table 7.1) ────────────────────────────────

/** Tariff for given operating year (1-based) and season.
 *  Op years 1-tariffEscalationYears+1: AEPC table (or generated if user
 *    overrides escalation rate / years).
 *  Op years (tariffEscalationYears+2)-ppaTermYears: frozen at plateau.
 *  Op years > ppaTermYears: post-PPA captive (× postPpaTariffFraction). */
function tariffNprPerKwh(
  opYear: number,
  isDry: boolean,
  i: FinancialInputs,
): number {
  const base = isDry ? i.dryTariffNprPerKwh : i.wetTariffNprPerKwh
  const escYears = Math.max(0, Math.floor(i.tariffEscalationYears))
  const escRate = i.tariffEscalationPct / 100

  // Plateau tariff = base × (1 + escRate)^escYears  [reached at op year escYears+1]
  const plateau = base * Math.pow(1 + escRate, escYears)

  if (opYear <= 0) return 0
  if (opYear > i.ppaTermYears) {
    // Post-PPA captive
    return plateau * i.postPpaTariffFraction
  }
  if (opYear <= escYears + 1) {
    // Use AEPC default table when defaults are in play (matches Table 7.1
    // exactly — 8.40 → 8.65 → 8.90 → 9.16 → 9.41 → 9.66, accounting for
    // the rounding the AEPC table applies). When user overrides base or
    // escalation, fall back to clean compounding.
    const usingAepcDefaults =
      Math.abs(i.dryTariffNprPerKwh - NEA_DRY_BASE_NPR_PER_KWH) < 0.001 &&
      Math.abs(i.wetTariffNprPerKwh - NEA_WET_BASE_NPR_PER_KWH) < 0.001 &&
      Math.abs(i.tariffEscalationPct - 3) < 0.001 &&
      i.tariffEscalationYears === 5
    if (usingAepcDefaults && opYear <= 6) {
      return isDry
        ? AEPC_TARIFF_TABLE.dry[opYear - 1]
        : AEPC_TARIFF_TABLE.wet[opYear - 1]
    }
    return base * Math.pow(1 + escRate, opYear - 1)
  }
  // Frozen plateau (op years escYears+2 .. ppaTermYears)
  return plateau
}

/** Annual revenue at given operating year using monthly energy split + tariff schedule. */
function annualRevenue(
  opYear: number,
  ramp: number,
  i: FinancialInputs,
): { revenueNpr: number; effectiveTariff: number; energyMwh: number } {
  if (opYear <= 0 || ramp <= 0) {
    return { revenueNpr: 0, effectiveTariff: 0, energyMwh: 0 }
  }
  let revenue = 0
  let totalEnergyMwh = 0
  for (let m = 0; m < 12; m++) {
    const monthName = (i.monthsEnglish[m] ?? '').slice(0, 3).toLowerCase()
    // Map month name to 0-based index (Jan=0). Robust to "Jan"/"January"/etc.
    const monthIdx = monthNameToIndex(monthName, m)
    const isDry = DRY_MONTH_INDICES.has(monthIdx)
    const tariff = tariffNprPerKwh(opYear, isDry, i)
    const energy = (i.monthlyEnergyMwh[m] ?? 0) * ramp
    totalEnergyMwh += energy
    revenue += energy * 1000 * tariff   // MWh × 1000 = kWh × NPR/kWh = NPR
  }
  const effectiveTariff = totalEnergyMwh > 0
    ? revenue / (totalEnergyMwh * 1000)
    : 0
  return { revenueNpr: revenue, effectiveTariff, energyMwh: totalEnergyMwh }
}

const ENGLISH_MONTH_LOOKUP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}
function monthNameToIndex(name: string, fallbackIdx: number): number {
  const lc = name.slice(0, 3).toLowerCase()
  return ENGLISH_MONTH_LOOKUP[lc] ?? fallbackIdx
}

/** Dry / wet split of annual energy, useful for diagnostics tile. */
function splitDryWet(i: FinancialInputs): { dryMwh: number; wetMwh: number } {
  let dry = 0, wet = 0
  for (let m = 0; m < 12; m++) {
    const idx = monthNameToIndex(i.monthsEnglish[m] ?? '', m)
    const e = i.monthlyEnergyMwh[m] ?? 0
    if (DRY_MONTH_INDICES.has(idx)) dry += e
    else wet += e
  }
  return { dryMwh: dry, wetMwh: wet }
}

// ─── Royalty (gated by capacity) ──────────────────────────────────────────────

function royaltyForYear(
  opYear: number,
  capacityKw: number,
  revenueNpr: number,
  i: FinancialInputs,
): number {
  // Electricity Act 2065 §21: ≤1000 kW → 0 royalty permanently.
  if (capacityKw <= ROYALTY_EXEMPT_KW) return 0
  if (opYear <= 0) return 0
  const r = i.royaltyOver1MW
  if (opYear <= 15) {
    return capacityKw * r.capacityFirst15NprPerKw
         + revenueNpr * (r.energyFirst15Pct / 100)
  }
  return capacityKw * r.capacityAfter15NprPerKw
       + revenueNpr * (r.energyAfter15Pct / 100)
}

// ─── Main calculation ─────────────────────────────────────────────────────────

export function computeFinancial(i: FinancialInputs): FinancialOutputs {
  const capex = buildCapEx(i)
  const totalCapEx = capex.totalCapExNpr
  const subsidy = capex.subsidyNpr
  const equity = capex.equityNpr
  const debt = capex.debtNpr
  const interestRate = i.bankInterestRatePct / 100

  // ── Year-1 revenue (operations year 1, full ramp at this point would be 60%
  //    per default; here we report UN-RAMPED tariff diagnostics for display)
  // ─ 'Annual revenue Yr-1' in the prompt's reference case is at full energy
  //   (no ramp), simply Σ E_month × τ_month. We compute that for the display
  //   tile so the engineer can sanity-check against reference.
  const fullYr1 = annualRevenue(1, 1.0, i)
  const dryWet = splitDryWet(i)

  // ── Build cashflow array ──
  const N = i.constructionYears + i.projectLifeYears  // total horizon length (years)
  const cashflows: CashflowRow[] = []
  let debtBalance = debt
  let cumNcfBefore = 0
  let cumNcfAfter = 0
  // O&M base year-1 amount (escalated for subsequent years)
  const oMBase = totalCapEx * (i.oAndMPctOfCapEx / 100) + i.landLeaseNprPerYear + i.wheelingNprPerYear
  const insuranceBase = totalCapEx * (i.insurancePctOfCapEx / 100)

  for (let t = 0; t < N; t++) {
    const opYear = t - i.constructionYears + 1   // 1-based; <=0 during construction
    const inOperations = opYear >= 1

    // ── CapEx outflow per disbursement schedule ──
    const dIdx = t  // disbursement schedule indexed from year 0
    const disbFraction = dIdx < i.disbursementSchedule.length
      ? i.disbursementSchedule[dIdx]
      : 0
    const capexOut = totalCapEx * disbFraction

    // ── Subsidy receipts ──
    let subsidyIn = 0
    if (t === i.constructionYears) {
      subsidyIn = subsidy * i.subsidyAtCodFraction        // 60% at COD
    } else if (t === i.constructionYears + 1) {
      subsidyIn = subsidy * i.subsidyAtPovFraction        // 40% at POV
    }

    // ── Operations: revenue / opex / royalty / tax / depreciation ──
    let revenue = 0
    let opex = 0
    let royalty = 0
    let tax = 0
    let depreciation = 0
    let effectiveTariff = 0
    let energyMwhYr = 0

    if (inOperations) {
      // Revenue ramp (60% / 80% / 100%)
      const ramp = opYear === 1 ? i.revenueRampYear1
                 : opYear === 2 ? i.revenueRampYear2
                 :                i.revenueRampYear3
      const rev = annualRevenue(opYear, ramp, i)
      revenue = rev.revenueNpr
      effectiveTariff = rev.effectiveTariff
      energyMwhYr = rev.energyMwh

      // OpEx (escalated)
      const escFactor = Math.pow(1 + i.oAndMEscalationPct / 100, opYear - 1)
      opex = (oMBase + insuranceBase) * escFactor

      // Royalty
      royalty = royaltyForYear(opYear, i.pInstalledKw, revenue, i)

      // Depreciation (4% SLM, 25-year deductible per AEPC §7)
      depreciation = opYear <= 25 ? totalCapEx * DEPRECIATION_RATE_SLM : 0

      // Tax — gated by capacity per Income Tax Act 2058
      if (i.pInstalledKw > TAX_EXEMPT_KW) {
        if (opYear > RE_INCENTIVE_YEARS) {
          // Tax shield: depreciation + interest deductible
          // Interest expense for current year (computed below in debt block)
          // To avoid forward-reference, compute simple proxy here: for year
          // post-incentive, use straight-line interest estimate
          // Better: tax is computed AFTER debt service block runs. So we
          // do a 2-pass: first compute interest, then tax. Inline below.
        }
      }
    }

    // ── Debt service ──
    let dInterest = 0
    let dPrincipal = 0
    if (i.debtEnabled && inOperations && opYear <= i.loanTenorYears) {
      // Equal-principal amortization (Nepal DFS standard practice)
      dPrincipal = debt / i.loanTenorYears
      dInterest = debtBalance * interestRate
    }

    // ── Tax (now that interest is known) ──
    if (i.pInstalledKw > TAX_EXEMPT_KW && inOperations && opYear > RE_INCENTIVE_YEARS) {
      const taxableIncome = Math.max(0, revenue - opex - royalty - dInterest - depreciation)
      tax = taxableIncome * CORPORATE_TAX_RATE_AFTER_INCENTIVE
    }

    // Update debt balance for next year
    const debtBalanceEnd = Math.max(0, debtBalance - dPrincipal)

    // ── NCF: Project (pre-financing) ──
    // All-equity basis: full CapEx outflow during construction; subsidy as
    // cash receipt at COD/POV; revenue/opex/royalty/tax during operations.
    // No debt service. This is the AEPC §7.4 FIRR cashflow.
    const ncfBefore = -capexOut + subsidyIn + revenue - opex - royalty - tax

    // ── NCF: Equity (post-financing) ──
    // Equity holder contributes their share (equity_total) over the
    // disbursement schedule, then receives dividends = revenue − opex
    // − royalty − tax − debt_service during operations. Subsidy and debt
    // do NOT appear in equity NCF — they were the project's other funding
    // sources, used to reduce the equity contribution.
    // Note: if the disbursement schedule overlaps with the COD year (e.g.
    // 20% spillover with [35,45,20] for 2-yr construction), the equity
    // holder pays AND receives operations cashflow in the same year.
    const equityContribution = capex.equityNpr * disbFraction
    const operationsCash = inOperations
      ? (revenue - opex - royalty - tax - dInterest - dPrincipal)
      : 0
    const ncfAfter = -equityContribution + operationsCash

    cumNcfBefore += ncfBefore
    cumNcfAfter += ncfAfter

    cashflows.push({
      year: t,
      operatingYear: inOperations ? opYear : 0,
      capexOutflow: capexOut,
      subsidyReceipt: subsidyIn,
      revenue,
      opex,
      royalty,
      taxPayable: tax,
      depreciation,
      debtInterest: dInterest,
      debtPrincipal: dPrincipal,
      debtService: dInterest + dPrincipal,
      debtBalance: debtBalanceEnd,
      ncfBeforeFinancing: ncfBefore,
      ncfAfterFinancing: ncfAfter,
      cumulativeNcfBefore: cumNcfBefore,
      cumulativeNcfAfter: cumNcfAfter,
      effectiveTariffNprPerKwh: effectiveTariff,
      energyMwh: energyMwhYr,
    })

    debtBalance = debtBalanceEnd
  }

  // ── Headline metrics ──
  const ncfBeforeArr = cashflows.map((c) => c.ncfBeforeFinancing)
  const ncfAfterArr  = cashflows.map((c) => c.ncfAfterFinancing)

  const irrProject = computeIrr(ncfBeforeArr) * 100  // %
  const irrEquity  = i.debtEnabled ? computeIrr(ncfAfterArr) * 100 : NaN

  const npvAt6Npr  = computeNpv(ncfBeforeArr, DISCOUNT_RATE_AEPC_BCR)
  const npvAt12Npr = computeNpv(ncfBeforeArr, DISCOUNT_RATE_EQUITY)

  // BCR at 6%: PV(benefits) / PV(costs)
  let pvBenefits = 0, pvCosts = 0
  for (let t = 0; t < cashflows.length; t++) {
    const c = cashflows[t]
    const denom = Math.pow(1 + DISCOUNT_RATE_AEPC_BCR, t)
    pvBenefits += (c.revenue + c.subsidyReceipt) / denom
    pvCosts    += (c.capexOutflow + c.opex + c.royalty + c.taxPayable) / denom
  }
  const bcrAt6 = pvCosts > 0 ? pvBenefits / pvCosts : NaN

  // Payback (simple): first year where cumulative NCF (before financing) ≥ 0
  let paybackSimple = NaN
  for (let t = 0; t < cashflows.length; t++) {
    if (cashflows[t].cumulativeNcfBefore >= 0) {
      // Linear interpolation within the year
      const prev = t > 0 ? cashflows[t - 1].cumulativeNcfBefore : -Infinity
      if (prev < 0 && cashflows[t].ncfBeforeFinancing > 0) {
        paybackSimple = t + (-prev) / cashflows[t].ncfBeforeFinancing
      } else {
        paybackSimple = t
      }
      break
    }
  }

  // Discounted payback (at 12%)
  let paybackDiscounted = NaN
  let cumDisc = 0
  for (let t = 0; t < cashflows.length; t++) {
    const d = ncfBeforeArr[t] / Math.pow(1 + DISCOUNT_RATE_EQUITY, t)
    const prev = cumDisc
    cumDisc += d
    if (cumDisc >= 0 && prev < 0) {
      paybackDiscounted = d > 0 ? t + (-prev) / d : t
      break
    }
  }

  // LCoE (at 6%): PV(all costs) / PV(all energy)
  let pvCostsLcoe = 0, pvEnergyKwh = 0
  for (let t = 0; t < cashflows.length; t++) {
    const c = cashflows[t]
    const denom = Math.pow(1 + DISCOUNT_RATE_AEPC_BCR, t)
    // Costs: capex (full) + opex + royalty + tax. Subsidy NOT subtracted —
    // LCoE measures the social cost of energy regardless of who pays.
    pvCostsLcoe += (c.capexOutflow + c.opex + c.royalty + c.taxPayable) / denom
    pvEnergyKwh += (c.energyMwh * 1000) / denom
  }
  const lcoe = pvEnergyKwh > 0 ? pvCostsLcoe / pvEnergyKwh : NaN

  // DSCR
  let dscrMin = NaN, dscrAvg = NaN
  if (i.debtEnabled) {
    const dscrSeries: number[] = []
    for (const c of cashflows) {
      if (c.operatingYear >= 1 && c.operatingYear <= i.loanTenorYears) {
        const cfads = c.revenue - c.opex - c.royalty - c.taxPayable
        const ds = c.debtService
        if (ds > 0) dscrSeries.push(cfads / ds)
      }
    }
    if (dscrSeries.length > 0) {
      dscrMin = Math.min(...dscrSeries)
      dscrAvg = dscrSeries.reduce((a, b) => a + b, 0) / dscrSeries.length
    }
  }

  // Tariff breakeven (uniform tariff at which IRR_project = 12%).
  // Revenue is linear in tariff (sub-1MW: no royalty energy %). For >1MW,
  // royalty energy % introduces a small non-linearity, but it's small enough
  // that linear interpolation is acceptable (engineers can binary-search
  // visually if needed).
  const tariffBreakeven = computeTariffBreakeven(i)

  // ── Sensitivity (one-way, 6 scenarios) ──
  const sensitivity: SensitivityRow[] = [
    runSensitivity('Base case',          i, 1.00, 1.00, 1.00),
    runSensitivity('Tariff +20%',        i, 1.20, 1.00, 1.00),
    runSensitivity('Tariff −20%',        i, 0.80, 1.00, 1.00),
    runSensitivity('CapEx +20%',         i, 1.00, 1.20, 1.00),
    runSensitivity('CapEx −20%',         i, 1.00, 0.80, 1.00),
    runSensitivity('Energy −10%',        i, 1.00, 1.00, 0.90),
  ]

  // ── Warnings ──
  const warnings: FinancialWarning[] = []
  if (Number.isFinite(lcoe) && lcoe > i.wetTariffNprPerKwh) {
    warnings.push({
      level: 'warn',
      code: 'LCOE_ABOVE_WET',
      message: `LCoE (NPR ${lcoe.toFixed(2)}/kWh) exceeds NEA wet-tier tariff (NPR ${i.wetTariffNprPerKwh.toFixed(2)}/kWh) — project uneconomic during wet months at the marginal rate.`,
    })
  }
  if (!Number.isFinite(irrProject)) {
    warnings.push({
      level: 'critical',
      code: 'IRR_PROJECT_NONE',
      message: 'Project IRR is undefined — lifetime cashflows do not break even at any discount rate. Re-examine tariff, OpEx escalation, post-PPA assumption, or project life.',
    })
  }
  if (i.debtEnabled && !Number.isFinite(irrEquity)) {
    warnings.push({
      level: 'critical',
      code: 'IRR_EQUITY_NONE',
      message: 'Equity IRR is undefined — equity holders do not recover their contribution at any positive discount rate. Project unbankable as configured.',
    })
  }
  if (Number.isFinite(irrProject) && irrProject < 12) {
    warnings.push({
      level: 'warn',
      code: 'IRR_PROJECT_LOW',
      message: `Project IRR (${irrProject.toFixed(1)}%) below typical 12% equity threshold.`,
    })
  }
  if (Number.isFinite(irrEquity) && irrEquity < 15) {
    warnings.push({
      level: 'warn',
      code: 'IRR_EQUITY_LOW',
      message: `Equity IRR (${irrEquity.toFixed(1)}%) below AEPC developer benchmark of 15%.`,
    })
  }
  if (Number.isFinite(dscrMin) && dscrMin < 1.3) {
    const yr = cashflows.find(
      (c) =>
        c.operatingYear >= 1 &&
        c.operatingYear <= i.loanTenorYears &&
        c.debtService > 0 &&
        (c.revenue - c.opex - c.royalty - c.taxPayable) / c.debtService === dscrMin,
    )?.operatingYear ?? 1
    warnings.push({
      level: 'critical',
      code: 'DSCR_BELOW_FLOOR',
      message: `Lender DSCR floor (1.3×) breached in operating year ${yr} (min DSCR ${dscrMin.toFixed(2)}). Project may be unbankable without restructuring.`,
    })
  }
  if (npvAt6Npr < 0) {
    warnings.push({
      level: 'critical',
      code: 'NPV_NEGATIVE',
      message: `Negative NPV at 6% discount (NPR ${(npvAt6Npr / 1e7).toFixed(2)} cr) — project not viable by AEPC §7.4 criterion.`,
    })
  }
  if (i.subsidyPctOfCapEx > 60) {
    warnings.push({
      level: 'warn',
      code: 'SUBSIDY_OVER_CAP',
      message: `Subsidy ${i.subsidyPctOfCapEx}% exceeds AEPC RE Subsidy Policy 2069 cap (60%) for grid-connected mini-hydro.`,
    })
  }
  if (capex.specificCostUsdPerKw > 6000) {
    warnings.push({
      level: 'warn',
      code: 'CAPEX_HIGH',
      message: `Specific CapEx USD ${capex.specificCostUsdPerKw.toFixed(0)}/kW exceeds 95th percentile for Nepal micro-hydro (Poudel 2022). Re-check line items.`,
    })
  }
  if (capex.specificCostUsdPerKw < 2000 && capex.specificCostUsdPerKw > 0) {
    warnings.push({
      level: 'warn',
      code: 'CAPEX_LOW',
      message: `Specific CapEx USD ${capex.specificCostUsdPerKw.toFixed(0)}/kW below 5th percentile for Nepal micro-hydro. Likely missing line items — re-check.`,
    })
  }

  // ── Lender checklist (AEPC DFS §7.4) ──
  const lenderChecklist = [
    {
      label: 'NPV positive (AEPC §7.4)',
      passed: npvAt6Npr > 0,
      note: `NPV at 6% = NPR ${(npvAt6Npr / 1e7).toFixed(2)} cr`,
    },
    {
      label: 'FIRR > bank rate',
      passed: Number.isFinite(irrProject) && irrProject > i.bankInterestRatePct,
      note: `Project IRR ${Number.isFinite(irrProject) ? irrProject.toFixed(1) + '%' : 'N/A'} vs ${i.bankInterestRatePct}% loan rate`,
    },
    {
      label: 'BCR > 1.0',
      passed: Number.isFinite(bcrAt6) && bcrAt6 > 1.0,
      note: `BCR at 6% = ${Number.isFinite(bcrAt6) ? bcrAt6.toFixed(2) : 'N/A'}`,
    },
    {
      label: 'DSCR ≥ 1.3 every year (lender floor)',
      passed: !i.debtEnabled || (Number.isFinite(dscrMin) && dscrMin >= 1.3),
      note: i.debtEnabled
        ? `Min DSCR = ${Number.isFinite(dscrMin) ? dscrMin.toFixed(2) : 'N/A'}`
        : 'Debt disabled — N/A',
    },
    {
      label: 'Equity IRR ≥ 15% (developer benchmark)',
      passed: !i.debtEnabled || (Number.isFinite(irrEquity) && irrEquity >= 15),
      note: i.debtEnabled
        ? `Equity IRR = ${Number.isFinite(irrEquity) ? irrEquity.toFixed(1) + '%' : 'N/A'}`
        : 'Debt disabled — N/A',
    },
    {
      label: 'Specific CapEx in expected range (USD 2000–6000/kW)',
      passed:
        capex.specificCostUsdPerKw >= 2000 &&
        capex.specificCostUsdPerKw <= 6000,
      note: `USD ${capex.specificCostUsdPerKw.toFixed(0)}/kW (Poudel 2022 mean ≈ 5074)`,
    },
  ]

  return {
    capex,
    annualRevenueYr1Npr: fullYr1.revenueNpr,
    dryEnergyMwh: dryWet.dryMwh,
    wetEnergyMwh: dryWet.wetMwh,
    blendedTariffNprPerKwh: fullYr1.effectiveTariff,
    cashflows,
    irrProjectPct: irrProject,
    irrEquityPct: irrEquity,
    npvAt6Cr: npvAt6Npr / 1e7,
    npvAt12Cr: npvAt12Npr / 1e7,
    bcrAt6,
    paybackSimpleYears: paybackSimple,
    paybackDiscountedYears: paybackDiscounted,
    lcoeNprPerKwh: lcoe,
    dscrMin,
    dscrAvg,
    tariffBreakevenNprPerKwh: tariffBreakeven,
    isBelowRoyaltyThreshold: i.pInstalledKw <= ROYALTY_EXEMPT_KW,
    isBelowTaxThreshold: i.pInstalledKw <= TAX_EXEMPT_KW,
    sensitivity,
    warnings,
    lenderChecklist,
  }
}

/** Compute the uniform tariff (NPR/kWh) at which IRR_project = 12%.
 *  Strategy: revenue is linear in tariff (sub-1MW), so we evaluate NPV at
 *  12% for two trial uniform tariffs and solve linearly for τ where NPV = 0.
 *  This is exactly equivalent to "tariff at which IRR = 12%" because at that
 *  tariff, NPV at 12% is zero by definition. */
function computeTariffBreakeven(i: FinancialInputs): number {
  // Trial 1: τ = 0 (no revenue from energy; only subsidy + capex + opex)
  const i0: FinancialInputs = {
    ...i,
    dryTariffNprPerKwh: 0,
    wetTariffNprPerKwh: 0,
    tariffEscalationPct: 0,
    postPpaTariffFraction: 0,
  }
  // Trial 2: τ = 1 NPR/kWh uniform
  const i1: FinancialInputs = {
    ...i,
    dryTariffNprPerKwh: 1,
    wetTariffNprPerKwh: 1,
    tariffEscalationPct: 0,
    postPpaTariffFraction: 1,
  }
  const npv0 = simpleNpvAtRate(i0, DISCOUNT_RATE_EQUITY)
  const npv1 = simpleNpvAtRate(i1, DISCOUNT_RATE_EQUITY)
  if (npv1 <= npv0 || !Number.isFinite(npv1) || !Number.isFinite(npv0)) return NaN
  // Linear: NPV(τ) = npv0 + τ × (npv1 − npv0); want NPV = 0
  const tau = -npv0 / (npv1 - npv0)
  return tau > 0 ? tau : NaN
}

/** Lightweight NPV-at-rate that re-runs the cashflow build for a probe scenario.
 *  Used inside computeTariffBreakeven and runSensitivity. */
function simpleNpvAtRate(i: FinancialInputs, rate: number): number {
  const out = computeFinancialBare(i)
  return computeNpv(out.ncfBefore, rate)
}

/** Bare cashflow array build (no metrics) — used for sensitivity probes. */
function computeFinancialBare(i: FinancialInputs): { ncfBefore: number[]; ncfAfter: number[] } {
  const capex = buildCapEx(i)
  const totalCapEx = capex.totalCapExNpr
  const subsidy = capex.subsidyNpr
  const debt = capex.debtNpr
  const interestRate = i.bankInterestRatePct / 100

  const N = i.constructionYears + i.projectLifeYears
  const ncfBefore: number[] = []
  const ncfAfter: number[] = []
  let debtBalance = debt
  const oMBase = totalCapEx * (i.oAndMPctOfCapEx / 100) + i.landLeaseNprPerYear + i.wheelingNprPerYear
  const insuranceBase = totalCapEx * (i.insurancePctOfCapEx / 100)

  for (let t = 0; t < N; t++) {
    const opYear = t - i.constructionYears + 1
    const inOps = opYear >= 1
    const dIdx = t
    const disbFrac = dIdx < i.disbursementSchedule.length ? i.disbursementSchedule[dIdx] : 0
    const capexOut = totalCapEx * disbFrac
    let subsidyIn = 0
    if (t === i.constructionYears) subsidyIn = subsidy * i.subsidyAtCodFraction
    else if (t === i.constructionYears + 1) subsidyIn = subsidy * i.subsidyAtPovFraction

    let revenue = 0, opex = 0, royalty = 0, tax = 0, depreciation = 0
    if (inOps) {
      const ramp = opYear === 1 ? i.revenueRampYear1
                 : opYear === 2 ? i.revenueRampYear2
                 :                i.revenueRampYear3
      const rev = annualRevenue(opYear, ramp, i)
      revenue = rev.revenueNpr
      const escFactor = Math.pow(1 + i.oAndMEscalationPct / 100, opYear - 1)
      opex = (oMBase + insuranceBase) * escFactor
      royalty = royaltyForYear(opYear, i.pInstalledKw, revenue, i)
      depreciation = opYear <= 25 ? totalCapEx * DEPRECIATION_RATE_SLM : 0
    }

    let dInterest = 0, dPrincipal = 0
    if (i.debtEnabled && inOps && opYear <= i.loanTenorYears) {
      dPrincipal = debt / i.loanTenorYears
      dInterest = debtBalance * interestRate
    }
    if (i.pInstalledKw > TAX_EXEMPT_KW && inOps && opYear > RE_INCENTIVE_YEARS) {
      const taxableIncome = Math.max(0, revenue - opex - royalty - dInterest - depreciation)
      tax = taxableIncome * CORPORATE_TAX_RATE_AFTER_INCENTIVE
    }
    const debtBalanceEnd = Math.max(0, debtBalance - dPrincipal)
    const before = -capexOut + subsidyIn + revenue - opex - royalty - tax
    const equityContribution = capex.equityNpr * disbFrac
    const operationsCash = inOps
      ? (revenue - opex - royalty - tax - dInterest - dPrincipal)
      : 0
    const after = -equityContribution + operationsCash
    ncfBefore.push(before)
    ncfAfter.push(after)
    debtBalance = debtBalanceEnd
  }
  return { ncfBefore, ncfAfter }
}

/** Run a scaled-input sensitivity scenario and return headline metrics. */
function runSensitivity(
  scenario: string,
  base: FinancialInputs,
  tariffMul: number,
  capexMul: number,
  energyMul: number,
): SensitivityRow {
  // Apply multipliers cleanly:
  // - tariffMul scales dry & wet base tariffs
  // - capexMul scales each civil/EM/T&A line item via override (post-formula)
  // - energyMul scales monthlyEnergyMwh
  const scaled: FinancialInputs = {
    ...base,
    dryTariffNprPerKwh: base.dryTariffNprPerKwh * tariffMul,
    wetTariffNprPerKwh: base.wetTariffNprPerKwh * tariffMul,
    monthlyEnergyMwh: base.monthlyEnergyMwh.map((e) => e * energyMul),
    annualEnergyMwh: base.annualEnergyMwh * energyMul,
    firmEnergyMwh: base.firmEnergyMwh * energyMul,
  }
  // For capex: scale by overriding line items
  if (capexMul !== 1.0) {
    const baseCx = buildCapEx(base)
    scaled.a1HeadworksNpr = baseCx.a1HeadworksNpr * capexMul
    scaled.a2SettlingNpr  = baseCx.a2SettlingNpr  * capexMul
    scaled.a3HeadraceNpr  = baseCx.a3HeadraceNpr  * capexMul
    scaled.a4ForebayNpr   = baseCx.a4ForebayNpr   * capexMul
    scaled.a5PenstockNpr  = baseCx.a5PenstockNpr  * capexMul
    scaled.a6AnchorsNpr   = baseCx.a6AnchorsNpr   * capexMul
    scaled.a7PowerhouseNpr= baseCx.a7PowerhouseNpr* capexMul
    scaled.a8TailraceNpr  = baseCx.a8TailraceNpr  * capexMul
    scaled.b1TurbineNpr   = baseCx.b1TurbineNpr   * capexMul
    scaled.b2GeneratorNpr = baseCx.b2GeneratorNpr * capexMul
    scaled.b3SwitchgearNpr= baseCx.b3SwitchgearNpr* capexMul
    scaled.c1TransmissionNpr = baseCx.c1TransmissionNpr * capexMul
    scaled.c2AccessRoadNpr   = baseCx.c2AccessRoadNpr   * capexMul
    scaled.d3LandAcquisitionNpr = baseCx.d3LandAcquisitionNpr * capexMul
    scaled.d4EnvironmentalNpr   = baseCx.d4EnvironmentalNpr   * capexMul
  }

  const { ncfBefore } = computeFinancialBare(scaled)
  const irr = computeIrr(ncfBefore) * 100
  const npv6 = computeNpv(ncfBefore, DISCOUNT_RATE_AEPC_BCR) / 1e7
  // Payback simple
  let cum = 0
  let pay = NaN
  for (let t = 0; t < ncfBefore.length; t++) {
    const prev = cum
    cum += ncfBefore[t]
    if (cum >= 0 && prev < 0) {
      pay = ncfBefore[t] > 0 ? t + (-prev) / ncfBefore[t] : t
      break
    }
  }
  return {
    scenario,
    irrProjectPct: irr,
    npv6Cr: npv6,
    paybackYears: pay,
  }
}

// ─── Helpers re-exported for the form (display utilities) ───────────────────

export const FINANCIAL_HELPERS = {
  isFinitePositive,
  safe,
  computeIrr,
  computeNpv,
  monthNameToIndex,
  DRY_MONTH_INDICES,
  AEPC_TARIFF_TABLE,
  DISCOUNT_RATE_AEPC_BCR,
  DISCOUNT_RATE_EQUITY,
  ROYALTY_EXEMPT_KW,
  TAX_EXEMPT_KW,
}