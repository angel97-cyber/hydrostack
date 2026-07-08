import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  calculateWECSMonthlyFlows,
  calculateWECSFloodPeaks,
  calculateMIPFlows,
  calculateFDC,
  interpolateFDC
} from "../src/engineering/hydrology.ts";

const DATA_DIR = path.join(__dirname, "../Hydrosoft/data");
const DATAS_DIR = path.join(__dirname, "../Hydrosoft/dataS");

// Helper to parse HMData.txt files
interface HMParams {
  A: number;
  A3000: number;
  MWI: number;
  spots: { month: number; flow: number }[];
}

const monthMap: Record<string, number> = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12
};

function parseHMFile(filePath: string): HMParams {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").map(l => l.trim());

  // samm has: Line 6: A, Line 7: A3000, Line 8: MWI (or Line 8 is precip, Line 11 is A5000? No, we mapped Line 8 as MWI)
  // Let's check which index matches our project
  // In samm: Line 6 is 186 (A), Line 7 is 25 (A3000), Line 8 is 1500 (MWI)
  // In Lower: Line 6 is 42.34 (A), Line 7 is 41.15 (A3000), Line 8 is 2500 (MWI)
  // In TEST-1: Line 8 is 16.5 (A), Line 9 is 1800 (A3000? No, TEST-1 has Line 8 = 16.5 (A), Line 11 = 1559 (MWI))
  
  let A = 0;
  let A3000 = 0;
  let MWI = 0;
  let spots: { month: number; flow: number }[] = [];

  const isTest1 = filePath.includes("TEST-1HMData.txt");

  if (isTest1) {
    A = parseFloat(lines[7]); // Line 8: 16.5
    A3000 = 0; // Not glaciated
    MWI = parseFloat(lines[10]); // Line 11: 1559
    
    // Parse spots from lines 16-23 (0-indexed 15-22)
    // February (15), 0.230 (16)
    // March (17), 0.210 (18)
    // December (19), empty? (20)
    // December (21), 0.520 (22)
    const rawSpots = [
      { mStr: lines[15], fStr: lines[16] },
      { mStr: lines[17], fStr: lines[18] },
      { mStr: lines[19], fStr: lines[20] },
      { mStr: lines[21], fStr: lines[22] }
    ];
    for (const rs of rawSpots) {
      const m = monthMap[rs.mStr.toLowerCase()];
      const f = parseFloat(rs.fStr);
      if (m && !isNaN(f)) {
        spots.push({ month: m, flow: f });
      } else {
        spots.push({ month: 0, flow: 0 }); // Placeholder for order
      }
    }
  } else {
    // samm or Lower
    A = parseFloat(lines[5]); // Line 6
    A3000 = parseFloat(lines[6]); // Line 7
    MWI = parseFloat(lines[7]); // Line 8
    
    // Spots start at line 17 (0-indexed 16)
    // Line 17: Month, Line 18: Flow
    // Line 19: Month, Line 20: Flow
    // Line 21: Month, Line 22: Flow
    // Line 23: Month, Line 24: Flow
    const rawSpots = [
      { mStr: lines[16], fStr: lines[17] },
      { mStr: lines[18], fStr: lines[19] },
      { mStr: lines[20], fStr: lines[21] },
      { mStr: lines[22], fStr: lines[23] }
    ];
    for (const rs of rawSpots) {
      if (rs.mStr) {
        const m = monthMap[rs.mStr.toLowerCase()];
        const f = parseFloat(rs.fStr);
        if (m && !isNaN(f)) {
          spots.push({ month: m, flow: f });
        } else {
          spots.push({ month: 0, flow: 0 });
        }
      } else {
        spots.push({ month: 0, flow: 0 });
      }
    }
  }

  return { A, A3000, MWI, spots };
}

// Helper to read float values from legacy output files
function readLegacyOutputs(filePath: string): number[] {
  const content = fs.readFileSync(filePath, "utf-8");
  return content
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !isNaN(Number(l)))
    .map(Number);
}

// Helper to read MIP files
function readLegacyMIPFile(filePath: string): number[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  // first line is "MIP-X", subsequent lines are monthly flows
  return lines.slice(1).map(Number);
}

