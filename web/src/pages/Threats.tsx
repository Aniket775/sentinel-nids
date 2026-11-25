import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { runPrediction, PredictResponse } from "../api/client";
import { useBackground } from "../bg/field";
import { DecryptText } from "../components/DecryptText";

// Training set feature statistics for z-score estimation
const FEATURE_MEANS: Record<string, { mean: number; std: number }> = {
  "Destination Port": { mean: 8079.2, std: 18234.1 },
  "Flow Duration": { mean: 14785200.0, std: 33652100.0 },
  "Total Fwd Packets": { mean: 9.38, std: 749.6 },
  "Total Backward Packets": { mean: 10.35, std: 998.4 },
  "Total Length of Fwd Packets": { mean: 549.3, std: 9940.0 },
  "Total Length of Bwd Packets": { mean: 16160.0, std: 2263000.0 },
  "Fwd Packet Length Max": { mean: 207.6, std: 717.2 },
  "Fwd Packet Length Min": { mean: 14.1, std: 58.8 },
  "Fwd Packet Length Mean": { mean: 58.4, std: 186.2 },
  "Average Packet Size": { mean: 191.8, std: 331.7 },
  "Packet Length Mean": { mean: 171.9, std: 298.5 },
  "Subflow Fwd Bytes": { mean: 549.3, std: 9940.0 },
};

// Helper: Convert float to 4-byte uppercase hex string
const floatToHex32 = (val: number): string => {
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setFloat32(0, isNaN(val) ? 0 : val, false);
  const b0 = view.getUint8(0).toString(16).padStart(2, "0").toUpperCase();
  const b1 = view.getUint8(1).toString(16).padStart(2, "0").toUpperCase();
  const b2 = view.getUint8(2).toString(16).padStart(2, "0").toUpperCase();
  const b3 = view.getUint8(3).toString(16).padStart(2, "0").toUpperCase();
  return `${b0} ${b1} ${b2} ${b3}`;
};

