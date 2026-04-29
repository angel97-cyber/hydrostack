// ============================================================================
// HydroStack — Hydrology Calculation Engine
// ============================================================================
// Implements three flow-estimation methods for ungauged streams in Nepal:
//
//   1. AEPC 2014 FDC equations (§2.4.6) — direct Q% at standard exceedances.
//      Inputs:  ATotal, A5000A, A3000A, MWI.
//      Output:  Q0, Q5, Q20, Q40, Q60, Q80, Q95, Q100  [m³/s].
//
//   2. WECS/DHM (Hydest) regression (AEPC 2014 §2.4.5.2) — 12 monthly flows
//      from a single regression equation per month.
//      Use when catchment > 100 km².
//
//   3. MIP method (AEPC 2014 §2.4.5.1; AEPC POHV 2008 Appendix C2.2) —
//      regional unit hydrographs × catchment area, refined by one
//      low-flow site measurement (Nov–May).
//      Use when catchment < 100 km². This is the most accurate method
//      for micro-hydro because it is anchored to a real measurement.
//
// Plus design flood (AEPC 2014 §2.4.7), gross/net head, and installed
// capacity per the universal hydropower equation P = η · ρ · g · Q · H.
//
// Every formula in this file carries a citation comment of the form
// `// AEPC 2014 §X.Y, Eq. X.Y` so the audit trail is unambiguous.
// ============================================================================

// ─── Physical constants ─────────────────────────────────────────────────────
export const RHO = 1000; // kg/m³  — density of water
export const G = 9.81; // m/s²  — gravitational acceleration

// ─── Hydrological regions (MIP, AEPC POHV 2008 Appendix C2.2) ───────────────
export const MIP_REGIONS = [
  { id: 1, label: 'Region 1 — Mountain catchments' },
  { id: 2, label: 'Region 2 — Hills north of Mahabharat' },
  { id: 3, label: 'Region 3 — Pokhara, Nuwakot, Kathmandu, Sun Koshi tribs.' },
  { id: 4, label: 'Region 4 — Lower Tamur valley' },
  { id: 5, label: 'Region 5 — Rivers draining Mahabharat' },
  { id: 6, label: 'Region 6 — Kankai Mai basin' },
  { id: 7, label: 'Region 7 — Churia range to Terai' },
] as const;

export type MipRegionId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

// MIP unit hydrograph in litre/sec per km² of catchment (Table C2.2.1, AEPC POHV 2008).
// Index: [region 1..7 - 1][month 0..11 (Jan..Dec)].
export const MIP_UNIT_HYDROGRAPH_LPS_KM2: number[][] = [
  // Region 1 — Mountain
  [24.0, 18.0, 13.0, 10.0, 26.0, 60.0, 145.0, 250.0, 165.0, 80.0, 41.0, 31.0],
  // Region 2 — Hills north of Mahabharat
  [7.39, 5.61, 4.39, 3.30, 3.99, 23.79, 59.99, 89.99, 66.69, 30.0, 13.0, 10.0],
  // Region 3 — Pokhara/Nuwakot/Kathmandu/Sun Koshi
  [13.0, 9.02, 6.62, 4.8, 9.02, 15.02, 64.99, 120.0, 99.98, 50.02, 24.0, 18.0],
  // Region 4 — Lower Tamur valley
  [8.23, 6.02, 4.42, 3.20, 7.01, 12.0, 22.05, 87.26, 66.91, 22.05, 16.0, 11.01],
  // Region 5 — Rivers draining Mahabharat
  [15.97, 12.01, 8.98, 6.60, 6.01, 18.01, 73.99, 92.0, 66.0, 43.03, 30.03, 21.98],
  // Region 6 — Kankai Mai
  [15.02, 11.99, 9.40, 7.40, 19.02, 44.99, 179.97, 249.97, 200.02, 44.99, 25.01, 19.02],
  // Region 7 — Churia to Terai
  [3.30, 2.20, 1.40, 1.00, 3.50, 6.00, 14.00, 35.00, 24.00, 12.00, 7.50, 5.00],
];

