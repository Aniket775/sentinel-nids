# Model Card: Sentinel Network Intrusion Detection System (NIDS)

## 1. Model Details
- **Model Name**: Sentinel NIDS Classifier
- **Model Architecture**: Ensemble Decision Trees / Gradient Boosted Trees (evaluated against Random Forest, SVM, and XGBoost)
- **Input Features**: 25 top statistical network bidirectional flow attributes (extracted via CICFlowMeter)
- **Target Output**: 4-class categorical classification:
  1. `Normal` (Legitimate network traffic)
  2. `DDoS` (Volumetric distributed denial of service attack)
  3. `PortScan` (Reconnaissance port probing)
  4. `BruteForce` (Automated credential enumeration against FTP/SSH daemons)
- **Framework**: Scikit-Learn 1.9+, XGBoost 3.4+, Joblib
- **Explainability**: SHAP (Shapley Additive Explanations) TreeExplainer
- **Release Version**: 1.0.0 (Offline Research Prototype)

---

## 2. Intended Use & Operational Boundaries
- **Primary Intended Use**: Offline, dataset-based academic intrusion analysis, flow threat classification, and security analytics evaluation.
- **Out of Scope & Prohibited Use**:
  - Live kernel packet sniffing or promiscuous NIC capture.
  - Autonomous firewall alteration or automated connection dropping.
  - Standalone mission-critical production perimeter defense.
  - Guaranteeing detection of zero-day attacks or novel exploit payloads.

---

## 3. Training & Evaluation Data
- **Source**: CICIDS2017 Benchmark Dataset (Canadian Institute for Cybersecurity, University of New Brunswick).
- **Files Utilized**:
  - `Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv`
  - `Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv`
  - `Tuesday-WorkingHours.pcap_ISCX.csv`
- **Data Hygiene**:
  - Explicit removal of non-generalizable network identifiers: `Flow ID`, `Source IP`, `Destination IP`, `Source Port`, and `Timestamp` to eliminate label leakage.
  - Conversion of numeric infinities (`+inf`, `-inf`) to NaN, imputed using training-fold medians.
  - Complete elimination of duplicate records and zero-variance features.
- **Split Strategy**: Stratified 70% Training, 15% Validation, 15% Holdout Test (Fixed random seed: 42).

---

## 4. Evaluation Protocol & Metrics
Evaluation prioritizes **Macro-averaged F1-Score** and **Per-Class Recall** alongside overall Accuracy. In intrusion detection, high accuracy can be misleading due to benign traffic dominance (>80-90%); capturing rare minority attacks (such as BruteForce) is critical.

---

## 5. False Positive & False Negative Considerations
- **Potential False Positives**:
  - High-concurrency legitimate transfers (e.g., multi-threaded HTTP/2 downloads, BitTorrent, large database migrations) displaying high `Flow Packets/s` or `Flow Bytes/s` can trigger false DDoS alerts.
  - Network discovery tools or health-check monitors querying open ports may trigger PortScan alerts.
- **Potential False Negatives**:
  - Low-and-slow brute force attacks that throttle attempts below statistical thresholds.
  - Evasive volumetric attacks employing random packet sizes and artificial jitter.

---

## 6. Caveats & Ethical Guardrails
- **No Payload Inspection**: The model examines statistical flow metrics (packet lengths, inter-arrival variance, flag counts). It does not decrypt TLS/SSL payloads or inspect HTTP application layers.
- **Dataset Shift**: Statistical flow distributions generated in synthetic testbeds (such as CICIDS2017) do not directly mirror dynamic modern cloud/enterprise traffic without retraining and calibration.
- **Explainability vs. Causality**: SHAP feature attributions identify statistical feature weights contributing to mathematical output scores. They do **not** represent verified network-level causal proof.
