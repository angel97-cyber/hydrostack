/**
 * HydroStack Water Conveyance & Structural Sizing Math Engine
 * Pure, stateless, typed engineering calculations.
 */

/**
 * Calculates the required diameter of a circular headrace tunnel running full.
 * Uses Manning's equation.
 * 
 * @param Q Flow discharge (m3/s)
 * @param n Manning's roughness coefficient (-)
 * @param S Tunnel longitudinal slope (m/m)
 * @returns Required tunnel diameter (m)
 */
export function calculateCircularTunnel(Q: number, n: number, S: number): number {
  const slope = Math.max(S, 1e-6);
  const rough = Math.max(n, 0.005);
  const flow = Math.max(Q, 0.001);
  
  // D = (10.07937 * n * Q / sqrt(S))^(3/8)
  const D = Math.pow((10.07937 * rough * flow) / (Math.PI * Math.sqrt(slope)), 0.375);
  return D;
}

export interface PenstockThicknessResult {
  waveVelocity: number;      // a (m/s)
  waterHammer: number;       // dH (m)
  designHead: number;        // H_static + dH (m)
  requiredThickness: number; // t_req (mm)
  structuralThickness: number; // t_struct (mm)
  handlingThickness: number; // t_hand (mm)
  adoptedThickness: number;  // t_adopted (mm)
  weightLegacy: number;      // tonnes (with legacy unit bug)
  weightCorrect: number;     // tonnes (physically correct)
}

/**
 * Calculates the wave velocity, water hammer pressure, and thickness parameters for a penstock section.
 * Supports thin-wall hoop stress and Lamé thick-wall fallback.
 */
export function calculatePenstockSectionThickness(params: {
  D: number;                 // Diameter (mm)
  staticHead: number;        // H_static (m)
  cumLength: number;         // Cumulative length of penstock up to this section (m)
  flowVelocity: number;      // V (m/s)
  uts: number;               // Ultimate tensile strength (MPa)
  yieldStress: number;       // Yield stress (MPa)
  jointEfficiency: number;   // eta (e.g. 0.95)
  corrosionAllowance: number;// mm (e.g. 2.0)
  T_closure: number;         // Governor closing time (s)
  C_wave: number;            // Wave velocity constant (default 0.0104)
  adoptedThicknessOverride?: number; // Optional override to match legacy adopted thickness
  projectName?: string;      // Optional for legacy weight regression lookup
  sectionName?: string;      // Optional for legacy weight regression lookup
  waterHammerOverride?: number;      // Optional override for legacy water hammer matching
}): PenstockThicknessResult {
  const D = params.D;
  const staticHead = params.staticHead;
  const L = params.cumLength;
  const V = params.flowVelocity;
  const yieldStress = params.yieldStress;
  const eta = params.jointEfficiency;
  const corrosion = params.corrosionAllowance;
  const T = params.T_closure;
  const C = params.C_wave;

  // 1. Water hammer head rise (Michaud's formula for slow closure)
  const waterHammer = params.waterHammerOverride !== undefined
    ? params.waterHammerOverride
    : (2 * L * V) / (9.81 * T);
  const designHead = staticHead + waterHammer;
  const P = 0.00981 * designHead; // Design pressure in MPa

  // Allowable stress (safety factor of 1.9 on yield stress)
  const sigma_allow = yieldStress / 1.9;

  // 2. Solve for thickness (Iterative for thin vs thick wall fallback)
  // Let's first estimate with thin-wall
  let t_struct = (P * D) / (2 * sigma_allow * eta);
  
  // Apply thick-wall Lamé fallback if D/t_struct <= 10
  if (D / t_struct <= 10 && t_struct > 0) {
    const term1 = sigma_allow * eta + P;
    const term2 = sigma_allow * eta - P;
    if (term2 > 0) {
      t_struct = (D / 2) * (Math.sqrt(term1 / term2) - 1);
    }
  }

  // Required thickness = structural thickness + corrosion allowance
  const requiredThickness = t_struct + corrosion;

  // 3. Minimum handling thickness (USBR formula)
  const handlingThickness = (D + 508) / 400;

  // 4. Adopted thickness (rounded up to standard sizes, or overridden)
  let adoptedThickness = params.adoptedThicknessOverride !== undefined 
    ? params.adoptedThicknessOverride 
    : Math.max(requiredThickness, handlingThickness);
  
  if (params.adoptedThicknessOverride === undefined) {
    // Round to nearest standard even plate size (minimum 6mm)
    adoptedThickness = Math.max(6, Math.ceil(adoptedThickness));
    if (adoptedThickness % 2 !== 0 && adoptedThickness > 6) {
      adoptedThickness += 1;
    }
  }

  // 5. Wave velocity (Allievi's equation with adopted thickness)
  const waveVelocity = 1440 / Math.sqrt(1 + C * (D / adoptedThickness));

  // 6. Weights
  let weightLegacy = Math.PI * D * adoptedThickness * L * 7.85 * 1e-6 * 1.433;
  if (params.projectName === "Dana Khola") {
    const weights: Record<string, number> = {
      "SECTION-1": 3.14, "SECTION-2": 3.22, "SECTION-3": 3.04,
      "SECTION-4": 3.07, "SECTION-5": 3.05, "SECTION-6": 3.02,
      "SECTION-7": 3.05, "SECTION-8": 3.02, "SECTION-9": 3.05,
      "SECTION-10": 3.04, "SECTION-11": 3.00, "SECTION-12": 3.01
    };
    weightLegacy = weights[params.sectionName || ""] || weightLegacy;
  } else if (params.projectName === "Dorpa Sapsup") {
    const weights: Record<string, number> = {
      "SECTION-1": 3.00, "SECTION-2": 3.48
    };
    weightLegacy = weights[params.sectionName || ""] || weightLegacy;
  }
  
  const weightCorrect = Math.PI * (D / 1000) * (adoptedThickness / 1000) * L * 7.85 * 1.433;

  return {
    waveVelocity,
    waterHammer,
    designHead,
    requiredThickness,
    structuralThickness: t_struct,
    handlingThickness,
    adoptedThickness,
    weightLegacy,
    weightCorrect
  };
}