// Non-dimensional regional hydrograph (Table C2.2.2, AEPC POHV 2008).
// Normalised so April = 1.00. Same indexing as the unit hydrograph.
export const MIP_NONDIM_HYDROGRAPH: number[][] = [
  [2.40, 1.80, 1.30, 1.00, 2.60, 6.00, 14.50, 25.00, 16.50, 8.00, 4.10, 3.10],
  [2.24, 1.70, 1.33, 1.00, 1.21, 7.27, 18.18, 27.27, 20.91, 9.09, 3.94, 3.03],
  [2.71, 1.88, 1.38, 1.00, 1.88, 3.13, 13.54, 25.00, 20.83, 10.42, 5.00, 3.75],
  [2.59, 1.88, 1.38, 1.00, 2.19, 3.75, 6.89, 27.27, 20.91, 6.89, 5.00, 3.44],
  [2.42, 1.82, 1.36, 1.00, 0.91, 2.73, 11.21, 13.94, 10.00, 6.52, 4.55, 3.33],
  [2.03, 1.62, 1.27, 1.00, 2.57, 6.08, 24.32, 33.78, 27.03, 6.08, 3.38, 2.57],
  [3.30, 2.20, 1.40, 1.00, 3.50, 6.00, 14.00, 35.00, 24.00, 12.00, 7.50, 5.00],
];

// WECS/DHM (Hydest) coefficients (Table 2.2, AEPC DFS 2014 §2.4.5.2).
// Qmean,month = C · A^A1 · (A5000A + 1)^A2 · MWI^A3
// Order: [Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec]
export const WECS_DHM_COEFFS: { C: number; A1: number; A2: number; A3: number }[] = [
  { C: 0.01423, A1: 0,      A2: 0.9777, A3: 0      }, // Jan
  { C: 0.01219, A1: 0,      A2: 0.9766, A3: 0      }, // Feb
  { C: 0.009988,A1: 0,      A2: 0.9948, A3: 0      }, // Mar
  { C: 0.007974,A1: 0,      A2: 1.0435, A3: 0      }, // Apr
  { C: 0.008434,A1: 0,      A2: 1.0898, A3: 0      }, // May
  { C: 0.006943,A1: 0.9968, A2: 0,      A3: 0.2610 }, // Jun
  { C: 0.02123, A1: 0,      A2: 1.0093, A3: 0.2523 }, // Jul
  { C: 0.02548, A1: 0,      A2: 0.9963, A3: 0.2620 }, // Aug
  { C: 0.01677, A1: 0,      A2: 0.9894, A3: 0.2878 }, // Sep
  { C: 0.009724,A1: 0,      A2: 0.9880, A3: 0.2508 }, // Oct
  { C: 0.001760,A1: 0.9605, A2: 0,      A3: 0.3910 }, // Nov
  { C: 0.001485,A1: 0.9536, A2: 0,      A3: 0.3607 }, // Dec
];

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Standard normal variant for flood return periods (AEPC 2014 Table 2.3).
export const FLOOD_S_VARIANT: Record<number, number> = {
  2:   0,
  5:   0.842,
  10:  1.282,
  20:  1.645,
  50:  2.054,
  100: 2.326,
};

// ════════════════════════════════════════════════════════════════════════════
//                          §1  AEPC 2014 FDC METHOD
// ════════════════════════════════════════════════════════════════════════════
// Direct regression for the Flow Duration Curve at 8 standard exceedances.
// Source: AEPC DFS Guidelines 2014, §2.4.6, p. 21.
//
// NOTE on Q80 and Q95: the published PDF prints these as
//     ln Q80 = -4.8508 + 1.0375·ln(A5000A+1) + 0.3739
//     ln Q95 = -5.4716 + 1.0776·ln(A5000A+1) + 0.3739
// i.e. with `+ 0.3739` as a CONSTANT and no `·ln(MWI)` factor.
// We tested both interpretations against multiple catchments and only
// the literal printed form gives physically valid FDCs (Q80 < Q60 < Q40).
// Reading `0.3739` as a coefficient on ln(MWI) makes Q80 exceed Q60 by
// an order of magnitude, which is impossible. We therefore implement
// the equations exactly as printed in the standard.
// ════════════════════════════════════════════════════════════════════════════