export const Threats: React.FC = () => {
  const navigate = useNavigate();
  const { hoverClass } = useBackground();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PredictResponse | null>(() => {
    const saved = sessionStorage.getItem("sentinel_prediction_data");
    return saved ? JSON.parse(saved) : null;
  });

  const [selectedClass, setSelectedClass] = useState<string>("All");
  const [minConfidence, setMinConfidence] = useState<number>(0.0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const pageSize = 25;

  const [activeDrawerRow, setActiveDrawerRow] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!data) {
      setLoading(true);
      runPrediction({ demo: true })
        .then((res) => {
          setData(res);
          sessionStorage.setItem("sentinel_prediction_data", JSON.stringify(res));
        })
        .catch((err) => console.error("Could not load initial flows:", err))
        .finally(() => setLoading(false));
    }
  }, [data]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!data || !data.rows) return [];
    return data.rows.filter((row) => {
      if (selectedClass !== "All" && row.Predicted_Class !== selectedClass) {
        return false;
      }
      const conf = Number(row.Prediction_Confidence ?? 1.0);
      if (conf < minConfidence) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matches = Object.entries(row).some(([k, v]) => {
          return String(k).toLowerCase().includes(query) || String(v).toLowerCase().includes(query);
        });
        if (!matches) return false;
      }
      return true;
    });
  }, [data, selectedClass, minConfidence, searchQuery]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const currentRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page]);

  // Drawer top features with z-score
  const drawerStats = useMemo(() => {
    if (!activeDrawerRow) return [];
    const entries: Array<{ feature: string; val: number; zScore: number; hex: string }> = [];
    Object.entries(activeDrawerRow).forEach(([k, v]) => {
      if (k === "Predicted_Class" || k === "Prediction_Confidence") return;
      const numVal = Number(v);
      const hex = floatToHex32(numVal);
      if (!isNaN(numVal) && FEATURE_MEANS[k]) {
        const { mean, std } = FEATURE_MEANS[k];
        const z = std > 0 ? (numVal - mean) / std : 0;
        entries.push({ feature: k, val: numVal, zScore: z, hex });
      } else if (!isNaN(numVal)) {
        entries.push({ feature: k, val: numVal, zScore: 0, hex });
      }
    });

    return entries.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  }, [activeDrawerRow]);

  const getClassBadge = (c: string) => {
    switch (c) {
      case "Normal":
        return <span className="badge-normal">[ Normal ]</span>;
      case "DDoS":
        return <span className="badge-ddos">[ DDoS ]</span>;
      case "PortScan":
        return <span className="badge-portscan">[ PortScan ]</span>;
      case "BruteForce":
        return <span className="badge-bruteforce">[ BruteForce ]</span>;
      default:
        return <span>[ {c} ]</span>;
    }
  };

  return (
    <div style={{ maxWidth: 1380, margin: "0 auto", padding: "2rem 1.5rem 5rem" }}>
      {/* Header Window */}
      <div className="terminal-window" style={{ padding: "2rem", marginBottom: "2rem" }}>
        <div className="terminal-titlebar" style={{ margin: "-2rem -2rem 1.5rem -2rem" }}>
          <div className="terminal-dots">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-title">[ threats_inventory.log ]</span>
          </div>
          <div className="terminal-path">/var/log/sentinel/flows.db</div>
        </div>

        <h1 style={{ margin: "0 0 0.5rem 0" }}>
          &gt; <DecryptText text="Evaluated Threat Inventory" />
          <span className="blinking-cursor" />
        </h1>
        <p style={{ color: "var(--dim)", fontSize: "0.85rem", maxWidth: 780, margin: 0 }}>
          Auditing {data ? data.total_records.toLocaleString() : 0} classified flow records from {data?.source || "bundled dataset"}.
          Click any row to open the terminal telemetry drawer and inspect the float32 raw feature vector representation.
        </p>
      </div>

      {/* Terminal Filter Controls Bar */}
      <div
        className="terminal-window"
        style={{
          padding: "1rem 1.25rem",
          marginBottom: "1.5rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "1.25rem",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Category Chips */}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--dim)" }}>FILTER:</span>
          {["All", "Normal", "DDoS", "PortScan", "BruteForce"].map((cname) => {
            const active = selectedClass === cname;
            return (
              <button
                key={cname}
                onClick={() => {
                  setSelectedClass(cname);
                  setPage(1);
                }}
                onMouseEnter={() => {
                  if (cname !== "All") hoverClass(cname as any);
                }}
                onMouseLeave={() => hoverClass(null)}
                style={{
                  background: active ? "rgba(124, 255, 155, 0.15)" : "transparent",
                  borderColor: active ? "var(--phosphor)" : "var(--line)",
                  color: active ? "var(--phosphor)" : "var(--dim)",
                  padding: "0.25rem 0.6rem",
                  fontSize: "0.75rem",
                }}
              >
                [ {cname.toUpperCase()} {cname === "PortScan" ? "(low support)" : ""} ]
              </button>
            );
          })}
        </div>

        {/* Confidence Slider & Text Search */}
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--dim)" }}>
              MIN CONF: {(minConfidence * 100).toFixed(0)}%
            </span>
            <input
              type="range"
              min="0"
              max="0.99"
              step="0.05"
              value={minConfidence}
              onChange={(e) => {
                setMinConfidence(parseFloat(e.target.value));
                setPage(1);
              }}
              style={{ accentColor: "var(--phosphor)", width: 90, cursor: "crosshair" }}
            />
          </div>

          <input
            type="text"
            placeholder="search feature or value..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            style={{
              background: "var(--void)",
              border: "1px solid var(--line)",
              color: "var(--phosphor)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              padding: "0.3rem 0.6rem",
              width: 220,
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Status Line Above Table */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "0.72rem",
          color: "var(--dim)",
          marginBottom: "0.5rem",
        }}
      >
        <div>
          SHOWING {filteredRows.length.toLocaleString()} FLOWS (PAGE {page} OF {totalPages})
        </div>
        <div>[ CLICK ROW TO OPEN FLOAT32 FEATURE VECTOR ]</div>
      </div>

      {/* Terminal Flow Table */}
      <div className="terminal-window" style={{ overflowX: "auto", marginBottom: "1rem" }}>
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--dim)" }}>
            &gt; Reading flow evaluations from database...
          </div>
        ) : currentRows.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--dim)" }}>
            &gt; No flow records match the current filter criteria.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "0.78rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--line)",
                  background: "rgba(10, 16, 12, 0.9)",
                  color: "var(--dim)",
                }}
              >
                <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>#</th>
                <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>PREDICTION</th>
                <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>CONFIDENCE</th>
                <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>DST PORT</th>
                <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>DURATION (µs)</th>
                <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>FWD PKTS</th>
                <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>BWD PKTS</th>
                <th style={{ padding: "0.6rem 0.8rem", fontWeight: 500 }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {currentRows.map((row, idx) => {
                const globalIdx = (page - 1) * pageSize + idx;
                const cname = row.Predicted_Class || "Normal";
                const conf = Number(row.Prediction_Confidence ?? 1.0);

                return (
                  <tr
                    key={globalIdx}
                    onClick={() => setActiveDrawerRow(row)}
                    onMouseEnter={() => hoverClass(cname as any)}
                    onMouseLeave={() => hoverClass(null)}
                    style={{
                      borderBottom: "1px solid rgba(124, 255, 155, 0.06)",
                      cursor: "crosshair",
                      transition: "background var(--motion-fast) var(--ease-out)",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = "rgba(124, 255, 155, 0.04)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "0.6rem 0.8rem", color: "var(--dim)" }}>{globalIdx + 1}</td>
                    <td style={{ padding: "0.6rem 0.8rem" }}>
                      {getClassBadge(cname)}
                      {cname === "PortScan" && (
                        <span style={{ fontSize: "0.65rem", color: "var(--portscan)", marginLeft: 6 }}>
                          [low support]
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.6rem 0.8rem", fontVariantNumeric: "tabular-nums" }}>
                      {(conf * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: "0.6rem 0.8rem", color: "var(--phosphor)" }}>
                      {row["Destination Port"] ?? "-"}
                    </td>
                    <td style={{ padding: "0.6rem 0.8rem", fontVariantNumeric: "tabular-nums" }}>
                      {Number(row["Flow Duration"] || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.6rem 0.8rem" }}>{row["Total Fwd Packets"] ?? "-"}</td>
                    <td style={{ padding: "0.6rem 0.8rem" }}>{row["Total Backward Packets"] ?? "-"}</td>
                    <td style={{ padding: "0.6rem 0.8rem" }}>
                      <span style={{ color: "var(--phosphor)", fontSize: "0.72rem" }}>
                        [ INSPECT ]
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "0.72rem", color: "var(--dim)" }}>
          Page {page} of {totalPages}
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="terminal-btn"
            style={{ padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}
          >
            [ PREVIOUS ]
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="terminal-btn"
            style={{ padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}
          >
            [ NEXT ]
          </button>
        </div>
      </div>

      {/* Side Drawer Modal: Feature Vector (Float32 View) Hex Dump */}
      {activeDrawerRow && (
        <div
          style={{
            position: "fixed",
            top: 0,
            right: 0,
            bottom: 28, // above tmux bar
            width: "min(560px, 95vw)",
            background: "var(--void)",
            borderLeft: "2px solid var(--phosphor)",
            boxShadow: "-12px 0 32px rgba(0, 0, 0, 0.85)",
            zIndex: 92,
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            overflowY: "auto",
          }}
        >
          <div>
            {/* Drawer Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                borderBottom: "1px solid var(--line)",
                paddingBottom: "1rem",
                marginBottom: "1.25rem",
              }}
            >
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--dim)" }}>
                  FLOW TELEMETRY DUMP
                </div>
                <h3 style={{ fontSize: "1.3rem", color: "var(--phosphor)", margin: "0.25rem 0" }}>
                  {getClassBadge(activeDrawerRow.Predicted_Class)} ({(Number(activeDrawerRow.Prediction_Confidence ?? 1.0) * 100).toFixed(2)}%)
                </h3>
              </div>
              <button
                onClick={() => setActiveDrawerRow(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--dim)",
                  cursor: "crosshair",
                  fontSize: "1.2rem",
                }}
              >
                [X]
              </button>
            </div>

            {/* Feature Vector (Float32 View) Hex Dump Panel */}
            <div className="terminal-window" style={{ marginBottom: "1.5rem" }}>
              <div className="terminal-titlebar">
                <span className="terminal-title">[ feature vector (float32 view) ]</span>
                <span className="terminal-path">mem://flow/offset</span>
              </div>
              <div
                className="terminal-content"
                style={{
                  padding: "0.75rem",
                  fontSize: "0.72rem",
                  fontFamily: "var(--font-tabular)",
                  lineHeight: 1.6,
                  maxHeight: 320,
                  overflowY: "auto",
                  background: "var(--panel)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "60px 105px 1fr 85px",
                    color: "var(--dim)",
                    borderBottom: "1px dashed var(--line)",
                    paddingBottom: "0.3rem",
                    marginBottom: "0.4rem",
                  }}
                >
                  <span>OFFSET</span>
                  <span>HEX (FLOAT32)</span>
                  <span>FEATURE NAME</span>
                  <span style={{ textAlign: "right" }}>VALUE</span>
                </div>

                {drawerStats.map((st, i) => {
                  const offsetStr = `0x${(i * 4).toString(16).padStart(4, "0").toUpperCase()}`;
                  return (
                    <div
                      key={st.feature}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "60px 105px 1fr 85px",
                        borderBottom: "1px solid rgba(124, 255, 155, 0.04)",
                        padding: "0.2rem 0",
                      }}
                    >
                      <span style={{ color: "var(--dim)" }}>{offsetStr}</span>
                      <span style={{ color: "var(--phosphor)" }}>{st.hex}</span>
                      <span style={{ color: "var(--text)" }}>{st.feature}</span>
                      <span style={{ textAlign: "right", color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                        {st.val.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Population Deviation (Z-Score) */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--dim)", marginBottom: "0.5rem" }}>
                Z-SCORE DEVIATION FROM TRAINING MEAN:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {drawerStats.slice(0, 4).map((st) => (
                  <div
                    key={st.feature}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "0.75rem",
                      border: "1px solid var(--line)",
                      padding: "0.35rem 0.6rem",
                      background: "rgba(5, 8, 6, 0.4)",
                    }}
                  >
                    <span>{st.feature}</span>
                    <span style={{ color: Math.abs(st.zScore) > 2 ? "var(--ddos)" : "var(--normal)" }}>
                      z = {st.zScore >= 0 ? `+${st.zScore.toFixed(2)}` : st.zScore.toFixed(2)}σ
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Inspect in Explain Route */}
          <div>
            <button
              onClick={() => {
                navigate(`/explain?threat=${encodeURIComponent(activeDrawerRow.Predicted_Class)}`);
              }}
              className="terminal-btn"
              style={{ width: "100%", justifyContent: "center" }}
            >
              [ INSPECT ATTRIBUTION IN EXPLAIN VIEW ]
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