describe("HydroStack Hydrology Engine Regression Tests", () => {

  it("should match WECS monthly flows for project samm", () => {
    const hmPath = path.join(DATA_DIR, "sammHMData.txt");
    const { A, MWI } = parseHMFile(hmPath);
    
    // Legacy outputs (chronological)
    const legacyPath = path.join(DATA_DIR, "sammWECSDis.txt");
    const legacyFlows = readLegacyOutputs(legacyPath);

    // Calculate flows using TS engine
    const calculatedFlows = calculateWECSMonthlyFlows(A, A, MWI); // WECSDisN is chronological
    const computedFlows = calculatedFlows.WECSDisN;

    expect(computedFlows.length).toBe(12);
    expect(legacyFlows.length).toBe(12);

    // Assert within 0.5% margin
    for (let i = 0; i < 12; i++) {
      const diff = Math.abs(computedFlows[i] - legacyFlows[i]);
      const maxAllowedDiff = legacyFlows[i] * 0.005;
      expect(diff).toBeLessThanOrEqual(maxAllowedDiff);
    }
  });

  it("should match WECS monthly flows for project lower", () => {
    const hmPath = path.join(DATA_DIR, "LowerHMData.txt");
    const { A, MWI } = parseHMFile(hmPath);
    
    // Legacy outputs (chronological)
    const legacyPath = path.join(DATA_DIR, "lowerWECSDis.txt");
    const legacyFlows = readLegacyOutputs(legacyPath);

    // Calculate flows using TS engine
    const calculatedFlows = calculateWECSMonthlyFlows(A, A, MWI);
    const computedFlows = calculatedFlows.WECSDisN;

    expect(computedFlows.length).toBe(12);
    expect(legacyFlows.length).toBe(12);

    // Assert within 0.5% margin
    for (let i = 0; i < 12; i++) {
      const diff = Math.abs(computedFlows[i] - legacyFlows[i]);
      const maxAllowedDiff = Math.max(legacyFlows[i] * 0.005, 0.005); // Allow absolute tolerance of 0.005 for very small flows
      expect(diff).toBeLessThanOrEqual(maxAllowedDiff);
    }
  });

  it("should match WECS flood peaks for project lower", () => {
    const hmPath = path.join(DATA_DIR, "LowerHMData.txt");
    const { A3000 } = parseHMFile(hmPath);

    // Legacy outputs (lowerhfdhm.txt)
    const legacyPath = path.join(DATA_DIR, "PRJT/lowerhfdhm.txt");
    const legacyPeaks = readLegacyOutputs(legacyPath);

    const calculatedPeaks = calculateWECSFloodPeaks(A3000);

    // Mapping: T -> Index in legacy
    const returnPeriodsMap: Record<number, number> = {
      2: 0,
      5: 1,
      10: 2,
      20: 3,
      50: 4,
      100: 5,
      1000: 8
    };

    for (const T of Object.keys(returnPeriodsMap).map(Number)) {
      const legacyIdx = returnPeriodsMap[T];
      const legacyPeak = legacyPeaks[legacyIdx];
      const calculatedPeak = calculatedPeaks[T];

      const diff = Math.abs(calculatedPeak - legacyPeak);
      const maxAllowedDiff = legacyPeak * 0.005;
      expect(diff).toBeLessThanOrEqual(maxAllowedDiff);
    }
  });

  it("should match MIP regional scaling for project samm (Region 1)", () => {
    const hmPath = path.join(DATA_DIR, "sammHMData.txt");
    const { spots } = parseHMFile(hmPath);

    // spotMeasurements in Record form
    const spotRecord: Record<number, number> = {};
    for (const spot of spots) {
      if (spot.month > 0) {
        spotRecord[spot.month] = spot.flow;
      }
    }

    const calculatedMIP = calculateMIPFlows(1, spotRecord); // Region 1

    // Verify MIP-1 and MIP-2 flows
    for (let k = 1; k <= 4; k++) {
      const legacyPath = path.join(DATA_DIR, `sammMIP${k}Dis.txt`);
      const legacyFlows = readLegacyMIPFile(legacyPath);
      const computedFlows = calculatedMIP[k];

      expect(computedFlows.length).toBe(12);
      expect(legacyFlows.length).toBe(12);

      for (let i = 0; i < 12; i++) {
        const diff = Math.abs(computedFlows[i] - legacyFlows[i]);
        const maxAllowedDiff = Math.max(legacyFlows[i] * 0.005, 0.001);
        expect(diff).toBeLessThanOrEqual(maxAllowedDiff);
      }
    }
  });

  it("should match MIP regional scaling for project TEST-1 (Region 1)", () => {
    const hmPath = path.join(DATAS_DIR, "TEST-1HMData.txt");
    const { spots } = parseHMFile(hmPath);

    // spotMeasurements in Array form
    const calculatedMIP = calculateMIPFlows(1, spots);

    // Verify MIP-1, MIP-2, MIP-3, and MIP-4 flows
    for (let k = 1; k <= 4; k++) {
      const legacyPath = path.join(DATAS_DIR, `TEST-1MIP${k}Dis.txt`);
      const legacyFlows = readLegacyMIPFile(legacyPath);
      const computedFlows = calculatedMIP[k];

      expect(computedFlows.length).toBe(12);
      expect(legacyFlows.length).toBe(12);

      for (let i = 0; i < 12; i++) {
        const diff = Math.abs(computedFlows[i] - legacyFlows[i]);
        const maxAllowedDiff = Math.max(legacyFlows[i] * 0.005, 0.001);
        expect(diff).toBeLessThanOrEqual(maxAllowedDiff);
      }
    }
  });

  it("should correctly calculate Flow Duration Curve (FDC) and interpolate standard points", () => {
    const flows = [2.368, 2.017, 1.818, 1.872, 2.523, 9.713, 26.378, 31.752, 24.343, 10.690, 5.246, 3.418];
    const fdcPoints = calculateFDC(flows);

    expect(fdcPoints.length).toBe(14);
    expect(fdcPoints[0].exceedence).toBe(0.0);
    expect(fdcPoints[0].flow).toBeCloseTo(31.752 * 1.2, 3);
    expect(fdcPoints[13].exceedence).toBe(100.0);
    expect(fdcPoints[13].flow).toBeCloseTo(1.818 * 0.8, 3);

    // Test interpolation
    const q40 = interpolateFDC(fdcPoints, 40.0);
    // 40% lies between m=5 (P = 5/13 * 100% = 38.46%) and m=6 (P = 6/13 * 100% = 46.15%)
    // Sorted flows are:
    // 31.752, 26.378, 24.343, 10.690, 9.713, 5.246, 3.418, 2.523, 2.368, 2.017, 1.872, 1.818
    // m=5: P_5 = 38.46%, Q_5 = 9.713
    // m=6: P_6 = 46.15%, Q_6 = 5.246
    // Interpolation for 40%:
    // q = 9.713 + ((40.0 - 38.4615) / (46.1538 - 38.4615)) * (5.246 - 9.713)
    // q = 9.713 + (1.5385 / 7.6923) * (-4.467) = 9.713 + 0.2 * (-4.467) = 9.713 - 0.8934 = 8.8196
    expect(q40).toBeCloseTo(8.820, 2);
  });
  
});
