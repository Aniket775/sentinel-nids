import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMetrics, MetricsResponse } from "../api/client";
import { useBackground } from "../bg/field";
import { DecryptText } from "../components/DecryptText";

const ASCII_BANNER = `
 ███████╗███████╗███╗   ██╗████████╗██╗███╗   ██╗███████╗██╗     
 ██╔════╝██╔════╝████╗  ██║╚══██╔══╝██║████╗  ██║██╔════╝██║     
 ███████╗█████╗  ██╔██╗ ██║   ██║   ██║██╔██╗ ██║█████╗  ██║     
 ╚════██║██╔══╝  ██║╚██╗██║   ██║   ██║██║╚██╗██║██╔══╝  ██║     
 ███████║███████╗██║ ╚████║   ██║   ██║██║ ╚████║███████╗███████╗
 ╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝
`;

export const Overview: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const { hoverClass } = useBackground();

  useEffect(() => {
    fetchMetrics()
      .then((data) => setMetrics(data))
      .catch((err) => console.error("Failed to fetch metrics:", err));
  }, []);

  return (
    <div style={{ maxWidth: 1380, margin: "0 auto", padding: "2rem 1.5rem 5rem" }}>
      {/* Block ASCII Art Banner */}
      <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
        <pre
          aria-hidden="true"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(0.45rem, 1vw, 0.75rem)",
            lineHeight: 1.15,
            color: "var(--phosphor)",
            textShadow: "0 0 6px var(--phosphor-glow)",
            margin: 0,
            userSelect: "none",
          }}
        >
          {ASCII_BANNER}
        </pre>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
            color: "var(--dim)",
            letterSpacing: "0.15em",
            marginTop: "0.5rem",
          }}
        >
          :: blue team // offline flow analysis &amp; threat attribution ::
        </div>
      </div>

      {/* Main Hero Header */}
      <div
        className="terminal-window"
        style={{
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <div className="terminal-titlebar" style={{ margin: "-2rem -2rem 1.5rem -2rem" }}>
          <div className="terminal-dots">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-title">[ sys_overview.sh ]</span>
          </div>
          <div className="terminal-path">/proc/net/sentinel/status</div>
        </div>

        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--dim)", marginBottom: "0.75rem" }}>
          [ CICIDS2017 BENCHMARK // OFFLINE TELEMETRY AUDIT ]
        </div>

        <h1 style={{ margin: "0 0 1rem 0" }}>
          &gt; <DecryptText text="Supervised Flow Intrusion Detection" />
          <span className="blinking-cursor" />
        </h1>

        <p
          style={{
            color: "var(--text)",
            maxWidth: 820,
            fontSize: "0.95rem",
            lineHeight: 1.6,
            margin: "0 0 1.5rem 0",
          }}
        >
          Evaluating multi-class network flow anomalies against the Canadian Institute for Cybersecurity
          CICIDS2017 benchmark. The engine processes pre-aggregated bidirectional IPFIX/NetFlow records, isolates
          volumetric floods, reconnaissance sweeps, and credential enumeration, and outputs mathematically grounded SHAP explanations.
        </p>

        {/* Quick Action Buttons */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link to="/analyze" className="terminal-btn">
            [ RUN FLOW ANALYSIS ]
          </Link>
          <Link to="/threats" className="terminal-btn">
            [ VIEW DETECTED THREATS ]
          </Link>
          <Link to="/explain" className="terminal-btn">
            [ SHAP ATTRIBUTION ]
          </Link>
          <Link to="/compare" className="terminal-btn">
            [ BENCHMARK COMPARISON ]
          </Link>
        </div>
      </div>

      {/* Headline KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "1.25rem",
          marginBottom: "2.5rem",
        }}
      >
        {/* KPI 1 */}
        <div className="terminal-window bracket-box" style={{ margin: 0 }}>
          <div className="terminal-titlebar">
            <span className="terminal-title">[ MACRO_F1 ]</span>
            <span className="terminal-path">metric.f1</span>
          </div>
          <div className="terminal-content">
            <div style={{ fontSize: "2.4rem", color: "var(--phosphor)", textShadow: "0 0 6px var(--phosphor-glow)" }}>
              {metrics ? metrics.macro_f1.toFixed(4) : "0.9958"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--dim)", marginTop: "0.25rem" }}>
              Champion Model: {metrics?.champion_model || "XGBoost"}
            </div>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="terminal-window bracket-box" style={{ margin: 0 }}>
          <div className="terminal-titlebar">
            <span className="terminal-title">[ TEST_ACCURACY ]</span>
            <span className="terminal-path">eval.acc</span>
          </div>
          <div className="terminal-content">
            <div style={{ fontSize: "2.4rem", color: "var(--phosphor)", textShadow: "0 0 6px var(--phosphor-glow)" }}>
              {metrics ? `${(metrics.accuracy * 100).toFixed(2)}%` : "99.99%"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--dim)", marginTop: "0.25rem" }}>
              Weighted-F1: {metrics ? metrics.weighted_f1.toFixed(4) : "0.9999"}
            </div>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="terminal-window bracket-box" style={{ margin: 0 }}>
          <div className="terminal-titlebar">
            <span className="terminal-title">[ TEST_SAMPLE_N ]</span>
            <span className="terminal-path">holdout.size</span>
          </div>
          <div className="terminal-content">
            <div style={{ fontSize: "2.4rem", color: "var(--text)" }}>
              {metrics ? metrics.test_sample_size.toLocaleString() : "21,865"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--dim)", marginTop: "0.25rem" }}>
              Stratified 15% Holdout Partition
            </div>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="terminal-window bracket-box" style={{ margin: 0 }}>
          <div className="terminal-titlebar">
            <span className="terminal-title">[ INFERENCE_RATE ]</span>
            <span className="terminal-path">speed.ops</span>
          </div>
          <div className="terminal-content">
            <div style={{ fontSize: "2.4rem", color: "var(--normal)" }}>
              ~917k <span style={{ fontSize: "1rem" }}>flows/s</span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--dim)", marginTop: "0.25rem" }}>
              Latency: {metrics ? `${(metrics.inference_time_sec * 1000).toFixed(1)}ms` : "23.8ms"} / 21.8k rows
            </div>
          </div>
        </div>
      </div>

      {/* Target Taxonomy Strip */}
      <div className="terminal-window" style={{ marginBottom: "2.5rem" }}>
        <div className="terminal-titlebar">
          <div className="terminal-dots">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-title">[ taxonomy_matrix.conf ]</span>
          </div>
          <div className="terminal-path">/etc/sentinel/classes</div>
        </div>

        <div className="terminal-content" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--dim)", marginBottom: "1rem" }}>
            HOVER OVER A THREAT CLASS TO ENGAGE SIMULATED PARTICLE VECTOR ON BACKGROUND:
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {/* Normal */}
            <div
              onMouseEnter={() => hoverClass("Normal")}
              onMouseLeave={() => hoverClass(null)}
              style={{
                border: "1px solid var(--line)",
                padding: "1rem",
                background: "rgba(5, 8, 6, 0.6)",
                cursor: "crosshair",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span className="badge-normal" style={{ fontSize: "0.9rem" }}>[ NORMAL ]</span>
                <span style={{ fontSize: "0.7rem", color: "var(--dim)" }}>n=17,641 test (117,606 total)</span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text)", lineHeight: 1.5 }}>
                Legitimate baseline network sessions (HTTP/HTTPS, DNS, NTP, routine background daemon flows).
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--dim)" }}>
                Precision: 99.99% | Recall: 99.99%
              </div>
            </div>

            {/* DDoS */}
            <div
              onMouseEnter={() => hoverClass("DDoS")}
              onMouseLeave={() => hoverClass(null)}
              style={{
                border: "1px solid var(--line)",
                padding: "1rem",
                background: "rgba(5, 8, 6, 0.6)",
                cursor: "crosshair",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span className="badge-ddos" style={{ fontSize: "0.9rem" }}>[ DDOS ]</span>
                <span style={{ fontSize: "0.7rem", color: "var(--dim)" }}>n=3,580 test (23,864 total)</span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text)", lineHeight: 1.5 }}>
                Distributed volumetric packet flood exhaustion targeting service availability.
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--dim)" }}>
                Precision: 99.97% | Recall: 100.00%
              </div>
            </div>

            {/* PortScan */}
            <div
              onMouseEnter={() => hoverClass("PortScan")}
              onMouseLeave={() => hoverClass(null)}
              style={{
                border: "1px solid var(--line)",
                padding: "1rem",
                background: "rgba(5, 8, 6, 0.6)",
                cursor: "crosshair",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span className="badge-portscan" style={{ fontSize: "0.9rem" }}>[ PORTSCAN ]</span>
                <span style={{ fontSize: "0.7rem", color: "var(--portscan)" }}>n=32 test (213 total, low support)</span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text)", lineHeight: 1.5 }}>
                Host and service reconnaissance sweeps probing open network listener boundaries.
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--dim)" }}>
                Precision: 100.00% | Recall: 96.88%
              </div>
            </div>

            {/* BruteForce */}
            <div
              onMouseEnter={() => hoverClass("BruteForce")}
              onMouseLeave={() => hoverClass(null)}
              style={{
                border: "1px solid var(--line)",
                padding: "1rem",
                background: "rgba(5, 8, 6, 0.6)",
                cursor: "crosshair",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span className="badge-bruteforce" style={{ fontSize: "0.9rem" }}>[ BRUTEFORCE ]</span>
                <span style={{ fontSize: "0.7rem", color: "var(--dim)" }}>n=612 test (4,082 total)</span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text)", lineHeight: 1.5 }}>
                Automated credential enumeration against remote administration daemons (SSH/FTP).
              </div>
              <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: "var(--dim)" }}>
                Precision: 100.00% | Recall: 99.84%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Editorial Provenance Note */}
      <div
        style={{
          borderLeft: "2px solid var(--phosphor)",
          paddingLeft: "1rem",
          fontSize: "0.8rem",
          color: "var(--dim)",
          lineHeight: 1.6,
        }}
      >
        <div style={{ color: "var(--phosphor)", fontWeight: 500, marginBottom: "0.25rem" }}>
          :: ARCHITECTURAL SCOPE BOUNDARY ::
        </div>
        Sentinel NIDS is an offline flow-diagnostic engine. It evaluates statistical bidirectional flow metrics generated post-capture
        by standard flow tools (CICFlowMeter). It does not capture promiscuous live packets, terminate TCP connections, or manipulate inline firewall tables.
      </div>
    </div>
  );
};
