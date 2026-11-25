import React from "react";
import { DecryptText } from "../components/DecryptText";

interface LimitItem {
  id: string;
  num: string;
  title: string;
  category: string;
  reality: string;
  technicalDepth: string;
  mitigation: string;
}

const OPERATIONAL_BOUNDARIES: LimitItem[] = [
  {
    id: "offline-flow",
    num: "01",
    title: "Offline Batch Flow Analysis (No Inline Packet Capture)",
    category: "SCOPE & TOPOLOGY",
    reality:
      "Sentinel NIDS operates exclusively on bidirectional NetFlow/IPFIX CSV dumps post-capture. It does not bind raw promiscuous sockets (AF_PACKET, libpcap) or terminate live TCP connections.",
    technicalDepth:
      "Because inference runs on pre-aggregated flow tuples, the system cannot drop in-flight malicious packets or disrupt an ongoing exploit payload before TCP FIN/RST occurs.",
    mitigation:
      "Integrate an inline packet processing pipeline (such as DPDK or eBPF/XDP) that feeds high-frequency flow records to an in-memory queue (e.g. Redis Stream or Kafka) coupled with streaming inference workers.",
  },
  {
    id: "testbed-artifacts",
    num: "02",
    title: "Synthesised Closed-Testbed Attack Artifacts",
    category: "DATASET PROVENANCE",
    reality:
      "CICIDS2017 benchmark attacks were executed in an isolated Canadian Institute for Cybersecurity lab environment using scripted tools (ARES, Patator, Slowloris).",
    technicalDepth:
      "Adversarial behavior in production networks exhibits polymorphic payload shaping, randomized jitter, low-and-slow exfiltration, and domain generation algorithms (DGAs) absent from 2017 lab dumps.",
    mitigation:
      "Employ continuous adversarial retraining on multi-source threat telemetry (e.g., modern Zeek/Suricata enterprise logs) and perform regular red-team evaluations to surface blind spots.",
  },
  {
    id: "extraction-latency",
    num: "03",
    title: "Feature Extraction Latency & Flow Boundary Delay",
    category: "FEATURE TIMING",
    reality:
      "CICFlowMeter calculates 78+ statistical aggregates (e.g., Flow Duration, Fwd IAT Std, Packet Length Variance) only after observing bidirectional session termination.",
    technicalDepth:
      "For persistent TCP streams or long-lived botnet C2 sessions, the flow remains un-aggregated for minutes or hours, creating a structural delay between intrusion initiation and detection alert.",
    mitigation:
      "Implement sliding-window early-flow detection algorithms that compute feature approximations across the initial N packets (e.g. first 5 to 20 packets) to flag attacks within milliseconds of session initiation.",
  },
  {
    id: "class-imbalance",
    num: "04",
    title: "Extreme Class Imbalance & PortScan Minority Representation",
    category: "STATISTICAL RELIABILITY (R4)",
    reality:
      "In the audited 150,000-flow dataset partition, PortScan accounts for only 213 total records (32 in the holdout test set), compared to 117,606 Normal flows.",
    technicalDepth:
      "While tree models (Random Forest, XGBoost) achieve 100% test recall on these 32 records, the small sample size induces wide 95% Clopper-Pearson confidence intervals [89.1%, 100%]. SVM experiences precision collapse (13.8%) due to boundary sensitivity.",
    mitigation:
      "Deploy cost-sensitive loss penalties, targeted SMOTE/GAN synthetic oversampling with topological validation, and enforce strict reporting of confidence intervals rather than point metrics.",
  },
  {
    id: "concept-drift",
    num: "05",
    title: "Temporal Protocol Evolution & Concept Drift",
    category: "MODEL LONGEVITY",
    reality:
      "Models trained on 2017 network traffic lack familiarity with contemporary transport standards such as HTTP/3, QUIC (UDP-based encrypted transport), and encrypted SNI (ESNI/ECH).",
    technicalDepth:
      "Statistical metrics like packet length distributions and inter-arrival intervals shift fundamentally when traffic migrates from cleartext TCP to QUIC multiplexing, eroding decision tree splits.",
    mitigation:
      "Establish automated Kolmogorov-Smirnov and Population Stability Index (PSI) drift monitoring on incoming telemetry streams, triggering automated active-learning retraining pipelines when feature distributions diverge.",
  },
];

export const Limits: React.FC = () => {
  return (
    <div style={{ maxWidth: 1380, margin: "0 auto", padding: "2rem 1.5rem 5rem" }}>
      {/* Header Window */}
      <div className="terminal-window" style={{ padding: "2rem", marginBottom: "2rem" }}>
        <div className="terminal-titlebar" style={{ margin: "-2rem -2rem 1.5rem -2rem" }}>
          <div className="terminal-dots">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-title">[ limits.sec ]</span>
          </div>
          <div className="terminal-path">/etc/security/boundaries.conf</div>
        </div>

        <h1 style={{ margin: "0 0 0.5rem 0" }}>
          &gt; <DecryptText text="System Operational Boundaries &amp; Engineering Constraints" />
          <span className="blinking-cursor" />
        </h1>
        <p style={{ color: "var(--dim)", fontSize: "0.85rem", maxWidth: 820, margin: 0 }}>
          Machine learning applied to cybersecurity demands explicit documentation of failure modes and topological boundaries.
          Below are the five engineering constraints defining this offline research prototype and their production mitigations.
        </p>
      </div>

      {/* 5 Operational Boundary Panels */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        {OPERATIONAL_BOUNDARIES.map((item) => (
          <div key={item.id} className="terminal-window bracket-box" style={{ margin: 0 }}>
            <div className="terminal-titlebar">
              <span className="terminal-title">
                [ BOUNDARY {item.num} // {item.category} ]
              </span>
              <span className="terminal-path">AUDIT_ID: {item.id.toUpperCase()}</span>
            </div>

            <div className="terminal-content">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                  gap: "1.5rem",
                }}
              >
                {/* Left: Engineering Reality */}
                <div>
                  <h3 style={{ color: "var(--phosphor)", fontSize: "1.1rem", marginBottom: "0.5rem" }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                    {item.reality}
                  </p>
                  <p style={{ fontSize: "0.78rem", color: "var(--dim)", lineHeight: 1.5, margin: 0 }}>
                    {item.technicalDepth}
                  </p>
                </div>

                {/* Right: Concrete Mitigation */}
                <div
                  style={{
                    borderLeft: "1px dashed var(--line)",
                    paddingLeft: "1.5rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ fontSize: "0.7rem", color: "var(--normal)", fontWeight: 500, marginBottom: "0.4rem" }}>
                    :: MITIGATION RECOMMENDATION ::
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text)", lineHeight: 1.6, margin: 0 }}>
                    {item.mitigation}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
