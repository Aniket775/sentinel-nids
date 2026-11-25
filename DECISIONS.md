# Architecture and Engineering Decisions Record (DECISIONS.md)

## Project: Network Intrusion Detection System (NIDS)

This document records the foundational architectural decisions, dataset assumptions, technical trade-offs, and operational guardrails established for this project.

---

### Decision 1: Target Scope and Operational Boundary
- **Context**: NIDS can range from live packet capture/inline firewall blocking to offline dataset-driven threat classification.
- **Decision**: Scope Version 1 strictly as an **offline, dataset-based ML intrusion detection and analysis system**. The system accepts network-flow CSV records (e.g., CICFlowMeter outputs), validates schema, executes an end-to-end trained ML pipeline across 4 target classes, and outputs prediction confidence, threat breakdowns, and SHAP explainability.
- **Rationale**: Live packet capture requires root/promiscuous privileges, OS-dependent libpcap drivers, and real-time streaming infrastructure, which distract from evaluating feature relevance, classification fidelity, class imbalance, and explainability on standard benchmark flows.
- **Guardrail**: No automated firewall modification, packet injection, or live packet capturing is included in v1.

---

### Decision 2: Target Taxonomy (4-Class Mapping)
- **Context**: CICIDS2017 contains over 14 attack labels across multiple days, many with subtle sub-variants (e.g., DoS Hulk, DoS GoldenEye, DoS Slowloris, Heartbleed, Infiltration, Web Attacks, Botnet).
- **Decision**: Enforce a strict 4-class taxonomy:
  1. `Normal` (from `BENIGN`)
  2. `DDoS` (from `DDoS`)
  3. `PortScan` (from `PortScan`)
  4. `BruteForce` (from `FTP-Patator` and `SSH-Patator`)
- **Rationale**: Focusing on these distinct attack vectors allows in-depth comparative evaluation between volumetric flood patterns (DDoS), reconnaissance probing (PortScan), and targeted credential enumeration (BruteForce) against standard normal traffic. All other attacks (e.g., Web Attacks, Botnet, Infiltration) are excluded from this 4-class training set to avoid noisy multi-label ambiguity and maintain documented class integrity.

---

### Decision 3: Handling Class Imbalance
- **Context**: Normal traffic overwhelmingly dominates network captures (>80-90%), while specific attacks (like BruteForce SSH/FTP) represent a fraction of total flows.
- **Decision**: 
  - Never resample validation or test splits.
  - Employ stratified train/validation/test splitting (70% train / 15% val / 15% test, seed 42).
  - On training data, evaluate class-weighted loss (`class_weight='balanced'` in RF and SVM; `sample_weight` in XGBoost) alongside controlled majority undersampling rather than blindly generating synthetic minority points via SMOTE across hundreds of thousands of flow features (which risks synthesizing impossible network packet dynamics).

---

### Decision 4: Algorithmic Comparison (RF vs. SVM vs. XGBoost)
- **Context**: We need to evaluate three distinct algorithm families: ensemble bagging (Random Forest), gradient boosting (XGBoost), and maximal-margin hyperplane classification (SVM).
- **Decision**:
  - Tree-based models (RF, XGBoost) natively handle raw feature distributions, non-linear feature splits, and rapid parallel inference.
  - SVM (`SVC(kernel='rbf')`) requires careful numeric standard scaling (`StandardScaler`) and $O(N^2)$ to $O(N^3)$ computational scaling. For large datasets, SVM training must be conducted on a stratified representative training sample (documented transparently) to ensure deterministic, bounded training time while still providing a rigorous fair comparison on the test set.

---

### Decision 5: Explainability with SHAP
- **Context**: Cybersecurity analysts need actionable feature attribution rather than a black-box label.
- **Decision**: Use `shap.TreeExplainer` on the selected tree-based model for global importance (summary beeswarm, mean |SHAP| bar plots) and local single-record water/force plots.
- **Guardrail**: Prominently disclose in the UI that SHAP provides *model feature attribution*, not verified network causality.

---

### Decision 6: Code Structure and Zero Duplication
- **Context**: Streamlit dashboards often suffer from inline data processing and duplicated ML logic.
- **Decision**: All data loading, cleaning, transformation, inference, and explainability logic resides strictly in `src/nids/`. The Streamlit application in `app/` strictly acts as a presentation and interaction layer calling the modular core APIs.
