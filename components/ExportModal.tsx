/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SYNAPSE MED — EXPORT MODAL
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cinematic export interface for Study Guides + Knowledge Graphs
 * Features atmospheric design, real-time progress, and format selection
 *
 * Design Philosophy:
 * - Editorial quality with atmospheric depth
 * - Reactive feedback with meaningful motion
 * - Tactile interaction patterns
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  X,
  Download,
  FileText,
  Globe,
  Package,
  Check,
  Loader2,
  FileJson,
  Palette,
  Zap,
  ChevronRight,
  AlertCircle,
  Info,
} from "lucide-react";
import { AugmentedNote } from "../types";
import {
  ExportOptions,
  ExportProgress,
  exportAsZip,
  exportAsMarkdown,
  exportAsHtml,
} from "../services/exportService";

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT PROPS
// ═══════════════════════════════════════════════════════════════════════════

interface ExportModalProps {
  note: AugmentedNote;
  isOpen: boolean;
  onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMAT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const FORMAT_OPTIONS = [
  {
    id: "markdown",
    key: "includeMarkdown" as const,
    label: "Markdown (.md)",
    description:
      "Plain text notes — works in Notion, Obsidian, or any text editor",
    hint: "💡 Best for: Copying into your notes app or editing later",
    icon: FileText,
    color: "#14b8a6",
    recommended: true,
  },
  {
    id: "html",
    key: "includeHtml" as const,
    label: "Web Page (.html)",
    description:
      "Beautiful formatted page — just double-click to open in browser",
    hint: "💡 Best for: Reading, printing, or sharing with classmates",
    icon: Globe,
    color: "#f59e0b",
    recommended: true,
  },
  {
    id: "graphData",
    key: "includeGraphData" as const,
    label: "Graph Data (.json)",
    description: "Knowledge map data for advanced use",
    hint: "💡 For developers or data analysis tools",
    icon: FileJson,
    color: "#06b6d4",
    recommended: false,
  },
];

const THEME_OPTIONS = [
  {
    id: "obsidian",
    label: "Obsidian",
    description: "Dark mode, atmospheric",
    preview: "bg-[#0a0c0e]",
    textPreview: "text-gray-100",
  },
  {
    id: "clinical",
    label: "Clinical",
    description: "Light mode, professional",
    preview: "bg-gray-50",
    textPreview: "text-gray-900",
  },
  {
    id: "print",
    label: "Print",
    description: "Optimized for printing",
    preview: "bg-white",
    textPreview: "text-black",
  },
];

const QUALITY_OPTIONS = [
  { id: "standard", label: "Standard", description: "Faster export" },
  { id: "high", label: "High", description: "Recommended" },
  { id: "maximum", label: "Maximum", description: "Best quality" },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const ExportModal: React.FC<ExportModalProps> = ({ note, isOpen, onClose }) => {
  // State
  const [options, setOptions] = useState<ExportOptions>({
    includeMarkdown: true,
    includeHtml: true,
    includePdf: false,
    includeGraph: false,
    includeGraphData: false,
    theme: "obsidian",
    quality: "high",
  });

  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(
    null
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [quickExportMode, setQuickExportMode] = useState<string | null>(null);

  // Computed
  const selectedFormatsCount = useMemo(() => {
    return [
      options.includeMarkdown,
      options.includeHtml,
      options.includePdf,
      options.includeGraph,
      options.includeGraphData,
    ].filter(Boolean).length;
  }, [options]);

  const canExport = selectedFormatsCount > 0 && !isExporting;

  // Handlers
  const toggleFormat = useCallback((key: keyof ExportOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleProgressUpdate = useCallback((progress: ExportProgress) => {
    setExportProgress(progress);
  }, []);

  const handleFullExport = useCallback(async () => {
    if (!canExport) return;

    setIsExporting(true);
    setExportError(null);
    setExportProgress({
      stage: "preparing",
      progress: 0,
      message: "Starting export...",
    });

    try {
      await exportAsZip(note, options, handleProgressUpdate);

      // Success state
      setExportProgress({
        stage: "complete",
        progress: 100,
        message: "Export complete!",
      });

      // Auto-close after success
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(null);
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error("Export failed:", error);
      setExportError(error.message || "Export failed. Please try again.");
      setIsExporting(false);
      setExportProgress(null);
    }
  }, [note, options, canExport, handleProgressUpdate, onClose]);

  const handleQuickExport = useCallback(
    async (format: "markdown" | "html") => {
      setQuickExportMode(format);
      setExportError(null);

      try {
        if (format === "markdown") {
          await exportAsMarkdown(note);
        } else if (format === "html") {
          await exportAsHtml(note, options.theme);
        }

        setQuickExportMode(null);
      } catch (error: any) {
        console.error("Quick export failed:", error);
        setExportError(error.message || "Export failed. Please try again.");
        setQuickExportMode(null);
      }
    },
    [note, options.theme]
  );

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
      {/* Modal Container */}
      <div className="relative bg-gradient-to-b from-bio-deep to-bio-void border border-white/[0.06] rounded-3xl shadow-2xl w-full max-w-2xl transform animate-scaleIn overflow-hidden max-h-[90vh] flex flex-col">
        {/* Atmospheric Glows */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-vital-cyan/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-neural-purple/10 rounded-full blur-[100px] pointer-events-none" />

        {/* Top Accent Line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-vital-cyan/50 to-transparent" />

        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 border-b border-white/[0.04]">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="absolute top-6 right-6 p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={20} />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-vital-cyan/15 to-clinical-teal/10 border border-vital-cyan/20 flex items-center justify-center">
              <Package size={24} className="text-vital-cyan" />
            </div>
            <div>
              <h2 className="text-2xl font-serif italic text-serum-white">
                Export Study Guide
              </h2>
              <p className="text-sm text-gray-500 mt-1 font-sans">
                {note.title}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 custom-scrollbar">
          {/* Error Display */}
          {exportError && (
            <div className="mb-6 p-4 rounded-xl bg-tissue-rose/10 border border-tissue-rose/20 flex items-start gap-3 animate-fadeIn">
              <AlertCircle
                size={18}
                className="text-tissue-rose shrink-0 mt-0.5"
              />
              <div>
                <p className="text-sm text-tissue-rose font-medium">
                  Export Error
                </p>
                <p className="text-xs text-gray-400 mt-1">{exportError}</p>
              </div>
            </div>
          )}

          {/* Export Progress */}
          {isExporting && exportProgress && (
            <div className="mb-6 p-6 rounded-2xl glass-slide border border-white/[0.06] animate-fadeIn">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Loader2
                      size={20}
                      className="text-vital-cyan animate-spin"
                    />
                    <div className="absolute inset-0 w-5 h-5 rounded-full bg-vital-cyan/20 animate-ping" />
                  </div>
                  <span className="text-sm font-medium text-gray-200">
                    {exportProgress.message}
                  </span>
                </div>
                <span className="text-xs font-mono text-vital-cyan">
                  {exportProgress.progress}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-vital-cyan to-clinical-teal rounded-full transition-all duration-300 ease-out relative"
                  style={{ width: `${exportProgress.progress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              </div>

              {/* Stage Indicator */}
              <div className="flex justify-between mt-4 text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                {[
                  "preparing",
                  "markdown",
                  "html",
                  "pdf",
                  "graph",
                  "bundling",
                  "complete",
                ].map((stage) => (
                  <span
                    key={stage}
                    className={`transition-colors ${
                      exportProgress.stage === stage
                        ? "text-vital-cyan"
                        : exportProgress.progress > 0 &&
                          [
                            "preparing",
                            "markdown",
                            "html",
                            "pdf",
                            "graph",
                            "bundling",
                            "complete",
                          ].indexOf(stage) <
                            [
                              "preparing",
                              "markdown",
                              "html",
                              "pdf",
                              "graph",
                              "bundling",
                              "complete",
                            ].indexOf(exportProgress.stage)
                        ? "text-gray-400"
                        : ""
                    }`}
                  >
                    {stage === "preparing" ? "Prep" : stage}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Export */}
          {!isExporting && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={14} className="text-synapse-amber" />
                <span className="text-xs font-sans font-semibold uppercase tracking-[0.15em] text-gray-400">
                  Quick Download
                </span>
              </div>
              <p className="text-[11px] text-gray-500 mb-4 leading-relaxed">
                Not sure which to pick?{" "}
                <span className="text-vital-cyan">HTML</span> is perfect for
                reading and printing.
                <span className="text-teal-400">Markdown</span> is great if you
                use Notion or Obsidian.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    id: "markdown",
                    label: "Markdown",
                    subtitle: "For notes apps",
                    icon: FileText,
                    color: "#14b8a6",
                  },
                  {
                    id: "html",
                    label: "Web Page",
                    subtitle: "For reading",
                    icon: Globe,
                    color: "#f59e0b",
                  },
                ].map((format) => {
                  const Icon = format.icon;
                  const isLoading = quickExportMode === format.id;
                  return (
                    <button
                      key={format.id}
                      onClick={() =>
                        handleQuickExport(format.id as "markdown" | "html")
                      }
                      disabled={!!quickExportMode}
                      className={`group relative p-5 rounded-xl border transition-all duration-300 ${
                        isLoading
                          ? "bg-white/[0.05] border-vital-cyan/30"
                          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]"
                      } disabled:opacity-50`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        {isLoading ? (
                          <Loader2
                            size={22}
                            className="text-vital-cyan animate-spin"
                          />
                        ) : (
                          <Icon size={22} style={{ color: format.color }} />
                        )}
                        <span className="text-sm font-medium text-gray-200">
                          {format.label}
                        </span>
                        {(format as any).subtitle && (
                          <span className="text-[10px] text-gray-500">
                            {(format as any).subtitle}
                          </span>
                        )}
                      </div>
                      <div
                        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                        style={{
                          background: `radial-gradient(circle at center, ${format.color}08 0%, transparent 70%)`,
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Format Selection */}
          {!isExporting && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Package size={14} className="text-vital-cyan" />
                  <span className="text-xs font-sans font-semibold uppercase tracking-[0.15em] text-gray-400">
                    Bundle Contents
                  </span>
                </div>
                <span className="text-xs font-mono text-gray-500">
                  {selectedFormatsCount} selected
                </span>
              </div>

              <div className="space-y-2">
                {FORMAT_OPTIONS.map((format) => {
                  const Icon = format.icon;
                  const isSelected = options[format.key];
                  return (
                    <button
                      key={format.id}
                      onClick={() => toggleFormat(format.key)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 ${
                        isSelected
                          ? "bg-white/[0.04] border-white/[0.12]"
                          : "bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03] hover:border-white/[0.08]"
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                          isSelected
                            ? "border-vital-cyan bg-vital-cyan"
                            : "border-gray-600"
                        }`}
                      >
                        {isSelected && (
                          <Check size={12} className="text-bio-void" />
                        )}
                      </div>

                      {/* Icon */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                          isSelected ? "bg-white/[0.08]" : "bg-white/[0.03]"
                        }`}
                      >
                        <Icon
                          size={18}
                          style={{
                            color: isSelected ? format.color : "#6b7280",
                          }}
                        />
                      </div>

                      {/* Label */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium transition-colors ${
                              isSelected ? "text-gray-100" : "text-gray-400"
                            }`}
                          >
                            {format.label}
                          </span>
                          {format.recommended && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-vital-cyan/10 text-vital-cyan uppercase tracking-wider">
                              Best
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {format.description}
                        </span>
                        {(format as any).hint && (
                          <span className="block text-[10px] text-gray-600 mt-1">
                            {(format as any).hint}
                          </span>
                        )}
                      </div>

                      <ChevronRight
                        size={16}
                        className={`text-gray-600 transition-transform ${
                          isSelected ? "rotate-90" : ""
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Theme & Quality Settings */}
          {!isExporting && (options.includeHtml || options.includePdf) && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Palette size={14} className="text-neural-purple" />
                <span className="text-xs font-sans font-semibold uppercase tracking-[0.15em] text-gray-400">
                  Appearance
                </span>
              </div>

              <div>
                {/* Theme Selection - Full width since PDF quality removed */}
                <div>
                  <label className="text-[10px] font-mono text-gray-500 uppercase tracking-wider mb-2 block">
                    HTML Theme (for Web Page export)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {THEME_OPTIONS.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() =>
                          setOptions((prev) => ({
                            ...prev,
                            theme: theme.id as
                              | "obsidian"
                              | "clinical"
                              | "print",
                          }))
                        }
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          options.theme === theme.id
                            ? "bg-white/[0.05] border-vital-cyan/30"
                            : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]"
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-md ${theme.preview} border border-white/10`}
                        />
                        <div className="text-left">
                          <div className="text-xs font-medium text-gray-200">
                            {theme.label}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {theme.description}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Statistics Preview */}
          {!isExporting && (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                <span>Your Study Guide</span>
                <span>{note.graphData.nodes.length} concepts mapped</span>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-gray-400">
                <span>📝 {note.pearls?.length || 0} clinical pearls</span>
                <span>📚 {note.sources?.length || 0} references</span>
                <span>
                  📄 ~{Math.ceil(note.markdownContent.length / 3000)} pages
                </span>
              </div>
            </div>
          )}

          {/* Helpful tip for medical students */}
          {!isExporting && (
            <div className="mt-4 p-4 rounded-xl bg-vital-cyan/5 border border-vital-cyan/10 flex items-start gap-3">
              <Info size={16} className="text-vital-cyan shrink-0 mt-0.5" />
              <div className="text-[11px] text-gray-400 leading-relaxed">
                <span className="text-vital-cyan font-medium">Pro tip:</span>{" "}
                Export as Web Page (.html) and save it anywhere on your
                computer. Double-click to open it in your browser — works
                offline, no internet needed! Perfect for exam prep.
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="relative px-8 py-6 border-t border-white/[0.04] bg-black/20">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-5 py-3 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/[0.05] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>

            <button
              onClick={handleFullExport}
              disabled={!canExport}
              className={`flex items-center gap-3 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                canExport
                  ? "bg-vital-cyan text-bio-void hover:shadow-[0_0_40px_rgba(42,212,212,0.3)] hover:scale-[1.02]"
                  : "bg-white/[0.03] text-gray-500 cursor-not-allowed"
              }`}
            >
              {isExporting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Export as ZIP
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Global Styles for Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes scaleIn {
          from { 
            opacity: 0; 
            transform: scale(0.95) translateY(10px); 
          }
          to { 
            opacity: 1; 
            transform: scale(1) translateY(0); 
          }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-scaleIn {
          animation: scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default ExportModal;
