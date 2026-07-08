/**
 * HydroStack Headworks & Desanding Basin Math Engine
 * Pure, stateless, typed engineering calculations.
 */

export interface CrossSectionProperties {
  area: number;
  perimeter: number;
  hydraulicRadius: number;
}

export interface RatingCurvePoint {
  stage: number;
  discharge: number;
}

/**
 * Calculates wetted area, wetted perimeter, and hydraulic radius of an irregular
 * channel cross-section trimmed at a target water level.
 * 
 * @param coordinates Surveyed cross-section points ordered left-to-right (x, y).
 * @param waterLevel Target stage/water elevation (m).
 * @returns CrossSectionProperties object containing area, perimeter, and hydraulic radius.
 */
export function calculateCrossSectionProperties(
  coordinates: { x: number; y: number }[],
  waterLevel: number
): CrossSectionProperties {
  if (coordinates.length < 2) {
    return { area: 0, perimeter: 0, hydraulicRadius: 0 };
  }

  let area = 0;
  let perimeter = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[i + 1];

    const y1 = p1.y;
    const y2 = p2.y;
    const x1 = p1.x;
    const x2 = p2.x;

    const dx = x2 - x1;

    // Both points below or at the water level
    if (y1 <= waterLevel && y2 <= waterLevel) {
      const dy = y2 - y1;
      perimeter += Math.sqrt(dx * dx + dy * dy);
      area += (waterLevel - (y1 + y2) / 2) * dx;
    }
    // Segment crosses the water level (exiting water)
    else if (y1 <= waterLevel && y2 > waterLevel) {
      const ratio = (waterLevel - y1) / (y2 - y1);
      const xInt = x1 + ratio * dx;
      
      const dySub = waterLevel - y1;
      const dxSub = xInt - x1;
      perimeter += Math.sqrt(dxSub * dxSub + dySub * dySub);
      area += 0.5 * (waterLevel - y1) * dxSub;
    }
    // Segment crosses the water level (entering water)
    else if (y1 > waterLevel && y2 <= waterLevel) {
      const ratio = (waterLevel - y1) / (y2 - y1);
      const xInt = x1 + ratio * dx;

      const dySub = waterLevel - y2;
      const dxSub = x2 - xInt;
      perimeter += Math.sqrt(dxSub * dxSub + dySub * dySub);
      area += 0.5 * (waterLevel - y2) * dxSub;
    }
    // Both points above water level (dry segment)
    // No contribution to wetted area or perimeter
  }

  const hydraulicRadius = perimeter > 0 ? area / perimeter : 0;

  return {
    area: Math.round(area * 1000) / 1000,
    perimeter: Math.round(perimeter * 1000) / 1000,
    hydraulicRadius: Math.round(hydraulicRadius * 1000) / 1000
  };
}

/**
 * Computes rating curve coordinates by slicing coordinates in stage increments.
 * 
 * @param coordinates Irregular cross-section coordinates.
 * @param slope Channel bed longitudinal slope.
 * @param n Manning's roughness coefficient.
 * @param maxStage Maximum stage elevation or depth above invert.
 * @param steps Number of discrete stage intervals.
 * @returns Array of RatingCurvePoint objects.
 */
export function calculateManningRatingCurve(
  coordinates: { x: number; y: number }[],
  slope: number,
  n: number,
  maxStage: number,
  steps: number
): RatingCurvePoint[] {
  if (steps <= 0) return [];
  const minY = Math.min(...coordinates.map(p => p.y));
  const points: RatingCurvePoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const stageVal = minY + (i * maxStage) / steps;
    const props = calculateCrossSectionProperties(coordinates, stageVal);
    let discharge = 0;
    if (props.area > 0 && props.perimeter > 0 && n > 0 && slope > 0) {
      discharge = (1 / n) * props.area * Math.pow(props.hydraulicRadius, 2 / 3) * Math.sqrt(slope);
    }
    points.push({
      stage: Math.round(stageVal * 1000) / 1000,
      discharge: Math.round(discharge * 1000) / 1000
    });
  }

  return points;
}

export interface TabularRatingRecord {
  area: number;
  perimeter: number;
  n: number;
  slope: number;
  depth: number;
}

/**
 * Generates rating curve coordinates from pre-calculated area-perimeter tabular blocks
 * matching the legacy software's integer truncation and linear interpolation rules.
 * 
 * @param table Array of TabularRatingRecord blocks from InputRCdata.txt.
 * @param invertElevation River bottom/invert elevation (m).
 * @returns Array of RatingCurvePoint objects containing stage for each integer discharge.
 */
