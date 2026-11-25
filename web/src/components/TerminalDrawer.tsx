import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { fetchMetrics, runPrediction } from "../api/client";

interface TerminalHistoryItem {
  id: string;
  command: string;
  output: React.ReactNode;
}

export const TerminalDrawer: React.FC = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [history, setHistory] = useState<TerminalHistoryItem[]>([
    {
      id: "init",
      command: "",
      output: (
        <div>
          <div>SENTINEL SHELL [OFFLINE_MODE v1.0.0]</div>
          <div style={{ color: "var(--dim)" }}>
            Type <span style={{ color: "var(--phosphor)" }}>help</span> for available commands. Press Esc, ` or type exit to close.
          </div>
        </div>
      ),
    },
  ]);

  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Toggle listener for backtick or Ctrl+K or custom event
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "`" && !e.ctrlKey && !e.metaKey && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") ||
          (e.key === "k" && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    const handleCustomToggle = () => setIsOpen((prev) => !prev);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("sentinel-toggle-terminal", handleCustomToggle);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("sentinel-toggle-terminal", handleCustomToggle);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, history]);

  const handleCommand = async (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    setCmdHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);

    const parts = cmd.split(" ");
    const action = parts[0].toLowerCase();
    const arg = parts.slice(1).join(" ").toLowerCase();

    let output: React.ReactNode = null;

    switch (action) {
      case "help":
        output = (
          <div style={{ lineHeight: 1.5 }}>
            <div>Available Shell Commands:</div>
            <div>  <span style={{ color: "var(--phosphor)" }}>goto &lt;route&gt;</span>     - Navigate: overview, analyze, threats, explain, compare, method, limits</div>
            <div>  <span style={{ color: "var(--phosphor)" }}>run demo</span>         - Trigger offline prediction pipeline on 10,000 demo flows</div>
            <div>  <span style={{ color: "var(--phosphor)" }}>status</span>           - Query active champion model, accuracy, and Macro-F1</div>
            <div>  <span style={{ color: "var(--phosphor)" }}>classes</span>          - Display 4 target taxonomy classes with test support n</div>
            <div>  <span style={{ color: "var(--phosphor)" }}>explain &lt;idx&gt;</span>      - Inspect local SHAP attribution vectors (e.g. explain 40)</div>
            <div>  <span style={{ color: "var(--phosphor)" }}>theme &lt;name&gt;</span>      - Switch visual theme: green, amber, ice</div>
            <div>  <span style={{ color: "var(--phosphor)" }}>matrix on|off</span>     - Toggle Layer C digital rain on screen margins</div>
            <div>  <span style={{ color: "var(--phosphor)" }}>scope</span>            - Print 5 operational boundaries of this offline prototype</div>
            <div>  <span style={{ color: "var(--phosphor)" }}>whoami</span>           - Print current analyst privileges</div>
            <div>  <span style={{ color: "var(--phosphor)" }}>clear</span>            - Clear shell buffer</div>
            <div>  <span style={{ color: "var(--phosphor)" }}>exit</span>             - Close terminal drawer</div>
          </div>
        );
        break;

      case "goto":
        const validRoutes = ["overview", "analyze", "threats", "explain", "compare", "method", "limits"];
        if (validRoutes.includes(arg)) {
          navigate(arg === "overview" ? "/" : `/${arg}`);
          output = <div>Navigating to /{arg}...</div>;
        } else {
          output = <div style={{ color: "var(--ddos)" }}>Unknown route. Valid options: {validRoutes.join(", ")}</div>;
        }
        break;

      case "run":
        if (arg === "demo") {
          output = <div>Executing batch prediction pipeline on bundled demonstration flows...</div>;
          try {
            const res = await runPrediction({ demo: true });
            sessionStorage.setItem("sentinel_prediction_data", JSON.stringify(res));
            window.dispatchEvent(new CustomEvent("sentinel-prediction-complete", { detail: res }));
            output = (
              <div>
                <div style={{ color: "var(--normal)" }}>Success: Processed {res.total_records.toLocaleString()} flows in {res.duration_ms}ms ({res.throughput_flows_per_sec.toLocaleString()} flows/sec).</div>
                <div>Normal: {res.class_counts.Normal} | DDoS: {res.class_counts.DDoS} | PortScan: {res.class_counts.PortScan} | BruteForce: {res.class_counts.BruteForce}</div>
              </div>
            );
          } catch (err: any) {
            output = <div style={{ color: "var(--ddos)" }}>Pipeline error: {err.message}</div>;
          }
        } else {
          output = <div style={{ color: "var(--dim)" }}>Usage: run demo</div>;
        }
        break;

      case "status":
        try {
          const m = await fetchMetrics();
          output = (
            <div>
              <div>CHAMPION MODEL: {m.champion_model}</div>
              <div>TEST ACCURACY : {(m.accuracy * 100).toFixed(2)}%</div>
              <div>MACRO-F1      : {m.macro_f1.toFixed(4)}</div>
              <div>HOLDOUT SET   : {m.test_sample_size.toLocaleString()} records</div>
              <div>OPERATING MODE: OFFLINE / READ-ONLY</div>
            </div>
          );
        } catch {
          output = <div style={{ color: "var(--ddos)" }}>Failed to query API metrics.</div>;
        }
        break;

      case "classes":
        output = (
          <div>
            <div>TARGET 4-CLASS TAXONOMY:</div>
            <div>  - <span style={{ color: "var(--normal)" }}>Normal</span>: Legitimate traffic (n=17,641 test, 117,606 total)</div>
            <div>  - <span style={{ color: "var(--ddos)" }}>DDoS</span>: Volumetric flooding (n=3,580 test, 23,864 total)</div>
            <div>  - <span style={{ color: "var(--bruteforce)" }}>BruteForce</span>: Credential enumeration (n=612 test, 4,082 total)</div>
            <div>  - <span style={{ color: "var(--portscan)" }}>PortScan</span>: Service reconnaissance (n=32 test, 213 total, [low support])</div>
          </div>
        );
        break;

      case "explain":
        navigate(`/explain?case=${encodeURIComponent(arg || "40")}`);
        output = <div>Opening local attribution inspector for case {arg || "40"}...</div>;
        break;

      case "theme":
        if (["green", "amber", "ice"].includes(arg)) {
          localStorage.setItem("sentinel_theme", arg);
          document.documentElement.setAttribute("data-theme", arg);
          output = <div>Theme updated to [{arg.toUpperCase()}].</div>;
        } else {
          output = <div style={{ color: "var(--dim)" }}>Usage: theme green | amber | ice</div>;
        }
        break;

      case "matrix":
        if (arg === "off") {
          window.dispatchEvent(new CustomEvent("sentinel-toggle-matrix", { detail: { enabled: false } }));
          output = <div>Data rain overlay disabled.</div>;
        } else {
          window.dispatchEvent(new CustomEvent("sentinel-toggle-matrix", { detail: { enabled: true } }));
          output = <div>Data rain overlay enabled.</div>;
        }
        break;

      case "scope":
        output = (
          <div>
            <div style={{ color: "var(--phosphor)", fontWeight: 500 }}>OFFLINE SYSTEM BOUNDARIES:</div>
            <div>1. Offline flow analysis: no live packet capture, no in-flight blocking.</div>
            <div>2. Closed testbed artifacts: CICIDS2017 generated in isolated Canadian lab.</div>
            <div>3. Feature extraction delay: CICFlowMeter calculates features post-termination.</div>
            <div>4. Severe class imbalance: PortScan has only ~213 total records (low support).</div>
            <div>5. Concept drift: 2017 flow statistics degrade on modern protocols (HTTP/3, QUIC).</div>
          </div>
        );
        break;

      case "whoami":
        output = <div>analyst@sentinel, read-only</div>;
        break;

      case "clear":
        setHistory([]);
        setInputVal("");
        return;

      case "exit":
        setIsOpen(false);
        setInputVal("");
        return;

      case "nmap":
        output = (
          <div>
            <div>[NMAP / RECONNAISSANCE SIGNATURE]</div>
            <div>PortScan traffic in CICIDS2017 exhibits rapid SYN probing across multiple destination ports.</div>
            <div>In the audited test slice, PortScan accounts for n=32 flows (213 total flows in training pool).</div>
            <div>Tree models detect it via Destination Port variance and low backward packet ratios.</div>
          </div>
        );
        break;

      default:
        if (cmd.startsWith("sudo")) {
          output = <div style={{ color: "var(--ddos)" }}>denied: this system is read-only by design</div>;
        } else {
          output = <div style={{ color: "var(--dim)" }}>command not found: {action}, try help</div>;
        }
        break;
    }

    setHistory((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        command: rawCmd,
        output,
      },
    ]);
    setInputVal("");
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCommand(inputVal);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const nextIdx = historyIndex === -1 ? cmdHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(nextIdx);
        setInputVal(cmdHistory[nextIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex >= 0) {
        const nextIdx = historyIndex + 1;
        if (nextIdx < cmdHistory.length) {
          setHistoryIndex(nextIdx);
          setInputVal(cmdHistory[nextIdx]);
        } else {
          setHistoryIndex(-1);
          setInputVal("");
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 28, // Above tmux bar
        left: 0,
        right: 0,
        height: "min(340px, 45vh)",
        background: "var(--void)",
        borderTop: "2px solid var(--phosphor)",
        boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.8)",
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-mono)",
        fontSize: "0.8rem",
        color: "var(--text)",
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.3rem 0.8rem",
          background: "var(--panel)",
          borderBottom: "1px solid var(--line)",
          fontSize: "0.72rem",
          color: "var(--dim)",
        }}
      >
        <span>SENTINEL COMMAND SHELL // pts/0</span>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--dim)",
            fontSize: "0.8rem",
            padding: 0,
            cursor: "pointer",
          }}
        >
          [ESC TO CLOSE]
        </button>
      </div>

      {/* History Log */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0.8rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        {history.map((item) => (
          <div key={item.id}>
            {item.command && (
              <div style={{ color: "var(--phosphor)", display: "flex", gap: "0.5rem" }}>
                <span>&gt;</span>
                <span>{item.command}</span>
              </div>
            )}
            <div style={{ marginLeft: item.command ? "1rem" : 0, color: "var(--text)" }}>
              {item.output}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Prompt */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0.5rem 1rem",
          background: "rgba(10, 16, 12, 0.8)",
          borderTop: "1px solid var(--line)",
          gap: "0.5rem",
        }}
      >
        <span style={{ color: "var(--phosphor)", fontWeight: 600 }}>&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="type a command (help, status, run demo, goto...)"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "var(--phosphor)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.82rem",
          }}
        />
      </div>
    </div>
  );
};
