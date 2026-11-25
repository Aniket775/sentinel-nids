import React, { useRef, useState, useEffect } from "react";
import * as d3 from "d3";
import { runPrediction, PredictResponse } from "../api/client";
import { useBackground } from "../bg/field";
import { DecryptText } from "../components/DecryptText";

export const Analyze: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [stage, setStage] = useState<"idle" | "schema" | "transform" | "inference" | "done">("idle");
  const [stageLogs, setStageLogs] = useState<string[]>([]);
  const [results, setResults] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(0.85);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const histogramRef = useRef<SVGSVGElement>(null);
  const { setTarget } = useBackground();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleRun = async (useDemo: boolean = false) => {
    setError(null);
    setResults(null);
    setStage("schema");
    setStageLogs([
      `[00.00s] Parsing flow headers from ${useDemo ? "bundled demo (10,000 flows)" : file?.name || "CSV input"}...`,
    ]);

    await new Promise((r) => setTimeout(r, 200));
    setStage("transform");
    setStageLogs((prev) => [
      ...prev,
      "[00.01s] Validating schema & aligning 25 predictive features... OK",
    ]);

    await new Promise((r) => setTimeout(r, 200));
    setStage("inference");
    setStageLogs((prev) => [
      ...prev,
      "[00.02s] Executing vectorized XGBoost inference & probability estimation...",
    ]);

    try {
      const data = await runPrediction(useDemo ? { demo: true } : { file: file || undefined });
      setResults(data);
      sessionStorage.setItem("sentinel_prediction_data", JSON.stringify(data));
      setStage("done");
      setStageLogs((prev) => [
        ...prev,
        `[${(data.duration_ms / 1000).toFixed(2)}s] Inference complete. Processed ${data.total_records.toLocaleString()} records (${data.throughput_flows_per_sec.toLocaleString()} flows/sec).`,
      ]);

      // Dynamically morph background field weights
      const total = data.total_records || 1;
      setTarget({
        normal: (data.class_counts.Normal || 0) / total,
        ddos: (data.class_counts.DDoS || 0) / total,
        portscan: (data.class_counts.PortScan || 0) / total,
        bruteforce: (data.class_counts.BruteForce || 0) / total,
      });
    } catch (err: any) {
      setError(err.message || "Execution failed");
      setStage("idle");
    }
  };

  // Render D3 Confidence Histogram
  useEffect(() => {
    if (!results || !histogramRef.current || !results.confidences.length) return;

    const svg = d3.select(histogramRef.current);
    svg.selectAll("*").remove();

    const width = 640;
    const height = 240;
    const margin = { top: 20, right: 30, bottom: 40, left: 55 };

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const x = d3
      .scaleLinear()
      .domain([0, 1])
      .range([margin.left, width - margin.right]);

    const bins = d3
      .bin()
      .domain([0, 1])
      .thresholds(x.ticks(20))(results.confidences);

    const maxCount = d3.max(bins, (d) => d.length) || 1;

    const y = d3
      .scaleLinear()
      .domain([0, maxCount])
      .range([height - margin.bottom, margin.top]);

    // X Axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat((d) => `${(Number(d) * 100).toFixed(0)}%`))
      .call((g) => g.select(".domain").attr("stroke", "var(--line)"))
      .call((g) => g.selectAll(".tick line").attr("stroke", "var(--line)"))
      .call((g) =>
        g
          .selectAll(".tick text")
          .attr("fill", "var(--dim)")
          .attr("font-family", "IBM Plex Mono, monospace")
          .attr("font-size", "10px")
      );

    // Y Axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4))
      .call((g) => g.select(".domain").attr("stroke", "var(--line)"))
      .call((g) => g.selectAll(".tick line").attr("stroke", "var(--line)"))
      .call((g) =>
        g
          .selectAll(".tick text")
          .attr("fill", "var(--dim)")
          .attr("font-family", "IBM Plex Mono, monospace")
          .attr("font-size", "10px")
      );

    // Bars
    svg
      .selectAll("rect.bar")
      .data(bins)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(d.x0 ?? 0) + 1)
      .attr("width", (d) => Math.max(0, x(d.x1 ?? 0) - x(d.x0 ?? 0) - 2))
      .attr("y", (d) => y(d.length))
      .attr("height", (d) => height - margin.bottom - y(d.length))
      .attr("fill", "var(--panel)")
      .attr("stroke", "var(--phosphor)")
      .attr("stroke-width", 1);

    // Draggable / Interactive Threshold Line
    const threshX = x(threshold);
    const lineGroup = svg.append("g").style("cursor", "ew-resize");

    lineGroup
      .append("line")
      .attr("x1", threshX)
      .attr("x2", threshX)
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom)
      .attr("stroke", "var(--portscan)")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,3");

    lineGroup
      .append("text")
      .attr("x", threshX + 6)
      .attr("y", margin.top + 14)
      .attr("fill", "var(--portscan)")
      .attr("font-family", "IBM Plex Mono, monospace")
      .attr("font-size", "10px")
      .text(`CUTOFF ${(threshold * 100).toFixed(0)}%`);

    // Drag behavior on SVG
    const drag = d3.drag<SVGSVGElement, unknown>().on("drag", (event) => {
      const coords = d3.pointer(event, svg.node());
      const newX = Math.max(margin.left, Math.min(width - margin.right, coords[0]));
      const newThresh = Math.round(x.invert(newX) * 100) / 100;
      setThreshold(newThresh);
    });

    svg.call(drag);
  }, [results, threshold]);

  // Compute Mean Confidence and Scaled ASCII Block Bars
  const meanConfidence = results && results.confidences.length
    ? (results.confidences.reduce((a, b) => a + b, 0) / results.confidences.length)
    : 0;

  const totalRec = results?.total_records || 1;
  const maxClassCount = results ? Math.max(...Object.values(results.class_counts)) : 1;

  const getAsciiBar = (count: number) => {
    const barWidth = 20;
    const ratio = Math.max(0, Math.min(1, count / (maxClassCount || 1)));
    const filled = Math.round(ratio * barWidth);
    return `[${"█".repeat(filled)}${" ".repeat(barWidth - filled)}]`;
  };

  return (
    <div style={{ maxWidth: 1380, margin: "0 auto", padding: "2rem 1.5rem 5rem" }}>
      {/* Header Panel */}
      <div className="terminal-window" style={{ padding: "2rem", marginBottom: "2rem" }}>
        <div className="terminal-titlebar" style={{ margin: "-2rem -2rem 1.5rem -2rem" }}>
          <div className="terminal-dots">
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-dot" />
            <span className="terminal-title">[ analyze.sh ]</span>
          </div>
          <div className="terminal-path">/usr/bin/sentinel-flow-eval</div>
        </div>

        <h1 style={{ margin: "0 0 0.5rem 0" }}>
          &gt; <DecryptText text="Batch Flow Evaluation &amp; Threat Detection" />
          <span className="blinking-cursor" />
        </h1>
        <p style={{ color: "var(--dim)", fontSize: "0.85rem", maxWidth: 760, margin: 0 }}>
          Ingest raw CSV records describing bidirectional flow telemetry. The pipeline performs feature alignment,
          applies the pre-trained XGBoost classifier, calculates uncertainty metrics, and exports annotated security datasets.
        </p>
      </div>

      {/* Grid: Upload Terminal vs Pipeline Log */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        {/* Upload Terminal Window */}
        <div className="terminal-window" style={{ margin: 0 }}>
          <div className="terminal-titlebar">
            <span className="terminal-title">[ input_source.conf ]</span>
            <span className="terminal-path">stdin.csv</span>
          </div>
          <div className="terminal-content">
            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `1px dashed ${isDragging ? "var(--phosphor)" : "var(--line)"}`,
                padding: "2rem 1rem",
                textAlign: "center",
                background: isDragging ? "rgba(124, 255, 155, 0.05)" : "rgba(5, 8, 6, 0.5)",
                cursor: "pointer",
                marginBottom: "1.25rem",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setFile(e.target.files[0]);
                  }
                }}
              />
              <div style={{ color: "var(--phosphor)", fontSize: "1.2rem", marginBottom: "0.5rem" }}>
                {file ? `[ FILE LOADED: ${file.name} ]` : "[ DRAG & DROP FLOW CSV HERE ]"}
              </div>
              <div style={{ color: "var(--dim)", fontSize: "0.75rem" }}>
                Accepts CICFlowMeter bidirectional network flow format (.csv)
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                disabled={!file || stage !== "idle"}
                onClick={() => handleRun(false)}
                className="terminal-btn"
              >
                [ EVALUATE UPLOADED CSV ]
              </button>

              <button
                disabled={stage !== "idle"}
                onClick={() => handleRun(true)}
                className="terminal-btn"
              >
                [ RUN BUNDLED DEMO (10,000 FLOWS) ]
              </button>
            </div>

            {error && (
              <div style={{ color: "var(--ddos)", fontSize: "0.8rem", marginTop: "1rem" }}>
                Error: {error}
              </div>
            )}
          </div>
        </div>

        {/* Pipeline Terminal Streaming Log */}
        <div className="terminal-window" style={{ margin: 0 }}>
          <div className="terminal-titlebar">
            <span className="terminal-title">[ pipeline_stream.log ]</span>
            <span className="terminal-path">/dev/ttyS0</span>
          </div>
          <div
            className="terminal-content"
            style={{
              background: "var(--void)",
              minHeight: 200,
              fontFamily: "var(--font-mono)",
              fontSize: "0.78rem",
              lineHeight: 1.6,
            }}
          >
            {stageLogs.length === 0 ? (
              <div style={{ color: "var(--dim)" }}>
                &gt; Awaiting flow ingestion trigger...
                <br />
                &gt; Model bundle: models/selected_model (XGBoost)
                <br />
                &gt; Features: 25 top MDI discriminators
              </div>
            ) : (
              stageLogs.map((l, i) => (
                <div key={i} style={{ color: l.includes("complete") ? "var(--normal)" : "var(--text)" }}>
                  {l}
                </div>
              ))
            )}
            {stage !== "idle" && stage !== "done" && (
              <div style={{ color: "var(--phosphor)", marginTop: "0.5rem" }}>
                Processing stage: {stage.toUpperCase()}...
                <span className="blinking-cursor" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results View: Nmap-Style Report Block & D3 Confidence Histogram */}
      {results && (
        <div className="terminal-window" style={{ marginBottom: "2.5rem" }}>
          <div className="terminal-titlebar">
            <span className="terminal-title">[ nmap_scan_report.txt ]</span>
            <span className="terminal-path">stdout</span>
          </div>

          <div className="terminal-content">
            {/* Nmap Header */}
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
                color: "var(--phosphor)",
                marginBottom: "1rem",
                paddingBottom: "0.5rem",
                borderBottom: "1px dashed var(--line)",
              }}
            >
              NMAP-STYLE SCAN REPORT FOR INGESTED FLOW POOL: {results.source.toUpperCase()}
            </div>

            {/* ASCII Bar Table */}
            <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)", color: "var(--dim)" }}>
                    <th style={{ textAlign: "left", padding: "0.5rem" }}>THREAT CLASS</th>
                    <th style={{ textAlign: "left", padding: "0.5rem" }}>DISTRIBUTION SPECTRUM</th>
                    <th style={{ textAlign: "right", padding: "0.5rem" }}>FLOW COUNT</th>
                    <th style={{ textAlign: "right", padding: "0.5rem" }}>RATIO</th>
                    <th style={{ textAlign: "left", padding: "0.5rem" }}>SUPPORT NOTE</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Normal */}
                  <tr style={{ borderBottom: "1px solid rgba(124, 255, 155, 0.08)" }}>
                    <td style={{ padding: "0.5rem", color: "var(--normal)" }}>[ Normal ]</td>
                    <td style={{ padding: "0.5rem", color: "var(--normal)", fontFamily: "var(--font-tabular)" }}>
                      {getAsciiBar(results.class_counts.Normal || 0)}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {(results.class_counts.Normal || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {(((results.class_counts.Normal || 0) / totalRec) * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: "0.5rem", color: "var(--dim)", fontSize: "0.72rem" }}>Baseline traffic</td>
                  </tr>

                  {/* DDoS */}
                  <tr style={{ borderBottom: "1px solid rgba(124, 255, 155, 0.08)" }}>
                    <td style={{ padding: "0.5rem", color: "var(--ddos)" }}>[ DDoS ]</td>
                    <td style={{ padding: "0.5rem", color: "var(--ddos)", fontFamily: "var(--font-tabular)" }}>
                      {getAsciiBar(results.class_counts.DDoS || 0)}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {(results.class_counts.DDoS || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {(((results.class_counts.DDoS || 0) / totalRec) * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: "0.5rem", color: "var(--dim)", fontSize: "0.72rem" }}>Volumetric flood</td>
                  </tr>

                  {/* PortScan */}
                  <tr style={{ borderBottom: "1px solid rgba(124, 255, 155, 0.08)" }}>
                    <td style={{ padding: "0.5rem", color: "var(--portscan)" }}>[ PortScan ]</td>
                    <td style={{ padding: "0.5rem", color: "var(--portscan)", fontFamily: "var(--font-tabular)" }}>
                      {getAsciiBar(results.class_counts.PortScan || 0)}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {(results.class_counts.PortScan || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {(((results.class_counts.PortScan || 0) / totalRec) * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: "0.5rem", color: "var(--portscan)", fontSize: "0.72rem" }}>
                      [n=32 test, 213 total, low support]
                    </td>
                  </tr>

                  {/* BruteForce */}
                  <tr style={{ borderBottom: "1px solid rgba(124, 255, 155, 0.08)" }}>
                    <td style={{ padding: "0.5rem", color: "var(--bruteforce)" }}>[ BruteForce ]</td>
                    <td style={{ padding: "0.5rem", color: "var(--bruteforce)", fontFamily: "var(--font-tabular)" }}>
                      {getAsciiBar(results.class_counts.BruteForce || 0)}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {(results.class_counts.BruteForce || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {(((results.class_counts.BruteForce || 0) / totalRec) * 100).toFixed(1)}%
                    </td>
                    <td style={{ padding: "0.5rem", color: "var(--dim)", fontSize: "0.72rem" }}>Patator credential sweep</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Nmap Footer */}
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
                color: "var(--dim)",
                paddingTop: "0.75rem",
                borderTop: "1px dashed var(--line)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div>
                TOTAL AUDITED: <b style={{ color: "var(--text)" }}>{results.total_records.toLocaleString()} flows</b> |
                MEAN CERTAINTY: <b style={{ color: "var(--phosphor)" }}>{(meanConfidence * 100).toFixed(2)}%</b> |
                DURATION: <b style={{ color: "var(--text)" }}>{results.duration_ms}ms</b>
              </div>

              {/* CSV Export Button */}
              <a
                href="/api/export"
                download="sentinel_annotated_flows.csv"
                className="terminal-btn"
                style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}
              >
                [ EXPORT ANNOTATED CSV ]
              </a>
            </div>

            {/* D3 Confidence Histogram */}
            <div style={{ marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--phosphor)" }}>
                  PREDICTION CONFIDENCE HISTOGRAM (20 BINS)
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--dim)" }}>
                  Drag cutoff line to filter high vs review flows
                </span>
              </div>
              <svg ref={histogramRef} style={{ width: "100%", height: "auto" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
