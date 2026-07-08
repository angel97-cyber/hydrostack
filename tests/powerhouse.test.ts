import { describe, it, expect } from "vitest";
import {
  recommendTurbineType,
  calculateSynchronousSpeed,
  getTurbineEfficiency,
  calculatePowerOutput,
  compileBoQAndCost
} from "../src/engineering/powerhouse.ts";

describe("HydroStack Powerhouse, Turbines & Costing Engine Unit Tests", () => {

  it("should recommend the correct turbine type based on net head boundaries", () => {
    // Pelton: Head > 250m
    expect(recommendTurbineType(300, 2.5)).toBe("Pelton");
    expect(recommendTurbineType(250.1, 1.0)).toBe("Pelton");

    // Francis: 30m <= Head <= 250m (or up to 500m overlap, but head range boundary prioritizes Pelton above 250m)
    expect(recommendTurbineType(120, 5.0)).toBe("Francis");
    expect(recommendTurbineType(30, 4.0)).toBe("Francis");

    // Kaplan: Head < 30m, high flow
    expect(recommendTurbineType(15, 8.0)).toBe("Kaplan");

    // Propeller: Head < 30m, low flow
    expect(recommendTurbineType(15, 2.0)).toBe("Propeller");
  });

  it("should calculate synchronous speed corresponding to an even number of poles at 50 Hz", () => {
    // 50 Hz grid: speed N = 120 * f / p = 6000 / p
    // For theoretical N = 1450 rpm:
    // poles = 120 * 50 / 1450 = 4.14 -> rounds to 4 poles
    // N_sync = 6000 / 4 = 1500 rpm
    const result1 = calculateSynchronousSpeed(1450, 50);
    expect(result1.poles).toBe(4);
    expect(result1.synchronousSpeed_N).toBe(1500);

    // For theoretical N = 980 rpm:
    // poles = 6000 / 980 = 6.12 -> rounds to 6 poles
    // N_sync = 1000 rpm
    const result2 = calculateSynchronousSpeed(980, 50);
    expect(result2.poles).toBe(6);
    expect(result2.synchronousSpeed_N).toBe(1000);

    // For theoretical N = 720 rpm:
    // poles = 6000 / 720 = 8.33 -> rounds to 8 poles
    // N_sync = 750 rpm
    const result3 = calculateSynchronousSpeed(720, 50);
    expect(result3.poles).toBe(8);
    expect(result3.synchronousSpeed_N).toBe(750);

    // Check minimum poles clamp
    const result4 = calculateSynchronousSpeed(4000, 50);
    expect(result4.poles).toBe(2);
    expect(result4.synchronousSpeed_N).toBe(3000);
  });

  it("should perform correct piecewise linear interpolation on Pelton and Francis curves", () => {
    // Francis (FT_CURVE):
    // 100% load: 90.0
    // 99% load: 90.65
    expect(getTurbineEfficiency("Francis", 100)).toBeCloseTo(90.0, 2);
    expect(getTurbineEfficiency("Francis", 99)).toBeCloseTo(90.65, 2);
    // Interpolation at 15.5% (between 15% [17.75] and 16% [21.3])
    // 17.75 + 0.5 * (21.3 - 17.75) = 19.525
    expect(getTurbineEfficiency("Francis", 15.5)).toBeCloseTo(19.525, 3);

    // Pelton (PT_CURVE):
    // 100% load: 92.5
    // 8% load: 64.0
    expect(getTurbineEfficiency("Pelton", 100)).toBeCloseTo(92.5, 2);
    expect(getTurbineEfficiency("Pelton", 8)).toBeCloseTo(64.0, 2);
    // Interpolation at 8.5% (between 8% [64.0] and 9% [67.0])
    // 64.0 + 0.5 * (67.0 - 64.0) = 65.5
    expect(getTurbineEfficiency("Pelton", 8.5)).toBeCloseTo(65.5, 2);

    // Clamping checks
    // Below min load (Francis min = 15.0%, Pelton min = 8.0%)
    expect(getTurbineEfficiency("Francis", 10.0)).toBeCloseTo(17.75, 2);
    expect(getTurbineEfficiency("Pelton", 5.0)).toBeCloseTo(64.0, 2);

    // Above max load (100.0%)
    expect(getTurbineEfficiency("Francis", 110.0)).toBeCloseTo(90.0, 2);
    expect(getTurbineEfficiency("Pelton", 105.0)).toBeCloseTo(92.5, 2);

    // Zero load should return 0
    expect(getTurbineEfficiency("Francis", 0)).toBe(0);
    expect(getTurbineEfficiency("Pelton", -5.0)).toBe(0);
  });

  it("should calculate mechanical and electrical power output correctly", () => {
    // Q = 2.0 m3/s, H_net = 100m, turbineEff = 90.0%, generatorEff = 96.0%
    const power = calculatePowerOutput(2.0, 100, 90.0, 96.0);
    // shaftPower_kW = 9.81 * 2 * 100 * 0.90 = 1765.8 kW
    expect(power.shaftPower_kW).toBeCloseTo(1765.8, 1);
    // electricalPower_kW = 1765.8 * 0.96 = 1695.168 kW
    expect(power.electricalPower_kW).toBeCloseTo(1695.168, 1);

    // Test with decimal fraction input (e.g. 0.90 and 0.96)
    const powerDec = calculatePowerOutput(2.0, 100, 0.90, 0.96);
    expect(powerDec.shaftPower_kW).toBeCloseTo(1765.8, 1);
    expect(powerDec.electricalPower_kW).toBeCloseTo(1695.168, 1);
  });

  it("should compile a Bill of Quantities and calculate total cost correctly", () => {
    const components = {
      desanderConcrete_m3: 150,
      penstockSteel_tonnes: 45,
      anchorBlockConcrete_m3: 80
    };
    const rates = {
      concrete: 10000,
      steel: 120000
    };

    const boq = compileBoQAndCost(components, rates);

    expect(boq.items.length).toBe(3);
    
    const desanderItem = boq.items.find(i => i.name.includes("Desanding"));
    expect(desanderItem).toBeDefined();
    expect(desanderItem?.cost).toBe(150 * 10000);

    const steelItem = boq.items.find(i => i.name.includes("Penstock"));
    expect(steelItem).toBeDefined();
    expect(steelItem?.cost).toBe(45 * 120000);

    const anchorItem = boq.items.find(i => i.name.includes("Anchor"));
    expect(anchorItem).toBeDefined();
    expect(anchorItem?.cost).toBe(80 * 10000);

    const expectedTotal = 150 * 10000 + 45 * 120000 + 80 * 10000;
    expect(boq.totalCost).toBe(expectedTotal);
  });

});
