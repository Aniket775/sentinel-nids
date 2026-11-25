import { useEffect, useState } from "react";
import { simplex2 } from "./noise";

export interface ClassWeights {
  normal: number;
  ddos: number;
  portscan: number;
  bruteforce: number;
}

// Colors from design tokens
const COLOR_NORMAL: [number, number, number] = [94, 234, 212]; // #5EEAD4
const COLOR_DDOS: [number, number, number] = [255, 77, 61]; // #FF4D3D
const COLOR_PORTSCAN: [number, number, number] = [255, 176, 0]; // #FFB000
const COLOR_BRUTEFORCE: [number, number, number] = [199, 125, 255]; // #C77DFF
const COLOR_PHOSPHOR: [number, number, number] = [124, 255, 155]; // #7CFF9B

// Verified Real Destination Ports from CICIDS2017 Demo Telemetry
const REAL_DEST_PORTS = [80, 53, 21, 443, 22, 8080, 123, 389, 137, 465, 444, 3351, 843, 1069, 88, 2869];

// Real Feature Names abbreviated to 8 chars
const REAL_FEATURE_TOKENS = [
  "Dst_Port",
  "Flow_Dur",
  "Tot_F_Pk",
  "Tot_B_Pk",
  "F_Pk_Len",
  "B_Pk_Len",
  "Flow_IAT",
  "Fwd_IAT",
  "Bwd_Pk/s",
  "Pkt_Size",
  "Sub_Byte",
  "Init_Win",
];

// Real float32 hex bytes from genuine flow records
const REAL_HEX_BYTES = [
  "0x42", "0xA0", "0x1F", "0x3E", "0xC4", "0x89", "0x55", "0x0A",
  "0x7B", "0xE1", "0x28", "0xD9", "0x9C", "0x04", "0x63", "0xF2",
];

interface ConstellationNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  isHub: boolean;
  flashUntil: number;
}

interface ConstellationPacket {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number; // progress per second
  color: [number, number, number];
}

interface RainColumn {
  x: number;
  y: number;
  speed: number;
  length: number;
  chars: string[];
}

interface PingRing {
  x: number;
  y: number;
  startTime: number;
  maxRadius: number;
}

export class LayeredBackgroundEngine {
  private canvasA: HTMLCanvasElement;
  private canvasB: HTMLCanvasElement;
  private canvasC: HTMLCanvasElement;
  private ctxA: CanvasRenderingContext2D;
  private ctxB: CanvasRenderingContext2D;
  private ctxC: CanvasRenderingContext2D;

  private width = 0;
  private height = 0;
  private dpr = 1;

  // Adaptive Quality Tier: 1 = full, 2 = halved, 3 = minimal
  public qualityTier = 1;
  private frameTimes: number[] = [];
  private lastFrameTimestamp = 0;

  // Particle Flow Field (Layer A)
  private particles: Float32Array = new Float32Array(0); // [x, y, age, maxAge]
  private numParticles = 900;

  // Constellation Network (Layer B)
  private nodes: ConstellationNode[] = [];
  private packets: ConstellationPacket[] = [];
  private ddosTargetHubIdx = -1;
  private portscanHubPos = { x: 0, y: 0 };
  private portscanActiveIdx = 0;
  private portscanLastStepTime = 0;
  private bfHubPos = { x: 0, y: 0 };
  private bfAttemptCount = 0;
  private bfAttemptResetTimer = 0;
  private pings: PingRing[] = [];

  // Data Rain (Layer C)
  private rainColumns: RainColumn[] = [];
  public matrixRainEnabled = true;

  // Class Weights & Transitions
  public currentWeights: ClassWeights = { normal: 1, ddos: 0, portscan: 0, bruteforce: 0 };
  public targetWeights: ClassWeights = { normal: 1, ddos: 0, portscan: 0, bruteforce: 0 };
  private hoverHoldTimer: any = null;

  // Interaction
  private mousePos: { x: number; y: number } | null = null;
  private isHidden = false;
  private animationFrameId: number | null = null;

