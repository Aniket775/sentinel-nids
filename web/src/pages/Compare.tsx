import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import { fetchComparison, ComparisonResponse } from "../api/client";
import { DecryptText } from "../components/DecryptText";

const CLASS_SUPPORT: Record<string, { test_n: number; total_n: number; low_support: boolean }> = {
  Normal: { test_n: 17641, total_n: 117606, low_support: false },
  DDoS: { test_n: 3580, total_n: 23864, low_support: false },
  BruteForce: { test_n: 612, total_n: 4082, low_support: false },
  PortScan: { test_n: 32, total_n: 213, low_support: true },
};

export const Compare: React.FC = () => {
  const [data, setData] = useState<ComparisonResponse | null>(null);

  const [activeModel, setActiveModel] = useState<string>("XGBoost");
  const [normalizeMatrix, setNormalizeMatrix] = useState<boolean>(false);
  const [hoveredCell, setHoveredCell] = useState<{
    trueClass: string;
    predClass: string;
    count: number;
    pct: number;
    x: number;
    y: number;
  } | null>(null);

  const scatterRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    fetchComparison()
      .then((res) => setData(res))
      .catch((err) => console.error("Could not load comparison data:", err));
  }, []);

  // Draw D3 Scatter Plot (Training Time vs Inference Latency)
  useEffect(() => {
    if (!data || !scatterRef.current) return;

    const svg = d3.select(scatterRef.current);
    svg.selectAll("*").remove();

    const width = 560;
    const height = 300;
    const margin = { top: 30, right: 30, bottom: 45, left: 60 };

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const plotData = data.table.map((row) => {
      const infSec = row["Inference Time (s)"];
      const perFlowUs = (infSec / 21865) * 1e6; // microseconds per flow
      return {
        model: row.Model,
        trainTime: row["Training Time (s)"],
        infLatencyUs: perFlowUs,
        macroF1: row["Macro-F1"],
        accuracy: row.Accuracy,
      };
    });

    const x = d3
      .scaleLog()
      .domain([0.8, 35])
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleLog()
      .domain([0.5, 300])
      .range([height - margin.bottom, margin.top]);

    // Gridlines
    svg
      .append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(-(height - margin.top - margin.bottom)).tickFormat(() => ""))
      .call((g) => g.selectAll(".tick line").attr("stroke", "var(--line)"))
      .call((g) => g.select(".domain").remove());

    svg
      .append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).ticks(5).tickSize(-(width - margin.left - margin.right)).tickFormat(() => ""))
      .call((g) => g.selectAll(".tick line").attr("stroke", "var(--line)"))
      .call((g) => g.select(".domain").remove());

    // X Axis
    svg
      .append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(4, ".1f"))
      .call((g) => g.select(".domain").attr("stroke", "var(--line)"))
      .call((g) => g.selectAll(".tick line").attr("stroke", "var(--line)"))
      .call((g) =>
        g
          .selectAll(".tick text")
          .attr("fill", "var(--dim)")
          .attr("font-family", "IBM Plex Mono, monospace")
          .attr("font-size", "10px")
      );

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", height - 6)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--dim)")
      .attr("font-family", "IBM Plex Mono, monospace")
      .attr("font-size", "10px")
      .text("TRAINING TIME (s, LOG SCALE)");

    // Y Axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).ticks(4, ".1f"))
      .call((g) => g.select(".domain").attr("stroke", "var(--line)"))
      .call((g) => g.selectAll(".tick line").attr("stroke", "var(--line)"))
      .call((g) =>
        g
          .selectAll(".tick text")
          .attr("fill", "var(--dim)")
          .attr("font-family", "IBM Plex Mono, monospace")
          .attr("font-size", "10px")
      );

    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--dim)")
      .attr("font-family", "IBM Plex Mono, monospace")
      .attr("font-size", "10px")
      .text("INFERENCE LATENCY (µs / FLOW, LOG)");

    const colors: Record<string, string> = {
      XGBoost: "var(--phosphor)",
      "Random Forest": "var(--normal)",
      SVM: "var(--portscan)",
    };

    plotData.forEach((d) => {
      const size = 12 + (d.macroF1 - 0.6) * 20; // square size
      const isChamp = d.model === "XGBoost";

      const g = svg.append("g").style("cursor", "crosshair");

      // Square marker with outline
      g.append("rect")
        .attr("x", x(d.trainTime) - size / 2)
        .attr("y", y(d.infLatencyUs) - size / 2)
        .attr("width", size)
        .attr("height", size)
        .attr("fill", isChamp ? "rgba(124, 255, 155, 0.4)" : "rgba(10, 16, 12, 0.8)")
        .attr("stroke", colors[d.model] || "var(--text)")
        .attr("stroke-width", 1.5)
        .style("filter", isChamp ? "drop-shadow(0 0 6px var(--phosphor-glow))" : "none");

      // Label
      g.append("text")
        .attr("x", x(d.trainTime) + size / 2 + 8)
        .attr("y", y(d.infLatencyUs) + 4)
        .attr("fill", "var(--text)")
        .attr("font-family", "IBM Plex Mono, monospace")
        .attr("font-size", "10px")
        .text(`${d.model} (F1: ${(d.macroF1 * 100).toFixed(1)}%)`);
    });
  }, [data]);

  const classes = ["BruteForce", "DDoS", "Normal", "PortScan"];
  const currentModelDetail = data?.models[activeModel];
  const cm = currentModelDetail?.confusion_matrix || [];
  const perClass = currentModelDetail?.per_class || {};

  return (
    <div style={{ maxWidth: 1380, margin: "0 auto", padding: "2rem 1.5rem 5rem" }}>
      {/* Header Window */}
      <div className="terminal-window" style={{ padding: "2rem", marginBottom: "2rem" }}>
        <div className="terminal-titlebar" style={{ margin: "-2rem -2rem 1.5rem -2rem" }}>
          <div className="terminal-dots">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-title">[ compare.eval ]</span>
          </div>
          <div className="terminal-path">/proc/benchmarks/three_model_summary</div>
        </div>

        <h1 style={{ margin: "0 0 0.5rem 0" }}>
          &gt; <DecryptText text="Empirical Three-Algorithm Benchmark Evaluation" />
          <span className="blinking-cursor" />
        </h1>
        <p style={{ color: "var(--dim)", fontSize: "0.85rem", maxWidth: 820, margin: 0 }}>
          Side-by-side performance comparison of Random Forest, Support Vector Machine (RBF kernel, 25k stratified sample),
          and XGBoost across an identical holdout test set (n=21,865 flows). Note SVM's boundary sensitivity on minority classes.
        </p>
      </div>

      {/* Model Benchmark Table Window */}
      <div className="terminal-window" style={{ overflowX: "auto", marginBottom: "2.5rem" }}>
        <div className="terminal-titlebar">
          <span className="terminal-title">[ comparison_matrix.tbl ]</span>
          <span className="terminal-path">reports/model_comparison.csv</span>
        </div>
        <div className="terminal-content" style={{ padding: 0 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "0.8rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--line)",
                  background: "rgba(10, 16, 12, 0.95)",
                  color: "var(--dim)",
                }}
              >
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>MODEL</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>ACCURACY</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>MACRO-F1</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>WEIGHTED-F1</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>PRECISION</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>RECALL</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>TRAIN (s)</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>INFERENCE (s)</th>
                <th style={{ padding: "0.75rem 1rem", fontWeight: 500 }}>SELECTION</th>
              </tr>
            </thead>
            <tbody>
              {data?.table.map((row) => {
                const isChampion = row.Model === "XGBoost";
                const isSelected = activeModel === row.Model;
                return (
                  <tr
                    key={row.Model}
                    onClick={() => setActiveModel(row.Model)}
                    style={{
                      borderBottom: "1px solid rgba(124, 255, 155, 0.06)",
                      cursor: "crosshair",
                      background: isSelected ? "rgba(124, 255, 155, 0.08)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "0.75rem 1rem", color: "var(--phosphor)", fontWeight: 500 }}>
                      [ {row.Model} ]
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontVariantNumeric: "tabular-nums" }}>
                      {(row.Accuracy * 100).toFixed(2)}%
                    </td>
                    <td
                      style={{
                        padding: "0.75rem 1rem",
                        fontVariantNumeric: "tabular-nums",
                        color: isChampion ? "var(--phosphor)" : row.Model === "SVM" ? "var(--portscan)" : "var(--text)",
                        textShadow: isChampion ? "0 0 6px var(--phosphor-glow)" : "none",
                      }}
                    >
                      {row["Macro-F1"].toFixed(4)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontVariantNumeric: "tabular-nums" }}>
                      {row["Weighted-F1"].toFixed(4)}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontVariantNumeric: "tabular-nums" }}>
                      {(row.Precision * 100).toFixed(2)}%
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontVariantNumeric: "tabular-nums" }}>
                      {(row.Recall * 100).toFixed(2)}%
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontVariantNumeric: "tabular-nums" }}>
                      {row["Training Time (s)"].toFixed(2)}s
                    </td>
                    <td style={{ padding: "0.75rem 1rem", fontVariantNumeric: "tabular-nums" }}>
                      {row["Inference Time (s)"].toFixed(4)}s
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      {isChampion ? (
                        <span style={{ color: "var(--phosphor)", border: "1px solid var(--phosphor)", padding: "0.15rem 0.4rem", fontSize: "0.68rem" }}>
                          CHAMPION
                        </span>
                      ) : row.Model === "SVM" ? (
                        <span style={{ color: "var(--portscan)", border: "1px solid var(--portscan)", padding: "0.15rem 0.4rem", fontSize: "0.68rem" }}>
                          25K SUBSAMPLED
                        </span>
                      ) : (
                        <span style={{ color: "var(--dim)", fontSize: "0.68rem" }}>BENCHMARK</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Confusion Matrix Heatmap + Scatter Plot */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2.5rem",
        }}
      >
        {/* Confusion Matrix Heatmap Window */}
        <div className="terminal-window" style={{ margin: 0 }}>
          <div className="terminal-titlebar">
            <span className="terminal-title">[ confusion_matrix.map ]</span>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span className="terminal-path">{activeModel.toUpperCase()} (n=21,865)</span>
              <button
                onClick={() => setNormalizeMatrix((v) => !v)}
                className="terminal-btn"
                style={{ padding: "0.15rem 0.5rem", fontSize: "0.68rem" }}
              >
                {normalizeMatrix ? "[ SHOW COUNTS ]" : "[ SHOW RECALL % ]"}
              </button>
            </div>
          </div>

          <div className="terminal-content">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "80px repeat(4, 1fr)",
                gap: 3,
                textAlign: "center",
                fontSize: "0.75rem",
              }}
            >
              <div style={{ color: "var(--dim)", textAlign: "left", fontSize: "0.68rem" }}>
                TRUE \ PRED
              </div>
              {classes.map((c) => (
                <div key={c} style={{ color: "var(--dim)", padding: "0.3rem 0", fontSize: "0.7rem" }}>
                  {c.slice(0, 5)}
                </div>
              ))}

              {classes.map((trueC, rowIdx) => {
                const rowSum = cm[rowIdx] ? cm[rowIdx].reduce((a: number, b: number) => a + b, 0) : 1;
                return (
                  <React.Fragment key={trueC}>
                    <div style={{ color: "var(--dim)", display: "flex", alignItems: "center", fontSize: "0.7rem" }}>
                      {trueC.slice(0, 5)}
                    </div>
                    {classes.map((predC, colIdx) => {
                      const count = cm[rowIdx] ? cm[rowIdx][colIdx] : 0;
                      const pct = (count / (rowSum || 1)) * 100;
                      const isDiagonal = rowIdx === colIdx;

                      return (
                        <div
                          key={predC}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredCell({
                              trueClass: trueC,
                              predClass: predC,
                              count,
                              pct,
                              x: rect.left,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                          style={{
                            background: isDiagonal
                              ? `rgba(124, 255, 155, ${Math.min(0.65, 0.15 + (pct / 100) * 0.5)})`
                              : count > 0
                              ? `rgba(255, 77, 61, ${Math.min(0.65, (count / 500) * 0.5)})`
                              : "rgba(5, 8, 6, 0.6)",
                            border: `1px solid ${isDiagonal ? "var(--phosphor)" : "var(--line)"}`,
                            padding: "0.8rem 0.2rem",
                            color: "var(--text)",
                            fontVariantNumeric: "tabular-nums",
                            cursor: "crosshair",
                            fontFamily: "var(--font-tabular)",
                          }}
                        >
                          {normalizeMatrix ? `${pct.toFixed(1)}%` : count.toLocaleString()}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>

            <div style={{ fontSize: "0.7rem", color: "var(--dim)", marginTop: "1rem" }}>
              Fig. 4 / Confusion matrix for {activeModel}. Diagonal elements represent true positives.
            </div>

            {/* Hover Tooltip */}
            {hoveredCell && (
              <div
                style={{
                  position: "fixed",
                  left: hoveredCell.x + 15,
                  top: hoveredCell.y - 25,
                  background: "var(--void)",
                  border: "1px solid var(--phosphor)",
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.72rem",
                  zIndex: 200,
                  pointerEvents: "none",
                  boxShadow: "0 0 6px var(--phosphor-glow)",
                }}
              >
                <div>True: {hoveredCell.trueClass} → Pred: {hoveredCell.predClass}</div>
                <div style={{ color: "var(--dim)" }}>
                  Count: {hoveredCell.count.toLocaleString()} ({hoveredCell.pct.toFixed(2)}%)
                </div>
              </div>
            )}
          </div>
        </div>

        {/* D3 Scatter Plot Window */}
        <div className="terminal-window" style={{ margin: 0 }}>
          <div className="terminal-titlebar">
            <span className="terminal-title">[ latency_vs_traintime.d3 ]</span>
            <span className="terminal-path">log-log-coords</span>
          </div>
          <div className="terminal-content">
            <svg ref={scatterRef} style={{ width: "100%", height: "auto" }} />
            <div style={{ fontSize: "0.7rem", color: "var(--dim)", marginTop: "0.5rem" }}>
              Fig. 5 / Training duration vs. per-flow inference latency. XGBoost achieves ~1.09 µs inference per flow.
            </div>
          </div>
        </div>
      </div>

      {/* Per-Class Breakdown & Minority Support */}
      <div className="terminal-window">
        <div className="terminal-titlebar">
          <span className="terminal-title">[ per_class_diagnostics.log ]</span>
          <span className="terminal-path">disaggregated_metrics (R4)</span>
        </div>
        <div className="terminal-content">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "1.25rem",
            }}
          >
            {classes.map((cname) => {
              const pData = perClass[cname] || { precision: 0, recall: 0, f1_score: 0 };
              const supp = CLASS_SUPPORT[cname];
              const isSvmFailure = activeModel === "SVM" && (cname === "PortScan" || cname === "BruteForce");

              return (
                <div
                  key={cname}
                  style={{
                    border: `1px solid ${isSvmFailure ? "var(--ddos)" : "var(--line)"}`,
                    padding: "1rem",
                    background: "rgba(5, 8, 6, 0.6)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                    <span style={{ color: "var(--phosphor)", fontWeight: 500 }}>[ {cname} ]</span>
                    {supp?.low_support && (
                      <span style={{ fontSize: "0.65rem", color: "var(--portscan)" }}>
                        [LOW SUPPORT]
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: "0.72rem", color: "var(--dim)", marginBottom: "0.75rem" }}>
                    n={supp?.test_n.toLocaleString()} test ({supp?.total_n.toLocaleString()} total)
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--dim)" }}>Precision:</span>
                      <span style={{ color: isSvmFailure && pData.precision < 0.3 ? "var(--ddos)" : "var(--text)" }}>
                        {(pData.precision * 100).toFixed(2)}%
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--dim)" }}>Recall:</span>
                      <span style={{ color: "var(--text)" }}>{(pData.recall * 100).toFixed(2)}%</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--dim)" }}>F1-Score:</span>
                      <span style={{ color: isSvmFailure && pData.f1_score < 0.5 ? "var(--ddos)" : "var(--normal)" }}>
                        {pData.f1_score.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  {isSvmFailure && (
                    <div
                      style={{
                        marginTop: "0.75rem",
                        paddingTop: "0.5rem",
                        borderTop: "1px dashed var(--ddos)",
                        fontSize: "0.7rem",
                        color: "var(--ddos)",
                        lineHeight: 1.4,
                      }}
                    >
                      SVM False Alarm Pathology: Normal flows misclassified as {cname} cause precision collapse ({cname === "PortScan" ? "13.8%" : "27.6%"}).
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
