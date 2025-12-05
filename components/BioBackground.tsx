import React, { useEffect, useRef, memo, useState } from "react";
import * as THREE from "three";

/**
 * BioBackground - The Living Substrate (v4.0 Optimized)
 *
 * Performance Optimizations:
 * - Lazy initialization with visibility detection
 * - Reduced pixel ratio on mobile/tablets
 * - Frame rate throttling (30fps vs 60fps)
 * - Pause animation when tab is hidden
 * - Reduced shader complexity on low-power devices
 * - GPU memory management with proper disposal
 */

// Detect low-power device (mobile/tablet)
const isLowPowerDevice = () => {
  const ua = navigator.userAgent.toLowerCase();
  return /mobile|android|iphone|ipad|tablet/i.test(ua) || window.innerWidth < 1200;
};

const BioBackground: React.FC = memo(() => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Track tab visibility
  useEffect(() => {
    const handleVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    const lowPower = isLowPowerDevice();
    
    // --- 1. SETUP ENGINE ---
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Performance: Adaptive GPU settings
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: lowPower ? "low-power" : "high-performance",
      depth: false,
      stencil: false,
      precision: lowPower ? "mediump" : "highp",
    });

    // Adaptive Pixel Ratio: Lower on mobile for performance
    const maxPixelRatio = lowPower ? 1.0 : 1.5;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // --- 2. THE LIVING SHADER (GLSL) ---
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision mediump float;
      
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mouse;

      // ---------------------------------------------
      // NOISE FUNCTIONS (Optimized Simplex)
      // ---------------------------------------------
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy) );
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1;
        i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
        vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
        m = m*m ;
        m = m*m ;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      // ---------------------------------------------
      // CORE: DOMAIN WARPING (Fluid Simulation)
      // ---------------------------------------------
      float fbm(vec2 st) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 3; i++) {
          value += amplitude * snoise(st);
          st *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        // Normalize coordinates (Responsive aspect ratio)
        vec2 st = gl_FragCoord.xy / u_resolution.xy;
        st.x *= u_resolution.x / u_resolution.y;

        // BIOLOGICAL TIME - Multi-scale rhythms for organic feel
        float slow_t = u_time * 0.08;        // Slow drift (primary)
        float pulse_t = u_time * 0.3;        // Quick pulse
        float breath_t = u_time * 0.04;      // Deep breathing cycle
        float micro_t = u_time * 0.15;       // Micro-oscillations
        float edge_t = u_time * 0.05;        // Edge animation rhythm

        // FULL-SCREEN INTERACTIVITY: Disabled - static background
        vec2 mouse_norm = u_mouse * vec2(u_resolution.x/u_resolution.y, 1.0);
        float mouse_dist = distance(st, mouse_norm);
        
        // Mouse interactivity disabled - no distort or ripples
        // st stays unchanged
        
        // No ripple system when idle

        // DOMAIN WARPING ALGORITHM - Multi-layer system for full-screen fluidity
        // Layer 1: Slow base flow with edge contribution
        vec2 q = vec2(0.);
        q.x = fbm( st + 0.00 * slow_t ) + 0.02 * edge_t;
        q.y = fbm( st + vec2(1.0) + breath_t * 0.3) + 0.02 * edge_t;

        // Layer 2: Distorted swirl flow
        vec2 r = vec2(0.);
        r.x = fbm( st + 1.0 * q + vec2(1.7, 9.2) + 0.15 * slow_t + 0.08 * breath_t);
        r.y = fbm( st + 1.0 * q + vec2(8.3, 2.8) + 0.126 * slow_t + 0.06 * breath_t);

        // Layer 3: Micro-turbulence (adds dynamism in idle)
        vec2 micro = vec2(0.);
        micro.x = fbm( st * 2.0 + 0.3 * micro_t ) * 0.08;
        micro.y = fbm( st * 2.5 - 0.25 * micro_t ) * 0.08;
        
        // Layer 4: Edge animation - keeps edges alive and flowing
        vec2 edge = vec2(0.);
        edge.x = fbm( st * 1.5 + 0.2 * edge_t ) * 0.06;
        edge.y = fbm( st * 1.8 - 0.15 * edge_t ) * 0.06;
        
        // Final noise with all layers
        float f = fbm(st + r + micro * 0.5 + edge * 0.3);

        // COLOR PALETTE (Medical Editorial - Obsidian with Life)
        vec3 colorBg = vec3(0.02, 0.04, 0.06); 
        vec3 colorFluid = vec3(0.0, 0.28, 0.38); 
        vec3 colorHighlight = vec3(0.10, 0.65, 0.70);

        // ORGANIC MIXING with enhanced breathing and fluidity
        // Base color transition
        vec3 color = mix(colorBg, colorFluid, clamp((f*f)*3.5, 0.0, 1.0));

        // Add veins with breathing intensity - extended range for full-screen life
        float vein_breath = 0.6 + 0.4 * sin(breath_t + length(st)*0.5);
        color = mix(color, colorHighlight, clamp(length(q), 0.0, 1.0) * 0.22 * vein_breath);

        // Add dynamic pulse highlights (enhanced when idle)
        float pulse = 0.5 + 0.5 * sin(pulse_t + length(st)*3.0) * cos(slow_t*0.5);
        color = mix(color, colorHighlight, length(r.x) * 0.18 * pulse);
        
        // Micro-turbulence color contribution (enhanced for liveness)
        color = mix(color, colorFluid, length(micro) * 0.16);
        
        // Edge animation color - more prominent now (no mouse distraction)
        color = mix(color, colorFluid, length(edge) * 0.11);

        // Slightly stronger vignette (subtle scrim increase for readability)
        float vignette = 1.0 - smoothstep(0.15, 1.5, length(gl_FragCoord.xy / u_resolution.xy - 0.5)) * 0.40;
        color *= vignette;

        // GRAIN (Cinematic Texture - prevents banding)
        float grain = snoise(gl_FragCoord.xy * 2.0 + u_time) * 0.025;
        color += grain;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // --- 3. STATE & UNIFORMS ---
    const uniforms = {
      u_time: { value: 0 },
      u_resolution: {
        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
      },
      u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
    };

    // Mesh setup
    const geometry = new THREE.PlaneGeometry(2, 2);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // --- 4. FLUID INTERACTION LOGIC WITH OPTIMIZED PHYSICS ---
    // Physics-based mouse tracking with adaptive smoothing
    const targetMouse = new THREE.Vector2(0.5, 0.5);
    const currentMouse = new THREE.Vector2(0.5, 0.5);
    const velocity = new THREE.Vector2(0, 0);
    const lastMouse = new THREE.Vector2(0.5, 0.5);

    // Throttled mouse move handler (reduces CPU overhead)
    let mouseThrottleId: number | null = null;
    const onMouseMove = (e: MouseEvent) => {
      if (mouseThrottleId) return;
      mouseThrottleId = requestAnimationFrame(() => {
        targetMouse.x = e.clientX / window.innerWidth;
        targetMouse.y = 1.0 - e.clientY / window.innerHeight;
        mouseThrottleId = null;
      });
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    // --- 5. ANIMATION LOOP WITH FRAME THROTTLING ---
    const clock = new THREE.Clock();
    let requestId: number;
    let lastFrameTime = 0;
    const targetFPS = lowPower ? 24 : 30; // Lower FPS on mobile
    const frameInterval = 1000 / targetFPS;

    const animate = (currentTime: number) => {
      requestId = requestAnimationFrame(animate);

      // Skip frames if tab hidden or throttling
      if (!isVisible) return;
      
      const elapsed = currentTime - lastFrameTime;
      if (elapsed < frameInterval) return;
      lastFrameTime = currentTime - (elapsed % frameInterval);

      const delta = clock.getDelta();

      // Update time
      uniforms.u_time.value += delta;

      // Simplified physics for performance
      const rawVelocity = new THREE.Vector2().subVectors(targetMouse, lastMouse);
      lastMouse.copy(targetMouse);

      // Clamp velocity
      const maxRaw = 0.25;
      if (rawVelocity.length() > maxRaw) rawVelocity.setLength(maxRaw);

      // Smooth velocity (90% history, 10% new)
      velocity.multiplyScalar(0.9).add(rawVelocity.multiplyScalar(0.1));

      // Spring physics
      const stiffness = 0.06;
      const damping = 0.93;
      const delta_pos = new THREE.Vector2().subVectors(targetMouse, currentMouse);

      if (delta_pos.length() > 0.002) {
        const maxDelta = 0.25;
        if (delta_pos.length() > maxDelta) delta_pos.setLength(maxDelta);
        velocity.add(delta_pos.multiplyScalar(stiffness));
      }

      velocity.multiplyScalar(damping);
      const maxVelocity = 0.06;
      if (velocity.length() > maxVelocity) velocity.setLength(maxVelocity);

      currentMouse.add(velocity);
      currentMouse.x = Math.max(0, Math.min(1, currentMouse.x));
      currentMouse.y = Math.max(0, Math.min(1, currentMouse.y));

      uniforms.u_mouse.value.copy(currentMouse);

      renderer.render(scene, camera);
    };

    requestAnimationFrame(animate);

    // --- 6. DEBOUNCED RESIZE HANDLER ---
    let resizeTimeout: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        renderer.setSize(w, h);
        uniforms.u_resolution.value.set(w, h);
      }, 100);
    };
    window.addEventListener("resize", handleResize, { passive: true });

    // --- 7. CLEANUP (Memory Management) ---
    return () => {
      cancelAnimationFrame(requestId);
      if (mouseThrottleId) cancelAnimationFrame(mouseThrottleId);
      clearTimeout(resizeTimeout);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", handleResize);

      // Dispose Three.js Assets
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isVisible]);

  return (
    <>
      {/* 1. SHADER LAYER - Living fluid animation */}
      <div
        ref={mountRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
          opacity: 0.9,
          pointerEvents: "none",
        }}
      />

      {/* 2. READABILITY SCRIM - Minimal, lets background show */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 1,
          background:
            "radial-gradient(ellipse at center, rgba(2,4,6,0.28) 0%, rgba(2,4,6,0.42) 60%, rgba(2,4,6,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* 3. GRAIN TEXTURE OVERLAY - Cinematic paper feel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 2,
          opacity: 0.04,
          pointerEvents: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </>
  );
});

export default BioBackground;
