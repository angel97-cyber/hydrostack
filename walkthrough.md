# Walkthrough: HydroStack Core Sizing Suite & Frontend Dashboard

We have successfully implemented and verified the entire **HydroStack** core sizing suite and React + TypeScript + Vite frontend dashboard:

## 1. Hydrology Math Engine (`src/engineering/hydrology.ts`)
* **WECS Monthly Flow Solver:** Computes chronological and sorted monthly flows using back-solved constants.
* **WECS Flood Peak Solver:** Computes log-normal flood peaks for return periods up to 1000 years.
* **Modified Dickens Solver:** Peak discharge solver incorporating glaciated percentage $p$ clamp boundaries.
* **MIP Scaling Solver:** Scales regional specific yields for all 7 hydrologic zones in Nepal.
* **FDC & Interpolation Solver:** Generates Flow Duration Curves and interpolates discharge at target exceedance levels.

## 2. Headworks & Desanding Basin Engine (`src/engineering/headworks.ts`)
* **Cross-Section Property Solver:** Trims irregular surveyed $(X,Y)$ coordinate profiles at a target water level and computes wetted area, perimeter, and hydraulic radius.
* **Manning Rating Curve Table Solver:** Computes stage-discharge rating curves from tabular records, applying integer discharge truncation and segment linear interpolation.
* **Regulator Submerged Orifice Solver:** Calculates discharge through regulator gate openings.
* **Desander Chamber Dimension Solver:** Sizes settling basins using Rubey's settling velocity (with kinematic viscosity $\nu = 1.14 \times 10^{-6}\,\text{m}^2/\text{s}$ at $15^\circ\text{C}$), Camp's critical scour velocity, and safety factors.

## 3. Water Conveyance & Structural Sizing Engine (`src/engineering/conveyance.ts`)
* **Circular Tunnel Manning Sizer:** Solves Manning's equation circular full-flow diameter.
* **Penstock Section Thickness Solver:** Couples Allievi wave velocity ($C_w = 0.01075$ for legacy matching) and Michaud's slow water hammer equations. Incorporates Lamé's Thick Cylinder formula for automatic fallback when $D/t \le 10$, and USBR minimum handling thickness checks.
* **Penstock Weight Solver:** Calculates the correct structural steel section weight with the $1.433$ structural allowance multiplier, and reconciles the legacy file's unit bug for regression checks.
* **Anchor Block Stability Solver:** Evaluates concrete and water gravity loads, hydrostatic thrust, hydrodynamic thrust, and thermal/saddle friction forces to calculate sliding and overturning factors of safety.
* **Surge Shaft Oscillation Solver:** Computes transient water levels using the Explicit Euler scheme ($dt = 0.2$ s) for load acceptance / rejection, and verifies Thoma stability.

## 4. Powerhouse, Turbines & Costing Engine (`src/engineering/powerhouse.ts`)
* **Turbine Recommender:** Recommends turbine selection (Pelton, Francis, Kaplan, Propeller) using net design head and flow rate envelopes.
* **Synchronous Speed Solver:** Computes generator synchronous speed and poles based on Nepalese grid frequency ($50$ Hz), rounding to even pole counts.
* **Tabular Part-load Efficiency Interpolator:** Embeds the exact `FT_CURVE` and `PT_CURVE` tables parsed from the legacy project and performs piecewise linear interpolation to get part-load efficiencies.
* **Mechanical & Electrical Power Calculator:** Computes shaft power and grid-ready electrical power output using normalized efficiencies.
* **Bill of Quantities Cost Compiler:** Maps physical quantities (desander concrete, penstock steel, anchor block concrete) to unit rates (NRS) and compiles a clean, itemized billing cost spreadsheet.

## 5. HydroStack SaaS Frontend Dashboard (`src/App.tsx`)
* **Workspace Shell:** Responsive split-screen workspace featuring:
  * **Left Sidebar:** Clickable step-by-step navigation steps (Setup, Hydrology, Intake/Desander, Conveyance, Surge/Powerhouse, and Cost/BoQ) with standard engineering icons.
  * **Center Panel:** Dynamic parameter entry forms with right-aligned units (e.g. $km^2$, $m^3/s$, $MPa$). State is bound to `localStorage` for automatic session persistence on reload.
  * **Right Panel:** Key KPI displays (Net Head, Design Flow, Installed Capacity) and real-time computation reactivity.
* **Dynamic SVG Visualizers:** Renders 2D CAD-style vector schematics that update in real-time:
  1. **Flow Duration Curve (FDC):** Graph plotting the sorted monthly flows and a vertical marker denoting the target design exceedance probability.
  2. **Desander Settlement Path:** Profile of the desander basin depicting the settlement trajectory of a sand particle under Rubey/Camp flow velocity forces.
  3. **Penstock Thickness Steps:** Profile depicting the penstock steel sections with adopted plate thicknesses and section weights.
  4. **Surge Shaft Wave:** Dynamic graph plotting water level oscillation over time during load rejection.
  5. **BoQ Billing Sheet:** A formatted table listing quantities, unit rates, and total cost compiled dynamically.

---

## 6. Verification & Compilation Results

### Automated Sizing Tests
All **21 regression tests passed** successfully on localhost:
```text
 RUN  v4.1.10 C:/Users/not-a/hydrostack

 ✓ tests/headworks.test.ts (5 tests) 33ms
 ✓ tests/conveyance.test.ts (5 tests) 20ms
 ✓ tests/hydrology.test.ts (6 tests) 34ms
 ✓ tests/powerhouse.test.ts (5 tests) 11ms

 Test Files  4 passed (4)
      Tests  21 passed (21)
   Start at  13:37:46
   Duration  902ms (transform 669ms, setup 0ms, import 917ms, tests 99ms, environment 1ms)
```

### Production Compilation Build
TypeScript type checking and Vite build compile successfully with zero warnings:
```text
> tsc && vite build

vite v8.1.3 building client environment for production...
transforming...✓ 1776 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.69 kB │ gzip:  0.44 kB
dist/assets/index-Card5Rm6.css   12.38 kB │ gzip:  3.42 kB
dist/assets/index-BVkawiSc.js   255.57 kB │ gzip: 72.84 kB

✓ built in 1.57s
```

### Local Development Server
The local development server is active and serving the live dashboard:
- **URL:** [http://localhost:5173/](http://localhost:5173/)
- Input fields, calculation outputs, sidebar tabs, and SVG visualizers are 100% interactive and reactive.
