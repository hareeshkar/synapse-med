import React, { useEffect, useRef, memo } from "react";
import * as THREE from "three";

/**
 * BioBackground - The Living Substrate (v3.0 Enhanced)
 *
 * Features:
 * - Fluid Domain Warping (Simulates viscous liquid flow)
 * - Biological "Lung" Breathing Rhythm (Compound sine waves)
 * - Hydrodynamic Parallax (Liquid displacement feel)
 * - Optimized WebGL renderer with proper cleanup
 *
 * Visual: Deep ocean current, slow-moving ink, obsidian glass with life.
 */

const BioBackground: React.FC = memo(() => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;

    // --- 1. SETUP ENGINE ---
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Performance: Request high-performance GPU for smooth animation
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
      depth: false,
      stencil: false,
    });

    // Smart Pixel Ratio: Capping at 1.5 preserves sharpness without frying mobile GPUs
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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
    // Physics-based mouse tracking with adaptive smoothing to prevent jitter
    const targetMouse = new THREE.Vector2(0.5, 0.5);
    const currentMouse = new THREE.Vector2(0.5, 0.5);
    const velocity = new THREE.Vector2(0, 0);
    const lastMouse = new THREE.Vector2(0.5, 0.5);
    const lastVelocity = new THREE.Vector2(0, 0);

    const onMouseMove = (e: MouseEvent) => {
      targetMouse.x = e.clientX / window.innerWidth;
      targetMouse.y = 1.0 - e.clientY / window.innerHeight; // Invert Y for shader coords
    };
    window.addEventListener("mousemove", onMouseMove);

    // --- 5. ANIMATION LOOP WITH JITTER-FREE PHYSICS ---
    const clock = new THREE.Clock();
    let requestId: number;

    const animate = () => {
      requestId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Update time
      uniforms.u_time.value += delta;

      // Physics-based mouse movement with stronger smoothing and clamping
      // Calculate raw velocity (delta since last frame)
      const rawVelocity = new THREE.Vector2().subVectors(
        targetMouse,
        lastMouse
      );
      lastMouse.copy(targetMouse);

      // Clamp raw velocity to avoid teleport jumps from large mouse moves
      const maxRaw = 0.25;
      if (rawVelocity.length() > maxRaw) rawVelocity.setLength(maxRaw);

      // Stronger velocity smoothing (90% history, 10% new) for very stable motion
      velocity.multiplyScalar(0.9).add(rawVelocity.multiplyScalar(0.1));
      lastVelocity.copy(velocity);

      // Apply spring physics with lighter stiffness and stronger damping
      const stiffness = 0.06; // gentler spring
      const damping = 0.93; // higher damping to kill oscillation

      // Spring force towards target, but clamp the delta to avoid large jumps
      const delta_pos = new THREE.Vector2().subVectors(
        targetMouse,
        currentMouse
      );

      // Deadzone: if very small movement, don't bother applying spring (prevents micro jitters)
      if (delta_pos.length() > 0.002) {
        const maxDelta = 0.25;
        if (delta_pos.length() > maxDelta) delta_pos.setLength(maxDelta);
        const springForce = delta_pos.multiplyScalar(stiffness);
        velocity.add(springForce);
      }

      // Apply damping/friction
      velocity.multiplyScalar(damping);

      // Cap velocity magnitude for very stable behavior
      const maxVelocity = 0.06;
      if (velocity.length() > maxVelocity) velocity.setLength(maxVelocity);

      // Update position (small increments)
      currentMouse.add(velocity);

      // Clamp to valid range to prevent shader artifacts
      currentMouse.x = Math.max(0, Math.min(1, currentMouse.x));
      currentMouse.y = Math.max(0, Math.min(1, currentMouse.y));

      uniforms.u_mouse.value.copy(currentMouse);

      renderer.render(scene, camera);
    };

    animate();

    // --- 6. ROBUST RESIZE HANDLER ---
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      uniforms.u_resolution.value.set(w, h);
    };
    window.addEventListener("resize", handleResize);

    // --- 7. CLEANUP (Memory Management) ---
    return () => {
      cancelAnimationFrame(requestId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", handleResize);

      // Dispose Three.js Assets to prevent leaks
      geometry.dispose();
      material.dispose();
      renderer.dispose();

      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

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
