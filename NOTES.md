# Technical Notes & Implementation Audit: Sentinel NIDS Redesign

## 1. Data Pipeline Funnel Reconciliation (Rule R5)

The prompt noted that subtracting 4,160 duplicate flows from 958,121 raw capture records does not equal the 145,765 records split 70/15/15 (102,035 / 21,865 / 21,865). The exact deterministic flow in the codebase is as follows:

1. **Raw Capture Repositories**:
   - `Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv`: 225,745 flows
   - `Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv`: 286,467 flows
   - `Tuesday-WorkingHours.pcap_ISCX.csv`: 445,909 flows
   - **Total Raw Available Flows**: 958,121 flows.

2. **Benchmarking Slice Ingestion (`scripts/train_models.py`)**:
   - For balanced computational benchmarking, `nrows_per_file = 50000` was enforced during ingestion.
   - 50,000 flows sampled per file $\times$ 3 files = **150,000 raw sampled flows**.

3. **Data Hygiene & Cleansing (`src/nids/data/cleaning.py`)**:
   - Removed 75 division-by-zero rows containing `NaN` or `±Inf`.
   - Removed 4,160 identical duplicate flow tuples.
   - Result: **145,765 clean, validated flow records**.

4. **Target Four-Class Partition (`src/nids/data/label_mapping.py`)**:
   - **Normal (`BENIGN`)**: 117,606 records (80.68%)
   - **DDoS (`DDoS`)**: 23,864 records (16.37%)
   - **BruteForce (`FTP-Patator`, `SSH-Patator`)**: 4,082 records (2.80%)
   - **PortScan (`PortScan`)**: 213 records (0.15%, low support)
   - Total: **145,765 records**.

5. **Stratified Split (70% / 15% / 15%, seed=42)**:
   - **Train Set (70%)**: 102,035 records
   - **Validation Set (15%)**: 21,865 records
   - **Holdout Test Set (15%)**: 21,865 records:
     - Normal: 17,641
     - DDoS: 3,580
     - BruteForce: 612
     - PortScan: 32 (low support)

6. **Support Vector Machine (SVM) Quadratic Subsampling**:
   - Because the RBF kernel solver has quadratic time complexity $\mathcal{O}(N^2)$, fitting on 102,035 records is computationally intractable in real-time pipelines.
   - The training set for SVM was stratified down to **25,000 records**, achieving a 22.3s train duration while preserving minority class ratios.

---

## 2. Feature Schema & Selection Clarification

- **Prompt Reference**: The prompt text referenced *"39 features"*.
- **Actual Pipeline Architecture**:
  - The raw CICFlowMeter CSVs contain 79 columns.
  - Stripping non-predictive identifiers (Flow ID, Source/Destination IPs, Source Port, Timestamp) leaves 73 columns.
  - Pruning constant/zero-variance features leaves **68 active features**.
  - Random Forest Mean Decrease in Impurity (MDI) feature selection selects the **top 25 discriminative features** as configured in `configs/default.yaml` and saved in `models/selected_model/metadata.json`.
- **Frontend Presentation**:
  - The schema alignment stage in `Analyze.tsx` and the Feature Schema Browser in `Method.tsx` group features into four functional domains: *Flow Timing & Rates*, *Packet Length & Statistics*, *Subflow & Volume*, and *Flags & Protocol Boundaries*, presenting real population statistics directly from `data/DATASET.md`.

---

## 3. Minority Class Support & PortScan Pathology (Rule R4)

- PortScan has only 213 total records in the dataset partition and 32 records in the holdout test set.
- All views, tables, and charts clearly tag PortScan with `[n=32 test (213 total), low support]`.
- Although XGBoost and Random Forest achieve high recall on these 32 records, SVM experiences severe precision degradation (13.84% precision) due to false-alarm leakage from Normal traffic into minority decision spaces. This pathology is highlighted in `Compare.tsx`.

---

## 4. Explainability & SHAP Methodology Boundary (Rule R3)

- Next to every SHAP waterfall and attribution component, the required methodological boundary is displayed as an editorial margin note:
  > *"Attribution of the model's decision, not proof of causation. SHAP values isolate statistical impact on the objective function, not network physical causality."*
- Rendered without alert boxes, emoji, or hype.

---

## 5. User Interface & Design System Implementation

