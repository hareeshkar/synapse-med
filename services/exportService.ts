/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SYNAPSE MED — EXPORT SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * High-fidelity export engine for Study Guides + Knowledge Graphs
 * Supports: Markdown, HTML (styled), PDF, and bundled ZIP archives
 *
 * Uses:
 * - JSZip for archive creation (client-side, zero-backend)
 * - html2canvas + jsPDF for PDF rendering
 * - Custom templates for editorial-quality HTML output
 *
 * Architecture: Pure client-side processing for privacy
 */

import { AugmentedNote, KnowledgeGraphData, KnowledgeNode } from "../types";

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface ExportOptions {
  includeMarkdown: boolean;
  includeHtml: boolean;
  includePdf: boolean;
  includeGraph: boolean; // SVG export of the graph
  includeGraphData: boolean; // JSON data for the graph
  theme: "obsidian" | "clinical" | "print";
  quality: "standard" | "high" | "maximum";
}

export interface ExportProgress {
  stage:
    | "preparing"
    | "markdown"
    | "html"
    | "pdf"
    | "graph"
    | "bundling"
    | "complete";
  progress: number; // 0-100
  message: string;
}

export type ExportProgressCallback = (progress: ExportProgress) => void;

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const CSS_THEME_OBSIDIAN = `
  :root {
    --bg-primary: #0a0c0e;
    --bg-secondary: #0f1114;
    --bg-tertiary: #161a1f;
    --text-primary: #f0f2f5;
    --text-secondary: #9ca3af;
    --text-muted: #6b7280;
    --accent-cyan: #2ad4d4;
    --accent-rose: #f472b6;
    --accent-amber: #f0b429;
    --accent-purple: #a78bfa;
    --accent-teal: #14b8a6;
    --border-color: rgba(255,255,255,0.06);
    --shadow-glow: 0 0 40px rgba(42, 212, 212, 0.1);
  }
  body {
    background: var(--bg-primary);
    color: var(--text-primary);
  }
`;

const CSS_THEME_CLINICAL = `
  :root {
    --bg-primary: #f8fafc;
    --bg-secondary: #ffffff;
    --bg-tertiary: #f1f5f9;
    --text-primary: #1e293b;
    --text-secondary: #475569;
    --text-muted: #94a3b8;
    --accent-cyan: #0891b2;
    --accent-rose: #e11d48;
    --accent-amber: #d97706;
    --accent-purple: #7c3aed;
    --accent-teal: #0d9488;
    --border-color: rgba(0,0,0,0.08);
    --shadow-glow: 0 4px 24px rgba(0,0,0,0.06);
  }
  body {
    background: var(--bg-primary);
    color: var(--text-primary);
  }
`;

const CSS_THEME_PRINT = `
  :root {
    --bg-primary: #ffffff;
    --bg-secondary: #ffffff;
    --bg-tertiary: #fafafa;
    --text-primary: #000000;
    --text-secondary: #333333;
    --text-muted: #666666;
    --accent-cyan: #0077b6;
    --accent-rose: #c81d4e;
    --accent-amber: #b45309;
    --accent-purple: #6d28d9;
    --accent-teal: #0f766e;
    --border-color: #e5e5e5;
    --shadow-glow: none;
  }
  body {
    background: var(--bg-primary);
    color: var(--text-primary);
  }
  @media print {
    body { font-size: 11pt; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
  }
`;

