import React, { useState, useEffect, useMemo } from 'react';
import {
  Settings,
  Droplet,
  Shuffle,
  Compass,
  Zap,
  DollarSign,
  Play,
  RotateCcw,
  CheckCircle,
  FileText
} from 'lucide-react';
import {
  calculateWECSMonthlyFlows,
  calculateWECSFloodPeaks,
  calculateModifiedDickensFlood,
  calculateFDC,
  interpolateFDC
} from './engineering/hydrology';
import {
  calculateCrossSectionProperties,
  calculateDesanderDimensions
} from './engineering/headworks';
import {
  calculateCircularTunnel,
  calculatePenstockSectionThickness,
  calculatePenstockWeight,
  calculateAnchorBlockStability,
  solveSurgeShaftOscillation,
  verifyThomaStability
} from './engineering/conveyance';
import {
  recommendTurbineType,
  calculateSynchronousSpeed,
  getTurbineEfficiency,
  calculatePowerOutput,
  compileBoQAndCost
} from './engineering/powerhouse';

interface State {
  projectName: string;
  district: string;
  frequency_Hz: number;
  catchmentArea: number;
  glaciatedAreaPercent: number;
  hydrologicZone: number;
  returnPeriod: number;
  targetExceedance: number;
  mwi_mm: number;

  // Desander
  desanderDesignFlow: number;
  desanderWidth: number;
  desanderDepth: number;
  desanderLength: number;
  desanderConcreteVol: number;

  // Conveyance
  conveyanceSlope: number;
  penstockD: number;
  penstockStaticHead: number;
  penstockLength: number;
  penstockFlowVelocity: number;
  penstockTClosure: number;
  penstockCWave: number;
  penstockUTS: number;
  penstockYield: number;
  penstockEta: number;
  penstockCorrosion: number;

  // Anchor block
  abWidth: number;
  abLength: number;
  abHeight1: number;
  abHeight2: number;
  abHeight3: number;
  abFriction: number;
  abAngle: number;
  abSectionLength: number;

  // Surge
  surgeL: number;
  surgeDt: number;
  surgeDuration: number;

  // Powerhouse
  turbineType: 'Francis' | 'Pelton';
  generatorEff: number;
  percentLoad: number;
  turbineNTheoretical: number;
}

const DEFAULT_STATE: State = {
  projectName: 'Dana Khola Hydropower Project',
  district: 'Ilam',
  frequency_Hz: 50,
  catchmentArea: 145.6,
  glaciatedAreaPercent: 12.5,
  hydrologicZone: 3,
  returnPeriod: 100,
  targetExceedance: 40,
  mwi_mm: 1800,

  // Desander
  desanderDesignFlow: 3.2,
  desanderWidth: 6.5,
  desanderDepth: 4.2,
  desanderLength: 45.0,
  desanderConcreteVol: 650,

  // Conveyance
  conveyanceSlope: 0.002,
  penstockD: 2500,
  penstockStaticHead: 124.5,
  penstockLength: 380,
  penstockFlowVelocity: 5.09,
  penstockTClosure: 33.33,
  penstockCWave: 0.01075,
  penstockUTS: 410,
  penstockYield: 250,
  penstockEta: 0.95,
  penstockCorrosion: 2.0,

  // Anchor block
  abWidth: 3.5,
  abLength: 3.5,
  abHeight1: 4.5,
  abHeight2: 4.2,
  abHeight3: 4.6,
  abFriction: 0.35,
  abAngle: 28.5,
  abSectionLength: 3.5,

  // Surge
  surgeL: 1200,
  surgeDt: 0.2,
  surgeDuration: 100,

  // Powerhouse
  turbineType: 'Francis',
  generatorEff: 96.0,
  percentLoad: 85.0,
  turbineNTheoretical: 980
};

