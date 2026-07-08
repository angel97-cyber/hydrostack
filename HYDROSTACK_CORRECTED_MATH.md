# Verified Engineering & Mathematical Specification: HydroStack Math Engine

This document represents the forensic technical audit of the legacy **Hydrosoft** codebase and defines the corrected, reconciled mathematical formulas, algorithms, and system guardrails to be implemented in the **HydroStack** SaaS platform.

---

### 1. The Missing Anchor Block (Thrust Block) Module

#### Forensic Audit findings
We successfully located the anchor block data structures and outputs inside the legacy workspace:
* **Files identified:**
  * Headrace Anchor Blocks: `data\blankHAB-10.txt` (and files `blankHAB-7.txt` to `blankHAB-60.txt`).
  * Penstock Anchor Blocks: `data\blankPAB-4.txt` (and files `blankPAB-4.txt` to `blankPAB-9.txt`).
  * Active project outputs: `data\LCKHP ABAB 39.txt` (43 lines) and `data\Ranma KHola HPPABdata.txt` (32 lines).
* **Variable Mapping (Line-by-Line Registry for `[Project]ABdata.txt` / `[Project]ABAB [No].txt`):**
  * **Line 1:** Pipe installation type (`Buried` or `Exposed`).
  * **Line 2:** Concrete density ($\gamma_c \approx 2.35\,\text{t/m}^3$).
  * **Line 3:** Soil wet density ($\gamma_s \approx 1.1\text{--}1.36\,\text{t/m}^3$).
  * **Line 4:** Block Width ($B$, m).
  * **Line 5:** Block Length ($L$, m).
  * **Line 6–8:** Height dimensions at toe, heel, and center ($H_1, H_2, H_3$, m).
  * **Line 9:** Temperature change ($\Delta T$, $^\circ\text{C}$).
  * **Line 10:** Steel density ($\gamma_{st} \approx 7.85\,\text{t/m}^3$).
  * **Line 11:** Foundation-concrete friction coefficient ($\mu \approx 0.25\text{--}0.35$).
  * **Line 12:** Steel pipe wall thickness ($t$, m).
  * **Line 13:** Steel pipe internal diameter ($D$, m).
  * **Line 14:** Flow velocity ($V$, m/s).
  * **Line 15:** Friction coefficient of pipe on saddles ($\mu_s \approx 0.15$).
  * **Line 16:** Water hammer pressure head ($\Delta H$, bar or MPa).
  * **Line 17:** Total design head ($H_{\text{total}}$, bar or MPa).
  * **Line 18:** Allowable soil bearing capacity ($q_{\text{allow}}$, kPa).
  * **Line 19–20:** Anchor block top and bottom widths ($b_1, b_2$, m).
  * **Line 21:** Total vertical force ($\sum V$, tons).
  * **Line 22:** Total horizontal force ($\sum H$, tons).
  * **Line 23–26:** Intermediate weight calculations (concrete, water, steel).
  * **Line 27:** Bend deflection angle ($\theta$, degrees).
  * **Line 28–31:** Center-of-gravity and moment arm variables.
  * **Line 32:** Outage code (`DIST`).
  * **Line 33:** Target Factor of Safety against sliding ($FoS_{s,\text{target}} \approx 1.5\text{--}1.75$).
  * **Line 34:** Target Factor of Safety against overturning ($FoS_{o,\text{target}} \approx 1.5\text{--}1.75$).
  * **Line 35–42:** Calculated sliding and overturning FoS values across load cases (empty pipe, full normal flow, transient water hammer flow).

#### Reconciled Math & Implementation for HydroStack
For a pipe bend of angle $\theta$ and slope angle change $\alpha$:

##### 1. Hydrostatic Force at Bend ($F_p$)
$$F_p = 2 \cdot P \cdot A \cdot \sin\left(\frac{\theta}{2}\right)$$
* Where $P$ is design pressure ($P = \rho g H_{\text{total}}$ in Pa) and $A = \frac{\pi D^2}{4}$ is pipe cross-sectional area ($\text{m}^2$).

##### 2. Hydrodynamic Force at Bend ($F_m$)
$$F_m = 2 \cdot \rho \cdot A \cdot V^2 \cdot \sin\left(\frac{\theta}{2}\right)$$
* Where $\rho = 1000\,\text{kg/m}^3$ and $V$ is flow velocity ($\text{m/s}$).