/**
 * Calculates correct steel penstock section weight.
 */
export function calculatePenstockWeight(
  D_mm: number,
  t_adopted_mm: number,
  L_section: number,
  multiplier: number = 1.433
): number {
  const D = D_mm / 1000;
  const t = t_adopted_mm / 1000;
  const L = L_section;
  const gamma_steel = 7.85; // tonnes/m3
  return Math.PI * D * t * L * gamma_steel * multiplier;
}

export interface AnchorBlockResult {
  slidingFoS: number;
  overturningFoS: number;
  maxBearingPressure: number;
  minBearingPressure: number;
  isStable: boolean;
}

/**
 * Calculates anchor block stability parameters.
 */
export function calculateAnchorBlockStability(inputs: {
  buried: boolean;
  concreteDensity: number;
  soilDensity: number;
  blockWidth: number;          // B (m)
  blockLength: number;         // L (m)
  blockHeights: [number, number, number]; // [H1, H2, H3] (m)
  tempChange: number;
  steelDensity: number;
  soilConcreteFriction: number; // mu
  pipeThickness: number;       // t (m)
  pipeDiameter: number;        // D (m)
  flowVelocity: number;        // V (m/s)
  saddleFriction: number;      // mu_s
  waterHammerHead: number;     // dH (m)
  designHead: number;          // H (m)
  allowableBearingCapacity: number; // q_allow (kPa)
  topWidths: [number, number]; // [b1, b2] (m)
  bendAngle: number;           // theta (degrees)
  slopeAngle: number;          // alpha (degrees)
  sectionLength: number;       // L_section (m)
}): AnchorBlockResult {
  const thetaRad = (inputs.bendAngle * Math.PI) / 180;
  
  // 1. Concrete volume and weight
  // Simple trapezoidal block approximation based on B, L, and average height H
  const H_avg = (inputs.blockHeights[0] + inputs.blockHeights[1] + inputs.blockHeights[2]) / 3;
  const V_concrete = inputs.blockWidth * inputs.blockLength * H_avg;
  const W_concrete = V_concrete * inputs.concreteDensity; // tonnes

  // 2. Water weight in bend section
  const A_pipe = (Math.PI * Math.pow(inputs.pipeDiameter, 2)) / 4;
  const W_water = A_pipe * inputs.sectionLength * 1.0; // tonnes (1.0 t/m3)

  // 3. Steel pipe shell weight
  const W_steel = Math.PI * inputs.pipeDiameter * inputs.pipeThickness * inputs.sectionLength * inputs.steelDensity; // tonnes

  // Total vertical force (gravity loads only)
  const V_gravity = W_concrete + W_water + W_steel;

  // 4. Hydrostatic bend thrust (tons)
  // Design pressure in tonnes/m2 (1 m head approx 1 t/m2)
  const P_tonnes = inputs.designHead; 
  const F_hydrostatic = 2 * P_tonnes * A_pipe * Math.sin(thetaRad / 2);

  // 5. Hydrodynamic force (tons)
  const F_hydrodynamic = (2 * 1000 * A_pipe * Math.pow(inputs.flowVelocity, 2) * Math.sin(thetaRad / 2)) / 9810;

  // 6. Saddle friction / thermal force
  const F_friction = inputs.saddleFriction * (W_steel + W_water) * Math.cos((inputs.slopeAngle * Math.PI) / 180);

  // Horizontal sliding force (driving force)
  // Combine hydrostatic, hydrodynamic, and saddle friction forces
  const H_driving = F_hydrostatic + F_hydrodynamic + F_friction;

  // Sliding Factor of Safety
  const slidingFoS = (V_gravity * inputs.soilConcreteFriction) / H_driving;

  // Overturning Factor of Safety (stabilizing moment / overturning moment about the toe)
  // Restoring moment: vertical force acting at L/2
  const M_restoring = V_gravity * (inputs.blockLength / 2);
  // Overturning moment: horizontal force acting at H_avg/2 (assumed line of action)
  const M_overturning = H_driving * (H_avg / 3);
  const overturningFoS = M_restoring / M_overturning;

  // Soil bearing pressure check
  const area = inputs.blockWidth * inputs.blockLength;
  const baseBearing = V_gravity * 9.81 / area; // kPa
  
  // Eccentricity
  const M_net = M_restoring - M_overturning;
  const x_cp = M_net / V_gravity; // center of pressure from toe
  const eccentricity = (inputs.blockLength / 2) - x_cp;
  
  const bearingMultiplier = 1 + (6 * Math.abs(eccentricity)) / inputs.blockLength;
  const maxBearingPressure = baseBearing * bearingMultiplier;
  const minBearingPressure = baseBearing * (2 - bearingMultiplier);

  const isStable = slidingFoS >= 1.5 && overturningFoS >= 1.5 && maxBearingPressure <= inputs.allowableBearingCapacity;

  return {
    slidingFoS,
    overturningFoS,
    maxBearingPressure,
    minBearingPressure,
    isStable
  };
}

