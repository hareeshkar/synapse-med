import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════════════
// SYNAPSE MED | OPTIMIZED SPLASH SCREEN (v2.0)
// ═══════════════════════════════════════════════════════════════════════════════════
// Performance optimizations:
// - Reduced particle count for better performance
// - CSS-based animations where possible (GPU accelerated)
// - Memoized static data
// - Lazy canvas initialization
// - Reduced re-renders with useCallback

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIG: DNA STAR GEOMETRY (Genesis) - Memoized outside component
// ─────────────────────────────────────────────────────────────────────────────────

const DNA_HELIX_POINTS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
  const radius = 160 + (i % 2) * 50;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    delay: i * 60,
    angle,
    radius,
  };
});

const STAR_CONNECTIONS = [
  { from: 0, to: 6 },
  { from: 1, to: 7 },
  { from: 2, to: 8 },
  { from: 3, to: 9 },
  { from: 4, to: 10 },
  { from: 5, to: 11 },
  { from: 0, to: 4 },
  { from: 4, to: 8 },
  { from: 8, to: 0 },
  { from: 2, to: 6 },
  { from: 6, to: 10 },
  { from: 10, to: 2 },
];

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIG: RADIATING TEXT (Genesis)
// ─────────────────────────────────────────────────────────────────────────────────

const SYNAPSE_LETTERS = "SYNAPSE".split("").map((char, i) => ({
  char,
  finalX: -245 + i * 50,
  finalY: 0,
  delay: i * 50,
}));

const MED_LETTERS = "Med".split("").map((char, i) => ({
  char,
  finalX: 125 + i * 45,
  finalY: 0,
  delay: 350 + i * 70,
}));

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIG: MORPHOGENETIC RINGS (Telemetry) - Reduced count for performance
// ─────────────────────────────────────────────────────────────────────────────────

const RING_CONFIG = [
  { size: 380, thickness: 1, speed: 45, direction: 1, delay: 0, dash: "4 8" },
  { size: 520, thickness: 0.5, speed: 35, direction: -1, delay: 150, dash: "2 12" },
  { size: 680, thickness: 0.3, speed: 60, direction: 1, delay: 300, dash: "1 30" },
];

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIG: NEURAL PERFUSION LOGS (Telemetry)
// ─────────────────────────────────────────────────────────────────────────────────

const PERFUSION_LOGS = [
  { text: "INITIALIZING CORTICAL MATRIX...", delay: 0 },
  { text: "ESTABLISHING NEURAL PATHWAYS...", delay: 600 },
  { text: "CALIBRATING BIO-RHYTHMS...", delay: 1200 },
  { text: "SYNCHRONIZING HEMODYNAMICS...", delay: 1800 },
  { text: "VITAL SIGNS NOMINAL.", delay: 2400 },
  { text: "CONSCIOUSNESS ONLINE.", delay: 3000 },
];

// ─────────────────────────────────────────────────────────────────────────────────
// PARTICLE SYSTEM (Optimized - Reduced count)
// ─────────────────────────────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
  delay: number;
  type: "plasma" | "neuron" | "synapse";
}

// ═══════════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════════