- **Tokens**: Strictly limited to `--ink (#0C1110)`, `--graphite (#161D1B)`, `--bone (#E8E2D2)`, and `--hairline (rgba(232,226,210,0.14))`.
- **Class Data Colors**: Strictly applied to data and particle fields: `--normal (#6FB7A0)`, `--ddos (#D0553B)`, `--portscan (#D9A441)`, `--bruteforce (#A98BC9)`.
- **Typography**: Self-hosted Fraunces (serif), Hanken Grotesk (body), and JetBrains Mono (labels/numbers) via `@fontsource`.
- **Background Engine**: Self-contained Canvas2D particle flow field driven by curl of 2D Simplex Noise, with class-specific attractors, lattices, rings, and cursor repulsion (`web/src/bg/field.ts`).
- **Motion & Accessibility**: GSAP text-line stagger reveals (400ms), respecting `prefers-reduced-motion`.

---

## 6. Execution Instructions

1. **Unified Production Server (FastAPI + React SPA)**:
   ```bash
   make run
   # Serves API endpoints and compiled terminal frontend on http://localhost:8000
   ```

2. **Development Servers (FastAPI + Vite Dev Server)**:
   ```bash
   make web
   # API: http://localhost:8000 (docs at /docs)
   # Web App: http://localhost:5173
   ```

3. **Streamlit Cybersecurity Console**:
   ```bash
   make app
   # Streamlit: http://localhost:8501
   ```

4. **Automated Verification**:
   ```bash
   make test
   make lint
   ```

---

## 7. Terminal Redesign Architecture & Implementation (Phases 1–4)

### 7.1 Look and Feel & Design System (Phase 1)
- **Palette Tokens (`web/src/styles/tokens.css`)**:
  - Surface base: `--void (#050806)`, `--panel (#0A100C)`, `--line (rgba(124, 255, 155, 0.18))`, `--text (#CFE9D6)`, `--dim (#6E8A77)`.
  - Primary Phosphor: `--phosphor (#7CFF9B)` with glow `0 0 6px rgba(124, 255, 155, 0.4)`.
  - Class Colors: Fixed semantic attribution across all views: `--normal (#5EEAD4)`, `--ddos (#FF4D3D)`, `--portscan (#FFB000)`, `--bruteforce (#C77DFF)`.
- **Theme Switcher**: Supported themes toggled via `<html data-theme="...">` and persisted in `localStorage`:
  - `green` (default phosphor green)
  - `amber` (amber CRT terminal: `--phosphor #FFB000`, `--text #F2DDB0`)
  - `ice` (cyan/blue cool terminal: `--phosphor #7DD3FC`, `--text #D6EAF5`)
  - `red-team` (unlocked via Konami code: `--phosphor #FF4D3D`, `--text #FFD4CF`)
- **Self-Hosted Monospace Typography**:
  - Body & UI: `IBM Plex Mono` (400/500)
  - Headers & Display: `VT323` (pixelated CRT terminal aesthetic)
  - Numeric & Tables: `JetBrains Mono` (`font-variant-numeric: tabular-nums`)
- **Surface CRT Effects (`TerminalChrome.tsx`)**:
  - Scanlines: 3px periodic linear gradient overlay at 6% opacity (`pointer-events: none`).
  - Vignette: 55% radial edge darkening.
  - CRT Flicker: 6s subtle luminosity oscillation between 0.0 and 0.02.
  - Glitch: Random 9–15s interval, 120ms horizontal slice shift with cyan/red chromatic split (disabled under `prefers-reduced-motion`).
- **Components & HUD**:
  - Terminal window chrome with titlebars (`[ analyze.sh ]`), square dots, and mono file paths.
  - Bracketed buttons (`[ RUN SCAN ]`) and badges (`[ DDoS ]`).
  - Tmux status bar pinned at bottom with left identity, center active route, and right telemetries (champion model, loaded flow count, theme button, live UTC clock).
  - Custom crosshair cursor with real-time `(X: ..., Y: ...)` coordinate readout.

### 7.2 Layered Background Engine (`web/src/bg/field.ts`, Phase 2)
Preserves the `useBackground()` hook (`setTarget`, `hoverClass`) across three stacked Canvas2D contexts:
- **Layer A (Bottom Fluid Flow Field)**:
  - 900 curl-noise particles (450 on mobile) drifting across simplex noise field (scale 0.0015, speed 0.5–1.2 px/frame).
  - Trailing persistence via `rgba(5, 8, 6, 0.10)` per frame; particle colors blend class weights.