##### 3. Gravity Forces
* **Concrete Block Weight ($W_c$):** $W_c = V_c \times \gamma_c \times g$
* **Water Weight ($W_w$):** $W_w = A \cdot L_{\text{section}} \times \rho_{\text{water}} \times g$
* **Steel Shell Weight ($W_s$):** $W_s = \pi D \cdot t \cdot L_{\text{section}} \times \gamma_{st} \times g$

##### 4. Thermal Expansion & Saddle Friction Forces ($F_t$)
For exposed pipes resting on saddles:
$$F_t = \pm f \cdot W_{\text{pipe+water}} \cdot \cos\alpha \pm E \cdot A_s \cdot \alpha_s \cdot \Delta T$$
* Where $f = 0.15$ (saddle friction), $E$ is steel Young's modulus ($2 \times 10^{11}\,\text{Pa}$), $A_s = \pi D t$ is steel area ($\text{m}^2$), and $\alpha_s = 1.2 \times 10^{-5}\,\text{/}^\circ\text{C}$ is the thermal expansion coefficient.

##### 5. Stability Calculations
* **Sliding Factor of Safety ($FoS_s$):**
  $$FoS_s = \frac{\mu \cdot \sum V + P_p}{\sum H} \ge 1.5$$
  * Where $\mu$ is soil-concrete friction (default $0.25$), $\sum V$ are net downward vertical forces, $\sum H$ are horizontal sliding forces, and $P_p$ is passive earth pressure (conservatively set to 0 for exposed blocks).
* **Overturning Factor of Safety ($FoS_o$):**
  $$FoS_o = \frac{\sum M_{\text{restoring}}}{\sum M_{\text{overturning}}} \ge 1.5$$
  * Taken about the toe of the block.
* **Soil Bearing Capacity Check:**
  $$q_{\text{max, min}} = \frac{\sum V}{B \cdot L} \left(1 \pm \frac{6e}{L}\right) \le q_{\text{allow}}$$
  * Eccentricity $e = \frac{L}{2} - \frac{\sum M_{\text{net}}}{\sum V}$. We enforce $e \le \frac{L}{6}$ to avoid tension across the base.

---

### 2. Desanding Basin $d_{\text{min}}$ Unit Conflict

#### Forensic Audit Findings
* **The Conflict:** In standard hydraulics, Camp/Newton/Rubey settling velocity calculations expect the target particle diameter ($d_{\text{min}}$) in **meters** (SI base), whereas Leliavsky/Camp critical scour velocity ($V_c = a \sqrt{d_{\text{min}}}$) expects $d_{\text{min}}$ in **millimeters** to yield the typical scour limit of $0.15\text{--}0.25\,\text{m/s}$ for sand.
* **Legacy Bug:** The legacy software took the user input of $d_{\text{min}}$ in millimeters (e.g., $0.2\,\text{mm}$ from `problems_hydrosoft_30.txt` line 244) and passed it directly to both calculations. This caused the settling velocity $w$ to be calculated as $\approx 1.8\,\text{m/s}$ (instead of the correct $0.02\,\text{m/s}$), which is off by two orders of magnitude!

#### Correction for HydroStack
The HydroStack math engine will enforce **strict base unit separation**:
1. All inputs are accepted in user units ($d_{\text{min}}$ in mm) but immediately converted to SI units ($d_{\text{min, SI}} = d_{\text{min}} / 1000$ in meters) at the boundaries.
2. **Settling Velocity ($w$) calculation:** Uses $d_{\text{min, SI}}$ (meters):
   $$w = F \cdot \sqrt{(s-1)g \cdot d_{\text{min, SI}}}$$
3. **Critical Scour Velocity ($V_c$) calculation:** Scaled explicitly to expect meters:
   $$V_c = a \cdot \sqrt{d_{\text{min, SI}} \cdot 1000} = a \cdot \sqrt{d_{\text{min, mm}}}$$

---

### 3. WECS/DHM Flood Peak Model Area Variable ($A_{3000}$)

#### Forensic Audit Findings
* **The Issue:** The regional empirical equations for 2-year and 100-year floods in Nepal require the catchment area below $3000\,\text{m}$ elevation ($A_{3000}$), not the total catchment area ($A$).
* **Legacy Check:** We inspected `data\LowerHMData.txt` and verified that line 6 represents the Total Catchment Area ($A = 42.34\,\text{km}^2$), and line 7 represents the Catchment Area below 3000m ($A_{3000} = 41.15\,\text{km}^2$). The software correctly isolated $A_{3000}$ to compute WECS flood flows. When $A_{3000} = 0$ (high altitude glaciated basins), a division-by-zero or math error occurred (reconciled in `problems_hydrosoft_30.txt` line 177).

