import React from "react";
import { NavLink } from "react-router-dom";

export const Navigation: React.FC = () => {
  const links = [
    { to: "/", label: "OVERVIEW" },
    { to: "/analyze", label: "ANALYZE" },
    { to: "/threats", label: "THREATS" },
    { to: "/explain", label: "EXPLAIN" },
    { to: "/compare", label: "COMPARE" },
    { to: "/method", label: "METHOD" },
    { to: "/limits", label: "LIMITS" },
  ];

  const handleOpenTerminal = () => {
    window.dispatchEvent(new CustomEvent("sentinel-toggle-terminal"));
  };

  return (
    <header
      style={{
        borderBottom: "1px solid var(--line)",
        background: "rgba(10, 16, 12, 0.95)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        width: "100%",
        userSelect: "none",
      }}
    >
      <div
        style={{
          maxWidth: "1380px",
          margin: "0 auto",
          padding: "0 20px",
          height: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Brand Terminal Identifier */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <NavLink
            to="/"
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--phosphor)",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                background: "var(--phosphor)",
                display: "inline-block",
                boxShadow: "0 0 6px var(--phosphor-glow)",
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.7rem",
                letterSpacing: "0.06em",
                color: "var(--phosphor)",
                textShadow: "0 0 6px var(--phosphor-glow)",
                lineHeight: 1,
              }}
            >
              SENTINEL_NIDS
            </span>
          </NavLink>

          <span style={{ color: "var(--dim)", fontSize: "0.75rem" }}>::</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.7rem",
              color: "var(--dim)",
              letterSpacing: "0.05em",
            }}
          >
            [OFFLINE_DIAGNOSTICS]
          </span>
        </div>

        {/* Terminal Navigation Links */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flexWrap: "wrap",
          }}
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              style={({ isActive }) => ({
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                padding: "4px 8px",
                fontFamily: "var(--font-mono)",
                fontSize: "0.75rem",
                letterSpacing: "0.06em",
                color: isActive ? "var(--phosphor)" : "var(--dim)",
                border: isActive ? "1px solid var(--phosphor)" : "1px solid transparent",
                background: isActive ? "rgba(124, 255, 155, 0.08)" : "transparent",
                textShadow: isActive ? "0 0 6px var(--phosphor-glow)" : "none",
                transition: "all var(--motion-fast) var(--ease-out)",
              })}
            >
              <span>{link.label}</span>
            </NavLink>
          ))}

          {/* Quick Terminal Drawer Toggle Button */}
          <button
            onClick={handleOpenTerminal}
            style={{
              marginLeft: "8px",
              padding: "3px 7px",
              fontSize: "0.7rem",
              border: "1px solid var(--line)",
              color: "var(--dim)",
              background: "transparent",
            }}
            title="Open CLI Terminal Drawer (Backtick or Ctrl+K)"
          >
            [ ` SHELL ]
          </button>
        </nav>
      </div>
    </header>
  );
};
