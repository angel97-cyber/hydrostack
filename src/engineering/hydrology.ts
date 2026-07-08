/**
 * HydroStack Core Hydrology Math Engine
 * Pure, stateless, typed engineering calculations.
 */

export interface WECSFlows {
  WECSDisN: number[]; // Chronological monthly flows (Jan to Dec)
  WECSDis: number[];  // Sorted descending monthly flows
}

/**
 * Calculates long-term mean monthly flows using WECS/DHM regression equations.
 * 
 * @param A Total catchment area (km2). Must be >= 0.1.
 * @param A5000 Catchment area below 5000m elevation (km2). Must be >= 0.
 * @param MWI Monsoon Wetness Index (mm).
 * @returns 12-element array (January to December) representing monthly flows (m3/s)
 *          with WECSDisN (chronological) and WECSDis (sorted) helper properties.
 */
export function calculateWECSMonthlyFlows(
  A: number,
  A5000: number,
  MWI: number
): number[] & WECSFlows {
  // Bounding guardrails
  const area = Math.max(A, 0.1);
  const mwi = Math.max(MWI, 0.1);

  // WECS/DHM monthly regression coefficients.
  // Note: The legacy software uses the total catchment area (A) for all monthly equations.
  const coeffs = [
    { C: 0.0142, a: 0.9777, b: 0.0 },      // Jan
    { C: 0.0122, a: 0.9766, b: 0.0 },      // Feb
    { C: 0.0100, a: 0.9948, b: 0.0 },      // Mar
    { C: 0.0080, a: 1.0435, b: 0.0 },      // Apr
    { C: 0.0084, a: 1.0898, b: 0.0 },      // May
    { C: 0.052851, a: 0.6321, b: 0.2608 }, // Jun
    { C: 0.0212, a: 1.0093, b: 0.2523 },   // Jul
    { C: 0.0255, a: 0.9963, b: 0.2620 },   // Aug
    { C: 0.0168, a: 0.9894, b: 0.2878 },   // Sep
    { C: 0.0097, a: 0.9880, b: 0.2508 },   // Oct
    { C: 0.012414, a: 0.6092, b: 0.3910 }, // Nov
    { C: 0.010272, a: 0.6048, b: 0.3615 }  // Dec
  ];

  const chronological = coeffs.map(c => {
    // Q = C * (A + 1)^a * MWI^b
    const flow = c.C * Math.pow(area + 1, c.a) * Math.pow(mwi, c.b);
    return Math.round(flow * 1000) / 1000;
  });

  const sorted = [...chronological].sort((a, b) => b - a);

  // Build the result conforming to WECSFlows while remaining a standard array
  const result = [...chronological] as any;
  result.WECSDisN = chronological;
  result.WECSDis = sorted;

  return result;
}

/**
 * Calculates flood peaks using the log-normal WECS/DHM flood peak model.
 * 
 * @param A3000 Catchment area below 3000m elevation (km2).
 * @returns Record of return period to flood peak discharge (m3/s).
 */
export function calculateWECSFloodPeaks(A3000: number): Record<number, number> {
  // Clamp A3000 to prevent log domain errors
  const A3000Clamped = Math.max(A3000, 0.001);

  // Q2 and Q100 estimations
  const Q2 = 1.8767 * Math.pow(A3000Clamped + 1, 0.8783);
  const Q100 = 14.63 * Math.pow(A3000Clamped + 1, 0.7342);

  const lnQ2 = Math.log(Q2);
  const lnQ100 = Math.log(Q100);

  // Standard normal variate for T=100 (P=0.01) is 2.32635
  const z100 = 2.32635;
  const sigma = (lnQ100 - lnQ2) / z100;

  // Standard normal variates for target return periods
  const zTable: Record<number, number> = {
    2: 0.0,
    5: 0.84162,
    10: 1.28155,
    20: 1.64485,
    50: 2.05375,
    100: 2.32635,
    1000: 3.09023
  };

  const peaks: Record<number, number> = {};
  for (const T of Object.keys(zTable).map(Number)) {
    const z = zTable[T];
    const flow = Math.exp(lnQ2 + z * sigma);
    peaks[T] = Math.round(flow * 100) / 100;
  }

  return peaks;
}

/**
 * Calculates Modified Dickens peak flood discharge.
 * 
 * @param A Total catchment area (km2).
 * @param a Snow-covered area (km2).
 * @param T Return period (years). Must be >= 2.
 * @returns Peak discharge (m3/s).
 */
export function calculateModifiedDickensFlood(A: number, a: number, T: number): number {
  if (T < 2) {
    throw new Error("Return period T must be greater than or equal to 2.");
  }
  // Glaciated percentage p, clamped to valid domain bounds
  const p = Math.max(Math.min(((a + 6) / (A + a)) * 100, 100.0), 0.01);
  
  // CT coefficient
  const CT = 2.342 * Math.log10(0.6 * T) * Math.log10(1185 / p) + 4;
  
  // Peak discharge Q_T = C_T * A^0.75
  const QT = CT * Math.pow(A, 0.75);
  return Math.round(QT * 100) / 100;
}