- **Layer B (Network Constellation & Attack Visualizers)**:
  - 70 drifting nodes (35 on mobile) bouncing off viewport edges with Euclidean proximity edges (<160px).
  - Traveling packet bursts along edges at 90 px/s (max 120 packets).
  - **DDoS Mode**: Hub target $T$ absorbs accelerated packet vortex ($+0.9 \times w_d$ per frame) with expanding ring pulse every 400ms and glowing red connected edges.
  - **PortScan Mode**: 16 dedicated nodes arrange in a scanning circular lattice, sequentially probed in clockwise port order using real CICIDS ports (`80, 53, 21, 443, 22, 25, 110, 143, 8080, 8443, 3306, 5432, 139, 445, 123, 161`).
  - **BruteForce Mode**: Target hub surrounded by rotating dashed perimeter ring with a dynamic `REPLAY` attempt counter incrementing on each failed strike.
  - Interactive click ping rings and gentle cursor link attraction.
- **Layer C (Data Rain Margins)**:
  - Outer 14% left and right viewport columns stream real CICIDS2017 feature names, protocol ports, and float32 hex representations.
  - Toggleable via interactive CLI drawer command `matrix on|off`.
- **Adaptive Performance Loop**:
  - Frame time monitors rendering latency. If rolling average exceeds 28ms, quality downgrades to half particle/node counts; recovers automatically after 180 healthy frames.

### 7.3 Creative Features & Page Implementations (Phase 3)
- **Boot Sequence (`BootSequence.tsx`)**: Realistic terminal boot loader displaying live model metadata and holdout size on first session visit. Auto-skips on return visits, `noboot` query parameter, or `prefers-reduced-motion`.
- **Interactive CLI Drawer (`TerminalDrawer.tsx`)**: Activated via `` ` `` (backtick) or `Ctrl+K`. Features comprehensive command suite: `help`, `goto <route>`, `run demo`, `status`, `classes`, `explain [case]`, `theme <name>`, `matrix on|off`, `scope`, `whoami`, `clear`, `exit`.
- **Text Decrypt Effect (`DecryptText.tsx`)**: 600ms random glyph resolving left-to-right on page headers.
- **Overview Page (`Overview.tsx`)**: ASCII block art banner (`SENTINEL`), blinking terminal cursor heading, bracket KPI telemetry cards, hoverable taxonomy strip driving background weight transitions.
- **Analyze Page (`Analyze.tsx`)**: Terminal window titlebar `[ analyze.sh ]`, streaming ingestion log, Nmap-style scan report with ASCII character proportion bars (`[████████████████████]`), and interactive D3 confidence histogram with draggable cutoff threshold.
- **Threats Page (`Threats.tsx`)**: Inventory log `[ threats_inventory.log ]`, bracket category chips, side drawer with real-time float32 hex dump view (`offset | hex bytes | feature name | value`).
- **Explain Page (`Explain.tsx`)**: Interactive case study selection, monospace D3 waterfall attribution plot with phosphor hover glow, Destination Port telemetry gauge, ranked RF MDI global importance ladder, and Rule R3 SHAP causation disclaimer note.
- **Compare Page (`Compare.tsx`)**: Square confusion matrix heatmap with raw counts and normalized recall toggles, D3 log-log latency vs. throughput trade-off scatter plot, per-class breakdown with SVM quadratic bottleneck callout.
- **Method Page (`Method.tsx`)**: R5 data funnel stages with animated spine, reproducible split ratios, and 4-domain feature schema browser.
- **Limits Page (`Limits.tsx`)**: 5 operational cybersecurity boundary panels in terminal bracket cards.
- **Konami Code Easter Egg**: Typing `↑ ↑ ↓ ↓ ← → ← → B A` activates Red-Team theme and triggers DDoS visual vortex in the background engine.

### 7.4 Verification & Compliance (Phase 4)
- **Tests & Linters**: All 26 pytest unit and integration tests passing (`make test`). Ruff clean (`make lint`). TypeScript build clean (`npm run build`).
- **Rules Compliance**:
  - R1: `src/nids/` and `models/` untouched.
  - R2: Zero invented numbers, metrics, or IPs. Dynamic counts labeled `REPLAY`.
  - R3: SHAP attribution margin note present beside all attribution charts.
  - R4: Sample size $n$ and PortScan low support marker displayed on all per-class cards.
  - R5: Code-verified data pipeline funnel documented.
  - R6: No emoji, restrained phosphor glow, no gradients on buttons, no glassmorphism.
- **Visual Auditing**: High-resolution screenshots captured across all 7 routes at desktop (1440px) and mobile (390px) viewports stored in `reports/screenshots/`.
