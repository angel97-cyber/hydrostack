import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  calculateCrossSectionProperties,
  calculateManningRatingCurve,
  calculateManningRatingCurveFromTable,
  calculateRegulatorOrificeFlow,
  calculateDesanderDimensions,
  TabularRatingRecord,
  RatingCurvePoint
} from "../src/engineering/headworks.ts";

const DATA_DIR = path.join(__dirname, "../Hydrosoft/data");

// Helper to parse InputRCdata.txt files
function parseInputRCFile(filePath: string): TabularRatingRecord[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const records: TabularRatingRecord[] = [];
  
  for (let i = 0; i < lines.length; i += 5) {
    if (i + 4 < lines.length) {
      records.push({
        area: parseFloat(lines[i]),
        perimeter: parseFloat(lines[i + 1]),
        n: parseFloat(lines[i + 2]),
        slope: parseFloat(lines[i + 3]),
        depth: parseFloat(lines[i + 4])
      });
    }
  }
  return records;
}

// Helper to parse RCdata.txt files
function parseOutputRCFile(filePath: string): RatingCurvePoint[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const points: RatingCurvePoint[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < lines.length; i += 2) {
    if (i + 1 < lines.length) {
      const discharge = parseFloat(lines[i]);
      const stage = parseFloat(lines[i + 1]);
      if (!seen.has(discharge)) {
        seen.add(discharge);
        points.push({
          discharge,
          stage
        });
      }
    }
  }
  return points;
}


describe("HydroStack Headworks & Desander Engine Regression Tests", () => {

  it("should match Manning rating curve stages for project Dana Khola HPP (DS11)", () => {
    const inputPath = path.join(DATA_DIR, "Dana Khola Hydropower ProjectDS11InputRCdata.txt");
    const outputPath = path.join(DATA_DIR, "Dana Khola Hydropower ProjectDS11RCdata.txt");

    const table = parseInputRCFile(inputPath);
    const legacyPoints = parseOutputRCFile(outputPath);

    // Invert elevation back-calculated from legacy points:
    // depth[0] = 0.5, stage[0] = 2693.26
    // invert = 2693.26 - 0.5 = 2692.76 m
    const invertElevation = 2692.76;

    const computedPoints = calculateManningRatingCurveFromTable(table, invertElevation);

    expect(computedPoints.length).toBe(legacyPoints.length);

    for (let i = 0; i < computedPoints.length; i++) {
      const computed = computedPoints[i];
      const legacy = legacyPoints[i];

      expect(computed.discharge).toBe(legacy.discharge);
      
      // Verify stage matches within an absolute tolerance of 0.01 m (1 cm)
      const diff = Math.abs(computed.stage - legacy.stage);
      expect(diff).toBeLessThanOrEqual(0.01);
    }
  });

  it("should correctly trim irregular cross-section coordinates and solve properties", () => {
    // Simple V-shaped channel with bottom at (5, 0)
    const coordinates = [
      { x: 0, y: 5 },
      { x: 5, y: 0 },
      { x: 10, y: 5 }
    ];

    // trimmed at water level = 2.5 m
    // Intersection points will be at (2.5, 2.5) and (7.5, 2.5)
    // Submerged width = 5.0 m, max depth = 2.5 m
    // Area of triangle = 0.5 * 5.0 * 2.5 = 6.25 m2
    // Wetted perimeter = 2 * sqrt(2.5^2 + 2.5^2) = 2 * sqrt(12.5) = 2 * 3.5355 = 7.071 m
    const props = calculateCrossSectionProperties(coordinates, 2.5);

    expect(props.area).toBeCloseTo(6.25, 2);
    expect(props.perimeter).toBeCloseTo(7.071, 2);
    expect(props.hydraulicRadius).toBeCloseTo(6.25 / 7.071, 3);
  });

  it("should calculate rating curve from irregular coordinates", () => {
    const coordinates = [
      { x: 0, y: 5 },
      { x: 5, y: 0 },
      { x: 10, y: 5 }
    ];

    const points = calculateManningRatingCurve(coordinates, 0.01, 0.03, 3.0, 3);
    expect(points.length).toBe(4);
    // At stage = 0 (bottom of channel)
    expect(points[0].stage).toBe(0.0);
    expect(points[0].discharge).toBe(0.0);
    // Stage increases
    expect(points[3].stage).toBe(3.0);
    expect(points[3].discharge).toBeGreaterThan(0.0);
  });

  it("should correctly compute submerged head regulator orifice flow", () => {
    // Width = 2.0 m, Height = 1.5 m, Cd = 0.62, Head difference = 0.20 m
    const Q = calculateRegulatorOrificeFlow(2.0, 1.5, 0.62, 0.20);
    // Q = Cd * A * sqrt(2 * g * dh)
    // Q = 0.62 * 3.0 * sqrt(2 * 9.81 * 0.2) = 1.86 * sqrt(3.924) = 1.86 * 1.9809 = 3.684 m3/s
    expect(Q).toBeCloseTo(3.684, 2);
  });

  it("should correctly size desanding basin dimensions", () => {
    const Q = 2.0;
    const d_min_mm = 0.2;
    const scourCoeff_a = 0.40;
    const safetyFactor_eta = 1.5;
    const W = 4.0;
    const H = 2.5;

    const result = calculateDesanderDimensions(Q, d_min_mm, scourCoeff_a, safetyFactor_eta, W, H);

    // Settling velocity w: approx 0.02348 m/s (2.35 cm/s)
    expect(result.settlingVelocity_w).toBeCloseTo(0.02348, 4);

    // Critical velocity Vc: scourCoeff_a * sqrt(0.2) = 0.40 * 0.4472 = 0.1789 m/s
    expect(result.criticalVelocity_Vc).toBeCloseTo(0.17889, 4);

    // Length: eta * H * Vh / w
    // Vh = Q / (W * H) = 2.0 / 10.0 = 0.20 m/s
    // L = 1.5 * 2.5 * 0.20 / 0.02348 = 31.94 m
    expect(result.requiredLength).toBeCloseTo(31.94, 1);
  });

});