#### Correction for HydroStack
The HydroStack system schema will define two separate variables:
* `catchmentAreaTotal` ($A_{\text{total}}$, $\text{km}^2$)
* `catchmentAreaBelow3000` ($A_{3000}$, $\text{km}^2$)

The WECS flood peak equations will be coded as:
$$Q_2 = 1.8767 \times (A_{3000} + 1)^{0.8783}$$
$$Q_{100} = 14.63 \times (A_{3000} + 1)^{0.7342}$$

**Guardrail:** If $A_{3000} = 0$, $Q_2$ and $Q_{100}$ are set to the theoretical base runoff $Q_2 = 1.88\,\text{m}^3/\text{s}$ and $Q_{100} = 14.63\,\text{m}^3/\text{s}$ respectively. To prevent standard deviation division-by-zero errors:
$$A_{3000} = \max(A_{3000}, \, 0.001\,\text{km}^2)$$

---

### 4. Kirschmer Trashrack Bar Shape Coefficients ($\beta$)

#### Forensic Audit Findings
* **The Issue:** Bypassed or neglected head loss calculations in the legacy software due to the developer's claim that *"Headloss@TR is negligible"* (`problems_hydrosoft_30.txt` line 236).
* **Transposition Correction:** Standard engineering documentation frequently transposes $\beta$ values. The corrected values below will be enforced in HydroStack:

| Trashrack Bar Cross-Section Shape | Correct Beta ($\beta$) |
| :--- | :--- |
| **Sharp-edged rectangular** | 2.42 |
| **Rectangular, semi-circular upstream face** | 1.83 |
| **Circular/Round bar** | 1.79 |
| **Rectangular, semi-circular both ends** | 1.67 |

#### Implementation in HydroStack
We will implement the Kirschmer head loss calculation:
$$h_{TR} = \beta \cdot \left(\frac{s}{b}\right)^{4/3} \sin\theta \cdot \frac{V^2}{2g}$$

---

### 5. Modified Dickens Formula and Small Catchment Guardrails

#### Forensic Audit Findings
* **The Formula:**
  $$Q_T = C_T \cdot A^{3/4}$$
  $$C_T = 2.342 \log_{10}(0.6T) \cdot \log_{10}\left(\frac{1185}{p}\right) + 4$$
  $$p = \left[\frac{a + 6}{A + a}\right] \times 100$$
* **The Bug:** For small catchments with no snow (e.g. $A = 1\,\text{km}^2, a = 0$), $p = 600\%$, which is mathematically nonsensical since $p$ represents the percentage of snow-covered area. If $A < 0.5\,\text{km}^2$ and $a = 0$, $p > 1185$, making the term $\log_{10}(1185/p)$ negative or causing a math domain error.

#### Correction for HydroStack
We will implement strict bounding guardrails on the glaciated fraction $p$:
1. $p$ must represent a percentage bound between $0.01\%$ and $100\%$:
   $$p = \max\left(\min\left(\left[\frac{a + 6}{A + a}\right] \times 100, \, 100.0\right), \, 0.01\right)$$
   This ensures that $1185/p \ge 11.85$, so $\log_{10}(1185/p) \ge 1.0737$ is always mathematically defined and positive.
2. If the return period $T \le 1.67$ years, $\log_{10}(0.6T)$ becomes negative. We enforce the return period constraint $T \ge 2$ years.

---

### 6. Missing MIP (Medium Irrigation Project) Methods

#### Forensic Audit Findings
By comparing the files `data\Naumure ProjectMIP1Dis.txt` through `MIP4Dis.txt` and matching them to the project configurations in `sammHMData.txt` and `RKHMData.txt`, we reverse engineered the legacy MIP state logic:
* **MIP-1, MIP-2, MIP-3, and MIP-4** do not represent four separate regression equations. Rather, they represent the **same regional monthly specific yield hydrograph** calibrated against **four different user-supplied spot discharge measurements**:
  * **MIP-1:** Calibrated to **Spot Measurement 1** (Line 18 of `HMData.txt`).
  * **MIP-2:** Calibrated to **Spot Measurement 2** (Line 20 of `HMData.txt`).
  * **MIP-3:** Calibrated to **Spot Measurement 3** (Line 22 of `HMData.txt`).
  * **MIP-4:** Calibrated to **Spot Measurement 4** (Line 24 of `HMData.txt`).