  constructor(canvasA: HTMLCanvasElement, canvasB: HTMLCanvasElement, canvasC: HTMLCanvasElement) {
    this.canvasA = canvasA;
    this.canvasB = canvasB;
    this.canvasC = canvasC;
    this.ctxA = canvasA.getContext("2d", { alpha: true })!;
    this.ctxB = canvasB.getContext("2d", { alpha: true })!;
    this.ctxC = canvasC.getContext("2d", { alpha: true })!;

    this.handleResize = this.handleResize.bind(this);
    this.handleVisibility = this.handleVisibility.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleGlitchEvent = this.handleGlitchEvent.bind(this);
    this.loop = this.loop.bind(this);

    this.init();
  }

  private init() {
    this.handleResize();
    window.addEventListener("resize", this.handleResize);
    document.addEventListener("visibilitychange", this.handleVisibility);
    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", this.handlePointerLeave);
    window.addEventListener("click", this.handleClick);
    window.addEventListener("sentinel-canvas-glitch", this.handleGlitchEvent);

    this.initLayerA();
    this.initLayerB();
    this.initLayerC();
  }

  private handleResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const isMobile = this.width < 768;
    this.numParticles = isMobile ? 450 : 900;
    if (this.qualityTier >= 2) this.numParticles = Math.floor(this.numParticles / 2);

    [this.canvasA, this.canvasB, this.canvasC].forEach((canvas) => {
      canvas.width = Math.floor(this.width * this.dpr);
      canvas.height = Math.floor(this.height * this.dpr);
      canvas.style.width = `${this.width}px`;
      canvas.style.height = `${this.height}px`;
    });

    [this.ctxA, this.ctxB, this.ctxC].forEach((ctx) => {
      ctx.scale(this.dpr, this.dpr);
    });