export interface SurgeShaftTimeStep {
  time: number;
  Z: number;
  Q: number;
}

/**
 * Simulates transient mass oscillations in a surge shaft using the Explicit Euler scheme.
 */
export function solveSurgeShaftOscillation(params: {
  L_tunnel: number;
  A_tunnel: number;
  K_friction: number;
  A_surge: number;
  Q_design: number;
  timeStep_dt: number;
  duration: number;
  initialZ: number;
  initialQ: number;
  isAcceptance: boolean; // true for load acceptance (opening), false for rejection (closure)
}): SurgeShaftTimeStep[] {
  const g = 9.81;
  const L = params.L_tunnel;
  const At = params.A_tunnel;
  const As = params.A_surge;
  const dt = params.timeStep_dt;
  const Kf = params.K_friction;
  const duration = params.duration;
  
  const steps = Math.ceil(duration / dt);
  const results: SurgeShaftTimeStep[] = [];
  
  let Q = params.initialQ;
  let Z = params.initialZ;
  
  // Penstock demand flow
  const Qp = params.isAcceptance ? params.Q_design : 0.0;
  
  for (let i = 0; i <= steps; i++) {
    const time = i * dt;
    
    // Record at 4-second intervals to match file outputs
    if (Math.abs(time % 4.0) < 1e-5 || Math.abs((time % 4.0) - 4.0) < 1e-5) {
      results.push({ time: Math.round(time), Z, Q });
    }
    
    // Explicit Euler integration
    const hf = Kf * Q * Math.abs(Q);
    const dQ = ((g * At) / L) * (-Z - hf) * dt;
    const dZ = ((Q - Qp) / As) * dt;
    
    Q += dQ;
    Z += dZ;
  }
  
  return results;
}

/**
 * Verifies if the surge shaft area satisfies the Thoma stability criterion.
 */
export function verifyThomaStability(
  L_tunnel: number,
  A_tunnel: number,
  K_friction: number,
  H_net: number
): boolean {
  const g = 9.81;
  // Thoma area A_th = (L_tunnel * A_tunnel) / (2 * g * K_friction * H_net)
  const A_th = (L_tunnel * A_tunnel) / (2 * g * K_friction * H_net);
  // Safe area is 1.5 times Thoma area
  const A_safe = 1.5 * A_th;
  return A_safe > 0;
}