export interface AepcFdcInput {
  /** Total catchment area at intake [km²] */
  aTotal: number;
  /** Catchment area below 5000 m elevation [km²] */
  a5000A: number;
  /** Monsoon Wetness Index from WECS/DHM map [mm] (typical 1500–3500) */
  mwi: number;
}

export interface AepcFdcOutput {
  q0:   number; // m³/s
  q5:   number;
  q20:  number;
  q40:  number;
  q60:  number;
  q80:  number;
  q95:  number;
  q100: number;
}

export function aepcFdc(input: AepcFdcInput): AepcFdcOutput {
  const { aTotal, a5000A, mwi } = input;

  // Guard against ln(0) — return zeros if any input is non-positive.
  if (aTotal <= 0 || a5000A <= 0 || mwi <= 0) {
    return { q0: 0, q5: 0, q20: 0, q40: 0, q60: 0, q80: 0, q95: 0, q100: 0 };
  }

  const lnAt   = Math.log(aTotal);
  const lnA5p1 = Math.log(a5000A + 1);
  const lnMwi  = Math.log(mwi);

  // AEPC 2014 §2.4.6, FDC equations
  const q0   = Math.exp(-3.5346 + 0.9398 * lnA5p1 + 0.3739 * lnMwi);
  const q5   = Math.exp(-3.4978 + 0.9814 * lnA5p1 + 0.2670 * lnMwi);
  const q20  = Math.exp(-5.4357 + 0.9824 * lnAt   + 0.4408 * lnMwi);
  const q40  = Math.exp(-5.9543 + 1.0070 * lnAt   + 0.3231 * lnMwi);
  const q60  = Math.exp(-6.4846 + 1.0004 * lnAt   + 0.3016 * lnMwi);
  // Q80, Q95: literal printed form — `+ 0.3739` is a constant, not ·ln(MWI).
  const q80  = Math.exp(-4.8508 + 1.0375 * lnA5p1 + 0.3739);
  const q95  = Math.exp(-5.4716 + 1.0776 * lnA5p1 + 0.3739);
  // Q100: linear empirical form (AEPC 2014 §2.4.6). For catchments beyond
  // the regression's calibration range the unclamped result can exceed Q95,
  // which is physically impossible. We compute it as printed, then clamp
  // the entire FDC to be monotonically non-increasing in exceedance %.
  const q100Raw = -0.09892 + 0.08149 * (a5000A + 1);

  // Enforce monotonicity (each Q at higher exceedance % ≤ the previous).
  const clamped = [q0, q5, q20, q40, q60, q80, q95, q100Raw].reduce<number[]>(
    (acc, q) => {
      const prev = acc[acc.length - 1];
      acc.push(prev !== undefined ? Math.min(q, prev) : q);
      return acc;
    },
    []
  );
  const [, , , , , q80c, q95c, q100c] = clamped;

  return { q0, q5, q20, q40, q60, q80: q80c, q95: q95c, q100: Math.max(q100c, 0) };
}

/**
 * Linear interpolation between adjacent FDC ordinates.
 * AEPC 2014 §2.4.6 (worked example): "The percentage of exceedances in
 * between adjacent exceedances are calculated by taking arithmetic mean."
 *
 * This routine accepts any % and finds the two surrounding standard
 * ordinates, then linearly interpolates Q.
 */
export function interpolateFdc(fdc: AepcFdcOutput, percentExceedance: number): number {
  const points: [number, number][] = [
    [0,   fdc.q0],
    [5,   fdc.q5],
    [20,  fdc.q20],
    [40,  fdc.q40],
    [60,  fdc.q60],
    [80,  fdc.q80],
    [95,  fdc.q95],
    [100, fdc.q100],
  ];

  if (percentExceedance <= 0) return fdc.q0;
  if (percentExceedance >= 100) return fdc.q100;

  for (let i = 0; i < points.length - 1; i++) {
    const [p1, q1] = points[i];
    const [p2, q2] = points[i + 1];
    if (percentExceedance >= p1 && percentExceedance <= p2) {
      const t = (percentExceedance - p1) / (p2 - p1);
      return q1 + t * (q2 - q1);
    }
  }
  return 0;
}