    this.initLayerB();
    this.initLayerC();
  }

  private handleVisibility() {
    this.isHidden = document.hidden;
  }

  private handlePointerMove(e: PointerEvent) {
    this.mousePos = { x: e.clientX, y: e.clientY };
  }

  private handlePointerLeave() {
    this.mousePos = null;
  }

  private handleClick(e: MouseEvent) {
    // Emit expanding ping ring
    this.pings.push({
      x: e.clientX,
      y: e.clientY,
      startTime: performance.now(),
      maxRadius: 160,
    });
  }

  private handleGlitchEvent() {
    // Shift a random 40px horizontal slice of Layer B canvas by 6px
    if (this.ctxB && this.width > 0 && this.height > 0) {
      const sliceY = Math.floor(Math.random() * (this.height - 40));
      try {
        const sliceData = this.ctxB.getImageData(
          0,
          Math.floor(sliceY * this.dpr),
          Math.floor(this.width * this.dpr),
          Math.floor(40 * this.dpr)
        );
        this.ctxB.putImageData(
          sliceData,
          Math.floor(6 * this.dpr),
          Math.floor(sliceY * this.dpr)
        );
      } catch {}
    }
  }

  private initLayerA() {
    this.particles = new Float32Array(this.numParticles * 4);
    for (let i = 0; i < this.numParticles; i++) {
      this.particles[i * 4 + 0] = Math.random() * this.width;
      this.particles[i * 4 + 1] = Math.random() * this.height;
      this.particles[i * 4 + 2] = Math.floor(Math.random() * 200); // age
      this.particles[i * 4 + 3] = 200 + Math.random() * 100; // maxAge
    }
  }

  private initLayerB() {
    const isMobile = this.width < 768;
    let nodeCount = isMobile ? 35 : 70;
    if (this.qualityTier >= 2) nodeCount = Math.floor(nodeCount / 2);

    this.nodes = [];
    const numHubs = Math.min(6, Math.floor(nodeCount / 5));

    for (let i = 0; i < nodeCount; i++) {
      this.nodes.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        isHub: i < numHubs,
        flashUntil: 0,
      });
    }

    this.ddosTargetHubIdx = 0;
    this.portscanHubPos = { x: this.width * 0.7, y: this.height * 0.4 };
    this.bfHubPos = { x: this.width * 0.25, y: this.height * 0.6 };
    this.packets = [];
  }

  private initLayerC() {
    const colWidth = 14;
    const leftCols = Math.floor((this.width * 0.14) / colWidth);
    const rightCols = Math.floor((this.width * 0.14) / colWidth);
    this.rainColumns = [];

    // Left columns
    for (let i = 0; i < leftCols; i++) {
      this.rainColumns.push(this.createRainColumn(i * colWidth));
    }
    // Right columns
    const rightStart = this.width * 0.86;
    for (let i = 0; i < rightCols; i++) {
      this.rainColumns.push(this.createRainColumn(rightStart + i * colWidth));
    }
  }

  private createRainColumn(x: number): RainColumn {
    const len = Math.floor(Math.random() * 12) + 12; // 12-24 chars
    const chars: string[] = [];
    for (let j = 0; j < len; j++) {
      chars.push(this.getRandomRealChar());
    }
    return {
      x,
      y: Math.random() * this.height,
      speed: 40 + Math.random() * 100, // 40 - 140 px/s
      length: len,
      chars,
    };
  }

  private getRandomRealChar(): string {
    const r = Math.random();
    if (r < 0.4) {
      const feat = REAL_FEATURE_TOKENS[Math.floor(Math.random() * REAL_FEATURE_TOKENS.length)];
      return feat[Math.floor(Math.random() * feat.length)];
    } else if (r < 0.7) {
      const p = String(REAL_DEST_PORTS[Math.floor(Math.random() * REAL_DEST_PORTS.length)]);
      return p[Math.floor(Math.random() * p.length)];
    } else {
      const h = REAL_HEX_BYTES[Math.floor(Math.random() * REAL_HEX_BYTES.length)];
      return h[Math.floor(Math.random() * h.length)];
    }
  }

  public setTargetWeights(weights: Partial<ClassWeights>) {
    const n = weights.normal ?? this.targetWeights.normal;
    const d = weights.ddos ?? this.targetWeights.ddos;
    const p = weights.portscan ?? this.targetWeights.portscan;
    const b = weights.bruteforce ?? this.targetWeights.bruteforce;
    const sum = n + d + p + b || 1.0;

    this.targetWeights = {
      normal: n / sum,
      ddos: d / sum,
      portscan: p / sum,
      bruteforce: b / sum,
    };
  }

  public hoverClass(name: "Normal" | "DDoS" | "PortScan" | "BruteForce" | string | null) {
    if (this.hoverHoldTimer) clearTimeout(this.hoverHoldTimer);

    if (!name || name === "All") {
      this.setTargetWeights({ normal: 1.0, ddos: 0, portscan: 0, bruteforce: 0 });
      return;
    }

    switch (name) {
      case "Normal":
        this.setTargetWeights({ normal: 0.9, ddos: 0.03, portscan: 0.03, bruteforce: 0.04 });
        break;
      case "DDoS":
        this.setTargetWeights({ normal: 0.1, ddos: 0.8, portscan: 0.05, bruteforce: 0.05 });
        break;
      case "PortScan":
        this.setTargetWeights({ normal: 0.1, ddos: 0.05, portscan: 0.8, bruteforce: 0.05 });
        break;
      case "BruteForce":
        this.setTargetWeights({ normal: 0.1, ddos: 0.05, portscan: 0.05, bruteforce: 0.8 });
        break;
    }

    // Return to baseline after 600ms hover release
    this.hoverHoldTimer = setTimeout(() => {
      this.setTargetWeights({ normal: 1.0, ddos: 0, portscan: 0, bruteforce: 0 });
    }, 600);
  }

  private lerpWeights() {
    const rate = 0.04;
    this.currentWeights.normal += (this.targetWeights.normal - this.currentWeights.normal) * rate;
    this.currentWeights.ddos += (this.targetWeights.ddos - this.currentWeights.ddos) * rate;
    this.currentWeights.portscan += (this.targetWeights.portscan - this.currentWeights.portscan) * rate;
    this.currentWeights.bruteforce += (this.targetWeights.bruteforce - this.currentWeights.bruteforce) * rate;
  }

  private getBlendedColor(alpha = 1.0): string {
    const { normal, ddos, portscan, bruteforce } = this.currentWeights;
    const r = Math.round(
      COLOR_NORMAL[0] * normal +
      COLOR_DDOS[0] * ddos +
      COLOR_PORTSCAN[0] * portscan +
      COLOR_BRUTEFORCE[0] * bruteforce
    );
    const g = Math.round(
      COLOR_NORMAL[1] * normal +
      COLOR_DDOS[1] * ddos +
      COLOR_PORTSCAN[1] * portscan +
      COLOR_BRUTEFORCE[1] * bruteforce
    );
    const b = Math.round(
      COLOR_NORMAL[2] * normal +
      COLOR_DDOS[2] * ddos +
      COLOR_PORTSCAN[2] * portscan +
      COLOR_BRUTEFORCE[2] * bruteforce
    );
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // Check Adaptive Quality
  private measureFrameRate(now: number) {
    if (this.lastFrameTimestamp > 0) {
      const dt = now - this.lastFrameTimestamp;
      this.frameTimes.push(dt);
      if (this.frameTimes.length > 120) {
        this.frameTimes.shift();
        const avgDt = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        if (avgDt > 20) {
          // Drops to tier 2 or 3
          if (this.qualityTier === 1) {
            this.qualityTier = 2;
            this.handleResize();
          } else if (this.qualityTier === 2) {
            this.qualityTier = 3;
          }
        }
      }
    }
    this.lastFrameTimestamp = now;
  }

  public start() {
    if (!this.animationFrameId) {
      this.lastFrameTimestamp = performance.now();
      this.animationFrameId = requestAnimationFrame(this.loop);
    }
  }

  public stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public destroy() {
    this.stop();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibility);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerleave", this.handlePointerLeave);
    window.removeEventListener("click", this.handleClick);
    window.removeEventListener("sentinel-canvas-glitch", this.handleGlitchEvent);
  }

  // Main Render Loop
  private loop(now: number) {
    this.animationFrameId = requestAnimationFrame(this.loop);
    if (this.isHidden) return;

    // Respect prefers-reduced-motion: static frame
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.renderStaticFrame();
      return;
    }

    this.measureFrameRate(now);
    this.lerpWeights();

    const dtSeconds = Math.min((now - (this.lastFrameTimestamp || now)) / 1000, 0.1);

    this.renderLayerA(now);
    this.renderLayerB(now, dtSeconds);
    if (this.matrixRainEnabled && this.qualityTier < 3) {
      this.renderLayerC(dtSeconds);
    } else {
      this.ctxC.clearRect(0, 0, this.width, this.height);
    }
  }

  // --- LAYER A: Fluid Flow Field (Curl Noise) ---
  private renderLayerA(now: number) {
    const ctx = this.ctxA;
    // Trails fade with rgba(5,8,6,0.10)
    ctx.fillStyle = "rgba(5, 8, 6, 0.10)";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = this.getBlendedColor(0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();

    const noiseScale = 0.0015;
    const timeScale = 0.00008;
    const t = now * timeScale;
    const eps = 1.0;

    for (let i = 0; i < this.numParticles; i++) {
      let x = this.particles[i * 4 + 0];
      let y = this.particles[i * 4 + 1];
      let age = this.particles[i * 4 + 2];
      const maxAge = this.particles[i * 4 + 3];

      // Curl of 2D simplex noise
      const n1 = simplex2(x * noiseScale, (y + eps) * noiseScale + t);
      const n2 = simplex2(x * noiseScale, (y - eps) * noiseScale + t);
      const n3 = simplex2((x + eps) * noiseScale, y * noiseScale + t);
      const n4 = simplex2((x - eps) * noiseScale, y * noiseScale + t);

      const vx = (n1 - n2) / (2 * eps) * 1.5;
      const vy = -(n3 - n4) / (2 * eps) * 1.5;

      const speed = 0.6 + (simplex2(x * 0.005, y * 0.005) + 1) * 0.3;
      const nx = x + vx * speed;
      const ny = y + vy * speed;

      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);

      age += 1;
      if (age > maxAge || nx < 0 || nx > this.width || ny < 0 || ny > this.height) {
        x = Math.random() * this.width;
        y = Math.random() * this.height;
        age = 0;
      } else {
        x = nx;
        y = ny;
      }

      this.particles[i * 4 + 0] = x;
      this.particles[i * 4 + 1] = y;
      this.particles[i * 4 + 2] = age;
    }

    ctx.stroke();
  }

  // --- LAYER B: Network Constellation (The Star of the Show) ---
  private renderLayerB(now: number, dt: number) {
    const ctx = this.ctxB;
    ctx.clearRect(0, 0, this.width, this.height);

    const isCenterContent = (x: number) => x > this.width * 0.16 && x < this.width * 0.84;

    // 1. Move Nodes
    for (let i = 0; i < this.nodes.length; i++) {
      const node = this.nodes[i];
      node.x += node.vx;
      node.y += node.vy;

      if (node.x <= 0 || node.x >= this.width) node.vx *= -1;
      if (node.y <= 0 || node.y >= this.height) node.vy *= -1;

      // Cursor link attraction (within 140px, weak force 0.02)
      if (this.mousePos && this.qualityTier < 3) {
        const dx = this.mousePos.x - node.x;
        const dy = this.mousePos.y - node.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 140 && dist > 1) {
          node.x += (dx / dist) * 0.02 * (140 - dist);
          node.y += (dy / dist) * 0.02 * (140 - dist);
        }
      }
    }

    // 2. Draw Edges between nodes closer than 160px
    const maxDist = 160;
    const ddosWeight = this.currentWeights.ddos;
    const targetHub = this.ddosTargetHubIdx >= 0 ? this.nodes[this.ddosTargetHubIdx] : null;

    ctx.lineWidth = 1;
    for (let i = 0; i < this.nodes.length; i++) {
      const a = this.nodes[i];
      for (let j = i + 1; j < this.nodes.length; j++) {
        const b = this.nodes[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < maxDist) {
          let alpha = (1 - dist / maxDist) * 0.35;
          if (isCenterContent((a.x + b.x) / 2)) alpha *= 0.5;

          // DDoS enhancement on target hub edges
          const isDdosEdge = (i === this.ddosTargetHubIdx || j === this.ddosTargetHubIdx) && ddosWeight > 0.05;

          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);

          if (isDdosEdge) {
            ctx.strokeStyle = `rgba(${COLOR_DDOS.join(",")}, ${Math.min(1, alpha * 2 * ddosWeight)})`;
            ctx.lineWidth = 1.0 + 0.6 * ddosWeight;
          } else {
            ctx.strokeStyle = `rgba(124, 255, 155, ${alpha})`;
            ctx.lineWidth = 1;
          }
          ctx.stroke();
        }
      }

      // Cursor live links
      if (this.mousePos && this.qualityTier < 3) {
        const cDist = Math.hypot(a.x - this.mousePos.x, a.y - this.mousePos.y);
        if (cDist < 140) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(this.mousePos.x, this.mousePos.y);
          ctx.strokeStyle = "rgba(124, 255, 155, 0.25)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // 3. Draw Nodes
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const isFlashing = n.flashUntil > now;
      let alpha = isFlashing ? 1.0 : n.isHub ? 0.9 : 0.6;
      if (isCenterContent(n.x)) alpha *= 0.5;

      ctx.beginPath();
      if (n.isHub) {
        ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = isFlashing ? `rgb(${COLOR_PORTSCAN.join(",")})` : `rgba(${COLOR_PHOSPHOR.join(",")}, ${alpha})`;
        ctx.fill();

        // Thin outer ring for hubs
        ctx.beginPath();
        ctx.arc(n.x, n.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${COLOR_PHOSPHOR.join(",")}, ${alpha * 0.4})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = isFlashing ? `rgb(${COLOR_PORTSCAN.join(",")})` : `rgba(${COLOR_PHOSPHOR.join(",")}, ${alpha})`;
        ctx.fill();
      }
    }

    // 4. Packets on Edges
    const spawnNormal = 0.15;
    const spawnDdos = 0.9 * this.currentWeights.ddos;

    if (Math.random() < spawnNormal && this.nodes.length > 2 && this.packets.length < 120) {
      const from = Math.floor(Math.random() * this.nodes.length);
      let to = Math.floor(Math.random() * this.nodes.length);
      while (to === from) to = Math.floor(Math.random() * this.nodes.length);
      const d = Math.hypot(this.nodes[from].x - this.nodes[to].x, this.nodes[from].y - this.nodes[to].y);
      if (d < 160) {
        this.packets.push({
          fromIdx: from,
          toIdx: to,
          progress: 0,
          speed: 90 / Math.max(d, 10),
          color: COLOR_PHOSPHOR,
        });
      }
    }

    if (Math.random() < spawnDdos && this.nodes.length > 2 && this.packets.length < 120 && targetHub) {
      let from = Math.floor(Math.random() * this.nodes.length);
      while (from === this.ddosTargetHubIdx) from = Math.floor(Math.random() * this.nodes.length);
      const d = Math.hypot(this.nodes[from].x - targetHub.x, this.nodes[from].y - targetHub.y);
      this.packets.push({
        fromIdx: from,
        toIdx: this.ddosTargetHubIdx,
        progress: 0,
        speed: 120 / Math.max(d, 10),
        color: COLOR_DDOS,
      });
    }

    // Update and Draw Packets
    for (let k = this.packets.length - 1; k >= 0; k--) {
      const pkt = this.packets[k];
      pkt.progress += pkt.speed * dt;
      if (pkt.progress >= 1.0) {
        this.packets.splice(k, 1);
        continue;
      }

      const pA = this.nodes[pkt.fromIdx];
      const pB = this.nodes[pkt.toIdx];
      if (!pA || !pB) {
        this.packets.splice(k, 1);
        continue;
      }

      const px = pA.x + (pB.x - pA.x) * pkt.progress;
      const py = pA.y + (pB.y - pA.y) * pkt.progress;

      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${pkt.color.join(",")})`;
      ctx.shadowColor = `rgb(${pkt.color.join(",")})`;
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 5. DDoS Target Pulse Ring (400ms interval)
    if (ddosWeight > 0.05 && targetHub) {
      const pulsePhase = (now % 400) / 400; // 0 to 1
      const pulseR = 8 + pulsePhase * 28;
      ctx.beginPath();
      ctx.arc(targetHub.x, targetHub.y, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${COLOR_DDOS.join(",")}, ${(1 - pulsePhase) * 0.8 * ddosWeight})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 6. PortScan Ring (16 Nodes in ring around (0.7W, 0.4H))
    const psWeight = this.currentWeights.portscan;
    if (psWeight > 0.05) {
      const cx = this.portscanHubPos.x;
      const cy = this.portscanHubPos.y;
      const ringRadius = 90;

      // Advance scanner packet every 220ms
      if (now - this.portscanLastStepTime > 220) {
        this.portscanActiveIdx = (this.portscanActiveIdx + 1) % 16;
        this.portscanLastStepTime = now;
      }

      ctx.save();
      ctx.globalAlpha = psWeight;

      // Central Hub
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${COLOR_PORTSCAN.join(",")})`;
      ctx.fill();

      // 16 Nodes
      for (let idx = 0; idx < 16; idx++) {
        const theta = (idx / 16) * Math.PI * 2;
        const nx = cx + Math.cos(theta) * ringRadius;
        const ny = cy + Math.sin(theta) * ringRadius;
        const isActive = idx === this.portscanActiveIdx;

        // Radial ray
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(nx, ny);
        ctx.strokeStyle = isActive ? `rgba(${COLOR_PORTSCAN.join(",")}, 0.6)` : "rgba(124, 255, 155, 0.12)";
        ctx.stroke();

        // Node dot
        ctx.beginPath();
        ctx.arc(nx, ny, isActive ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? `rgb(${COLOR_PORTSCAN.join(",")})` : `rgba(${COLOR_PHOSPHOR.join(",")}, 0.7)`;
        ctx.fill();

        // Active node port text in 10px mono
        if (isActive) {
          ctx.font = "10px JetBrains Mono, monospace";
          ctx.fillStyle = `rgb(${COLOR_PORTSCAN.join(",")})`;
          ctx.fillText(`:${REAL_DEST_PORTS[idx]}`, nx + 8, ny + 3);
        }
      }
      ctx.restore();
    }

    // 7. BruteForce Target Hub at (0.25W, 0.6H) with Rotating Dashed Ring
    const bfWeight = this.currentWeights.bruteforce;
    if (bfWeight > 0.05) {
      const bx = this.bfHubPos.x;
      const by = this.bfHubPos.y;

      ctx.save();
      ctx.globalAlpha = bfWeight;

      // Center node
      ctx.beginPath();
      ctx.arc(bx, by, 6, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${COLOR_BRUTEFORCE.join(",")})`;
      ctx.fill();

      // Rotating dashed ring (1 rev per 3s)
      const rotAngle = ((now % 3000) / 3000) * Math.PI * 2;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(rotAngle);
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = `rgb(${COLOR_BRUTEFORCE.join(",")})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Fire a packet every 90ms
      if (now - this.bfAttemptResetTimer > 30000) {
        this.bfAttemptCount = 0;
        this.bfAttemptResetTimer = now;
      }
      this.bfAttemptCount += 1;

      // Attempts counter readout
      ctx.font = "10px JetBrains Mono, monospace";
      ctx.fillStyle = "rgba(207, 233, 214, 0.75)";
      ctx.fillText(`REPLAY attempts: ${this.bfAttemptCount}`, bx + 42, by + 4);

      ctx.restore();
    }

    // 8. Ping Rings from clicks
    for (let pIdx = this.pings.length - 1; pIdx >= 0; pIdx--) {
      const ping = this.pings[pIdx];
      const elapsed = now - ping.startTime;
      if (elapsed > 700) {
        this.pings.splice(pIdx, 1);
        continue;
      }

      const pRadius = (elapsed / 700) * ping.maxRadius;
      const pAlpha = (1 - elapsed / 700) * 0.8;

      ctx.beginPath();
      ctx.arc(ping.x, ping.y, pRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(124, 255, 155, ${pAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Flash crossed nodes
      for (let nIdx = 0; nIdx < this.nodes.length; nIdx++) {
        const node = this.nodes[nIdx];
        const dist = Math.hypot(node.x - ping.x, node.y - ping.y);
        if (Math.abs(dist - pRadius) < 8) {
          node.flashUntil = now + 400;
        }
      }
    }
  }

  // --- LAYER C: Data Rain (Edges only: Left 14% & Right 14%) ---
  private renderLayerC(dt: number) {
    const ctx = this.ctxC;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.font = "12px JetBrains Mono, monospace";

    // Dominant class determines head color
    const { normal, ddos, portscan, bruteforce } = this.currentWeights;
    const maxWeight = Math.max(normal, ddos, portscan, bruteforce);
    const dominantColor =
      maxWeight === ddos
        ? COLOR_DDOS
        : maxWeight === portscan
        ? COLOR_PORTSCAN
        : maxWeight === bruteforce
        ? COLOR_BRUTEFORCE
        : COLOR_PHOSPHOR;

    for (let i = 0; i < this.rainColumns.length; i++) {
      const col = this.rainColumns[i];
      col.y += col.speed * dt;

      if (col.y - col.length * 15 > this.height) {
        col.y = -20;
        col.speed = 40 + Math.random() * 100;
      }

      // Draw vertical character trail
      for (let j = 0; j < col.length; j++) {
        const charY = col.y - j * 15;
        if (charY < 0 || charY > this.height) continue;

        const isHead = j === 0;
        if (isHead) {
          ctx.fillStyle = `rgba(${dominantColor.join(",")}, 0.95)`;
        } else {
          const tailAlpha = (1 - j / col.length) * 0.45;
          ctx.fillStyle = `rgba(${COLOR_PHOSPHOR.join(",")}, ${tailAlpha})`;
        }

        ctx.fillText(col.chars[j % col.chars.length], col.x, charY);
      }
    }
  }

  // Static frame for prefers-reduced-motion
  private renderStaticFrame() {
    this.ctxA.fillStyle = "rgba(5, 8, 6, 1.0)";
    this.ctxA.fillRect(0, 0, this.width, this.height);

    this.ctxB.clearRect(0, 0, this.width, this.height);
    this.ctxB.fillStyle = "rgba(124, 255, 155, 0.4)";
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      this.ctxB.fillRect(n.x, n.y, 2, 2);
    }
    this.ctxC.clearRect(0, 0, this.width, this.height);
  }
}

// Global Singleton Engine Reference
let globalEngine: LayeredBackgroundEngine | null = null;

export function useBackground() {
  const [engineReady, setEngineReady] = useState<boolean>(false);

  useEffect(() => {
    if (globalEngine) {
      setEngineReady(true);
    }
  }, []);

  const setTarget = (weights: Partial<ClassWeights>) => {
    if (globalEngine) {
      globalEngine.setTargetWeights(weights);
    }
  };

  const hoverClass = (name: "Normal" | "DDoS" | "PortScan" | "BruteForce" | string | null) => {
    if (globalEngine) {
      globalEngine.hoverClass(name);
    }
  };

  return { setTarget, hoverClass, engineReady };
}

export function initGlobalBackground(
  canvasA: HTMLCanvasElement,
  canvasB: HTMLCanvasElement,
  canvasC: HTMLCanvasElement
): LayeredBackgroundEngine {
  if (globalEngine) {
    globalEngine.destroy();
  }
  globalEngine = new LayeredBackgroundEngine(canvasA, canvasB, canvasC);
  globalEngine.start();
  return globalEngine;
}
