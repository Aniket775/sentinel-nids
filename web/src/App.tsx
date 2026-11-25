import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { RouteTransition } from "./components/RouteTransition";
import { TerminalChrome } from "./components/TerminalChrome";
import { TerminalDrawer } from "./components/TerminalDrawer";
import { BootSequence } from "./components/BootSequence";
import { Overview } from "./pages/Overview";
import { Analyze } from "./pages/Analyze";
import { Threats } from "./pages/Threats";
import { Explain } from "./pages/Explain";
import { Compare } from "./pages/Compare";
import { Method } from "./pages/Method";
import { Limits } from "./pages/Limits";
import { initGlobalBackground } from "./bg/field";

export const App: React.FC = () => {
  const [booted, setBooted] = useState<boolean>(() => {
    return (
      sessionStorage.getItem("sentinel_booted") === "true" ||
      (typeof window !== "undefined" && window.location.search.includes("noboot"))
    );
  });

  useEffect(() => {
    const canvasA = document.getElementById("bg-canvas-a") as HTMLCanvasElement | null;
    const canvasB = document.getElementById("bg-canvas-b") as HTMLCanvasElement | null;
    const canvasC = document.getElementById("bg-canvas-c") as HTMLCanvasElement | null;

    if (canvasA && canvasB && canvasC) {
      const engine = initGlobalBackground(canvasA, canvasB, canvasC);

      // Listen for terminal matrix rain toggle
      const handleMatrixToggle = (e: any) => {
        engine.matrixRainEnabled = Boolean(e.detail?.enabled);
      };

      // Listen for red team mode konami toggle
      const handleRedTeam = (e: any) => {
        if (e.detail?.active) {
          engine.setTargetWeights({ normal: 0, ddos: 1.0, portscan: 0, bruteforce: 0 });
        } else {
          engine.setTargetWeights({ normal: 1.0, ddos: 0, portscan: 0, bruteforce: 0 });
        }
      };

      window.addEventListener("sentinel-toggle-matrix", handleMatrixToggle);
      window.addEventListener("sentinel-red-team-toggle", handleRedTeam);

      return () => {
        engine.destroy();
        window.removeEventListener("sentinel-toggle-matrix", handleMatrixToggle);
        window.removeEventListener("sentinel-red-team-toggle", handleRedTeam);
      };
    }
  }, []);

  return (
    <div className="app-container">
      {/* Boot Sequence on First Visit per Session */}
      {!booted && <BootSequence onComplete={() => setBooted(true)} />}

      {/* 3 Stacked Background Canvases */}
      <div
        id="bg-stack"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <canvas id="bg-canvas-a" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }} />
        <canvas id="bg-canvas-b" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }} />
        <canvas id="bg-canvas-c" style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }} />
      </div>

      {/* Terminal Surface Chrome: Scanlines, Vignette, Flicker, Cursor HUD, Tmux Bar */}
      <TerminalChrome />

      {/* Terminal Bottom Drawer (CLI Shell) */}
      <TerminalDrawer />

      {/* Top Header Navigation */}
      <Navigation />

      {/* Main Content Pages */}
      <main style={{ flex: 1, position: "relative", zIndex: 10 }}>
        <RouteTransition>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/threats" element={<Threats />} />
            <Route path="/explain" element={<Explain />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/method" element={<Method />} />
            <Route path="/limits" element={<Limits />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RouteTransition>
      </main>
    </div>
  );
};