// ════════════════════════════════════════════════════════════════════════════
//                §2  WECS/DHM MONTHLY FLOWS  (catchment > 100 km²)
// ════════════════════════════════════════════════════════════════════════════
// Source: AEPC DFS 2014 §2.4.5.2 Table 2.2 (also AEPC POHV 2008 Table C2.1.1).
//
//   Q_mean,month = C · A^A1 · (A5000A + 1)^A2 · MWI^A3   [m³/s]
//
// where coefficients (C, A1, A2, A3) vary by month per WECS_DHM_COEFFS.
// For micro-hydro (catchment < 100 km²) the standard recommends MIP
// instead — WECS/DHM is only useful at the pre-feasibility stage.
// ════════════════════════════════════════════════════════════════════════════

export interface WecsInput {
  aTotal: number;   // [km²]
  a5000A: number;   // [km²]
  mwi:    number;   // [mm]
}

/** Returns 12 mean monthly flows in m³/s, ordered Jan..Dec. */
export function wecsDhmMonthly(input: WecsInput): number[] {
  const { aTotal, a5000A, mwi } = input;
  if (aTotal <= 0 || a5000A < 0 || mwi <= 0) return new Array(12).fill(0);

  return WECS_DHM_COEFFS.map(({ C, A1, A2, A3 }) => {
    // AEPC 2014 §2.4.5.2 Eq. — exponents may be 0 for non-applicable terms
    const t1 = A1 === 0 ? 1 : Math.pow(aTotal, A1);
    const t2 = A2 === 0 ? 1 : Math.pow(a5000A + 1, A2);
    const t3 = A3 === 0 ? 1 : Math.pow(mwi, A3);
    return C * t1 * t2 * t3;
  });
}

// ════════════════════════════════════════════════════════════════════════════
//                §3  MIP METHOD  (catchment < 100 km², most accurate)
// ════════════════════════════════════════════════════════════════════════════
// Source: AEPC DFS 2014 §2.4.5.1; AEPC POHV 2008 Appendix C2.2.
//
//   Step a:  Q_initial,month = unitHydro[region][month] · A · 0.001   [m³/s]
//            (factor 0.001 converts l/s/km² × km² → m³/s)
//
//   Step b:  IF a low-flow site measurement Q_meas was made in month M:
//              ratio = Q_meas / Q_initial,M
//              Q_refined,month = Q_initial,month · ratio
//            This anchors the regional unit hydrograph to a real
//            measurement at the actual intake. AEPC POHV 2008
//            §C2.2 (vi).
// ════════════════════════════════════════════════════════════════════════════

export interface MipInput {
  region: MipRegionId;
  /** Catchment area [km²] */
  area: number;
  /** Optional site flow measurement (Nov–May). If provided, refines all 12 months. */
  measurement?: {
    /** Measured flow [m³/s] */
    q: number;
    /** 0-indexed month (0=Jan). Should be Oct..May (10,11,0,1,2,3,4) for the MIP method. */
    month: number;
  };
}

export interface MipOutput {
  /** Initial estimate from unit hydrograph alone [m³/s, Jan..Dec] */
  monthlyInitial: number[];
  /** Refined flows after applying the measurement ratio [m³/s, Jan..Dec] */
  monthlyRefined: number[];
  /** ratio = Q_measured / Q_initial(month), 1.0 if no measurement */
  refinementRatio: number;
}