export default function App() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [state, setState] = useState<State>(() => {
    const saved = localStorage.getItem('hydrostack_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // use fallback
      }
    }
    return DEFAULT_STATE;
  });

  useEffect(() => {
    localStorage.setItem('hydrostack_state', JSON.stringify(state));
  }, [state]);

  const handleReset = () => {
    if (window.confirm('Reset all parameters to default?')) {
      setState(DEFAULT_STATE);
    }
  };

  const handleFieldChange = (key: keyof State, value: any) => {
    setState((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  // Perform calculations reactively inside useMemo
  const calcs = useMemo(() => {
    // 1. Hydrology
    const monthly = calculateWECSMonthlyFlows(state.catchmentArea, state.catchmentArea, state.mwi_mm);
    const fdcPoints = calculateFDC(monthly.WECSDisN);
    const designDischargeQ = interpolateFDC(fdcPoints, state.targetExceedance);
    const peaks = calculateWECSFloodPeaks(state.catchmentArea);
    const floodPeak = peaks[state.returnPeriod] || peaks[100] || 0.0;
    const dickensPeak = calculateModifiedDickensFlood(state.catchmentArea, state.glaciatedAreaPercent, state.returnPeriod);

    const regionalSpecificYields: Record<number, number> = {
      1: 15.5, 2: 18.2, 3: 20.8, 4: 25.4, 5: 12.0, 6: 28.5, 7: 35.0
    };
    const specificYield = regionalSpecificYields[state.hydrologicZone] || 20.8;

    // 2. Headworks & Desander
    const desander = calculateDesanderDimensions(
      state.desanderDesignFlow,
      0.2, // d_min_mm
      0.15, // scourCoeff_a
      1.5, // safetyFactor_eta
      state.desanderWidth,
      state.desanderDepth
    );
    const Vh = state.desanderDesignFlow / (state.desanderWidth * state.desanderDepth);
    const froude = Vh / Math.sqrt(9.81 * state.desanderDepth);

    // 3. Water Conveyance
    const tunnelDiameter = calculateCircularTunnel(state.desanderDesignFlow, 0.013, state.conveyanceSlope);
    const penstock = calculatePenstockSectionThickness({
      D: state.penstockD,
      staticHead: state.penstockStaticHead,
      cumLength: state.penstockLength,
      flowVelocity: state.penstockFlowVelocity,
      uts: state.penstockUTS,
      yieldStress: state.penstockYield,
      jointEfficiency: state.penstockEta,
      corrosionAllowance: state.penstockCorrosion,
      T_closure: state.penstockTClosure,
      C_wave: state.penstockCWave
    });
    const designPressure_MPa = 0.00981 * penstock.designHead;
    const penstockSteelWeight = calculatePenstockWeight(state.penstockD, penstock.adoptedThickness, state.penstockLength);

    const abHeights: [number, number, number] = [state.abHeight1, state.abHeight2, state.abHeight3];
    const anchorBlock = calculateAnchorBlockStability({
      buried: false,
      concreteDensity: 2.30,
      soilDensity: 1.30,
      blockWidth: state.abWidth,
      blockLength: state.abLength,
      blockHeights: abHeights,
      tempChange: 0.0,
      steelDensity: 7.85,
      soilConcreteFriction: state.abFriction,
      pipeThickness: penstock.adoptedThickness / 1000,
      pipeDiameter: state.penstockD / 1000,
      flowVelocity: state.penstockFlowVelocity,
      saddleFriction: 0.15,
      waterHammerHead: penstock.waterHammer,
      designHead: penstock.designHead,
      allowableBearingCapacity: 250,
      topWidths: [state.abWidth, state.abWidth],
      bendAngle: state.abAngle,
      slopeAngle: 0.0,
      sectionLength: state.abSectionLength
    });

    // 4. Surge Shaft & Powerhouse
    const A_tunnel = Math.PI * Math.pow(tunnelDiameter, 2) / 4;
    const A_surge = Math.PI * Math.pow((state.penstockD * 2) / 1000, 2) / 4; // Surge dia = 2x penstock
    const surge = solveSurgeShaftOscillation({
      L_tunnel: state.surgeL,
      A_tunnel,
      K_friction: 0.08,
      A_surge,
      Q_design: state.desanderDesignFlow,
      timeStep_dt: state.surgeDt,
      duration: state.surgeDuration,
      initialZ: 0.0,
      initialQ: state.desanderDesignFlow,
      isAcceptance: false
    });

    const thomaStable = verifyThomaStability(state.surgeL, A_tunnel, 0.08, state.penstockStaticHead);
    const recommendedTurbine = recommendTurbineType(state.penstockStaticHead, state.desanderDesignFlow);
    const syncSpeed = calculateSynchronousSpeed(state.turbineNTheoretical, state.frequency_Hz);
    const turbineEff = getTurbineEfficiency(state.turbineType, state.percentLoad);
    const power = calculatePowerOutput(state.desanderDesignFlow, state.penstockStaticHead, turbineEff, state.generatorEff);

    // Cost compilation
    const abVolume = state.abWidth * state.abLength * ((state.abHeight1 + state.abHeight2 + state.abHeight3) / 3);
    const boq = compileBoQAndCost({
      desanderConcrete_m3: state.desanderConcreteVol,
      penstockSteel_tonnes: penstockSteelWeight,
      anchorBlockConcrete_m3: abVolume
    }, {
      concrete: 12500, // NRS/m3
      steel: 145000   // NRS/tonne
    });

    return {
      monthly,
      fdcPoints,
      designDischargeQ,
      floodPeak,
      dickensPeak,
      desander,
      Vh,
      froude,
      tunnelDiameter,
      penstock,
      designPressure_MPa,
      penstockSteelWeight,
      abVolume,
      anchorBlock,
      surge,
      thomaStable,
      recommendedTurbine,
      syncSpeed,
      turbineEff,
      power,
      boq,
      specificYield
    };
  }, [state]);

  const steps = [
    { name: 'Project Config', icon: Settings },
    { name: 'Hydrologic Analysis', icon: Droplet },
    { name: 'Intake/Desanding', icon: Shuffle },
    { name: 'Water Conveyance', icon: Compass },
    { name: 'Surge/Powerhouse', icon: Zap },
    { name: 'Cost & BoQ Estimator', icon: DollarSign }
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-on-background font-body-base antialiased">
      {/* Left Sidebar */}
      <aside className="w-[280px] bg-surface-container-low border-r border-outline-variant flex flex-col p-4 gap-4 shrink-0 z-10">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-2 p-2 rounded-lg bg-surface-container/40 border border-outline-variant/30">
          <div className="w-9 h-9 rounded bg-primary flex items-center justify-center text-on-primary font-bold text-lg">
            HS
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-primary tracking-wide text-sm">HydroStack</span>
            <span className="text-[10px] text-on-surface-variant font-data-mono">DESIGN SUITE v1.2</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="flex-1 flex items-center justify-center gap-1 bg-surface-container-high border border-outline-variant text-[12px] py-1.5 px-3 rounded font-medium hover:bg-surface-container-highest active:scale-95 duration-100 transition-all text-on-surface"
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-1 bg-primary text-on-primary text-[12px] py-1.5 px-3 rounded font-bold hover:opacity-90 active:scale-95 duration-100 transition-all"
          >
            <FileText size={14} /> Export
          </button>
        </div>

        {/* Wizard Steps */}
        <nav className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeStep === idx;
            return (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`flex items-center gap-3 p-2.5 rounded transition-all group relative text-left w-full active:scale-[0.98] duration-100 ${
                  isActive
                    ? 'bg-primary-container/20 text-primary border-l-4 border-primary font-bold pl-2'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface border-l-4 border-transparent'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'} />
                <span className="text-[13px]">{step.name}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="pt-3 border-t border-outline-variant/50 text-[11px] text-outline flex flex-col gap-1">
          <div className="flex items-center gap-1"><CheckCircle size={10} className="text-primary" /> Engine: TypeScript Core</div>
          <div className="flex items-center gap-1"><CheckCircle size={10} className="text-primary" /> Solver: Explicit Euler (dt=0.2s)</div>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex overflow-hidden">
        {/* Center Panel - Input Parameters */}
        <section className="flex-1 bg-surface border-r border-outline-variant flex flex-col overflow-y-auto">
          <header className="h-12 border-b border-outline-variant flex items-center px-6 sticky top-0 bg-surface/85 backdrop-blur z-20 justify-between shrink-0">
            <h1 className="font-semibold text-sm text-on-surface flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {steps[activeStep].name} Sizing Controls
            </h1>
            <span className="text-[11px] text-outline font-data-mono uppercase">Step {activeStep + 1} of 6</span>
          </header>

          <div className="p-6 max-w-xl mx-auto w-full flex flex-col gap-6">
            {/* STEP 0: Project Config */}
            {activeStep === 0 && (
              <div className="flex flex-col gap-5">
                <div className="border border-outline-variant/60 rounded bg-surface-container-lowest p-4">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Project Metadata</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Project Name</label>
                      <input
                        type="text"
                        value={state.projectName}
                        onChange={(e) => handleFieldChange('projectName', e.target.value)}
                        className="w-full bg-surface-dim border border-outline-variant rounded py-2 px-3 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all h-9"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Location District (Nepal)</label>
                      <select
                        value={state.district}
                        onChange={(e) => handleFieldChange('district', e.target.value)}
                        className="w-full bg-surface-dim border border-outline-variant rounded py-2 px-3 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all h-9"
                      >
                        <option value="Ilam">Ilam (Zone 3)</option>
                        <option value="Solukhumbu">Solukhumbu (Zone 1)</option>
                        <option value="Kaski">Kaski (Zone 4)</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Generator Design Grid Frequency</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={state.frequency_Hz}
                          onChange={(e) => handleFieldChange('frequency_Hz', parseFloat(e.target.value) || 50)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary transition-all font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">Hz</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1: Hydrology */}
            {activeStep === 1 && (
              <div className="flex flex-col gap-5">
                <div className="border border-outline-variant/60 rounded bg-surface-container-lowest p-4">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Basin Dimensions & Region</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Catchment Area</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={state.catchmentArea}
                          onChange={(e) => handleFieldChange('catchmentArea', parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-14 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">km²</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Hydrologic Zone (WECS 1-7)</label>
                      <input
                        type="number"
                        min="1"
                        max="7"
                        value={state.hydrologicZone}
                        onChange={(e) => handleFieldChange('hydrologicZone', parseInt(e.target.value) || 3)}
                        className="w-full bg-surface-dim border border-outline-variant rounded py-2 px-3 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Glaciated Area Percentage</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={state.glaciatedAreaPercent}
                          onChange={(e) => handleFieldChange('glaciatedAreaPercent', parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">%</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Monsoon Wetness Index (MWI)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={state.mwi_mm}
                          onChange={(e) => handleFieldChange('mwi_mm', parseFloat(e.target.value) || 1800)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">mm</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-outline-variant/60 rounded bg-surface-container-lowest p-4">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Target Exceedance</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Return Period (Flood Sizing)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={state.returnPeriod}
                          onChange={(e) => handleFieldChange('returnPeriod', parseInt(e.target.value) || 100)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-14 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">Years</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Target FDC Exceedance Level</label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={state.targetExceedance}
                          onChange={(e) => handleFieldChange('targetExceedance', parseFloat(e.target.value) || 40)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Intake/Desander */}
            {activeStep === 2 && (
              <div className="flex flex-col gap-5">
                <div className="border border-outline-variant/60 rounded bg-surface-container-lowest p-4">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Desanding Basin Sizing</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Design Inflow (Q)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.05"
                          value={state.desanderDesignFlow}
                          onChange={(e) => handleFieldChange('desanderDesignFlow', parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-14 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">m³/s</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Chamber Width (B)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={state.desanderWidth}
                          onChange={(e) => handleFieldChange('desanderWidth', parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">m</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Chamber Water Depth (H)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={state.desanderDepth}
                          onChange={(e) => handleFieldChange('desanderDepth', parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">m</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Chamber Length (L)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.5"
                          value={state.desanderLength}
                          onChange={(e) => handleFieldChange('desanderLength', parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">m</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Estimated Concrete Volume (BoQ)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={state.desanderConcreteVol}
                          onChange={(e) => handleFieldChange('desanderConcreteVol', parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">m³</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Water Conveyance */}
            {activeStep === 3 && (
              <div className="flex flex-col gap-5">
                <div className="border border-outline-variant/60 rounded bg-surface-container-lowest p-4">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Tunnel & Penstock Sizing</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Tunnel Bed Slope (S)</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={state.conveyanceSlope}
                        onChange={(e) => handleFieldChange('conveyanceSlope', parseFloat(e.target.value) || 0.001)}
                        className="w-full bg-surface-dim border border-outline-variant rounded py-2 px-3 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Penstock Pipe Diameter (D)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={state.penstockD}
                          onChange={(e) => handleFieldChange('penstockD', parseFloat(e.target.value) || 1000)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">mm</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Total Penstock Length</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={state.penstockLength}
                          onChange={(e) => handleFieldChange('penstockLength', parseFloat(e.target.value) || 100)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">m</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Static Design Head</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.1"
                          value={state.penstockStaticHead}
                          onChange={(e) => handleFieldChange('penstockStaticHead', parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">m</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Design Water Velocity (V)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={state.penstockFlowVelocity}
                          onChange={(e) => handleFieldChange('penstockFlowVelocity', parseFloat(e.target.value) || 2.0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-14 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">m/s</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-outline-variant/60 rounded bg-surface-container-lowest p-4">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Structural Safety & Steel Properties</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Steel Grade UTS</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={state.penstockUTS}
                            onChange={(e) => handleFieldChange('penstockUTS', parseFloat(e.target.value) || 410)}
                            className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-outline font-data-mono">MPa</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Steel Yield stress</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={state.penstockYield}
                            onChange={(e) => handleFieldChange('penstockYield', parseFloat(e.target.value) || 250)}
                            className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-outline font-data-mono">MPa</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Joint Efficiency (eta)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={state.penstockEta}
                          onChange={(e) => handleFieldChange('penstockEta', parseFloat(e.target.value) || 0.9)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 px-3 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Corrosion Margin</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            value={state.penstockCorrosion}
                            onChange={(e) => handleFieldChange('penstockCorrosion', parseFloat(e.target.value) || 2.0)}
                            className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-outline font-data-mono">mm</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Closing Time (Tc)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={state.penstockTClosure}
                            onChange={(e) => handleFieldChange('penstockTClosure', parseFloat(e.target.value) || 10.0)}
                            className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-outline font-data-mono">s</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Wave Constant (C)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={state.penstockCWave}
                          onChange={(e) => handleFieldChange('penstockCWave', parseFloat(e.target.value) || 0.0104)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 px-3 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-outline-variant/60 rounded bg-surface-container-lowest p-4">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Anchor Block Dimensions</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Block Width (B)</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={state.abWidth}
                            onChange={(e) => handleFieldChange('abWidth', parseFloat(e.target.value) || 1.0)}
                            className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-outline font-data-mono">m</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Block Length (L)</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={state.abLength}
                            onChange={(e) => handleFieldChange('abLength', parseFloat(e.target.value) || 1.0)}
                            className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-outline font-data-mono">m</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] text-on-surface-variant font-semibold uppercase">Height H1</label>
                        <input
                          type="number"
                          value={state.abHeight1}
                          onChange={(e) => handleFieldChange('abHeight1', parseFloat(e.target.value) || 1.0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-1.5 px-2 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] text-on-surface-variant font-semibold uppercase">Height H2</label>
                        <input
                          type="number"
                          value={state.abHeight2}
                          onChange={(e) => handleFieldChange('abHeight2', parseFloat(e.target.value) || 1.0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-1.5 px-2 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] text-on-surface-variant font-semibold uppercase">Height H3</label>
                        <input
                          type="number"
                          value={state.abHeight3}
                          onChange={(e) => handleFieldChange('abHeight3', parseFloat(e.target.value) || 1.0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-1.5 px-2 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                      </div>
                    </div>
                    <div className="flex grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] text-on-surface-variant font-semibold uppercase">Friction Coeff.</label>
                        <input
                          type="number"
                          step="0.01"
                          value={state.abFriction}
                          onChange={(e) => handleFieldChange('abFriction', parseFloat(e.target.value) || 0.3)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-1.5 px-2 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] text-on-surface-variant font-semibold uppercase">Bend Angle (deg)</label>
                        <input
                          type="number"
                          value={state.abAngle}
                          onChange={(e) => handleFieldChange('abAngle', parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-1.5 px-2 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[9px] text-on-surface-variant font-semibold uppercase">Segment Length</label>
                        <input
                          type="number"
                          value={state.abSectionLength}
                          onChange={(e) => handleFieldChange('abSectionLength', parseFloat(e.target.value) || 1)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-1.5 px-2 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Surge/Powerhouse */}
            {activeStep === 4 && (
              <div className="flex flex-col gap-5">
                <div className="border border-outline-variant/60 rounded bg-surface-container-lowest p-4">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Surge Tank Simulation Inputs</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Tunnel Length (L_tunnel)</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={state.surgeL}
                          onChange={(e) => handleFieldChange('surgeL', parseFloat(e.target.value) || 100)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">m</span>
                      </div>
                    </div>
                    <div className="flex grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Time Step (dt)</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.05"
                            value={state.surgeDt}
                            onChange={(e) => handleFieldChange('surgeDt', parseFloat(e.target.value) || 0.1)}
                            className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-outline font-data-mono">s</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Duration</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={state.surgeDuration}
                            onChange={(e) => handleFieldChange('surgeDuration', parseInt(e.target.value) || 50)}
                            className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-outline font-data-mono">s</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border border-outline-variant/60 rounded bg-surface-container-lowest p-4">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Generator & Turbine Selection</h3>
                  <div className="flex flex-col gap-4">
                    <div className="flex grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Turbine Type Selection</label>
                        <select
                          value={state.turbineType}
                          onChange={(e) => handleFieldChange('turbineType', e.target.value as any)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 px-3 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary h-9"
                        >
                          <option value="Francis">Francis</option>
                          <option value="Pelton">Pelton</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Generator Efficiency</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            value={state.generatorEff}
                            onChange={(e) => handleFieldChange('generatorEff', parseFloat(e.target.value) || 90.0)}
                            className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-outline font-data-mono">%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Turbine Theoretical Speed</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={state.turbineNTheoretical}
                            onChange={(e) => handleFieldChange('turbineNTheoretical', parseFloat(e.target.value) || 500)}
                            className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-outline font-data-mono">rpm</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-on-surface-variant font-semibold uppercase">Part-Load Operational</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            value={state.percentLoad}
                            onChange={(e) => handleFieldChange('percentLoad', parseFloat(e.target.value) || 80)}
                            className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-outline font-data-mono">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Cost & BoQ */}
            {activeStep === 5 && (
              <div className="flex flex-col gap-5">
                <div className="border border-outline-variant/60 rounded bg-surface-container-lowest p-4">
                  <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Cost Estimation Setup</h3>
                  <div className="flex flex-col gap-4">
                    <p className="text-xs text-outline leading-relaxed">
                      This calculator maps concrete and steel volumes generated across the desanding basin, penstock layout, and anchor blocks to Nepalese rate catalogs (e.g. Ilam District standard rates).
                    </p>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] text-on-surface-variant font-semibold uppercase">Project concrete volume</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={state.desanderConcreteVol}
                          onChange={(e) => handleFieldChange('desanderConcreteVol', parseFloat(e.target.value) || 0)}
                          className="w-full bg-surface-dim border border-outline-variant rounded py-2 pl-3 pr-12 text-xs text-on-surface focus:border-primary focus:ring-1 focus:ring-primary font-data-mono text-data-mono h-9"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-outline font-data-mono">m³</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right Panel - Live Sizing & Visualizations */}
        <section className="flex-1 bg-surface-dim border-l border-outline-variant/50 flex flex-col overflow-hidden">
          <header className="h-12 border-b border-outline-variant flex items-center px-6 bg-surface-dim/80 backdrop-blur z-20 justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <h2 className="font-semibold text-xs text-on-surface">HydroStack Solver Status:</h2>
            </div>
            <div className="text-[10px] text-primary font-data-mono bg-primary/10 border border-primary/20 px-2 py-0.5 rounded uppercase">
              CONVERGED
            </div>
          </header>

          {/* Scrollable Output Content */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-container rounded p-3 border border-outline-variant relative overflow-hidden flex flex-col justify-between h-20">
                <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">Net Head</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-data-mono text-[20px] font-bold text-primary">{state.penstockStaticHead.toFixed(1)}</span>
                  <span className="font-data-mono text-[11px] text-outline">m</span>
                </div>
              </div>

              <div className="bg-surface-container rounded p-3 border border-outline-variant relative overflow-hidden flex flex-col justify-between h-20">
                <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">Design Flow</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-data-mono text-[20px] font-bold text-secondary">{state.desanderDesignFlow.toFixed(2)}</span>
                  <span className="font-data-mono text-[11px] text-outline">m³/s</span>
                </div>
              </div>

              <div className="bg-surface-container rounded p-3 border border-outline-variant relative overflow-hidden flex flex-col justify-between h-20">
                <span className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wider">Electrical Power</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-data-mono text-[20px] font-bold text-primary">{(calcs.power.electricalPower_kW / 1000).toFixed(2)}</span>
                  <span className="font-data-mono text-[11px] text-outline">MW</span>
                </div>
              </div>
            </div>

            {/* Render Tab Specific SVG Visualizer */}
            <div className="bg-surface-container rounded border border-outline-variant p-4 flex flex-col">
              <h3 className="text-xs font-semibold text-on-surface uppercase mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                Live Engineering Drawing
              </h3>

              <div className="w-full aspect-[16/10] bg-[#070908] border border-outline-variant/60 rounded overflow-hidden relative flex items-center justify-center">
                {/* CAD Grid Pattern Overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  backgroundImage: 'radial-gradient(rgba(134, 148, 138, 0.1) 1px, transparent 1px)',
                  backgroundSize: '16px 16px'
                }} />

                {/* VISUALIZER 0/1: Flow Duration Curve Graph */}
                {(activeStep === 0 || activeStep === 1) && (
                  <svg className="w-full h-full p-6 text-xs" viewBox="0 0 400 240">
                    {/* Grid lines */}
                    <line x1="40" y1="20" x2="40" y2="200" stroke="#3c4a42" strokeWidth="1" />
                    <line x1="40" y1="200" x2="380" y2="200" stroke="#3c4a42" strokeWidth="1" />
                    <line x1="40" y1="20" x2="380" y2="20" stroke="#3c4a42" strokeWidth="0.5" strokeDasharray="3 3" />
                    <line x1="40" y1="110" x2="380" y2="110" stroke="#3c4a42" strokeWidth="0.5" strokeDasharray="3 3" />

                    {/* FDC Curve path */}
                    <path
                      d={`M 40,30 Q 150,110 250,170 T 380,195`}
                      fill="none"
                      stroke="#89ceff"
                      strokeWidth="2"
                    />

                    {/* Exceedance Marker */}
                    {(() => {
                      const exceedX = 40 + (state.targetExceedance / 100) * 340;
                      return (
                        <>
                          <line x1={exceedX} y1="20" x2={exceedX} y2="200" stroke="#4edea3" strokeWidth="1.5" strokeDasharray="4 4" />
                          <circle cx={exceedX} cy="140" r="4" fill="#4edea3" />
                          <text x={exceedX + 5} y="40" fill="#4edea3" className="font-data-mono text-[9px]">
                            Q{state.targetExceedance} = {calcs.designDischargeQ.toFixed(2)} m³/s
                          </text>
                        </>
                      );
                    })()}

                    {/* Legend */}
                    <text x="50" y="215" fill="#bbcabf" className="font-data-mono text-[9px]">Exceedance Probability (%)</text>
                    <text x="30" y="115" fill="#bbcabf" transform="rotate(-90 15 110)" className="font-data-mono text-[9px]">Discharge (m³/s)</text>
                    <text x="250" y="215" fill="#89ceff" className="font-data-mono text-[9px]">FDC Hydrology Zone {state.hydrologicZone}</text>
                  </svg>
                )}

                {/* VISUALIZER 2: Desander Particle Settlement Schematic */}
                {activeStep === 2 && (
                  <svg className="w-full h-full p-6 text-xs" viewBox="0 0 400 240">
                    {/* Desander Chamber Box */}
                    <rect x="40" y="50" width="320" height="110" fill="none" stroke="#86948a" strokeWidth="1.5" />
                    
                    {/* Water flow line */}
                    <line x1="40" y1="50" x2="360" y2="50" stroke="#89ceff" strokeWidth="1" strokeDasharray="3 3" />
                    
                    {/* Inlet and Outlet labels */}
                    <text x="45" y="42" fill="#89ceff" className="font-data-mono text-[9px]">INLET FLOW (V_h = {calcs.Vh.toFixed(2)} m/s)</text>
                    <text x="280" y="42" fill="#86948a" className="font-data-mono text-[9px]">OUTLET</text>

                    {/* Settlement Path line */}
                    {(() => {
                      const w = calcs.desander.settlingVelocity_w; // m/s
                      const V_h = calcs.Vh;     // m/s
                      const L = state.desanderLength;
                      const H = state.desanderDepth;
                      
                      // slope = w / V_h
                      // distance to settle = H * V_h / w
                      const X_settle = (H * V_h) / w;
                      const isSettled = X_settle <= L;
                      
                      // map coordinates: Chamber is 320px wide (L), 110px high (H)
                      // start is (40, 50)
                      const pathX = 40 + Math.min(320, (X_settle / L) * 320);
                      const pathY = 50 + (pathX - 40) * (110 / 320) * (L / X_settle);

                      return (
                        <>
                          <path
                            d={`M 40,50 L ${pathX},${pathY}`}
                            fill="none"
                            stroke="#fc7c78"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                          />
                          <circle cx={pathX} cy={pathY} r="4" fill={isSettled ? '#4edea3' : '#fc7c78'} />
                          <text x="50" y="100" fill="#dde4dd" className="font-data-mono text-[9px]">
                            Rubey settling w = {(w * 100).toFixed(1)} cm/s
                          </text>
                          <text x="50" y="120" fill="#dde4dd" className="font-data-mono text-[9px]">
                            Chamber Status: {isSettled ? 'SETTLED (SF = 1.5)' : 'SCOUR OUT OF BOUNDS'}
                          </text>
                        </>
                      );
                    })()}

                    {/* Dimension markers */}
                    <text x="180" y="180" fill="#bbcabf" className="font-data-mono text-[9px]">Length L = {state.desanderLength} m</text>
                    <text x="370" y="110" fill="#bbcabf" transform="rotate(90 370 110)" className="font-data-mono text-[9px]">Depth H = {state.desanderDepth} m</text>
                  </svg>
                )}

                {/* VISUALIZER 3: Penstock stepped wall thickness */}
                {activeStep === 3 && (
                  <svg className="w-full h-full p-6 text-xs" viewBox="0 0 400 240">
                    {/* Stepped profile of pipe */}
                    {/* Section 1 */}
                    <rect x="50" y="60" width="100" height="70" fill="none" stroke="#3c4a42" strokeWidth="1" />
                    <line x1="50" y1="95" x2="150" y2="95" stroke="#89ceff" strokeWidth="1.5" />
                    <text x="60" y="80" fill="#dde4dd" className="font-data-mono text-[8px]">Sec 1: H={state.penstockStaticHead.toFixed(1)}m</text>
                    <text x="60" y="120" fill="#4edea3" className="font-data-mono text-[8px]">t = {calcs.penstock.adoptedThickness} mm</text>

                    {/* Section 2 */}
                    <rect x="150" y="50" width="120" height="90" fill="none" stroke="#3c4a42" strokeWidth="1" />
                    <line x1="150" y1="95" x2="270" y2="95" stroke="#89ceff" strokeWidth="3" />
                    <text x="160" y="70" fill="#dde4dd" className="font-data-mono text-[8px]">Sec 2: L={state.penstockLength}m</text>
                    <text x="160" y="120" fill="#4edea3" className="font-data-mono text-[8px]">D = {state.penstockD} mm</text>

                    {/* Section 3 (Powerhouse junction) */}
                    <rect x="270" y="40" width="80" height="110" fill="none" stroke="#3c4a42" strokeWidth="1" />
                    <line x1="270" y1="95" x2="350" y2="95" stroke="#89ceff" strokeWidth="4.5" />
                    <text x="275" y="60" fill="#dde4dd" className="font-data-mono text-[8px]">Powerhouse</text>
                    <text x="275" y="120" fill="#4edea3" className="font-data-mono text-[8px]">W = {calcs.penstockSteelWeight.toFixed(1)} t</text>

                    {/* Anchor block overlay */}
                    <rect x="140" y="85" width="20" height="20" fill="#161d19" stroke="#4edea3" strokeWidth="1" />

                    <text x="50" y="190" fill="#bbcabf" className="font-data-mono text-[9px]">
                      Hoop design pressure P = {calcs.designPressure_MPa.toFixed(3)} MPa
                    </text>
                    <text x="50" y="210" fill="#bbcabf" className="font-data-mono text-[9px]">
                      Allievi wave speed a = {calcs.penstock.waveVelocity.toFixed(1)} m/s
                    </text>
                  </svg>
                )}

                {/* VISUALIZER 4: Surge Oscillation Wave */}
                {activeStep === 4 && (
                  <svg className="w-full h-full p-6 text-xs" viewBox="0 0 400 240">
                    {/* Grid lines */}
                    <line x1="40" y1="20" x2="40" y2="200" stroke="#3c4a42" strokeWidth="1" />
                    <line x1="40" y1="110" x2="380" y2="110" stroke="#3c4a42" strokeWidth="1" /> {/* Zero level */}
                    
                    {/* Simulation oscillation wave path */}
                    {(() => {
                      const surgePoints = calcs.surge;
                      if (surgePoints.length === 0) return null;

                      const maxZ = Math.max(...surgePoints.map(p => Math.abs(p.Z))) || 1.0;
                      const yScale = 80 / maxZ;

                      const pathPoints = surgePoints.map((p) => {
                        const x = 40 + (p.time / state.surgeDuration) * 340;
                        const y = 110 - p.Z * yScale;
                        return `${x},${y}`;
                      });

                      return (
                        <path
                          d={`M ${pathPoints.join(' L ')}`}
                          fill="none"
                          stroke="#4edea3"
                          strokeWidth="1.5"
                        />
                      );
                    })()}

                    {/* Labels */}
                    <text x="50" y="35" fill="#4edea3" className="font-data-mono text-[9px]">Surge Max Z = {Math.max(...calcs.surge.map(p => p.Z)).toFixed(2)} m</text>
                    <text x="50" y="55" fill="#fc7c78" className="font-data-mono text-[9px]">Surge Min Z = {Math.min(...calcs.surge.map(p => p.Z)).toFixed(2)} m</text>
                    <text x="300" y="215" fill="#bbcabf" className="font-data-mono text-[9px]">Time (s)</text>
                    <text x="25" y="115" fill="#bbcabf" transform="rotate(-90 15 110)" className="font-data-mono text-[9px]">Water level Z (m)</text>
                  </svg>
                )}

                {/* VISUALIZER 5: Cost Estimator Summary */}
                {activeStep === 5 && (
                  <div className="w-full h-full p-6 flex flex-col justify-between overflow-y-auto">
                    <div className="flex justify-between items-center border-b border-outline-variant/50 pb-2">
                      <span className="text-[11px] font-bold text-primary">BILL OF QUANTITIES</span>
                      <span className="font-data-mono text-[10px] text-outline">District: {state.district}</span>
                    </div>

                    <table className="w-full text-left text-[10px] font-data-mono mt-2">
                      <thead>
                        <tr className="border-b border-outline-variant/30 text-outline uppercase text-[8px]">
                          <th className="py-1">Item Description</th>
                          <th className="py-1 text-right">Quantity</th>
                          <th className="py-1 text-right">Rate</th>
                          <th className="py-1 text-right">Total (NRS)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calcs.boq.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-outline-variant/10 text-on-surface-variant">
                            <td className="py-1">{item.name}</td>
                            <td className="py-1 text-right">{item.quantity.toFixed(1)}</td>
                            <td className="py-1 text-right">{item.rate.toLocaleString()}</td>
                            <td className="py-1 text-right">{item.cost.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="border-t border-outline-variant/60 pt-2 mt-auto flex justify-between items-baseline">
                      <span className="text-[10px] font-bold text-on-surface">TOTAL BUDGET SUMMARY</span>
                      <span className="font-data-mono text-sm font-bold text-primary">
                        NRS {calcs.boq.totalCost.toLocaleString(undefined, {maximumFractionDigits:0})}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Calculations Log & Specs */}
            <div className="bg-surface-container rounded border border-outline-variant p-4 flex flex-col gap-2">
              <h4 className="text-xs font-semibold text-on-surface uppercase border-b border-outline-variant/30 pb-1">
                Real-Time Solver Summary
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-data-mono text-on-surface-variant">
                {activeStep === 0 && (
                  <>
                    <div>Project Location: {state.projectName}</div>
                    <div>District: {state.district}</div>
                    <div>Grid Frequency: {state.frequency_Hz} Hz</div>
                    <div>Poles: {calcs.syncSpeed.poles}</div>
                  </>
                )}
                {activeStep === 1 && (
                  <>
                    <div>Dickens Flood Peak: {calcs.dickensPeak.toFixed(1)} m³/s</div>
                    <div>Log-Normal Peak: {calcs.floodPeak.toFixed(1)} m³/s</div>
                    <div>Exceedance Discharge Q{state.targetExceedance}: {calcs.designDischargeQ.toFixed(2)} m³/s</div>
                    <div>Region Zone specific yield: {calcs.specificYield} lps/km²</div>
                  </>
                )}
                {activeStep === 2 && (
                  <>
                    <div>Rubey Settling Velocity: {(calcs.desander.settlingVelocity_w * 100).toFixed(2)} cm/s</div>
                    <div>Camp Scour Velocity: {(calcs.desander.criticalVelocity_Vc * 100).toFixed(2)} cm/s</div>
                    <div>Horizontal Flow velocity V_h: {calcs.Vh.toFixed(2)} m/s</div>
                    <div>Froude Number: {calcs.froude.toFixed(4)}</div>
                  </>
                )}
                {activeStep === 3 && (
                  <>
                    <div>Circular Tunnel Manning Diameter: {calcs.tunnelDiameter.toFixed(3)} m</div>
                    <div>Required Wall thickness: {calcs.penstock.requiredThickness.toFixed(2)} mm</div>
                    <div>Minimum Handling limit: {calcs.penstock.handlingThickness.toFixed(2)} mm</div>
                    <div>Adopted Wall thickness: {calcs.penstock.adoptedThickness} mm</div>
                    <div>Total Steel Penstock Weight: {calcs.penstockSteelWeight.toFixed(1)} tonnes</div>
                    <div>Anchor sliding FoS: {calcs.anchorBlock.slidingFoS.toFixed(2)}</div>
                    <div>Anchor overturning FoS: {calcs.anchorBlock.overturningFoS.toFixed(2)}</div>
                    <div className={calcs.anchorBlock.slidingFoS < 1.5 || calcs.anchorBlock.overturningFoS < 1.5 ? "text-rose-500 font-bold animate-pulse col-span-2" : ""}>
                      Anchor Status: {calcs.anchorBlock.isStable ? 'STABLE' : 'UNSTABLE'}
                    </div>
                    {(calcs.anchorBlock.slidingFoS < 1.5 || calcs.anchorBlock.overturningFoS < 1.5) && (
                      <div className="col-span-2 text-rose-400 text-[10px] mt-1 border border-rose-500/25 bg-rose-500/5 p-2 rounded leading-relaxed">
                        ⚠️ Warning: Restoring gravity moments are insufficient. Increase anchor block width (B) or length (L) in the left panel to secure the pipe.
                      </div>
                    )}
                  </>
                )}
                {activeStep === 4 && (
                  <>
                    <div>Surge Tank Diameter: {((state.penstockD * 2) / 1000).toFixed(2)} m</div>
                    <div>Surge solver time steps: {calcs.surge.length}</div>
                    <div>Thoma Area criteria: {calcs.thomaStable ? 'STABLE (PASS)' : 'UNSTABLE (FAIL)'}</div>
                    <div>Recommended Turbine: {calcs.recommendedTurbine}</div>
                    <div>Poles: {calcs.syncSpeed.poles}</div>
                    <div>Synchronous speed N_sync: {calcs.syncSpeed.synchronousSpeed_N} rpm</div>
                    <div>Turbine efficiency ({state.turbineType}): {calcs.turbineEff.toFixed(2)}%</div>
                    <div>Generator shaft Power: {calcs.power.shaftPower_kW.toFixed(0)} kW</div>
                    <div>Generator electrical Power: {calcs.power.electricalPower_kW.toFixed(0)} kW</div>
                  </>
                )}
                {activeStep === 5 && (
                  <>
                    <div>Desander Concrete Vol: {state.desanderConcreteVol} m³</div>
                    <div>Anchor block Concrete Vol: {calcs.abVolume.toFixed(1)} m³</div>
                    <div>Penstock Steel weight: {calcs.penstockSteelWeight.toFixed(1)} tonnes</div>
                    <div>Concrete unit Rate: NRS 12,500 / m³</div>
                    <div>Steel unit Rate: NRS 145,000 / Ton</div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