// Non-dimensional monthly flow ordinates for the 7 regions of Nepal
// Hand-aligned with NDRH.txt values for Region 1 and 2
export const MIP_REGIONAL_ORDINATES: Record<number, number[]> = {
  1: [2.4, 1.8, 1.3, 1.0, 2.3, 6.0, 14.5, 25.0, 16.5, 8.0, 4.1, 3.1],
  2: [2.24, 1.7, 1.33, 1.0, 1.21, 7.27, 18.18, 27.27, 20.91, 9.09, 3.94, 3.03],
  3: [2.71, 1.88, 1.38, 1.0, 1.88, 3.13, 13.54, 25.0, 20.83, 7.29, 4.69, 3.75],
  4: [2.59, 1.88, 1.38, 1.0, 2.19, 3.75, 6.89, 27.27, 20.91, 7.72, 4.83, 3.67],
  5: [2.42, 1.82, 1.36, 1.0, 0.91, 2.73, 11.21, 13.94, 10.0, 4.55, 3.94, 3.33],
  6: [2.03, 1.62, 1.27, 1.0, 2.57, 6.08, 24.32, 33.78, 27.03, 9.46, 4.32, 2.84],
  7: [3.30, 2.20, 1.40, 1.0, 3.50, 6.00, 14.00, 35.00, 24.00, 10.0, 6.50, 4.50]
};

/**
 * Calculates monthly flows by scaling the non-dimensional regional hydrograph
 * against up to 4 spot flow measurements.
 * 
 * @param region Hydrologic Region index (1 to 7).
 * @param spotMeasurements Record of 1-based month index to flow value, or array of month-flow objects.
 * @returns Record of scaled MIP monthly flow arrays for MIP-1, MIP-2, MIP-3, and MIP-4.
 */
export function calculateMIPFlows(
  region: number,
  spotMeasurements: Record<number, number> | { month: number; flow: number }[]
): Record<number, number[]> {
  let spots: { month: number; flow: number }[] = [];
  if (Array.isArray(spotMeasurements)) {
    spots = spotMeasurements;
  } else {
    spots = Object.keys(spotMeasurements).map(k => ({
      month: Number(k),
      flow: spotMeasurements[Number(k)]
    }));
  }

  const ordinates = MIP_REGIONAL_ORDINATES[region] || MIP_REGIONAL_ORDINATES[1];

  const results: Record<number, number[]> = {
    1: new Array(12).fill(0),
    2: new Array(12).fill(0),
    3: new Array(12).fill(0),
    4: new Array(12).fill(0)
  };

  // Process up to 4 spot measurements
  for (let k = 1; k <= 4; k++) {
    const spot = spots[k - 1];
    if (spot && spot.flow > 0 && spot.month >= 1 && spot.month <= 12) {
      const refOrdinate = ordinates[spot.month - 1];
      const scale = spot.flow / refOrdinate;
      results[k] = ordinates.map(o => Math.round(scale * o * 1000) / 1000);
    }
  }

  return results;
}

export interface FDCPoint {
  exceedence: number;
  flow: number;
}

/**
 * Generates Flow Duration Curve points from monthly flows.
 * 
 * @param monthlyFlows Array of 12 monthly flow values.
 * @returns Array of 14 FDCPoint structures representing sorted flows and Weibull exceedance steps.
 */
export function calculateFDC(monthlyFlows: number[]): FDCPoint[] {
  const sorted = [...monthlyFlows].sort((a, b) => b - a);
  const fdc: FDCPoint[] = [];

  // Boundary 0% exceedance point: Q_0 = Q_1 * 1.2
  const Q0 = sorted[0] * 1.2;
  fdc.push({ exceedence: 0.0, flow: Math.round(Q0 * 1000) / 1000 });

  // 12 Weibull plotting positions: P = m / 13 * 100%
  for (let m = 1; m <= 12; m++) {
    const P_m = (m / 13) * 100;
    fdc.push({ exceedence: P_m, flow: sorted[m - 1] });
  }

  // Boundary 100% exceedance point: Q_100 = Q_12 * 0.8
  const Q100 = sorted[11] * 0.8;
  fdc.push({ exceedence: 100.0, flow: Math.round(Q100 * 1000) / 1000 });

  return fdc;
}

/**
 * Interpolates the flow for a specific exceedance probability from FDC points.
 * 
 * @param fdcPoints FDC points array generated by calculateFDC.
 * @param p Target exceedance probability (0 to 100).
 * @returns Interpolated flow value.
 */
export function interpolateFDC(fdcPoints: FDCPoint[], p: number): number {
  if (p < 0 || p > 100) {
    throw new Error("Exceedence percentage must be between 0 and 100.");
  }

  for (let i = 0; i < fdcPoints.length - 1; i++) {
    const p1 = fdcPoints[i].exceedence;
    const p2 = fdcPoints[i + 1].exceedence;
    if (p >= p1 && p <= p2) {
      const q1 = fdcPoints[i].flow;
      const q2 = fdcPoints[i + 1].flow;
      if (p2 === p1) return q1;
      const q = q1 + ((p - p1) / (p2 - p1)) * (q2 - q1);
      return Math.round(q * 1000) / 1000;
    }
  }

  return 0.0;
}