export function calculateManningRatingCurveFromTable(
  table: TabularRatingRecord[],
  invertElevation: number
): RatingCurvePoint[] {
  if (table.length === 0) return [];

  // Calculate discharge Q and stage for each tabular point
  const calcPoints = table.map(row => {
    const R = row.area / row.perimeter;
    const Q = (1 / row.n) * row.area * Math.pow(R, 2 / 3) * Math.sqrt(row.slope);
    const stage = invertElevation + row.depth;
    return {
      Q_calc: Q,
      Q_int: Math.floor(Q),
      stage: stage
    };
  });

  // Find range of integer discharges
  const Q_min = calcPoints[0].Q_int;
  const Q_max = calcPoints[calcPoints.length - 1].Q_int;

  const points: RatingCurvePoint[] = [];

  for (let Q = Q_min; Q <= Q_max; Q++) {
    // Find interpolation segment
    let stage = 0;
    
    // Find the adjacent indices in the calculated points
    let found = false;
    for (let i = 0; i < calcPoints.length - 1; i++) {
      const p1 = calcPoints[i];
      const p2 = calcPoints[i + 1];

      if (Q >= p1.Q_int && Q <= p2.Q_int) {
        if (p2.Q_int === p1.Q_int) {
          stage = p1.stage;
        } else {
          // Linear interpolation on integer Q
          stage = p1.stage + ((Q - p1.Q_int) / (p2.Q_int - p1.Q_int)) * (p2.stage - p1.stage);
        }
        found = true;
        break;
      }
    }

    if (!found) {
      // Out of bounds fallback (e.g. edge cases)
      stage = calcPoints[calcPoints.length - 1].stage;
    }

    points.push({
      discharge: Q,
      stage: Math.round(stage * 1000000) / 1000000 // Match high precision
    });
  }

  return points;
}

/**
 * Calculates discharge through a submerged head regulator gate.
 * 
 * @param width Gate opening width (m).
 * @param height Gate opening height (m).
 * @param Cd Discharge coefficient.
 * @param headDiff Water level difference upstream and downstream (m).
 * @returns Submerged orifice gate discharge (m3/s).
 */
export function calculateRegulatorOrificeFlow(
  width: number,
  height: number,
  Cd: number,
  headDiff: number
): number {
  if (headDiff <= 0) return 0;
  const g = 9.81;
  const area = width * height;
  const Q = Cd * area * Math.sqrt(2 * g * headDiff);
  return Math.round(Q * 1000) / 1000;
}

export interface DesanderDimensionsResult {
  settlingVelocity_w: number; // Settling velocity w (m/s)
  criticalVelocity_Vc: number; // Critical scour velocity Vc (m/s)
  requiredLength: number;      // Required basin length L (m)
}

/**
 * Computes desanding basin size parameters.
 * 
 * @param Q Chamber design discharge (m3/s).
 * @param d_min_mm Target settling sand particle diameter (mm).
 * @param scourCoeff_a Scour coefficient a (0.36 to 0.44).
 * @param safetyFactor_eta Basin design safety factor.
 * @param W Chamber width (m).
 * @param H Chamber depth (m).
 * @returns DesanderDimensionsResult.
 */
export function calculateDesanderDimensions(
  Q: number,
  d_min_mm: number,
  scourCoeff_a: number,
  safetyFactor_eta: number,
  W: number,
  H: number
): DesanderDimensionsResult {
  const s = 2.65; // Specific gravity of sand
  const g = 9.81; // Gravity acceleration
  const nu = 1.14e-6; // Water kinematic viscosity at 15°C

  // Convert sand size to meters for Rubey's equation
  const d = d_min_mm / 1000.0;

  // Rubey's settling velocity factor F
  const term = (36.0 * nu * nu) / (g * d * d * d * (s - 1.0));
  const F = Math.sqrt(2.0 / 3.0 + term) - Math.sqrt(term);
  const w = F * Math.sqrt((s - 1.0) * g * d);

  // Critical scour velocity Vc (Camp's formula, keeping sand size in mm)
  const Vc = scourCoeff_a * Math.sqrt(d_min_mm);

  // Horizontal flow velocity Vh
  const Vh = Q / (W * H);

  // Required length L = eta * H * Vh / w
  const L = (safetyFactor_eta * H * Vh) / w;

  return {
    settlingVelocity_w: Math.round(w * 100000) / 100000,
    criticalVelocity_Vc: Math.round(Vc * 100000) / 100000,
    requiredLength: Math.round(L * 1000) / 1000
  };
}