export function mipMethod(input: MipInput): MipOutput {
  const { region, area, measurement } = input;
  if (area <= 0) {
    return { monthlyInitial: new Array(12).fill(0), monthlyRefined: new Array(12).fill(0), refinementRatio: 1 };
  }

  const unitHydro = MIP_UNIT_HYDROGRAPH_LPS_KM2[region - 1];

  // AEPC POHV 2008 §C2.2 Step (ii): Q_init = unitHydro · A, with l/s → m³/s
  const monthlyInitial = unitHydro.map((q_lps_km2) => (q_lps_km2 * area) / 1000);

  let refinementRatio = 1;
  let monthlyRefined = [...monthlyInitial];

  if (measurement && measurement.q > 0 && monthlyInitial[measurement.month] > 0) {
    // AEPC POHV 2008 §C2.2 Step (iv–vi): scale by the measured/predicted ratio
    refinementRatio = measurement.q / monthlyInitial[measurement.month];
    monthlyRefined = monthlyInitial.map((q) => q * refinementRatio);
  }

  return { monthlyInitial, monthlyRefined, refinementRatio };
}

/**
 * Construct an empirical FDC from a 12-element monthly flow series.
 * Sorts descending, then assigns exceedance % via Weibull plotting
 * position P = m / (N+1) · 100  (AHEC §1.3, also Weibull formula).
 *
 * Returns Q at the same 8 standard percentiles as aepcFdc().
 */
export function fdcFromMonthly(monthly: number[]): AepcFdcOutput {
  const sorted = [...monthly].sort((a, b) => b - a);
  const N = sorted.length;
  // Weibull plotting positions
  const series: [number, number][] = sorted.map((q, i) => [((i + 1) / (N + 1)) * 100, q]);

  const interp = (p: number): number => {
    if (p <= series[0][0]) return series[0][1];
    if (p >= series[series.length - 1][0]) return series[series.length - 1][1];
    for (let i = 0; i < series.length - 1; i++) {
      const [p1, q1] = series[i];
      const [p2, q2] = series[i + 1];
      if (p >= p1 && p <= p2) {
        const t = (p - p1) / (p2 - p1);
        return q1 + t * (q2 - q1);
      }
    }
    return 0;
  };

  return {
    q0:   sorted[0],
    q5:   interp(5),
    q20:  interp(20),
    q40:  interp(40),
    q60:  interp(60),
    q80:  interp(80),
    q95:  interp(95),
    q100: sorted[N - 1],
  };
}

/** Arithmetic mean of 12 monthly flows [m³/s]. */
export function meanFlow(monthly: number[]): number {
  if (monthly.length === 0) return 0;
  return monthly.reduce((a, b) => a + b, 0) / monthly.length;
}

/** Minimum of 12 monthly flows [m³/s]. */
export function minFlow(monthly: number[]): number {
  if (monthly.length === 0) return 0;
  return Math.min(...monthly);
}

// ════════════════════════════════════════════════════════════════════════════
//                §4  DESIGN FLOOD  (AEPC 2014 §2.4.7)
// ════════════════════════════════════════════════════════════════════════════
//   Q2_daily   = 0.8154 · (A3000A + 1)^0.9527
//   Q2_inst    = 1.8767 · (A3000A + 1)^0.8783
//   Q100_daily = 4.144  · (A3000A + 1)^0.8448
//   Q100_inst  = 14.630 · (A3000A + 1)^0.7342
//
// For any other return period T:
//   σ_lnQ = ln(Q100_inst / Q2_inst) / 2.326
//   Q_T   = Q2_inst · exp(S_T · σ_lnQ),  S_T from Table 2.3
// ════════════════════════════════════════════════════════════════════════════

export interface FloodInput {
  /** Catchment area below 3000 m contour [km²] (snowline-influenced areas excluded) */
  a3000A: number;
}

export interface FloodOutput {
  q2Daily:   number;
  q2Inst:    number;
  q100Daily: number;
  q100Inst:  number;
  /** Standard deviation of ln(Q) — used to interpolate any return period. */
  sigmaLnQ:  number;
}

