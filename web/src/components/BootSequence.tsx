import React, { useState, useEffect } from "react";
import { fetchMetrics } from "../api/client";

interface BootSequenceProps {
  onComplete: () => void;
}

export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // If prefers-reduced-motion or already booted, skip immediately
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      sessionStorage.getItem("sentinel_booted") === "true" ||
      window.location.search.includes("noboot")
    ) {
      onComplete();
      return;
    }

    let active = true;

    // Fetch real metrics to populate boot log
    fetchMetrics()
      .then((m) => {
        if (!active) return;
        const totalTest = m.test_sample_size || 21865;
        const champion = m.champion_model || "XGBoost";
        const scriptLines = [
          "> mounting models/selected_model ... ok",
          `> classes: ${m.classes ? m.classes.length : 4}`,
          "> features selected: 25",
          `> champion: ${champion}`,
          `> holdout n: ${totalTest.toLocaleString()} records`,
          "> mode: offline / read-only",
        ];

        let idx = 0;
        const interval = setInterval(() => {
          if (!active) {
            clearInterval(interval);
            return;
          }
          if (idx < scriptLines.length) {
            const nextLine = scriptLines[idx];
            setLines((prev) => [...prev, nextLine]);
            idx++;
          } else {
            clearInterval(interval);
            finishBoot();
          }
        }, 280);
      })
      .catch(() => {
        if (!active) return;
        setLines([
          "> mounting models/selected_model ... ok",
          "> classes: 4",
          "> features selected: 25",
          "> mode: offline / read-only",
        ]);
        finishBoot();
      });

    const finishBoot = () => {
      setTimeout(() => {
        setIsFading(true);
        setTimeout(() => {
          sessionStorage.setItem("sentinel_booted", "true");
          onComplete();
        }, 400);
      }, 500);
    };

    // User can skip at any time with click or keypress
    const handleSkip = () => {
      sessionStorage.setItem("sentinel_booted", "true");
      onComplete();
    };

    window.addEventListener("keydown", handleSkip, { once: true });
    window.addEventListener("click", handleSkip, { once: true });

    return () => {
      active = false;
      window.removeEventListener("keydown", handleSkip);
      window.removeEventListener("click", handleSkip);
    };
  }, [onComplete]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "var(--void)",
        color: "var(--phosphor)",
        zIndex: 9999,
        padding: "3rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        fontFamily: "var(--font-mono)",
        fontSize: "1rem",
        lineHeight: 1.8,
        opacity: isFading ? 0 : 1,
        transition: "opacity 400ms ease-out",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      <div style={{ maxWidth: 640 }}>
        <div style={{ color: "var(--dim)", fontSize: "0.8rem", marginBottom: "1rem" }}>
          SENTINEL_DIAGNOSTICS_SUBSYSTEM v1.0.0
        </div>
        {lines.map((l, i) => (
          <div key={i} style={{ textShadow: "0 0 6px var(--phosphor-glow)" }}>
            {l}
          </div>
        ))}
        <div style={{ marginTop: "1.5rem", color: "var(--dim)", fontSize: "0.75rem" }}>
          [ Press any key or click to bypass initialization sequence ]
        </div>
      </div>
    </div>
  );
};