const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  minDuration = 8000, // Reduced default duration
}) => {
  // ─────────────────────────────────────────────────────────────────────────────
  // STATE: CHOREOGRAPHY (Minimized state updates)
  // ─────────────────────────────────────────────────────────────────────────────
  const [act, setAct] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Act 1: Singularity
  const [dotVisible, setDotVisible] = useState(false);
  const [dotPulsed, setDotPulsed] = useState(false);

  // Act 2: Naming (Text Emergence)
  const [lettersEmerging, setLettersEmerging] = useState(false);

  // Act 3: Structure (DNA Star + Rings)
  const [helixNodesVisible, setHelixNodesVisible] = useState(false);
  const [helixConnectionsVisible, setHelixConnectionsVisible] = useState(false);
  const [ringsActive, setRingsActive] = useState(false);

  // Act 4: Homeostasis (Vitals/HUD)
  const [hudVisible, setHudVisible] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);

  // Act 5: Perfusion (Neural Logs)
  const [footerVisible, setFooterVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState("");
  const [logIndex, setLogIndex] = useState(-1);

  // Vitals Data
  const [heartRate, setHeartRate] = useState(0);
  const [spO2, setSpO2] = useState(0);
  const [bp, setBp] = useState({ sys: 0, dia: 0 });

  // Act 6: Transcendence (Exit)
  const [exitProgress, setExitProgress] = useState(0);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exitAnimationRef = useRef<number>(0);
  const ecgAnimationRef = useRef<number>(0);

  // ─────────────────────────────────────────────────────────────────────────────
  // PARTICLE GENERATION (Reduced count for performance)
  // ─────────────────────────────────────────────────────────────────────────────
  const particles = useMemo<Particle[]>(() => {
    const result: Particle[] = [];

    // Reduced: 20 plasma particles (was 40)
    for (let i = 0; i < 20; i++) {
      result.push({
        id: i,
        x: Math.random() * 100,
        y: 100 + Math.random() * 20,
        size: Math.random() * 2.5 + 0.8,
        opacity: Math.random() * 0.4 + 0.15,
        duration: 12 + Math.random() * 12,
        delay: Math.random() * 6,
        type: "plasma",
      });
    }

    // Reduced: 10 orbital particles (was 18)
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      result.push({
        id: 100 + i,
        x: 50 + Math.cos(angle) * (22 + Math.random() * 12),
        y: 50 + Math.sin(angle) * (22 + Math.random() * 12),
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.3 + 0.1,
        duration: 18 + Math.random() * 8,
        delay: Math.random() * 4,
        type: "neuron",
      });
    }

    // Reduced: 6 synapse sparks (was 12)
    for (let i = 0; i < 6; i++) {
      result.push({
        id: 200 + i,
        x: 35 + Math.random() * 30,
        y: 35 + Math.random() * 30,
        size: Math.random() * 1.2 + 0.4,
        opacity: Math.random() * 0.5 + 0.3,
        duration: 2.5 + Math.random() * 3,
        delay: Math.random() * 5,
        type: "synapse",
      });
    }

    return result;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // MASTER TIMELINE ORCHESTRATION (Optimized timing)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    // ACT 1: SINGULARITY (T+0ms)
    timers.push(setTimeout(() => { setAct(1); setDotVisible(true); }, 100));
    timers.push(setTimeout(() => setDotPulsed(true), 400));

    // ACT 2: NAMING (T+600ms)
    timers.push(setTimeout(() => { setAct(2); setLettersEmerging(true); }, 600));

    // ACT 3: STRUCTURE (T+1600ms)
    timers.push(setTimeout(() => { setAct(3); setHelixNodesVisible(true); setRingsActive(true); }, 1600));
    timers.push(setTimeout(() => setHelixConnectionsVisible(true), 2000));

    // ACT 4: HOMEOSTASIS (T+2800ms)
    timers.push(setTimeout(() => { setAct(4); setTaglineVisible(true); setHudVisible(true); }, 2800));

    // ACT 5: PERFUSION (T+3600ms)
    timers.push(setTimeout(() => { setAct(5); setFooterVisible(true); setLogIndex(0); }, 3600));

    // PERFUSION LOG SEQUENCE (Faster)
    PERFUSION_LOGS.forEach((log, i) => {
      timers.push(setTimeout(() => { setCurrentLog(log.text); setLogIndex(i); }, 3600 + log.delay));
    });

    // ACT 6: TRANSCENDENCE (T+minDuration)
    timers.push(setTimeout(() => {
      setAct(6);
      const exitStart = performance.now();
      const exitDuration = 700; // Faster exit

      const animateExit = (currentTime: number) => {
        const elapsed = currentTime - exitStart;
        const progress = Math.min(elapsed / exitDuration, 1);
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setExitProgress(eased);

        if (progress < 1) {
          exitAnimationRef.current = requestAnimationFrame(animateExit);
        } else {
          onComplete();
        }
      };
      exitAnimationRef.current = requestAnimationFrame(animateExit);
    }, minDuration));

    return () => {
      timers.forEach(clearTimeout);
      if (exitAnimationRef.current) cancelAnimationFrame(exitAnimationRef.current);
    };
  }, [minDuration, onComplete]);

  // ─────────────────────────────────────────────────────────────────────────────
  // VITALS SIMULATION (Organic Drift)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hudVisible) return;

    // Boot-up sequence
    let hr = 0,
      sp = 0,
      sys = 0,
      dia = 0;
    const bootInterval = setInterval(() => {
      hr = Math.min(hr + 3, 64 + Math.floor(Math.random() * 6));
      sp = Math.min(sp + 4, 98 + Math.floor(Math.random() * 2));
      sys = Math.min(sys + 6, 118 + Math.floor(Math.random() * 6));
      dia = Math.min(dia + 3, 78 + Math.floor(Math.random() * 4));

      setHeartRate(hr);
      setSpO2(sp);
      setBp({ sys, dia });

      if (hr >= 64 && sp >= 98) clearInterval(bootInterval);
    }, 60);

    // Continuous organic drift
    const driftInterval = setInterval(() => {
      setHeartRate((prev) => {
        const drift = (Math.random() - 0.5) * 3;
        return Math.round(Math.max(60, Math.min(74, prev + drift)));
      });
      setSpO2((prev) => {
        const drift = (Math.random() - 0.5) * 0.8;
        return Math.round(Math.max(97, Math.min(100, prev + drift)));
      });
    }, 2000);

    return () => {
      clearInterval(bootInterval);
      clearInterval(driftInterval);
    };
  }, [hudVisible]);

  // ─────────────────────────────────────────────────────────────────────────────
  // ECG WAVEFORM RENDERER (Clinical-Grade)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hudVisible || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    let offset = 0;

    // ECG P-QRS-T complex generator
    const generateECGPoint = (x: number): number => {
      const cycle = (x % 110) / 110;
      const baseline = height / 2;

      if (cycle < 0.1) return baseline - Math.sin(cycle * 10 * Math.PI) * 3.5; // P wave
      if (cycle < 0.15) return baseline; // PR segment
      if (cycle < 0.18) return baseline + (cycle - 0.15) * 90; // Q wave
      if (cycle < 0.25)
        return baseline - Math.sin(((cycle - 0.18) / 0.07) * Math.PI) * 24; // R wave
      if (cycle < 0.3) return baseline + (0.3 - cycle) * 55; // S wave
      if (cycle < 0.35) return baseline; // ST segment
      if (cycle < 0.55)
        return baseline - Math.sin((cycle - 0.35) * 5 * Math.PI) * 5.5; // T wave
      return baseline;
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Grid background
      ctx.strokeStyle = "rgba(42, 212, 212, 0.08)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 0; i < width; i += 10) {
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
      }
      for (let i = 0; i < height; i += 10) {
        ctx.moveTo(0, i);
        ctx.lineTo(width, i);
      }
      ctx.stroke();

      // ECG waveform
      ctx.strokeStyle = "#F43F5E";
      ctx.lineWidth = 1.6;
      ctx.shadowColor = "#F43F5E";
      ctx.shadowBlur = 7;
      ctx.beginPath();

      for (let x = 0; x < width; x++) {
        const alpha = x < 20 ? x / 20 : 1;
        ctx.globalAlpha = alpha;

        const y = generateECGPoint(x + offset);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      offset += 1.8;
      ecgAnimationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(ecgAnimationRef.current);
  }, [hudVisible]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER: GENESIS × TELEMETRY MERGE
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden flex items-center justify-center"
      style={{ backgroundColor: "#030508", cursor: "none" }}
    >
      {/* ═══════════════════════════════════════════════════════════════════════
          EXIT SEQUENCE WRAPPER (Smooth GPU-accelerated transcendence)
          ═══════════════════════════════════════════════════════════════════════ */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `scale(${1 + exitProgress * 1.6}) translateZ(0)`,
          filter: `blur(${exitProgress * 7}px) brightness(${
            1 + exitProgress * 0.7
          })`,
          opacity: 1 - exitProgress,
          willChange: exitProgress > 0 ? "transform, filter, opacity" : "auto",
        }}
      >
        {/* Chromatic aberration (exit only) */}
        {exitProgress > 0 && (
          <>
            <div
              className="absolute inset-0 mix-blend-screen pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(244,63,94,0.14) 0%, transparent 45%)",
                transform: `translate(${exitProgress * 16}px, 0) translateZ(0)`,
                willChange: "transform",
              }}
            />
            <div
              className="absolute inset-0 mix-blend-screen pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(42,212,212,0.12) 0%, transparent 45%)",
                transform: `translate(${
                  -exitProgress * 16
                }px, 0) translateZ(0)`,
                willChange: "transform",
              }}
            />
          </>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            LAYER 0: DEEP SUBSTRATE (Telemetry Atmosphere)
            ───────────────────────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 75% 55% at 50% 48%, rgba(42, 212, 212, 0.07) 0%, transparent 58%),
              radial-gradient(circle at 78% 22%, rgba(159, 122, 234, 0.04) 0%, transparent 38%),
              radial-gradient(circle at 22% 78%, rgba(244, 63, 94, 0.04) 0%, transparent 38%),
              radial-gradient(circle at 88% 68%, rgba(240, 180, 41, 0.025) 0%, transparent 28%)
            `,
            animation: "atmosphere-breathe 9s ease-in-out infinite",
          }}
        />

        {/* Film grain */}
        <div
          className="absolute inset-0 pointer-events-none z-50"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            opacity: 0.035,
            mixBlendMode: "overlay",
          }}
        />

        {/* ─────────────────────────────────────────────────────────────────
            LAYER 1: PARTICLE SYSTEMS (Morphogenetic Flow)
            ───────────────────────────────────────────────────────────────── */}
        <div className="absolute inset-0 overflow-hidden z-[5]">
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-full"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                opacity: lettersEmerging ? p.opacity : 0,
                backgroundColor:
                  p.type === "synapse"
                    ? "rgba(42, 212, 212, 0.75)"
                    : p.type === "neuron"
                    ? "rgba(159, 122, 234, 0.55)"
                    : "rgba(255, 255, 255, 0.5)",
                boxShadow:
                  p.type === "synapse"
                    ? "0 0 5px rgba(42, 212, 212, 0.7)"
                    : "none",
                filter: `blur(${p.size < 1.5 ? 0.4 : 0}px)`,
                transition: "opacity 2s ease-in",
                animation:
                  p.type === "plasma"
                    ? `particle-rise ${p.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}s infinite`
                    : p.type === "neuron"
                    ? `particle-orbit ${p.duration}s linear ${p.delay}s infinite`
                    : `particle-spark ${p.duration}s ease-in-out ${p.delay}s infinite`,
              }}
            />
          ))}
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            LAYER 2: MORPHOGENETIC RINGS (Telemetry Scanner)
            ───────────────────────────────────────────────────────────────── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative" style={{ width: "700px", height: "400px" }}>
            <svg
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: "900px", height: "900px" }}
              viewBox="-450 -450 900 900"
            >
              <defs>
                <filter
                  id="ring-glow"
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="1.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                <linearGradient
                  id="ring-grad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="rgba(42, 212, 212, 0)" />
                  <stop offset="35%" stopColor="rgba(42, 212, 212, 0.2)" />
                  <stop offset="65%" stopColor="rgba(159, 122, 234, 0.15)" />
                  <stop offset="100%" stopColor="rgba(42, 212, 212, 0)" />
                </linearGradient>
              </defs>

              {RING_CONFIG.map((ring, i) => (
                <circle
                  key={i}
                  r={ring.size / 2}
                  fill="none"
                  stroke="url(#ring-grad)"
                  strokeWidth={ring.thickness}
                  strokeDasharray={ring.dash}
                  filter="url(#ring-glow)"
                  style={{
                    opacity: ringsActive ? 0.75 : 0,
                    transform: ringsActive ? "scale(1)" : "scale(0.75)",
                    transition: "all 2.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    transitionDelay: `${ring.delay}ms`,
                    transformOrigin: "center",
                    animation: ringsActive
                      ? `ring-spin-${ring.direction > 0 ? "cw" : "ccw"} ${
                          ring.speed
                        }s linear infinite`
                      : "none",
                  }}
                />
              ))}
            </svg>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            LAYER 3: CENTER STAGE (Genesis Choreography)
            ───────────────────────────────────────────────────────────────── */}
        <div
          className="relative z-10"
          style={{ width: "700px", height: "400px" }}
        >
          {/* ACT 1: SINGULARITY DOT - REMOVED */}

          {/* ACT 2: RADIATING TEXT (Name Emergence) */}
          {SYNAPSE_LETTERS.map(({ char, finalX, finalY, delay }, i) => (
            <span
              key={`syn-${i}`}
              className="absolute left-1/2 top-1/2 font-light text-5xl md:text-7xl text-white"
              style={{
                fontFamily: '"Manrope", sans-serif',
                opacity: lettersEmerging ? 1 : 0,
                transform: lettersEmerging
                  ? `translate(calc(-50% + ${finalX}px), calc(-50% + ${finalY}px))`
                  : "translate(-50%, -50%) scale(0)",
                transition: "all 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)",
                transitionDelay: `${delay}ms`,
                textShadow: lettersEmerging
                  ? "0 0 12px rgba(255,255,255,0.25)"
                  : "none",
              }}
            >
              {char}
            </span>
          ))}
          {MED_LETTERS.map(({ char, finalX, finalY, delay }, i) => (
            <span
              key={`med-${i}`}
              className="absolute left-1/2 top-1/2 italic font-normal text-5xl md:text-7xl text-[#2AD4D4]"
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                opacity: lettersEmerging ? 1 : 0,
                transform: lettersEmerging
                  ? `translate(calc(-50% + ${finalX}px), calc(-50% + ${finalY}px))`
                  : "translate(-50%, -50%) scale(0)",
                transition: "all 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)",
                transitionDelay: `${delay}ms`,
                textShadow: lettersEmerging
                  ? "0 0 18px rgba(42, 212, 212, 0.45), 0 0 36px rgba(42, 212, 212, 0.2)"
                  : "none",
              }}
            >
              {char}
            </span>
          ))}

          {/* ACT 3: DNA HELIX STAR (Structure Assembly) */}
          <svg
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            width="500"
            height="500"
            viewBox="-250 -250 500 500"
            style={{ overflow: "visible" }}
          >
            <defs>
              <linearGradient
                id="helix-grad"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="rgba(42, 212, 212, 0.65)" />
                <stop offset="50%" stopColor="rgba(159, 122, 234, 0.5)" />
                <stop offset="100%" stopColor="rgba(42, 212, 212, 0.4)" />
              </linearGradient>

              <filter id="node-glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Star Connections */}
            {STAR_CONNECTIONS.map(({ from, to }, i) => {
              const p1 = DNA_HELIX_POINTS[from];
              const p2 = DNA_HELIX_POINTS[to];
              return (
                <line
                  key={`conn-${i}`}
                  x1={helixConnectionsVisible ? p1.x : 0}
                  y1={helixConnectionsVisible ? p1.y : 0}
                  x2={helixConnectionsVisible ? p2.x : 0}
                  y2={helixConnectionsVisible ? p2.y : 0}
                  stroke="url(#helix-grad)"
                  strokeWidth="0.6"
                  strokeOpacity={helixConnectionsVisible ? 0.35 : 0}
                  style={{
                    transition: "all 1.1s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    transitionDelay: `${i * 35}ms`,
                  }}
                />
              );
            })}

            {/* Helix Nodes */}
            {DNA_HELIX_POINTS.map((point, i) => (
              <circle
                key={`node-${i}`}
                cx={helixNodesVisible ? point.x : 0}
                cy={helixNodesVisible ? point.y : 0}
                r={helixNodesVisible ? (i % 2 === 0 ? 3.5 : 2.5) : 0}
                fill={i % 2 === 0 ? "#2AD4D4" : "#9F7AEA"}
                filter="url(#node-glow)"
                style={{
                  transition: "all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  transitionDelay: `${point.delay}ms`,
                }}
              />
            ))}
          </svg>

          {/* ACT 4: TAGLINE */}
          <p
            className="absolute left-1/2 -translate-x-1/2 text-center italic text-lg md:text-xl text-slate-300/85"
            style={{
              fontFamily: '"Cormorant Garamond", serif',
              top: "72%",
              opacity: taglineVisible ? 1 : 0,
              transform: taglineVisible
                ? "translate(-50%, 0)"
                : "translate(-50%, 18px)",
              transition: "all 0.9s ease-out",
              textShadow: "0 0 8px rgba(42, 212, 212, 0.15)",
            }}
          >
            Your brain for medical learning.
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            LAYER 4: VITALS HUD (Medical Telemetry)
            ───────────────────────────────────────────────────────────────── */}
        <div
          className="absolute top-7 right-7 md:top-9 md:right-9 z-40 transition-all duration-1200"
          style={{
            opacity: hudVisible ? 1 : 0,
            transform: hudVisible
              ? "translateX(0) scale(1)"
              : "translateX(16px) scale(0.92)",
          }}
        >
          <div className="flex flex-col items-end gap-3">
            {/* Heart Rate + Pulse Indicator */}
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-mono text-gray-500 tracking-[0.3em] uppercase">
                  HR
                </span>
                <span
                  className="text-2xl font-light text-[#F43F5E] tabular-nums leading-none"
                  style={{
                    fontFamily: '"Manrope", sans-serif',
                    letterSpacing: "-0.02em",
                  }}
                >
                  {heartRate || "--"}
                </span>
              </div>
              <div
                className="w-2.5 h-2.5 rounded-full bg-[#F43F5E]"
                style={{
                  animation:
                    heartRate > 0
                      ? "cardiac-pulse 1.3s ease-in-out infinite"
                      : "none",
                  boxShadow: "0 0 10px rgba(244, 63, 94, 0.6)",
                }}
              />
            </div>

            {/* ECG Canvas */}
            <div className="relative w-32 h-10 border-b border-white/8 overflow-hidden rounded-sm bg-[#030508]/40">
              <canvas
                ref={canvasRef}
                width={128}
                height={40}
                className="absolute inset-0"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#030508] via-transparent to-[#030508] pointer-events-none" />
            </div>

            {/* Secondary Vitals */}
            <div className="flex gap-5 mt-1">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2AD4D4]/75" />
                <span className="font-mono text-[8px] text-gray-600 uppercase tracking-[0.18em]">
                  SpO₂
                </span>
                <span className="font-mono text-[10px] text-[#2AD4D4] tabular-nums">
                  {spO2 || "--"}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F0B429]/75" />
                <span className="font-mono text-[8px] text-gray-600 uppercase tracking-[0.18em]">
                  BP
                </span>
                <span className="font-mono text-[10px] text-[#F0B429] tabular-nums">
                  {bp.sys || "--"}/{bp.dia || "--"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            LAYER 5: FOOTER TELEMETRY (Neural Perfusion)
            ───────────────────────────────────────────────────────────────── */}
        <div
          className="absolute bottom-0 left-0 right-0 px-8 md:px-12 pb-7 md:pb-9 z-40 flex justify-between items-end transition-all duration-1200"
          style={{
            opacity: footerVisible ? 1 : 0,
            transform: footerVisible
              ? "translateY(0) scale(1)"
              : "translateY(12px) scale(0.95)",
          }}
        >
          {/* Left: Neural Logs + System Info */}
          <div className="flex flex-col gap-2">
            {/* Live Log Stream */}
            <div className="flex gap-2 items-center min-h-[20px]">
              <span
                className="w-2 h-2 bg-[#2AD4D4] rounded-full"
                style={{
                  animation: currentLog
                    ? "pulse-indicator 1.5s ease-in-out infinite"
                    : "none",
                  boxShadow: "0 0 8px rgba(42, 212, 212, 0.6)",
                }}
              />
              <span
                className="font-mono text-[10px] md:text-[11px] text-[#2AD4D4]/75 tracking-[0.22em] uppercase transition-all duration-400"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                {currentLog}
                {currentLog && <span className="animate-blink">_</span>}
              </span>
            </div>

            {/* Progress Dots */}
            <div className="flex gap-1.5 ml-4">
              {PERFUSION_LOGS.map((_, i) => (
                <div
                  key={i}
                  className="h-0.5 rounded-full transition-all duration-400"
                  style={{
                    width: i <= logIndex ? "28px" : "10px",
                    backgroundColor:
                      i <= logIndex
                        ? "rgba(42, 212, 212, 0.65)"
                        : "rgba(255, 255, 255, 0.12)",
                  }}
                />
              ))}
            </div>

            {/* System Metadata */}
            <div className="flex gap-6 mt-2 opacity-60">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[7px] text-gray-600 uppercase tracking-[0.25em]">
                  System
                </span>
                <span className="text-[10px] text-gray-500 tracking-wide">
                  COGNITIVE_MATRIX
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-[7px] text-gray-600 uppercase tracking-[0.25em]">
                  AI Core
                </span>
                <span className="text-[10px] text-[#2AD4D4]/60 tracking-wide">
                  GEMINI 2.5 FLASH
                </span>
              </div>
            </div>
          </div>

          {/* Right: Clinical Disciplines */}
          <div className="hidden md:flex gap-4 font-mono text-[9px] uppercase tracking-[0.2em] opacity-50">
            {["PHYSIO", "MD/DO", "RN", "PA", "PHARM", "PT"].map((d, i) => (
              <span
                key={d}
                className="transition-all duration-500"
                style={{
                  color:
                    i === 0
                      ? "rgba(42, 212, 212, 0.55)"
                      : "rgba(255, 255, 255, 0.25)",
                  transitionDelay: `${i * 80}ms`,
                }}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          EMBEDDED KEYFRAMES & ANIMATIONS
          ═══════════════════════════════════════════════════════════════════════ */}
      <style>{`
        /* ───────────────────────────────────────────────────────────────────
           ATMOSPHERIC ANIMATIONS
           ─────────────────────────────────────────────────────────────────── */
        
        @keyframes atmosphere-breathe {
          0%, 100% { 
            transform: scale(1) rotate(0deg); 
            opacity: 0.65; 
          }
          25% { 
            transform: scale(1.06) rotate(0.6deg); 
            opacity: 0.75;
          }
          50% { 
            transform: scale(1.12) rotate(0deg); 
            opacity: 0.95; 
          }
          75% { 
            transform: scale(1.06) rotate(-0.6deg); 
            opacity: 0.75;
          }
        }

        /* ───────────────────────────────────────────────────────────────────
           GENESIS DOT ANIMATIONS
           ─────────────────────────────────────────────────────────────────── */
        
        @keyframes genesis-pulse {
          0% { 
            transform: translate(-50%, -50%) scale(1); 
            opacity: 0.6; 
          }
          100% { 
            transform: translate(-50%, -50%) scale(14); 
            opacity: 0; 
          }
        }
        
        @keyframes genesis-pulse-outer {
          0% { 
            transform: translate(-50%, -50%) scale(1); 
            opacity: 0.3; 
          }
          100% { 
            transform: translate(-50%, -50%) scale(6); 
            opacity: 0; 
          }
        }

        /* ───────────────────────────────────────────────────────────────────
           PARTICLE ANIMATIONS (Morphogenetic Flow)
           ─────────────────────────────────────────────────────────────────── */
        
        @keyframes particle-rise {
          0% { 
            transform: translateY(0) scale(1); 
            opacity: 0; 
          }
          12% { 
            opacity: 1; 
            transform: translateY(-8px) scale(1.15);
          }
          88% { 
            opacity: 1; 
            transform: translateY(-8px) scale(1.15);
          }
          100% { 
            transform: translateY(-105vh) scale(0.35); 
            opacity: 0; 
          }
        }
        
        @keyframes particle-orbit {
          from { 
            transform: rotate(0deg) translateX(25px) rotate(0deg); 
          }
          to { 
            transform: rotate(360deg) translateX(25px) rotate(-360deg); 
          }
        }
        
        @keyframes particle-spark {
          0%, 100% { 
            opacity: 0; 
            transform: scale(0.6); 
          }
          15% { 
            opacity: 1; 
            transform: scale(1.7) rotate(0deg);
          }
          50% { 
            opacity: 1; 
            transform: scale(2) rotate(180deg);
          }
          85% { 
            opacity: 1; 
            transform: scale(1.7) rotate(360deg);
          }
        }

        /* ───────────────────────────────────────────────────────────────────
           RING ANIMATIONS (Morphogenetic Scanner)
           ─────────────────────────────────────────────────────────────────── */
        
        @keyframes ring-spin-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes ring-spin-ccw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }

        /* ───────────────────────────────────────────────────────────────────
           CARDIAC & VITALS ANIMATIONS
           ─────────────────────────────────────────────────────────────────── */
        
        @keyframes cardiac-pulse {
          0%, 100% { 
            transform: scale(1); 
            opacity: 0.75; 
          }
          18% { 
            transform: scale(1.4); 
            opacity: 1; 
          }
          36% { 
            transform: scale(1); 
          }
          54% { 
            transform: scale(1.25); 
            opacity: 0.9; 
          }
          72% { 
            transform: scale(1); 
          }
        }
        
        @keyframes pulse-indicator {
          0%, 100% { 
            opacity: 0.7; 
          }
          50% { 
            opacity: 1; 
          }
        }

        /* ───────────────────────────────────────────────────────────────────
           TERMINAL & UI ELEMENTS
           ─────────────────────────────────────────────────────────────────── */
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .animate-blink {
          animation: blink 1.1s step-end infinite;
        }
      `}</style>
    </div>
  );
};

export default SplashScreen;