* **Non-Dimensional Hydrograph (Region 1):**
  We extracted the exact monthly specific runoff ordinates (relative to March flow = 1.0) for Region 1 (standard for eastern/central Nepal):

| Month | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Ratio** | 1.846 | 1.385 | 1.000 | 0.769 | 1.769 | 4.615 | 11.154 | 19.231 | 12.692 | 6.154 | 3.154 | 2.385 |

#### Implementation in HydroStack
We will implement the MIP zonation model:
1. Lookup the non-dimensional monthly ordinates $R_i$ for the selected region ($1\text{--}7$).
2. For MIP Option $k$ ($k=1,2,3,4$):
   * If spot measurement $Q_{\text{spot}, k}$ is provided in month $m$, calculate the scaling factor:
     $$S_k = \frac{Q_{\text{spot}, k}}{R_m}$$
   * The estimated flow for month $i$ is:
     $$Q_{i, k} = S_k \cdot R_i$$
   * If no spot measurement is entered, $Q_{i, k} = 0$.

---

### 7. Economic Penstock Diameter Formula

#### Forensic Audit Findings
* **The Issue:** The attribution of the formula $D = C \cdot Q^{0.43} \cdot H^{-0.14}$ to "Fahlbusch/Sarkaria" was scrutinized.
* **Findings:** In standard metric penstock design, the Fahlbusch empirical formula is indeed defined as $D = 0.52 \cdot Q^{0.43} \cdot H^{-0.14}$, and the Sarkaria formula is $D = 0.44 \cdot Q^{0.43} \cdot H^{-0.14}$.
* **Optimization Logic:** In the file `data\Dana Khola Hydropower ProjectPP.txt`, the software performs a discrete financial optimization loop from diameter $1000\,\text{mm}$ to $1500\,\text{mm}$. It evaluates head loss, capitalized pipeline cost, capitalized energy loss value, and selects the diameter maximizing the net benefit.

#### Implementation in HydroStack
We will implement a two-step Penstock Sizing routine:
1. **Initial Estimate (Fahlbusch empirical):**
   $$D_{\text{est}} = 0.52 \cdot Q^{0.43} \cdot H_{\text{gross}}^{-0.14}$$
2. **Financial Optimization Loop:**
   Evaluate diameters in steps of $50\,\text{mm}$ within $\pm 30\%$ of $D_{\text{est}}$ to minimize:
   $$\text{Total Cost} = \text{Pipe Capitalized Cost} + \text{Capitalized Value of Friction Power Loss}$$

---

### 8. Francis & Kaplan/Propeller Specific Speed Envelopes

#### Forensic Audit Findings
We parsed the lookup files `NsFrancis.txt`, `Nskaplan.txt`, and `NsPropeller.txt` and verified the following:
* **Francis Specific Speed ($N_s$):**
  * Head range: $32\,\text{m}$ to $575\,\text{m}$; Specific speed range: $400\,\text{rpm}$ down to $70\,\text{rpm}$.
  * The lookup values fit the continuous curve:
    $$N_s = 3584.5 \cdot H_{\text{net}}^{-0.616}$$
* **Kaplan/Propeller Specific Speed ($N_s$):**
  * Head range: $13\,\text{m}$ to $50\,\text{m}$; Specific speed range: $800\,\text{rpm}$ down to $400\,\text{rpm}$.
  * The lookup values fit the continuous curve:
    $$N_s = 2876.2 \cdot H_{\text{net}}^{-0.506} \approx \frac{2876}{\sqrt{H_{\text{net}}}}$$

#### Implementation in HydroStack
We will code both the raw discrete lookup tables (for exact reproduction of legacy designs) and the continuous regression curves as options.

---

### 9. Surge Shaft Stability and Numerical Method

#### Forensic Audit Findings
* **The Method:** Inside `data\sammacceptance.txt`, we found that the transient ODEs are solved using the **Explicit Euler Method** with a fixed time step $dt = 0.2\,\text{seconds}$. Water levels $Z$ are recorded at 4-second intervals.
* **Missing Stability Criteria:** The legacy app did not perform Thoma area check.

#### Implementation in HydroStack
1. **Numerical Solver:** Explicit Euler scheme integrated with $dt = 0.1\,\text{s}$ or $0.2\,\text{s}$:
   $$Q_{t+dt} = Q_t + \left[ \frac{g \cdot A_t}{L_t} \cdot \left( -Z_t - K_f \cdot Q_t |Q_t| \right) \right] \cdot dt$$
   $$Z_{t+dt} = Z_t + \left[ \frac{Q_t - Q_p}{A_s} \right] \cdot dt$$
