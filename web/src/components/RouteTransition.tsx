import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import gsap from "gsap";

interface RouteTransitionProps {
  children: React.ReactNode;
}

export const RouteTransition: React.FC<RouteTransitionProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (!containerRef.current) return;

    // Respect prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Scroll window to top on route change
    window.scrollTo({ top: 0, behavior: "instant" });

    // Stagger reveal on headings, cards, and sections
    const elements = containerRef.current.querySelectorAll(".stagger-in, h1, h2, .tick-box, .editorial-col");
    if (elements.length > 0) {
      gsap.fromTo(
        elements,
        {
          opacity: 0,
          y: 14,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.4, // 400ms
          stagger: 0.05,
          ease: "power2.out", // cubic-bezier(0.16, 1, 0.3, 1)
          clearProps: "all",
        }
      );
    }
  }, [location.pathname]);

  return <div ref={containerRef}>{children}</div>;
};
