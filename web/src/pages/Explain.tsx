import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import * as d3 from "d3";
import { fetchCases, CasesResponse, CaseExplanation } from "../api/client";
import { useBackground } from "../bg/field";
import { DecryptText } from "../components/DecryptText";

export const Explain: React.FC = () => {
  const [searchParams] = useSearchParams();
  const threatQuery = searchParams.get("threat");
  const caseQuery = searchParams.get("case");
  const { hoverClass } = useBackground();

  const [data, setData] = useState<CasesResponse | null>(null);
  const [selectedCaseIdx, setSelectedCaseIdx] = useState<number>(0);

  const waterfallRef = useRef<SVGSVGElement | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    feature: string;
    actual: number;
    shap: number;
    impact: string;
  } | null>(null);

  useEffect(() => {
    fetchCases()
      .then((res) => {
        setData(res);
        if (caseQuery) {
          const matchIdx = res.cases.findIndex(
            (c) => String(c.sample_index) === caseQuery
          );
          if (matchIdx !== -1) setSelectedCaseIdx(matchIdx);
        } else if (threatQuery) {
          const match = res.cases.findIndex(
            (c) => c.predicted_class.toLowerCase() === threatQuery.toLowerCase()
          );
          if (match !== -1) {
            setSelectedCaseIdx(match);
          }
        }
      })
      .catch((err) => console.error("Could not fetch explanation cases:", err));
  }, [threatQuery, caseQuery]);

  const activeCase: CaseExplanation | null =
    data && data.cases.length > 0 ? data.cases[selectedCaseIdx] : null;

  // Destination Port analysis
  const destPortFeature = activeCase?.top_features.find(
    (f) => f.feature === "Destination Port"
  );
  const destPortValue = destPortFeature ? Number(destPortFeature.actual_value) : null;

  const getPortCategory = (port: number | null) => {
    if (port === null) return "Unknown Service";
    if (port <= 1023) return "Well-Known Service (0-1023)";
    if (port <= 49151) return "Registered Service (1024-49151)";
    return "Dynamic / Ephemeral (49152-65535)";
  };

  // Render D3 Waterfall chart (Monospace & Phosphor Glow on Hover)
  useEffect(() => {
    if (!activeCase || !waterfallRef.current) return;

    const svg = d3.select(waterfallRef.current);
    svg.selectAll("*").remove();

    const width = 680;
    const height = 340;
    const margin = { top: 30, right: 30, bottom: 40, left: 200 };

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const baseVal = 0.0;
    let runningVal = baseVal;
    const steps: Array<{
      feature: string;
      actual: number;
      shap: number;
      impact: string;
      start: number;
      end: number;
    }> = [];

    activeCase.top_features.forEach((f) => {
      const s = runningVal;
      const e = runningVal + f.shap_value;
      runningVal = e;
      steps.push({
        feature: f.feature,
        actual: f.actual_value,
        shap: f.shap_value,
        impact: f.impact,
        start: s,
        end: e,
      });
    });

    const minX = Math.min(0, d3.min(steps, (d) => Math.min(d.start, d.end)) ?? 0);
    const maxX = Math.max(1, d3.max(steps, (d) => Math.max(d.start, d.end)) ?? 1);

    const x = d3
      .scaleLinear()
      .domain([minX - 0.5, maxX + 0.5])
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleBand()
      .domain(steps.map((d) => d.feature))
      .range([margin.top, height - margin.bottom])
      .padding(0.35);

    // Zero hairline
    svg
      .append("line")
      .attr("x1", x(0))
      .attr("x2", x(0))
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "var(--line)")
      .attr("stroke-dasharray", "3,3");

    // X Axis
    const xAxis = d3.axisBottom(x).ticks(5).tickSize(4);
    svg
      .append("g")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(xAxis)
      .call((g) => g.select(".domain").attr("stroke", "var(--line)"))
      .call((g) => g.selectAll(".tick line").attr("stroke", "var(--line)"))
      .call((g) =>
        g
          .selectAll(".tick text")
          .attr("fill", "var(--dim)")
          .attr("font-family", "IBM Plex Mono, monospace")
          .attr("font-size", "10px")
      );

    // Y Axis labels
    const yAxis = d3.axisLeft(y).tickSize(0);
    svg
      .append("g")
      .attr("transform", `translate(${margin.left - 10}, 0)`)
      .call(yAxis)
      .call((g) => g.select(".domain").remove())
      .call((g) =>
        g
          .selectAll(".tick text")
          .attr("fill", "var(--text)")
          .attr("font-family", "IBM Plex Mono, monospace")
          .attr("font-size", "11px")
          .style("text-anchor", "end")
      );

    // Step Bar Groups
    const barGroups = svg
      .selectAll(".step-group")
      .data(steps)
      .enter()
      .append("g")
      .attr("class", "step-group")
      .style("cursor", "crosshair");

    // Square Bars with 1px outline & phosphor glow on hover
    barGroups
      .append("rect")
      .attr("y", (d) => y(d.feature)!)
      .attr("height", y.bandwidth())
      .attr("x", (d) => x(Math.min(d.start, d.end)))
      .attr("width", 0)
      .attr("fill", (d) => (d.shap >= 0 ? "rgba(255, 77, 61, 0.25)" : "rgba(94, 234, 212, 0.25)"))
      .attr("stroke", (d) => (d.shap >= 0 ? "var(--ddos)" : "var(--normal)"))
      .attr("stroke-width", 1)
      .on("mouseenter", function (event, d) {
        d3.select(this)
          .attr("fill", d.shap >= 0 ? "rgba(255, 77, 61, 0.6)" : "rgba(94, 234, 212, 0.6)")
          .style("filter", "drop-shadow(0 0 6px var(--phosphor-glow))");

        const bounds = svg.node()?.getBoundingClientRect();
        if (bounds) {
          setTooltip({
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top - 10,
            feature: d.feature,
            actual: d.actual,
            shap: d.shap,
            impact: d.impact,
          });
        }
      })
      .on("mouseleave", function (_, d) {
        d3.select(this)
          .attr("fill", d.shap >= 0 ? "rgba(255, 77, 61, 0.25)" : "rgba(94, 234, 212, 0.25)")
          .style("filter", "none");
        setTooltip(null);
      })
      .transition()
      .duration(500)
      .delay((_, i) => i * 100)
      .ease(d3.easeCubicOut)
      .attr("width", (d) => Math.max(3, Math.abs(x(d.end) - x(d.start))));

    // Attribution value numbers on bars
    barGroups
      .append("text")
      .attr("y", (d) => y(d.feature)! + y.bandwidth() / 2 + 4)
      .attr("x", (d) => (d.shap >= 0 ? x(d.end) + 6 : x(d.end) - 6))
      .attr("text-anchor", (d) => (d.shap >= 0 ? "start" : "end"))
      .attr("fill", "var(--phosphor)")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("font-size", "10px")
      .attr("opacity", 0)
      .text((d) => (d.shap > 0 ? `+${d.shap.toFixed(2)}` : d.shap.toFixed(2)))
      .transition()
      .delay((_, i) => i * 100 + 250)
      .duration(200)
      .attr("opacity", 1);
  }, [activeCase]);

  const portAngle = destPortValue !== null ? (Math.min(destPortValue, 65535) / 65535) * 180 : 0;

  return (
    <div style={{ maxWidth: 1380, margin: "0 auto", padding: "2rem 1.5rem 5rem" }}>
      {/* Header Window */}
      <div className="terminal-window" style={{ padding: "2rem", marginBottom: "2rem" }}>
        <div className="terminal-titlebar" style={{ margin: "-2rem -2rem 1.5rem -2rem" }}>
          <div className="terminal-dots">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-title">[ explain.xai ]</span>
          </div>
          <div className="terminal-path">/proc/ml/shap/tree_explainer</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: "2rem" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem 0" }}>
              &gt; <DecryptText text="Local Mathematical Attribution Dynamics" />
              <span className="blinking-cursor" />
            </h1>
            <p style={{ color: "var(--dim)", fontSize: "0.85rem", maxWidth: 700, margin: 0 }}>
              Inspecting localized SHAP (SHapley Additive exPlanations) values computed via TreeExplainer.
              Attributions quantify the additive push exerted by individual features on the model's raw log-odds decision boundary.
            </p>
          </div>

          {/* R3 Required Margin Note */}
          <div
            style={{
              borderLeft: "2px solid var(--phosphor)",
              paddingLeft: "1.25rem",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div style={{ fontSize: "0.7rem", color: "var(--phosphor)", fontWeight: 500, marginBottom: "0.25rem" }}>
              :: METHODOLOGICAL BOUNDARY (R3) ::
            </div>
            <p style={{ fontSize: "0.76rem", color: "var(--text)", margin: 0, lineHeight: 1.5 }}>
              Attribution of the model's decision, not proof of causation. SHAP values isolate statistical impact on the objective function, not network physical causality.
            </p>
          </div>
        </div>
      </div>

      {/* Case Selector Tabs */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--dim)", marginBottom: "0.5rem" }}>
          SELECT PRECOMPUTED CONCRETE CASE STUDY:
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {data?.cases.map((c, idx) => {
            const active = selectedCaseIdx === idx;
            return (
              <button
                key={c.sample_index}
                onClick={() => {
                  setSelectedCaseIdx(idx);
                  hoverClass(c.predicted_class as any);
                }}
                className="terminal-btn"
                style={{
                  background: active ? "rgba(124, 255, 155, 0.15)" : "transparent",
                  borderColor: active ? "var(--phosphor)" : "var(--line)",
                  color: active ? "var(--phosphor)" : "var(--dim)",
                  padding: "0.4rem 0.8rem",
                  fontSize: "0.75rem",
                }}
              >
                [ FLOW #{c.sample_index}: {c.predicted_class.toUpperCase()} {c.predicted_class === "PortScan" ? "(low support)" : ""} ]
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: D3 Waterfall + Destination Port & Global Ladder */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 1fr)",
          gap: "1.5rem",
          alignItems: "start",
        }}
      >
        {/* Waterfall Chart Window */}
        <div className="terminal-window" style={{ margin: 0 }}>
          <div className="terminal-titlebar">
            <span className="terminal-title">[ local_shap_waterfall.plot ]</span>
            <span className="terminal-path">case://flow/{activeCase?.sample_index ?? "..."}</span>
          </div>
          <div className="terminal-content">
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.75rem", color: "var(--dim)" }}>
              <span>BASE VALUE E[f(x)] = 0.0</span>
              <span>PREDICTED: <b style={{ color: "var(--phosphor)" }}>{activeCase?.predicted_class ? activeCase.predicted_class.toUpperCase() : "LOADING..."}</b></span>
            </div>

            <div style={{ position: "relative" }}>
              <svg ref={waterfallRef} style={{ width: "100%", height: "auto" }} />

              {/* Tooltip */}
              {tooltip && (
                <div
                  style={{
                    position: "absolute",
                    left: tooltip.x + 10,
                    top: tooltip.y - 20,
                    background: "var(--void)",
                    border: "1px solid var(--phosphor)",
                    padding: "0.4rem 0.6rem",
                    pointerEvents: "none",
                    fontSize: "0.72rem",
                    zIndex: 10,
                    boxShadow: "0 0 8px var(--phosphor-glow)",
                  }}
                >
                  <div style={{ color: "var(--phosphor)", fontWeight: 500 }}>{tooltip.feature}</div>
                  <div style={{ color: "var(--text)" }}>Value: {tooltip.actual.toLocaleString()}</div>
                  <div style={{ color: tooltip.shap >= 0 ? "var(--ddos)" : "var(--normal)" }}>
                    SHAP: {tooltip.shap >= 0 ? `+${tooltip.shap.toFixed(4)}` : tooltip.shap.toFixed(4)}
                  </div>
                </div>
              )}
            </div>

            <div style={{ fontSize: "0.7rem", color: "var(--dim)", marginTop: "0.75rem" }}>
              Fig. 3 / Additive attribution bars. Red tones push toward attack classification; cyan tones push toward normal.
            </div>
          </div>
        </div>

        {/* Right Column: Destination Port Dial & Global Feature Importance */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Destination Port Telemetry */}
          <div className="terminal-window" style={{ margin: 0 }}>
            <div className="terminal-titlebar">
              <span className="terminal-title">[ dst_port_telemetry.gau ]</span>
              <span className="terminal-path">proto/port</span>
            </div>
            <div className="terminal-content">
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                <svg width="100" height="60" viewBox="0 0 120 70">
                  <path
                    d="M 10 60 A 50 50 0 0 1 110 60"
                    fill="none"
                    stroke="var(--line)"
                    strokeWidth="6"
                  />
                  <line
                    x1="60"
                    y1="60"
                    x2={60 - 45 * Math.cos((portAngle * Math.PI) / 180)}
                    y2={60 - 45 * Math.sin((portAngle * Math.PI) / 180)}
                    stroke="var(--phosphor)"
                    strokeWidth="2.5"
                  />
                  <circle cx="60" cy="60" r="3" fill="var(--phosphor)" />
                </svg>

                <div>
                  <div style={{ fontSize: "1.4rem", color: "var(--phosphor)", textShadow: "0 0 6px var(--phosphor-glow)" }}>
                    Port {destPortValue !== null ? destPortValue : "N/A"}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--dim)", marginTop: "0.2rem" }}>
                    {getPortCategory(destPortValue)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Ranked Global Feature Importance Ladder */}
          <div className="terminal-window" style={{ margin: 0 }}>
            <div className="terminal-titlebar">
              <span className="terminal-title">[ global_importance.lad ]</span>
              <span className="terminal-path">rf_mdi_25</span>
            </div>
            <div
              className="terminal-content"
              style={{
                maxHeight: 280,
                overflowY: "auto",
                fontSize: "0.75rem",
              }}
            >
              {(data?.global_importance ?? []).slice(0, 12).map((item, idx) => {
                const isLocal = activeCase?.top_features.some((tf) => tf.feature === item.feature);
                return (
                  <div
                    key={item.feature}
                    style={{
                      padding: "0.3rem 0",
                      borderBottom: "1px solid rgba(124, 255, 155, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                      <span style={{ color: isLocal ? "var(--phosphor)" : "var(--text)" }}>
                        {idx + 1}. {item.feature} {isLocal ? "*" : ""}
                      </span>
                      <span style={{ color: "var(--dim)", fontVariantNumeric: "tabular-nums" }}>
                        {(item.importance * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ height: 2, background: "rgba(124, 255, 155, 0.1)" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, item.importance * 500)}%`,
                          background: isLocal ? "var(--phosphor)" : "var(--dim)",
                          boxShadow: isLocal ? "0 0 4px var(--phosphor-glow)" : "none",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              <div style={{ fontSize: "0.68rem", color: "var(--dim)", marginTop: "0.5rem" }}>
                * Features actively participating in current local case attribution.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