2. **Thoma Stability Guardrail:**
   $$A_s \ge 1.5 \times A_{th} = 1.5 \times \left( \frac{L_t \cdot A_t}{2 g \cdot C_f \cdot H_{\text{net}}} \right)$$

---

### 10. Water Hammer Allievi/Michaud vs. Joukowsky

#### Forensic Audit Findings
* **Allievi/Michaud Verification:** In `data\Dorpa Sapsup HPPPPTHK.txt`, Section 1, the water hammer head rise is calculated as $\Delta H = 1.79\,\text{m}$ for a cumulative length $L_c = 80\,\text{m}$ and velocity $V = 2.42\,\text{m/s}$. This corresponds to a slow closing time $T \approx 22\,\text{seconds}$ using **Michaud's formula**:
  $$\Delta H = \frac{2 L \cdot V}{g \cdot T}$$
  The legacy software strictly utilized the slow-closure Michaud equation and did not fall back to Joukowsky's instantaneous water hammer equation.

#### Implementation in HydroStack
We will implement a toggle between:
1. **Slow Closure (Michaud):** $\Delta H = \frac{2 L \cdot V}{g \cdot T}$ (when $T > 2L/a$).
2. **Instantaneous Closure (Joukowsky):** $\Delta H = \frac{a \cdot V}{g}$ (when $T \le 2L/a$).

---

### 11. Thin-Wall vs. Thick-Wall Penstock Fallback

#### Forensic Audit Findings
The legacy software relied entirely on the thin-wall hoop stress formula:
$$t = \frac{P \cdot D}{2 \cdot \sigma_{\text{allow}} \cdot \eta}$$
It did not contain a fallback for thick-walled pipes ($D/t \le 10$).

#### Correction for HydroStack
To ensure safety in high-head, thick-walled conduits, we will implement **Lamé's Thick Cylinder Equation** as an automatic fallback when $D/t \le 10$:
$$t = \frac{D}{2} \cdot \left( \sqrt{\frac{\sigma_{\text{allow}} \cdot \eta + P}{\sigma_{\text{allow}} \cdot \eta - P}} - 1 \right)$$

---

### 12. State Management & FDC Extrapolation

#### Forensic Audit Findings
The legacy app sorts the 12 monthly discharge values in descending order and assigns exceedence percentages using the Weibull position:
$$P_m = \frac{m}{13} \times 100\% \quad (7.69\% \text{ to } 92.31\%)$$
For standard exceedence steps (e.g. $40\%$, $95\%$), it uses **linear interpolation**. For boundary values outside the Weibull range ($P > 92.31\%$ or $P < 7.69\%$), it interpolates to 0 flow at $100\%$ exceedence.

#### Correction for HydroStack
To prevent unrealistic drop-offs at high exceedence, we will implement linear interpolation within bounds, and bound the $100\%$ exceedence flow at a minimum base flow:
$$Q_{100} = Q_{12} \times 0.8$$
$$Q_0 = Q_1 \times 1.2$$

---

### 13. Environmental Flows (E-Flows)

#### Forensic Audit Findings
The legacy software **did not implement** any environmental flow (E-Flow) calculations.

#### Correction for HydroStack
In compliance with modern Nepalese regulations (DoED guidelines), we will deduct a default **$10\%$ environmental flow** from the river monthly discharge:
$$Q_{\text{available, month}} = Q_{\text{river, month}} \times 0.90$$

---

### 14. Input Validation and System Bounds

We will enforce the following range validation constraints in the HydroStack schema:

| Parameter | Unit | Min Value | Max Value | Default | Warning Guardrail |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Catchment Area ($A$)** | $\text{km}^2$ | 0.1 | 100,000 | N/A | Warn if WECS selected for $A < 100\,\text{km}^2$ |
| **Manning's $n$** | - | 0.009 | 0.080 | 0.013 | Warn if outside $0.011\text{--}0.045$ |
| **Return Period ($T$)** | years | 2 | 10,000 | 100 | Require integer $\ge 2$ |
| **Soil Friction Coeff ($\mu$)** | - | 0.10 | 0.80 | 0.25 | Block if outside bounds |
| **E-Flow Fraction** | $\%$ | $0\%$ | $100\%$ | $10\%$ | Standard riparian release |
