import React, { useState, useEffect } from "react";

interface DecryptTextProps {
  text: string;
  durationMs?: number;
  className?: string;
  style?: React.CSSProperties;
}

const GLYPHS = "01!<>-_\\/[]{}—=+*^?#%&";

export const DecryptText: React.FC<DecryptTextProps> = ({
  text,
  durationMs = 600,
  className = "",
  style = {},
}) => {
  const [displayText, setDisplayText] = useState<string>(text);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayText(text);
      return;
    }

    const length = text.length;
    if (length === 0) return;

    const fps = 30;
    const totalFrames = Math.max(1, Math.floor((durationMs / 1000) * fps));
    let frame = 0;

    const interval = setInterval(() => {
      frame++;
      const progress = frame / totalFrames; // 0 to 1
      const settledCount = Math.floor(progress * length);

      let scrambled = "";
      for (let i = 0; i < length; i++) {
        if (i < settledCount) {
          scrambled += text[i];
        } else if (text[i] === " " || text[i] === "\n") {
          scrambled += text[i];
        } else {
          scrambled += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
      }

      setDisplayText(scrambled);

      if (frame >= totalFrames) {
        clearInterval(interval);
        setDisplayText(text);
      }
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [text, durationMs]);

  return (
    <span className={className} style={style}>
      {displayText}
    </span>
  );
};