export function aepcFlood(input: FloodInput): FloodOutput {
  const { a3000A } = input;
  if (a3000A <= 0) {
    return { q2Daily: 0, q2Inst: 0, q100Daily: 0, q100Inst: 0, sigmaLnQ: 0 };
  }
  const a = a3000A + 1;

  // AEPC 2014 §2.4.7 Eq. set
  const q2Daily   = 0.8154 * Math.pow(a, 0.9527);
  const q2Inst    = 1.8767 * Math.pow(a, 0.8783);
  const q100Daily = 4.144  * Math.pow(a, 0.8448);
  const q100Inst  = 14.630 * Math.pow(a, 0.7342);

  // AEPC 2014 §2.4.7 Eq.: σ_lnQ = ln(Q100/Q2) / 2.326  (S at T=100)
  const sigmaLnQ = Math.log(q100Inst / q2Inst) / 2.326;

  return { q2Daily, q2Inst, q100Daily, q100Inst, sigmaLnQ };
}

/**
 * Flood of arbitrary return period T (years), instantaneous peak.
 * AEPC 2014 §2.4.7: Q_T = Q2_inst · exp(S_T · σ_lnQ)
 */
export function floodAtReturnPeriod(flood: FloodOutput, T: number): number {
  const S = FLOOD_S_VARIANT[T];
  if (S === undefined) {
    // Unknown T — interpolate against ln(T) using known anchors
    return flood.q2Inst * Math.exp((Math.log(T) / Math.log(100)) * 2.326 * flood.sigmaLnQ);
  }
  return flood.q2Inst * Math.exp(S * flood.sigmaLnQ);
}

// ════════════════════════════════════════════════════════════════════════════
//                §5  HEAD AND INSTALLED CAPACITY
// ════════════════════════════════════════════════════════════════════════════

export interface HeadInput {
  /** Gross head from intake water level to powerhouse turbine centerline [m] */
  grossHead: number;
  /** Headrace + forebay friction loss as fraction of gross head (e.g. 0.02 = 2%) */
  headraceLossPct: number;
  /** Penstock friction loss as fraction of gross head (e.g. 0.04 = 4%) */
  penstockLossPct: number;
}

export interface HeadOutput {
  grossHead:    number; // m
  totalLossM:   number; // m
  totalLossPct: number; // fraction (0..1)
  netHead:      number; // m
}

export function netHead(input: HeadInput): HeadOutput {
  const { grossHead, headraceLossPct, penstockLossPct } = input;
  const totalLossPct = headraceLossPct + penstockLossPct;
  const totalLossM   = grossHead * totalLossPct;
  return {
    grossHead,
    totalLossM,
    totalLossPct,
    netHead: grossHead - totalLossM,
  };
}

export interface CapacityInput {
  /** Design discharge through turbine [m³/s] */
  qDesign: number;
  /** Net head at turbine inlet [m] */
  netHeadM: number;
  /** Overall plant efficiency η = η_turbine · η_generator · η_transformer (default 0.80) */
  efficiency: number;
}

export interface CapacityOutput {
  /** Installed capacity [kW] */
  powerKW: number;
  /** Installed capacity [MW] for convenience */
  powerMW: number;
}

export function installedCapacity(input: CapacityInput): CapacityOutput {
  const { qDesign, netHeadM, efficiency } = input;
  // Universal hydropower equation: P [W] = η · ρ · g · Q · H
  const powerW = efficiency * RHO * G * qDesign * netHeadM;
  const powerKW = powerW / 1000;
  return { powerKW, powerMW: powerKW / 1000 };
}

// ════════════════════════════════════════════════════════════════════════════
//                                 TYPES
// ════════════════════════════════════════════════════════════════════════════
// Persisted to project_modules.inputs / project_modules.outputs as JSONB.

export type FlowMethod = 'aepc_fdc' | 'wecs_dhm' | 'mip';

export interface HydrologyInputs {
  method: FlowMethod;

  // Catchment properties (used by all methods, subset depending on method)
  aTotal:  number;  // km²
  a5000A:  number;  // km² (used by AEPC FDC, WECS/DHM)
  a3000A:  number;  // km² (used by flood)
  mwi:     number;  // mm  (used by AEPC FDC, WECS/DHM)

  // MIP-specific
  mipRegion: MipRegionId;
  mipMeasurementQ: number;       // m³/s, 0 if no measurement
  mipMeasurementMonth: number;   // 0=Jan..11=Dec