const CSS_BASE = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  @font-face {
    font-family: 'Inter';
    src: url('https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2') format('woff2');
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }
  
  @font-face {
    font-family: 'Inter';
    src: url('https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiJ-Ek-_EeA.woff2') format('woff2');
    font-weight: 600;
    font-style: normal;
    font-display: swap;
  }
  
  @font-face {
    font-family: 'Playfair Display';
    src: url('https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtXK-F2qC0s.woff2') format('woff2');
    font-weight: 400;
    font-style: italic;
    font-display: swap;
  }
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.7;
    font-size: 16px;
    padding: 3rem;
    max-width: 900px;
    margin: 0 auto;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  
  /* Header */
  .header {
    margin-bottom: 4rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--border-color);
  }
  
  .header-brand {
    font-family: 'Inter', sans-serif;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--accent-cyan);
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .header-brand::before {
    content: '';
    width: 6px;
    height: 6px;
    background: var(--accent-cyan);
    border-radius: 50%;
    box-shadow: 0 0 10px var(--accent-cyan);
  }
  
  .header h1 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 3.5rem;
    font-weight: 400;
    font-style: italic;
    line-height: 1.2;
    margin-bottom: 1rem;
    background: linear-gradient(135deg, var(--text-primary) 0%, var(--accent-cyan) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  .header-meta {
    display: flex;
    gap: 2rem;
    font-size: 0.8rem;
    color: var(--text-muted);
    font-family: monospace;
    letter-spacing: 0.05em;
  }
  
  .header-meta span {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  /* Summary Block */
  .summary-block {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 2rem;
    margin-bottom: 3rem;
    position: relative;
    overflow: hidden;
  }
  
  .summary-block::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple));
  }
  
  .summary-label {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent-cyan);
    margin-bottom: 0.75rem;
  }
  
  .summary-text {
    font-size: 1.1rem;
    line-height: 1.8;
    color: var(--text-secondary);
  }
  
  /* Content Styling */
  .content {
    margin-bottom: 4rem;
  }
  
  .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    line-height: 1.4;
    margin-top: 2.5rem;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }
  
  .content h1 { font-size: 2rem; }
  .content h2 { 
    font-size: 1.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  .content h3 { font-size: 1.25rem; color: var(--accent-cyan); }
  .content h4 { font-size: 1.1rem; }
  .content h5, .content h6 { font-size: 1rem; }
  
  .content p {
    margin-bottom: 1.25rem;
    color: var(--text-secondary);
  }
  
  .content ul, .content ol {
    margin-bottom: 1.25rem;
    padding-left: 1.5rem;
    color: var(--text-secondary);
  }
  
  .content li {
    margin-bottom: 0.5rem;
    padding-left: 0.5rem;
  }
  
  .content li::marker {
    color: var(--accent-cyan);
  }
  
  .content blockquote {
    border-left: 3px solid var(--accent-purple);
    padding-left: 1.5rem;
    margin: 1.5rem 0;
    font-style: italic;
    color: var(--text-muted);
    background: var(--bg-tertiary);
    padding: 1rem 1.5rem;
    border-radius: 0 8px 8px 0;
  }
  
  .content code {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 0.875em;
    background: var(--bg-tertiary);
    padding: 0.2em 0.5em;
    border-radius: 4px;
    color: var(--accent-rose);
  }
  
  .content pre {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 1.5rem;
    overflow-x: auto;
    margin: 1.5rem 0;
  }
  
  .content pre code {
    background: none;
    padding: 0;
    color: var(--text-primary);
  }
  
  .content table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5rem 0;
    font-size: 0.9rem;
  }
  
  .content th, .content td {
    border: 1px solid var(--border-color);
    padding: 0.75rem 1rem;
    text-align: left;
  }
  
  .content th {
    background: var(--bg-tertiary);
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .content tr:nth-child(even) {
    background: var(--bg-secondary);
  }
  
  .content a {
    color: var(--accent-cyan);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: border-color 0.2s;
  }
  
  .content a:hover {
    border-bottom-color: var(--accent-cyan);
  }
  
  .content strong {
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .content em {
    font-style: italic;
  }
  
  .content hr {
    border: none;
    height: 1px;
    background: var(--border-color);
    margin: 3rem 0;
  }
  
  /* Clinical Pearls */
  .pearls-section {
    margin-top: 4rem;
    padding-top: 3rem;
    border-top: 1px solid var(--border-color);
  }
  
  .pearls-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .pearls-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, var(--accent-amber), #fcd34d);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
  }
  
  .pearls-title {
    font-family: 'Inter', sans-serif;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  .pearls-subtitle {
    font-size: 0.75rem;
    color: var(--accent-amber);
    font-family: monospace;
    letter-spacing: 0.1em;
  }
  
  .pearl-card {
    position: relative;
    border-radius: 16px;
    padding: 1.5rem;
    padding-left: 2rem;
    margin-bottom: 1rem;
    overflow: hidden;
  }
  
  .pearl-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
  }
  
  .pearl-card.red-flag {
    background: linear-gradient(135deg, rgba(244, 114, 182, 0.1), transparent);
    border: 1px solid rgba(244, 114, 182, 0.2);
  }
  .pearl-card.red-flag::before { background: var(--accent-rose); }
  
  .pearl-card.exam-tip {
    background: linear-gradient(135deg, rgba(42, 212, 212, 0.1), transparent);
    border: 1px solid rgba(42, 212, 212, 0.2);
  }
  .pearl-card.exam-tip::before { background: var(--accent-cyan); }
  
  .pearl-card.gap-filler {
    background: linear-gradient(135deg, rgba(167, 139, 250, 0.1), transparent);
    border: 1px solid rgba(167, 139, 250, 0.2);
  }
  .pearl-card.gap-filler::before { background: var(--accent-purple); }
  
  .pearl-card.fact-check {
    background: linear-gradient(135deg, rgba(240, 180, 41, 0.1), transparent);
    border: 1px solid rgba(240, 180, 41, 0.2);
  }
  .pearl-card.fact-check::before { background: var(--accent-amber); }
  
  .pearl-label {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }
  
  .pearl-card.red-flag .pearl-label { color: var(--accent-rose); }
  .pearl-card.exam-tip .pearl-label { color: var(--accent-cyan); }
  .pearl-card.gap-filler .pearl-label { color: var(--accent-purple); }
  .pearl-card.fact-check .pearl-label { color: var(--accent-amber); }
  
  .pearl-content {
    color: var(--text-secondary);
    line-height: 1.7;
  }
  
  /* Sources Section */
  .sources-section {
    margin-top: 4rem;
    padding-top: 3rem;
    border-top: 1px solid var(--border-color);
  }
  
  .sources-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  
  .sources-icon {
    width: 48px;
    height: 48px;
    background: linear-gradient(135deg, var(--accent-teal), #5eead4);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
  }
  
  .source-link {
    display: flex;
    flex-direction: column;
    padding: 1rem 1.25rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    margin-bottom: 0.75rem;
    text-decoration: none;
    transition: all 0.2s;
  }
  
  .source-link:hover {
    border-color: var(--accent-cyan);
    transform: translateY(-1px);
    box-shadow: var(--shadow-glow);
  }
  
  .source-title {
    font-size: 0.9rem;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }
  
  .source-url {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: monospace;
  }
  
  /* Footer */
  .footer {
    margin-top: 6rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.7rem;
    color: var(--text-muted);
    font-family: monospace;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  
  .footer-brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .footer-brand::before {
    content: '';
    width: 8px;
    height: 8px;
    background: var(--accent-cyan);
    border-radius: 50%;
  }
  
  /* Graph Section */
  .graph-section {
    margin-top: 4rem;
    padding-top: 3rem;
    border-top: 1px solid var(--border-color);
  }
  
  .graph-embed {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 2rem;
    text-align: center;
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .graph-embed svg {
    max-width: 100%;
    height: auto;
  }
`;

// ═══════════════════════════════════════════════════════════════════════════
// MARKDOWN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate clean, portable Markdown for the study guide
 */
export function generateMarkdown(note: AugmentedNote): string {
  const lines: string[] = [];

  // Front matter metadata
  lines.push("---");
  lines.push(`title: "${note.title}"`);
  lines.push(`created: ${new Date(note.timestamp).toISOString()}`);
  lines.push(`source: Synapse Med`);
  lines.push(`nodes: ${note.graphData.nodes.length}`);
  lines.push(`connections: ${note.graphData.links.length}`);
  lines.push("---");
  lines.push("");

  // Title
  lines.push(`# ${note.title}`);
  lines.push("");

  // Summary
  if (note.summary) {
    lines.push("> **Summary:** " + note.summary);
    lines.push("");
  }

  // ELI5 Analogy
  if (note.eli5Analogy) {
    lines.push("## 💡 In Simple Terms");
    lines.push("");
    lines.push(`> "${note.eli5Analogy}"`);
    lines.push("");
  }

  // Main content
  lines.push("---");
  lines.push("");
  lines.push(note.markdownContent);
  lines.push("");

  // Clinical Pearls
  if (note.pearls && note.pearls.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## ✨ Clinical Pearls");
    lines.push("");

    const pearlEmojis: Record<string, string> = {
      "red-flag": "🚨",
      "exam-tip": "📝",
      "gap-filler": "💡",
      "fact-check": "✅",
    };

    for (const pearl of note.pearls) {
      const emoji = pearlEmojis[pearl.type] || "•";
      const label = pearl.type
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      lines.push(`### ${emoji} ${label}`);
      lines.push("");
      lines.push(pearl.content);
      if (pearl.citation) {
        lines.push("");
        lines.push(`*Source: ${pearl.citation}*`);
      }
      lines.push("");
    }
  }

  // Sources
  if (note.sources && note.sources.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## 📚 Verified Sources");
    lines.push("");

    for (const source of note.sources) {
      lines.push(`- [${source.title}](${source.uri})`);
    }
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(
    `*Generated by Synapse Med on ${new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}*`
  );

  return lines.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// HTML EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert Markdown to styled HTML with editorial design
 */
export function generateHtml(
  note: AugmentedNote,
  theme: "obsidian" | "clinical" | "print" = "obsidian"
): string {
  const themeCSS =
    theme === "obsidian"
      ? CSS_THEME_OBSIDIAN
      : theme === "clinical"
      ? CSS_THEME_CLINICAL
      : CSS_THEME_PRINT;

  // Parse markdown to HTML (simple conversion)
  const contentHtml = markdownToHtml(note.markdownContent);

  // Build pearls HTML
  let pearlsHtml = "";
  if (note.pearls && note.pearls.length > 0) {
    const pearlLabels: Record<string, string> = {
      "red-flag": "🚨 Red Flag",
      "exam-tip": "📝 Exam Tip",
      "gap-filler": "💡 Gap Filler",
      "fact-check": "✅ Fact Check",
    };

    pearlsHtml = `
      <section class="pearls-section">
        <div class="pearls-header">
          <div class="pearls-icon">✨</div>
          <div>
            <div class="pearls-title">Clinical Pearls</div>
            <div class="pearls-subtitle">${
              note.pearls.length
            } high-yield insights</div>
          </div>
        </div>
        ${note.pearls
          .map(
            (pearl) => `
          <div class="pearl-card ${pearl.type}">
            <div class="pearl-label">${
              pearlLabels[pearl.type] || pearl.type
            }</div>
            <div class="pearl-content">${escapeHtml(pearl.content)}</div>
          </div>
        `
          )
          .join("")}
      </section>
    `;
  }

  // Build sources HTML
  let sourcesHtml = "";
  if (note.sources && note.sources.length > 0) {
    sourcesHtml = `
      <section class="sources-section">
        <div class="sources-header">
          <div class="sources-icon">✓</div>
          <div>
            <div class="pearls-title">Verified Sources</div>
            <div class="pearls-subtitle">${note.sources.length} references</div>
          </div>
        </div>
        ${note.sources
          .map(
            (source) => `
          <a href="${escapeHtml(
            source.uri
          )}" target="_blank" rel="noopener noreferrer" class="source-link">
            <span class="source-title">${escapeHtml(source.title)}</span>
            <span class="source-url">${new URL(source.uri).hostname}</span>
          </a>
        `
          )
          .join("")}
      </section>
    `;
  }

  // Build summary HTML
  let summaryHtml = "";
  if (note.summary) {
    summaryHtml = `
      <div class="summary-block">
        <div class="summary-label">Executive Summary</div>
        <div class="summary-text">${escapeHtml(note.summary)}</div>
      </div>
    `;
  }

  // Build ELI5 HTML
  let eli5Html = "";
  if (note.eli5Analogy) {
    eli5Html = `
      <div class="summary-block" style="border-left: 3px solid var(--accent-purple);">
        <div class="summary-label" style="color: var(--accent-purple);">💡 In Simple Terms</div>
        <div class="summary-text" style="font-style: italic;">"${escapeHtml(
          note.eli5Analogy
        )}"</div>
      </div>
    `;
  }

  const timestamp = new Date(note.timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="Synapse Med">
  <meta name="created" content="${new Date(note.timestamp).toISOString()}">
  <title>${escapeHtml(note.title)} — Synapse Med</title>
  <style>
    ${CSS_BASE}
    ${themeCSS}
  </style>
</head>
<body>
  <header class="header">
    <div class="header-brand">Synapse Med Study Guide</div>
    <h1>${escapeHtml(note.title)}</h1>
    <div class="header-meta">
      <span>📅 ${timestamp}</span>
      <span>🧠 ${note.graphData.nodes.length} nodes</span>
      <span>🔗 ${note.graphData.links.length} connections</span>
    </div>
  </header>
  
  ${summaryHtml}
  ${eli5Html}
  
  <main class="content">
    ${contentHtml}
  </main>
  
  ${pearlsHtml}
  ${sourcesHtml}
  
  <footer class="footer">
    <div class="footer-brand">Synapse Med</div>
    <div>Exported ${new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}</div>
  </footer>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// GRAPH SVG EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a standalone SVG visualization of the knowledge graph
 */
export function generateGraphSvg(graphData: KnowledgeGraphData): string {
  const width = 1200;
  const height = 800;
  const centerX = width / 2;
  const centerY = height / 2;

  // Group colors
  const groupColors: Record<
    number,
    { fill: string; stroke: string; name: string }
  > = {
    1: { fill: "#06b6d4", stroke: "#0891b2", name: "Core Concept" },
    2: { fill: "#f43f5e", stroke: "#e11d48", name: "Pathology" },
    3: { fill: "#8b5cf6", stroke: "#7c3aed", name: "Medication" },
    4: { fill: "#14b8a6", stroke: "#0d9488", name: "Anatomy" },
    5: { fill: "#f59e0b", stroke: "#d97706", name: "Physiology" },
    6: { fill: "#3b82f6", stroke: "#2563eb", name: "Diagnostic" },
    7: { fill: "#f97316", stroke: "#ea580c", name: "Clinical Sign" },
  };

  // Simple force-directed layout simulation (simplified for static SVG)
  const nodes = graphData.nodes.map((node, i) => {
    // Arrange in circular layout with some randomization
    const angle = (i / graphData.nodes.length) * 2 * Math.PI;
    const radius = 200 + Math.random() * 150;
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      radius: 20 + (node.val || 10) * 1.5,
    };
  });

  // Create node lookup for links
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Build links SVG
  const linksHtml = graphData.links
    .map((link) => {
      const source = nodeMap.get(
        typeof link.source === "string" ? link.source : (link.source as any).id
      );
      const target = nodeMap.get(
        typeof link.target === "string" ? link.target : (link.target as any).id
      );
      if (!source || !target) return "";

      // Curved path
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const normalX = -dy / dist;
      const normalY = dx / dist;
      const curveAmount = dist * 0.1;
      const cX = midX + normalX * curveAmount;
      const cY = midY + normalY * curveAmount;

      return `
      <path 
        d="M${source.x},${source.y} Q${cX},${cY} ${target.x},${target.y}"
        fill="none"
        stroke="#4b5563"
        stroke-width="1.5"
        stroke-opacity="0.4"
        marker-end="url(#arrow)"
      />
      <text
        x="${cX}"
        y="${cY - 5}"
        font-size="8"
        fill="#6b7280"
        text-anchor="middle"
        font-family="Inter, sans-serif"
      >${link.relationship}</text>
    `;
    })
    .join("");

  // Build nodes SVG
  const nodesHtml = nodes
    .map((node) => {
      const color = groupColors[node.group] || {
        fill: "#64748b",
        stroke: "#475569",
        name: "Other",
      };
      return `
      <g transform="translate(${node.x}, ${node.y})">
        <circle 
          r="${node.radius + 4}"
          fill="none"
          stroke="${color.stroke}"
          stroke-width="1"
          stroke-opacity="0.3"
          stroke-dasharray="4,4"
        />
        <circle 
          r="${node.radius}"
          fill="${color.fill}"
          stroke="${color.stroke}"
          stroke-width="2"
        />
        <text
          y="${node.radius + 18}"
          font-size="11"
          fill="#e5e7eb"
          text-anchor="middle"
          font-family="Inter, sans-serif"
          font-weight="500"
        >${escapeHtml(node.label)}</text>
      </g>
    `;
    })
    .join("");

  // Build legend
  const legendHtml = Object.entries(groupColors)
    .map(
      ([group, config], i) => `
    <g transform="translate(${20}, ${20 + i * 25})">
      <circle r="6" cx="6" cy="6" fill="${config.fill}" />
      <text x="18" y="10" font-size="10" fill="#9ca3af" font-family="Inter, sans-serif">${
        config.name
      }</text>
    </g>
  `
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg 
  xmlns="http://www.w3.org/2000/svg" 
  viewBox="0 0 ${width} ${height}"
  width="${width}"
  height="${height}"
  style="background: #0a0c0e;"
>
  <defs>
    <marker id="arrow" viewBox="0 -5 10 10" refX="25" refY="0" markerWidth="5" markerHeight="5" orient="auto">
      <path fill="#6b7280" d="M0,-5L10,0L0,5"/>
    </marker>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.5" fill="rgba(255,255,255,0.05)"/>
    </pattern>
  </defs>
  
  <rect width="100%" height="100%" fill="url(#grid)"/>
  
  <g class="links">
    ${linksHtml}
  </g>
  
  <g class="nodes">
    ${nodesHtml}
  </g>
  
  <g class="legend">
    ${legendHtml}
  </g>
  
  <text x="${width - 20}" y="${
    height - 15
  }" font-size="10" fill="#4b5563" text-anchor="end" font-family="monospace">
    Synapse Med — Topic Map
  </text>
</svg>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF EXPORT (Using jsPDF)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate PDF from HTML content
 * Uses dynamic import of jsPDF and html2canvas for client-side rendering
 */
export async function generatePdf(
  note: AugmentedNote,
  theme: "obsidian" | "clinical" | "print" = "print",
  quality: "standard" | "high" | "maximum" = "high",
  onProgress?: ExportProgressCallback
): Promise<Blob> {
  onProgress?.({
    stage: "pdf",
    progress: 10,
    message: "Loading PDF library...",
  });

  // Dynamic import of jsPDF
  const { jsPDF } = await import("jspdf");

  onProgress?.({ stage: "pdf", progress: 20, message: "Preparing content..." });

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPosition = margin;

  // Quality settings
  const fontSize = quality === "maximum" ? 11 : quality === "high" ? 10 : 9;
  const lineHeight = quality === "maximum" ? 6 : quality === "high" ? 5 : 4.5;

  // Colors based on theme
  const colors =
    theme === "print"
      ? {
          primary: "#000000",
          secondary: "#333333",
          accent: "#0077b6",
          muted: "#666666",
        }
      : theme === "clinical"
      ? {
          primary: "#1e293b",
          secondary: "#475569",
          accent: "#0891b2",
          muted: "#94a3b8",
        }
      : {
          primary: "#f0f2f5",
          secondary: "#9ca3af",
          accent: "#2ad4d4",
          muted: "#6b7280",
        };

  // Helper to add new page if needed
  const checkNewPage = (requiredHeight: number) => {
    if (yPosition + requiredHeight > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper to set color
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  };

  onProgress?.({ stage: "pdf", progress: 30, message: "Rendering header..." });

  // === HEADER ===
  // Brand
  pdf.setFontSize(8);
  const accentRgb = hexToRgb(colors.accent);
  pdf.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
  pdf.text("SYNAPSE MED STUDY GUIDE", margin, yPosition);
  yPosition += 8;

  // Title
  pdf.setFontSize(24);
  const primaryRgb = hexToRgb(colors.primary);
  pdf.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  const titleLines = pdf.splitTextToSize(note.title, contentWidth);
  pdf.text(titleLines, margin, yPosition);
  yPosition += titleLines.length * 10 + 5;

  // Metadata
  pdf.setFontSize(8);
  const mutedRgb = hexToRgb(colors.muted);
  pdf.setTextColor(mutedRgb.r, mutedRgb.g, mutedRgb.b);
  const dateStr = new Date(note.timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.text(
    `${dateStr}  •  ${note.graphData.nodes.length} nodes  •  ${note.graphData.links.length} connections`,
    margin,
    yPosition
  );
  yPosition += 12;

  // Separator line
  pdf.setDrawColor(
    hexToRgb(colors.muted).r,
    hexToRgb(colors.muted).g,
    hexToRgb(colors.muted).b
  );
  pdf.setLineWidth(0.2);
  pdf.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 10;

  onProgress?.({ stage: "pdf", progress: 40, message: "Rendering summary..." });

  // === SUMMARY ===
  if (note.summary) {
    pdf.setFontSize(8);
    pdf.setTextColor(accentRgb.r, accentRgb.g, accentRgb.b);
    pdf.text("EXECUTIVE SUMMARY", margin, yPosition);
    yPosition += 5;

    pdf.setFontSize(fontSize);
    const secondaryRgb = hexToRgb(colors.secondary);
    pdf.setTextColor(secondaryRgb.r, secondaryRgb.g, secondaryRgb.b);
    const summaryLines = pdf.splitTextToSize(note.summary, contentWidth);
    checkNewPage(summaryLines.length * lineHeight + 10);
    pdf.text(summaryLines, margin, yPosition);
    yPosition += summaryLines.length * lineHeight + 10;
  }

  onProgress?.({ stage: "pdf", progress: 50, message: "Rendering content..." });

  // === MAIN CONTENT ===
  // Simple markdown to text conversion for PDF
  const plainContent = markdownToPlainText(note.markdownContent);
  const contentLines = pdf.splitTextToSize(plainContent, contentWidth);

  pdf.setFontSize(fontSize);
  pdf.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);

  const chunkSize = 50; // Lines per chunk
  for (let i = 0; i < contentLines.length; i += chunkSize) {
    const chunk = contentLines.slice(i, i + chunkSize);
    checkNewPage(chunk.length * lineHeight);
    pdf.text(chunk, margin, yPosition);
    yPosition += chunk.length * lineHeight;

    const progress = 50 + Math.floor((i / contentLines.length) * 30);
    onProgress?.({
      stage: "pdf",
      progress,
      message: `Rendering content... ${Math.floor(
        (i / contentLines.length) * 100
      )}%`,
    });
  }

  onProgress?.({
    stage: "pdf",
    progress: 85,
    message: "Rendering clinical pearls...",
  });

  // === CLINICAL PEARLS ===
  if (note.pearls && note.pearls.length > 0) {
    checkNewPage(30);
    yPosition += 10;

    pdf.setFontSize(14);
    pdf.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    pdf.text("Clinical Pearls", margin, yPosition);
    yPosition += 10;

    for (const pearl of note.pearls) {
      checkNewPage(20);

      const labelColors: Record<string, string> = {
        "red-flag": "#f472b6",
        "exam-tip": "#2ad4d4",
        "gap-filler": "#a78bfa",
        "fact-check": "#f0b429",
      };

      const labelColor = hexToRgb(labelColors[pearl.type] || colors.accent);
      pdf.setFontSize(8);
      pdf.setTextColor(labelColor.r, labelColor.g, labelColor.b);

      const label = pearl.type
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
        .toUpperCase();
      pdf.text(label, margin, yPosition);
      yPosition += 5;

      pdf.setFontSize(fontSize);
      pdf.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      const pearlLines = pdf.splitTextToSize(pearl.content, contentWidth - 5);
      checkNewPage(pearlLines.length * lineHeight + 5);
      pdf.text(pearlLines, margin + 3, yPosition);
      yPosition += pearlLines.length * lineHeight + 8;
    }
  }

  onProgress?.({ stage: "pdf", progress: 95, message: "Finalizing..." });

  // === FOOTER on last page ===
  pdf.setFontSize(7);
  pdf.setTextColor(mutedRgb.r, mutedRgb.g, mutedRgb.b);
  pdf.text(
    `Generated by Synapse Med — ${new Date().toLocaleDateString()}`,
    margin,
    pageHeight - 10
  );

  onProgress?.({ stage: "pdf", progress: 100, message: "PDF complete!" });

  return pdf.output("blob");
}

// ═══════════════════════════════════════════════════════════════════════════
// ZIP BUNDLE EXPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a comprehensive ZIP archive with all export formats
 */
export async function createExportBundle(
  note: AugmentedNote,
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<Blob> {
  onProgress?.({
    stage: "preparing",
    progress: 0,
    message: "Initializing export...",
  });

  // Dynamic import of JSZip
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  // Create folder structure
  const folderName = sanitizeFilename(note.title);
  const folder = zip.folder(folderName);

  if (!folder) {
    throw new Error("Failed to create ZIP folder");
  }

  onProgress?.({
    stage: "preparing",
    progress: 10,
    message: "Preparing files...",
  });

  // Add README
  const readme = `# ${note.title}

Exported from Synapse Med on ${new Date().toLocaleDateString()}

## Contents

${
  options.includeMarkdown
    ? "- `study-guide.md` — Portable Markdown version\n"
    : ""
}${
    options.includeHtml
      ? "- `study-guide.html` — Styled HTML (open in browser)\n"
      : ""
  }${options.includePdf ? "- `study-guide.pdf` — Print-ready PDF\n" : ""}${
    options.includeGraph
      ? "- `knowledge-graph.svg` — Visual graph export\n"
      : ""
  }${
    options.includeGraphData
      ? "- `graph-data.json` — Raw graph data for integration\n"
      : ""
  }

## Statistics
- Nodes: ${note.graphData.nodes.length}
- Connections: ${note.graphData.links.length}
- Clinical Pearls: ${note.pearls?.length || 0}
- Verified Sources: ${note.sources?.length || 0}

---
*Synapse Med — Your AI Learning Companion*
`;
  folder.file("README.md", readme);

  // Generate and add Markdown
  if (options.includeMarkdown) {
    onProgress?.({
      stage: "markdown",
      progress: 20,
      message: "Generating Markdown...",
    });
    const markdown = generateMarkdown(note);
    folder.file("study-guide.md", markdown);
  }

  // Generate and add HTML
  if (options.includeHtml) {
    onProgress?.({
      stage: "html",
      progress: 35,
      message: "Generating HTML...",
    });
    const html = generateHtml(note, options.theme);
    folder.file("study-guide.html", html);
  }

  // Generate and add PDF
  if (options.includePdf) {
    onProgress?.({ stage: "pdf", progress: 50, message: "Generating PDF..." });
    const pdfBlob = await generatePdf(
      note,
      options.theme === "obsidian" ? "print" : options.theme,
      options.quality,
      onProgress
    );
    folder.file("study-guide.pdf", pdfBlob);
  }

  // Generate and add Graph SVG
  if (options.includeGraph) {
    onProgress?.({
      stage: "graph",
      progress: 80,
      message: "Generating graph visualization...",
    });
    const svg = generateGraphSvg(note.graphData);
    folder.file("knowledge-graph.svg", svg);
  }

  // Add Graph Data JSON
  if (options.includeGraphData) {
    onProgress?.({
      stage: "graph",
      progress: 85,
      message: "Exporting graph data...",
    });
    const graphJson = JSON.stringify(
      {
        title: note.title,
        exportedAt: new Date().toISOString(),
        nodes: note.graphData.nodes,
        links: note.graphData.links,
      },
      null,
      2
    );
    folder.file("graph-data.json", graphJson);
  }

  onProgress?.({
    stage: "bundling",
    progress: 90,
    message: "Creating ZIP archive...",
  });

  // Generate ZIP blob
  const zipBlob = await zip.generateAsync(
    {
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      const progress = 90 + Math.floor(metadata.percent / 10);
      onProgress?.({
        stage: "bundling",
        progress,
        message: `Compressing... ${Math.floor(metadata.percent)}%`,
      });
    }
  );

  onProgress?.({
    stage: "complete",
    progress: 100,
    message: "Export complete!",
  });

  return zipBlob;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simple Markdown to HTML converter
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML entities first (except for things we'll convert)
  const escapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
  };

  // Don't escape markdown syntax
  // Headers
  html = html.replace(/^######\s(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s(.+)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Code blocks
  html = html.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    "<pre><code>$2</code></pre>"
  );
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Blockquotes
  html = html.replace(/^>\s(.+)$/gm, "<blockquote>$1</blockquote>");

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Images (basic)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" style="max-width: 100%;">'
  );

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr>");
  html = html.replace(/^\*\*\*$/gm, "<hr>");

  // Lists
  html = html.replace(/^[-*]\s(.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");

  // Ordered lists
  html = html.replace(/^\d+\.\s(.+)$/gm, "<li>$1</li>");

  // Paragraphs (wrap remaining text)
  html = html.replace(/^(?!<[hupbol]|<li|<hr|<block|<pre)(.+)$/gm, "<p>$1</p>");

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, "");

  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, "\n");

  return html;
}

/**
 * Convert Markdown to plain text for PDF
 */
function markdownToPlainText(markdown: string): string {
  let text = markdown;

  // Remove headers markers
  text = text.replace(/^#{1,6}\s/gm, "");

  // Remove bold/italic markers
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, "$1");
  text = text.replace(/\*\*(.+?)\*\*/g, "$1");
  text = text.replace(/\*(.+?)\*/g, "$1");
  text = text.replace(/_(.+?)_/g, "$1");

  // Remove code markers
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/`([^`]+)`/g, "$1");

  // Convert links to text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove images
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

  // Remove horizontal rules
  text = text.replace(/^---$/gm, "");
  text = text.replace(/^\*\*\*$/gm, "");

  // Convert blockquotes
  text = text.replace(/^>\s/gm, "  ");

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Sanitize filename for cross-platform compatibility
 */
function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 100) || "export"
  );
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Quick export helpers
 */
export async function exportAsMarkdown(note: AugmentedNote): Promise<void> {
  const content = generateMarkdown(note);
  const blob = new Blob([content], { type: "text/markdown" });
  downloadBlob(blob, `${sanitizeFilename(note.title)}.md`);
}

export async function exportAsHtml(
  note: AugmentedNote,
  theme: "obsidian" | "clinical" | "print" = "obsidian"
): Promise<void> {
  const content = generateHtml(note, theme);
  const blob = new Blob([content], { type: "text/html" });
  downloadBlob(blob, `${sanitizeFilename(note.title)}.html`);
}

export async function exportAsPdf(
  note: AugmentedNote,
  theme: "obsidian" | "clinical" | "print" = "print",
  quality: "standard" | "high" | "maximum" = "high"
): Promise<void> {
  const blob = await generatePdf(note, theme, quality);
  downloadBlob(blob, `${sanitizeFilename(note.title)}.pdf`);
}

export async function exportAsZip(
  note: AugmentedNote,
  options: ExportOptions,
  onProgress?: ExportProgressCallback
): Promise<void> {
  const blob = await createExportBundle(note, options, onProgress);
  downloadBlob(blob, `${sanitizeFilename(note.title)}-export.zip`);
}
