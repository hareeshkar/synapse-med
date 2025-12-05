import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: "/synapse-med/",
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [react()],
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    build: {
      // Code splitting for better caching and parallel loading
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunk for React ecosystem
            "vendor-react": ["react", "react-dom"],
            // D3 is heavy - separate chunk
            "vendor-d3": ["d3"],
            // Three.js for background effects
            "vendor-three": ["three"],
            // Markdown processing
            "vendor-markdown": ["react-markdown", "remark-gfm"],
            // Export utilities
            "vendor-export": ["jspdf", "jszip"],
          },
        },
      },
      // Optimize chunk size warnings
      chunkSizeWarningLimit: 600,
      // Enable minification optimizations
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: mode === "production",
          drop_debugger: true,
          pure_funcs: mode === "production" ? ["console.log", "console.warn"] : [],
        },
      },
      // Generate source maps for debugging (disable in prod for smaller bundles)
      sourcemap: mode !== "production",
      // Target modern browsers for smaller output
      target: "es2020",
    },
    // Optimize dependency pre-bundling
    optimizeDeps: {
      include: ["react", "react-dom", "d3", "three", "lucide-react"],
      exclude: ["@google/genai"], // Exclude to avoid bundling issues
    },
  };
});