  // Head
  grossHead:        number;  // m
  headraceLossPct:  number;  // fraction 0..1
  penstockLossPct:  number;  // fraction 0..1

  // Capacity
  qDesign:    number;  // m³/s — typically ≈ Q40 or 0.85·Q11mo per AEPC POHV
  efficiency: number;  // 0..1 (default 0.80)
  targetCapacityKW: number; // user-stated target for cross-check (informational)
}

export interface HydrologyOutputs {
  // Flow Duration Curve at standard exceedances [m³/s]
  fdc: AepcFdcOutput;

  // Monthly flows from WECS/DHM and MIP (whichever was selected)
  monthlyFlows: number[];     // [m³/s] Jan..Dec, [] if AEPC-FDC method

  // Summary scalars
  qMean: number;
  qMin:  number;
  q40:   number;
  q80:   number;

  // Flood
  flood: FloodOutput;
  q100Inst: number;

  // Head
  head: HeadOutput;

  // Capacity
  capacity: CapacityOutput;
}

// ════════════════════════════════════════════════════════════════════════════
//                       MAIN COMPUTE — single entry point
// ════════════════════════════════════════════════════════════════════════════
// Wraps every individual function so the UI can compute everything in one
// call on every keystroke. Pure — no I/O, no side effects.

export function computeHydrology(inp: HydrologyInputs): HydrologyOutputs {
  // ─── Flow analysis: pick method ───────────────────────────────────────────
  let monthlyFlows: number[] = [];
  let fdc: AepcFdcOutput;

  if (inp.method === 'aepc_fdc') {
    fdc = aepcFdc({ aTotal: inp.aTotal, a5000A: inp.a5000A, mwi: inp.mwi });
  } else if (inp.method === 'wecs_dhm') {
    monthlyFlows = wecsDhmMonthly({ aTotal: inp.aTotal, a5000A: inp.a5000A, mwi: inp.mwi });
    fdc = fdcFromMonthly(monthlyFlows);
  } else {
    // MIP
    const mip = mipMethod({
      region: inp.mipRegion,
      area: inp.aTotal,
      measurement: inp.mipMeasurementQ > 0
        ? { q: inp.mipMeasurementQ, month: inp.mipMeasurementMonth }
        : undefined,
    });
    monthlyFlows = mip.monthlyRefined;
    fdc = fdcFromMonthly(monthlyFlows);
  }

  // ─── Summary scalars ──────────────────────────────────────────────────────
  const qMean = monthlyFlows.length > 0 ? meanFlow(monthlyFlows) : (fdc.q40 + fdc.q60) / 2;
  const qMin  = monthlyFlows.length > 0 ? minFlow(monthlyFlows)  : fdc.q95;

  // ─── Flood ────────────────────────────────────────────────────────────────
  const flood = aepcFlood({ a3000A: inp.a3000A });

  // ─── Head ─────────────────────────────────────────────────────────────────
  const head = netHead({
    grossHead: inp.grossHead,
    headraceLossPct: inp.headraceLossPct,
    penstockLossPct: inp.penstockLossPct,
  });

  // ─── Capacity ─────────────────────────────────────────────────────────────
  const capacity = installedCapacity({
    qDesign: inp.qDesign,
    netHeadM: head.netHead,
    efficiency: inp.efficiency,
  });

  return {
    fdc,
    monthlyFlows,
    qMean,
    qMin,
    q40: fdc.q40,
    q80: fdc.q80,
    flood,
    q100Inst: flood.q100Inst,
    head,
    capacity,
  };
}

// ─── Default inputs — sensible starting values for a fresh project ──────────
export const DEFAULT_HYDROLOGY_INPUTS: HydrologyInputs = {
  method: 'aepc_fdc',
  aTotal: 50,
  a5000A: 50,
  a3000A: 45,
  mwi: 2000,
  mipRegion: 3,
  mipMeasurementQ: 0,
  mipMeasurementMonth: 3, // April
  grossHead: 80,
  headraceLossPct: 0.02,
  penstockLossPct: 0.04,
  qDesign: 0.5,
  efficiency: 0.80,
  targetCapacityKW: 100,
};