import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { fetchMetrics } from "../api/client";

export type ThemeType = "green" | "amber" | "ice" | "red-team";

export const TerminalChrome: React.FC = () => {
  const location = useLocation();

  // Cursor coordinates
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Time & telemetry for tmux bar
  const [timeStr, setTimeStr] = useState<string>("");
  const [championModel, setChampionModel] = useState<string>("XGBoost");
  const [flowCount, setFlowCount] = useState<number>(0);
  const [currentTheme, setCurrentTheme] = useState<ThemeType>(() => {
    return (localStorage.getItem("sentinel_theme") as ThemeType) || "green";
  });

  // Track cursor
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Update clock every second
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTimeStr(
        now.toTimeString().split(" ")[0] // HH:MM:SS
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch champion model name & check loaded flows
  useEffect(() => {
    fetchMetrics()
      .then((m) => {
        if (m.champion_model) setChampionModel(m.champion_model);
      })
      .catch(() => {});

    const updateFlows = () => {
      try {
        const saved = sessionStorage.getItem("sentinel_prediction_data");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed.total_records === "number") {
            setFlowCount(parsed.total_records);
          }
        }
      } catch {}
    };

    updateFlows();
    const pollFlows = setInterval(updateFlows, 3000);
    return () => clearInterval(pollFlows);
  }, []);

  // Set theme on <html> and localStorage
  const setTheme = (theme: ThemeType) => {
    setCurrentTheme(theme);
    localStorage.setItem("sentinel_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  };

  const cycleTheme = () => {
    const themes: ThemeType[] = ["green", "amber", "ice"];
    const nextIdx = (themes.indexOf(currentTheme) + 1) % themes.length;
    setTheme(themes[nextIdx]);
  };

  // Glitch effect every 9-15s for 120ms
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let timeoutId: any;
    const scheduleGlitch = () => {
      const delay = Math.floor(Math.random() * 6000) + 9000; // 9s - 15s
      timeoutId = setTimeout(() => {
        // Trigger glitch on headlines
        const headings = document.querySelectorAll("h1, .display-heading");
        headings.forEach((h) => h.classList.add("glitch-active"));

        // Trigger slice glitch event for canvas
        window.dispatchEvent(new CustomEvent("sentinel-canvas-glitch"));

        setTimeout(() => {
          headings.forEach((h) => h.classList.remove("glitch-active"));
          scheduleGlitch();
        }, 120);
      }, delay);
    };

    scheduleGlitch();
    return () => clearTimeout(timeoutId);
  }, []);

  // Konami Code listener (Red Team Mode Easter Egg)
  useEffect(() => {
    const konamiSequence = [
      "ArrowUp",
      "ArrowUp",
      "ArrowDown",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ArrowLeft",
      "ArrowRight",
      "b",
      "a",
    ];
    let konamiIdx = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === konamiSequence[konamiIdx]) {
        konamiIdx++;
        if (konamiIdx === konamiSequence.length) {
          // Toggle Red Team Mode
          konamiIdx = 0;
          if (document.documentElement.getAttribute("data-theme") === "red-team") {
            const prev = localStorage.getItem("sentinel_theme") || "green";
            document.documentElement.setAttribute("data-theme", prev);
            setCurrentTheme(prev as ThemeType);
            window.dispatchEvent(
              new CustomEvent("sentinel-red-team-toggle", { detail: { active: false } })
            );
          } else {
            document.documentElement.setAttribute("data-theme", "red-team");
            setCurrentTheme("red-team");
            window.dispatchEvent(
              new CustomEvent("sentinel-red-team-toggle", { detail: { active: true } })
            );
          }
        }
      } else {
        konamiIdx = 0;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isRedTeam = currentTheme === "red-team";

  return (
    <>
      {/* Surface Overlays: Scanlines, Vignette, CRT Flicker */}
      <div className="crt-scanlines" />
      <div className="crt-vignette" />
      <div className="crt-flicker" />

      {/* Crosshair Cursor HUD with X, Y coordinates */}
      {cursorPos && (
        <div
          className="cursor-hud"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
          }}
        >
          {cursorPos.x.toString().padStart(4, "0")}:{cursorPos.y.toString().padStart(4, "0")}
        </div>
      )}

      {/* Tmux Bottom Status Bar */}
      <footer className="tmux-statusbar">
        <div className="tmux-left">
          <span>SENTINEL</span>
          <span style={{ color: "var(--dim)" }}>//</span>
          <span>{isRedTeam ? "RED TEAM VIEW // styling only" : "blue-team // offline"}</span>
        </div>

        <div className="tmux-center">
          <span style={{ color: "var(--dim)" }}>[</span>
          <span style={{ color: "var(--phosphor)", padding: "0 0.35rem" }}>
            {location.pathname === "/" ? "/overview" : location.pathname}
          </span>
          <span style={{ color: "var(--dim)" }}>]</span>
        </div>

        <div className="tmux-right">
          <span>MODEL: {championModel.toUpperCase()}</span>
          <span>FLOWS: {flowCount.toLocaleString()}</span>
          <button
            onClick={cycleTheme}
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--phosphor)",
              fontSize: "0.68rem",
              padding: "0.15rem 0.5rem",
              lineHeight: 1.2,
              cursor: "pointer",
            }}
            title="Click to cycle theme (Green, Amber, Ice)"
          >
            THEME: {currentTheme.toUpperCase()}
          </button>
          <span style={{ color: "var(--phosphor)" }}>{timeStr}</span>
        </div>
      </footer>
    </>
  );
};
