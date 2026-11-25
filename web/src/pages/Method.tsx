import React, { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { fetchDataset, DatasetResponse } from "../api/client";
import { DecryptText } from "../components/DecryptText";

gsap.registerPlugin(ScrollTrigger);

interface FeatureInfo {
  name: string;
  domain: string;
  mean: string;
  std: string;
  description: string;
}

const SCHEMA_FEATURES: FeatureInfo[] = [
  // Flow Timing & Rates
  {
    name: "Flow Duration",
    domain: "Flow Timing & Rates",
    mean: "14,785,200 µs",
    std: "33,652,100 µs",
    description: "Total duration of the bidirectional network flow in microseconds from handshake to teardown.",
  },
  {
    name: "Flow IAT Mean",
    domain: "Flow Timing & Rates",
    mean: "1,298,400 µs",
    std: "4,512,000 µs",
    description: "Mean inter-arrival time between consecutive packets observed in the flow.",
  },
  {
    name: "Fwd IAT Max",
    domain: "Flow Timing & Rates",
    mean: "3,105,200 µs",
    std: "10,240,000 µs",
    description: "Maximum inter-arrival time between consecutive packets sent in the forward direction.",
  },
  {
    name: "Bwd Packets/s",
    domain: "Flow Timing & Rates",
    mean: "4,120.5 pkts/s",
    std: "32,800.0 pkts/s",
    description: "Number of backward packets transmitted per second; anomalous spikes indicate flood attacks.",
  },

  // Packet Length & Statistics
  {
    name: "Destination Port",
    domain: "Flags & Protocol Boundaries",
    mean: "8,079.2",
    std: "18,234.1",
    description: "Destination port number identifying network service (e.g., 21 FTP, 22 SSH, 80 HTTP, 443 HTTPS).",
  },
  {
    name: "Average Packet Size",
    domain: "Packet Length & Statistics",
    mean: "191.8 bytes",
    std: "331.7 bytes",
    description: "Average size of all observed packets within the bidirectional flow.",
  },
  {
    name: "Packet Length Mean",
    domain: "Packet Length & Statistics",
    mean: "171.9 bytes",
    std: "298.5 bytes",
    description: "Mean length of packets in bytes across both transmission directions.",
  },
  {
    name: "Packet Length Variance",
    domain: "Packet Length & Statistics",
    mean: "128,450.0",
    std: "410,200.0",
    description: "Statistical variance in packet lengths; low variance characterizes automated brute force or beaconing.",
  },
  {
    name: "Max Packet Length",
    domain: "Packet Length & Statistics",
    mean: "948.2 bytes",
    std: "1,840.0 bytes",
    description: "Maximum packet length observed in either forward or reverse direction.",
  },
  {
    name: "Fwd Packet Length Mean",
    domain: "Packet Length & Statistics",
    mean: "58.4 bytes",
    std: "186.2 bytes",
    description: "Mean length of forward packets transmitted from client to destination service.",
  },
  {
    name: "Bwd Packet Length Mean",
    domain: "Packet Length & Statistics",
    mean: "245.8 bytes",
    std: "512.4 bytes",
    description: "Mean length of backward response packets returned by target server.",
  },

  // Subflow & Volume
  {
    name: "Subflow Fwd Bytes",
    domain: "Subflow & Volume",
    mean: "549.3 bytes",
    std: "9,940.0 bytes",
    description: "Total bytes transmitted in forward subflow direction.",
  },
  {
    name: "Total Length of Fwd Packets",
    domain: "Subflow & Volume",
    mean: "549.3 bytes",
    std: "9,940.0 bytes",
    description: "Accumulated payload and header bytes in client-initiated packets.",
  },
  {
    name: "Total Length of Bwd Packets",
    domain: "Subflow & Volume",
    mean: "16,160.0 bytes",
    std: "2,263,000.0 bytes",
    description: "Accumulated payload and header bytes in server-transmitted responses.",
  },
  {
    name: "Subflow Bwd Packets",
    domain: "Subflow & Volume",
    mean: "10.35 pkts",
    std: "998.4 pkts",
    description: "Average number of packets observed in reverse subflow session.",
  },

  // Flags & Structural Headers
  {
    name: "min_seg_size_forward",
    domain: "Flags & Protocol Boundaries",
    mean: "26.4 bytes",
    std: "7.8 bytes",
    description: "Minimum segment size observed in forward transmission direction.",
  },
  {
    name: "PSH Flag Count",
    domain: "Flags & Protocol Boundaries",
    mean: "0.28",
    std: "0.45",
    description: "Frequency of TCP PUSH flags forcing immediate buffer transmission to the application layer.",
  },
  {
    name: "Init_Win_bytes_forward",
    domain: "Flags & Protocol Boundaries",
    mean: "7,820.0 bytes",
    std: "13,400.0 bytes",
    description: "Initial TCP window size advertised in forward SYN packet.",
  },
];

export const Method: React.FC = () => {
  const [datasetData, setDatasetData] = useState<DatasetResponse | null>(null);
  const [activeDomain, setActiveDomain] = useState<string>("All");
  const [expandedFeature, setExpandedFeature] = useState<string | null>(null);

  const pathRef = useRef<SVGPathElement | null>(null);
  const funnelContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchDataset()
      .then((res) => setDatasetData(res))
      .catch((err) => console.error("Could not fetch dataset metadata:", err));
  }, []);

  // GSAP ScrollTrigger for animated funnel path drawing
  useEffect(() => {
    if (!pathRef.current || !funnelContainerRef.current) return;

    const path = pathRef.current;
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;

    const anim = gsap.to(path, {
      strokeDashoffset: 0,
      ease: "none",
      scrollTrigger: {
        trigger: funnelContainerRef.current,
        start: "top center",
        end: "bottom bottom",
        scrub: 0.5,
      },
    });

    return () => {
      anim.kill();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, [datasetData]);

  const domains = ["All", "Flow Timing & Rates", "Packet Length & Statistics", "Subflow & Volume", "Flags & Protocol Boundaries"];

  const filteredFeatures = SCHEMA_FEATURES.filter((f) => {
    if (activeDomain === "All") return true;
    return f.domain === activeDomain;
  });

  return (
    <div style={{ maxWidth: 1380, margin: "0 auto", padding: "2rem 1.5rem 5rem" }}>
      {/* Header Window */}
      <div className="terminal-window" style={{ padding: "2rem", marginBottom: "2rem" }}>
        <div className="terminal-titlebar" style={{ margin: "-2rem -2rem 1.5rem -2rem" }}>
          <div className="terminal-dots">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-title">[ method.pipeline ]</span>
          </div>
          <div className="terminal-path">/etc/dataset/provenance.md</div>
        </div>

        <h1 style={{ margin: "0 0 0.5rem 0" }}>
          &gt; <DecryptText text="Deterministic Data Pipeline &amp; Ingestion Funnel" />
          <span className="blinking-cursor" />
        </h1>
        <p style={{ color: "var(--dim)", fontSize: "0.85rem", maxWidth: 780, margin: 0 }}>
          Tracking the exact deterministic audit trail from UNB CICIDS2017 raw packet dumps to
          stratified cross-validation partitions (R5). Every transformation is recorded in code.
        </p>
      </div>

      {/* Raw Ingestion Files Audit Table Window */}
      <div className="terminal-window" style={{ overflowX: "auto", marginBottom: "2.5rem" }}>
        <div className="terminal-titlebar">
          <span className="terminal-title">[ raw_capture_dumps.sha256 ]</span>
          <span className="terminal-path">unb.ca/cic/ids-2017</span>
        </div>
        <div className="terminal-content" style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)", background: "rgba(10, 16, 12, 0.95)", color: "var(--dim)" }}>
                <th style={{ padding: "0.7rem 1rem", textAlign: "left", fontWeight: 500 }}>CAPTURE FILE</th>
                <th style={{ padding: "0.7rem 1rem", textAlign: "left", fontWeight: 500 }}>RAW FLOWS</th>
                <th style={{ padding: "0.7rem 1rem", textAlign: "left", fontWeight: 500 }}>SIZE</th>
                <th style={{ padding: "0.7rem 1rem", textAlign: "left", fontWeight: 500 }}>THREAT LABELS</th>
                <th style={{ padding: "0.7rem 1rem", textAlign: "left", fontWeight: 500 }}>SHA-256 HASH</th>
              </tr>
            </thead>
            <tbody>
              {datasetData?.raw_files.map((rf) => (
                <tr key={rf.name} style={{ borderBottom: "1px solid rgba(124, 255, 155, 0.06)" }}>
                  <td style={{ padding: "0.7rem 1rem", color: "var(--phosphor)" }}>{rf.name}</td>
                  <td style={{ padding: "0.7rem 1rem", fontVariantNumeric: "tabular-nums" }}>
                    {rf.total_rows.toLocaleString()}
                  </td>
                  <td style={{ padding: "0.7rem 1rem" }}>{rf.size_mb} MB</td>
                  <td style={{ padding: "0.7rem 1rem", color: "var(--text)" }}>{rf.threat_types.join(", ")}</td>
                  <td style={{ padding: "0.7rem 1rem", color: "var(--dim)", fontSize: "0.7rem" }}>
                    {rf.sha256.slice(0, 16)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scroll-Driven Data Funnel (R5) */}
      <div ref={funnelContainerRef} style={{ marginBottom: "3rem" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--dim)", marginBottom: "1rem" }}>
          :: PIPELINE TRANSFORMATION STAGES (R5 AUDIT TRAIL) ::
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", position: "relative" }}>
          {/* Animated SVG Spine */}
          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <svg
              style={{
                position: "absolute",
                top: 20,
                bottom: 20,
                width: 2,
                height: "calc(100% - 40px)",
                overflow: "visible",
              }}
            >
              <line x1="1" y1="0" x2="1" y2="100%" stroke="var(--line)" strokeWidth="1" />
              <path ref={pathRef} d="M 1 0 L 1 1000" fill="none" stroke="var(--phosphor)" strokeWidth="2" />
            </svg>
          </div>

          {/* Stages List */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {datasetData?.funnel_stages.map((stg, idx) => (
              <div key={stg.stage} className="terminal-window bracket-box" style={{ margin: 0 }}>
                <div className="terminal-titlebar">
                  <span className="terminal-title">[ STAGE 0{idx + 1}: {stg.stage.toUpperCase()} ]</span>
                  <span className="terminal-path" style={{ fontVariantNumeric: "tabular-nums", color: "var(--phosphor)" }}>
                    {stg.count.toLocaleString()} flows
                  </span>
                </div>
                <div className="terminal-content" style={{ padding: "1rem 1.25rem" }}>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text)", lineHeight: 1.5 }}>
                    {stg.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Schema Browser */}
      <div className="terminal-window">
        <div className="terminal-titlebar">
          <span className="terminal-title">[ telemetry_dictionary.def ]</span>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {domains.map((d) => (
              <button
                key={d}
                onClick={() => setActiveDomain(d)}
                style={{
                  background: activeDomain === d ? "rgba(124, 255, 155, 0.15)" : "transparent",
                  borderColor: activeDomain === d ? "var(--phosphor)" : "var(--line)",
                  color: activeDomain === d ? "var(--phosphor)" : "var(--dim)",
                  padding: "0.2rem 0.5rem",
                  fontSize: "0.68rem",
                }}
              >
                [ {d.toUpperCase()} ]
              </button>
            ))}
          </div>
        </div>

        <div className="terminal-content">
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {filteredFeatures.map((feat) => {
              const isOpen = expandedFeature === feat.name;
              return (
                <div
                  key={feat.name}
                  onClick={() => setExpandedFeature(isOpen ? null : feat.name)}
                  style={{
                    border: `1px solid ${isOpen ? "var(--phosphor)" : "var(--line)"}`,
                    padding: "0.75rem 1rem",
                    background: "rgba(5, 8, 6, 0.5)",
                    cursor: "crosshair",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--phosphor)", fontWeight: 500, fontSize: "0.82rem" }}>
                      &gt; {feat.name}
                    </span>
                    <div style={{ fontSize: "0.75rem", color: "var(--dim)", display: "flex", gap: "1rem" }}>
                      <span>Domain: {feat.domain}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text)" }}>Mean: {feat.mean}</span>
                    </div>
                  </div>

                  {isOpen && (
                    <div
                      style={{
                        marginTop: "0.75rem",
                        paddingTop: "0.5rem",
                        borderTop: "1px dashed var(--line)",
                        fontSize: "0.8rem",
                        color: "var(--text)",
                        lineHeight: 1.5,
                      }}
                    >
                      <p style={{ margin: "0 0 0.35rem 0" }}>{feat.description}</p>
                      <div style={{ fontSize: "0.72rem", color: "var(--dim)" }}>
                        Standard Deviation: {feat.std}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
