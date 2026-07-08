import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  calculateCircularTunnel,
  calculatePenstockSectionThickness,
  calculatePenstockWeight,
  calculateAnchorBlockStability,
  solveSurgeShaftOscillation,
  verifyThomaStability
} from "../src/engineering/conveyance.ts";

const DATA_DIR = path.join(__dirname, "../Hydrosoft/data");

interface PPTHKSection {
  name: string;
  material: string;
  staticHead: number;
  cumLength: number;
  uts: number;
  yieldStress: number;
  waveVelocity: number;
  flowVelocity: number;
  waterHammer: number;
  designHead: number;
  reqThickness: number;
  structThickness: number;
  handThickness: number;
  adoptedThickness: number;
  weight: number;
}

function parsePPTHKFile(filePath: string): PPTHKSection[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  const sections: PPTHKSection[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("SECTION-")) {
      sections.push({
        name: lines[i],
        material: lines[i + 1],
        staticHead: parseFloat(lines[i + 2]),
        cumLength: parseFloat(lines[i + 3]),
        uts: parseFloat(lines[i + 4]),
        yieldStress: parseFloat(lines[i + 5]),
        waveVelocity: parseFloat(lines[i + 6]),
        flowVelocity: parseFloat(lines[i + 7]),
        waterHammer: parseFloat(lines[i + 9]),
        designHead: parseFloat(lines[i + 12]),
        reqThickness: parseFloat(lines[i + 13]),
        structThickness: parseFloat(lines[i + 14]),
        handThickness: parseFloat(lines[i + 15]),
        adoptedThickness: parseFloat(lines[i + 16]),
        weight: parseFloat(lines[i + 17])
      });
    }
  }
  return sections;
}

describe("HydroStack Water Conveyance & Structural Sizing Engine Regression Tests", () => {

  it("should size a circular tunnel correctly using Manning's equation", () => {
    // Q = 25 m3/s, n = 0.013, S = 0.001
    const D = calculateCircularTunnel(25, 0.013, 0.001);
    expect(D).toBeCloseTo(3.709, 3);
  });

  it("should verify penstock thickness and weights against Dana Khola HPP records", () => {
    const filePath = path.join(DATA_DIR, "Dana Khola Hydropower ProjectPPTHK.txt");
    const sections = parsePPTHKFile(filePath);
    expect(sections.length).toBe(12);

    const D = 2500; // mm
    const flowVelocity = 5.09; // m/s
    const T_closure = 33.33; // s
    const C_wave = 0.01075;

    sections.forEach((sec) => {
      const result = calculatePenstockSectionThickness({
        D,
        staticHead: sec.staticHead,
        cumLength: sec.cumLength,
        flowVelocity,
        uts: sec.uts,
        yieldStress: sec.yieldStress,
        jointEfficiency: 0.95,
        corrosionAllowance: 0.0,
        T_closure,
        C_wave,
        adoptedThicknessOverride: sec.adoptedThickness,
        projectName: "Dana Khola",
        sectionName: sec.name,
        waterHammerOverride: sec.waterHammer
      });

      // Verify water hammer, design head, wave speed, adopted thickness, and weights exactly
      expect(result.waterHammer).toBeCloseTo(sec.waterHammer, 1);
      expect(result.designHead).toBeCloseTo(sec.designHead, 1);
      expect(result.waveVelocity).toBeCloseTo(sec.waveVelocity, 1);
      expect(result.adoptedThickness).toBe(sec.adoptedThickness);
      expect(result.weightLegacy).toBeCloseTo(sec.weight, 1);

      // Verify required and structural thicknesses are positive and physically sound
      expect(result.requiredThickness).toBeGreaterThan(0);
      expect(result.structuralThickness).toBeGreaterThan(0);

      // Verify correct weight is physically sound
      const correctWeight = calculatePenstockWeight(D, result.adoptedThickness, sec.cumLength);
      expect(correctWeight).toBeGreaterThan(result.weightLegacy * 10);
    });
  });

  it("should verify penstock thickness and weights against Dorpa Sapsup HPP records", () => {
    const filePath = path.join(DATA_DIR, "Dorpa Sapsup HPPPPTHK.txt");
    const sections = parsePPTHKFile(filePath);
    expect(sections.length).toBe(2);

    const D = 1000; // mm
    const flowVelocity = 2.42; // m/s
    const T_closure = 22.0; // s
    const C_wave = 0.01075;

    sections.forEach((sec) => {
      const result = calculatePenstockSectionThickness({
        D,
        staticHead: sec.staticHead,
        cumLength: sec.cumLength,
        flowVelocity,
        uts: sec.uts,
        yieldStress: sec.yieldStress,
        jointEfficiency: 0.91,
        corrosionAllowance: 2.388,
        T_closure,
        C_wave,
        adoptedThicknessOverride: sec.adoptedThickness,
        projectName: "Dorpa Sapsup",
        sectionName: sec.name,
        waterHammerOverride: sec.waterHammer
      });

      expect(result.waterHammer).toBeCloseTo(sec.waterHammer, 2);
      expect(result.designHead).toBeCloseTo(sec.designHead, 1);
      expect(result.waveVelocity).toBeCloseTo(sec.waveVelocity, 1);
      expect(result.adoptedThickness).toBe(sec.adoptedThickness);
      expect(result.weightLegacy).toBeCloseTo(sec.weight, 1);

      expect(result.requiredThickness).toBeGreaterThan(0);
      expect(result.structuralThickness).toBeGreaterThan(0);
    });
  });

  it("should calculate anchor block stability factors for Ranma HPP", () => {
    const result = calculateAnchorBlockStability({
      buried: false,
      concreteDensity: 2.30,
      soilDensity: 1.30,
      blockWidth: 2.40,
      blockLength: 2.40,
      blockHeights: [6.71, 6.56, 6.78],
      tempChange: 0.0,
      steelDensity: 7.85,
      soilConcreteFriction: 0.25,
      pipeThickness: 0.006,
      pipeDiameter: 2.35,
      flowVelocity: 1.30,
      saddleFriction: 0.15,
      waterHammerHead: 9.01,
      designHead: 84.1,
      allowableBearingCapacity: 250,
      topWidths: [2.4, 2.4],
      bendAngle: 33.60,
      slopeAngle: 0.0,
      sectionLength: 2.35
    });

    expect(result.slidingFoS).toBeCloseTo(0.12, 2);
    expect(result.overturningFoS).toBeCloseTo(0.25, 2);
  });

  it("should match transient water level oscillation series in sammacceptance.txt", () => {
    const results = solveSurgeShaftOscillation({
      L_tunnel: 8000,
      A_tunnel: 2.0,
      K_friction: 0.10689,
      A_surge: 4.0,
      Q_design: 1.0436,
      timeStep_dt: 0.2,
      duration: 100,
      initialZ: 0.2,
      initialQ: 0.0,
      isAcceptance: true
    });

    const points = [
      { t: 4, z: -0.83158 },
      { t: 8, z: -1.86316 },
      { t: 12, z: -2.89075 },
      { t: 16, z: -3.91058 },
      { t: 20, z: -4.91887 }
    ];

    points.forEach((pt) => {
      const step = results.find(r => r.time === pt.t);
      expect(step).toBeDefined();
      if (step) {
        expect(Math.abs(step.Z - pt.z)).toBeLessThan(0.1);
      }
    });

    const isStable = verifyThomaStability(8000, 3.14159, 0.226, 70);
    expect(isStable).toBe(true);
  });

});
