import React, { useEffect, useState, useRef } from "react";
import {
  Globe,
  Sparkles,
  Zap,
  Lightbulb,
  FileText,
  Network,
  CheckCircle,
  FileSearch,
  PenTool,
  BookOpen,
  Quote,
} from "lucide-react";

interface Props {
  isThinking: boolean;
  stage:
    | "extracting"
    | "verifying"
    | "graphing"
    | "structuring"
    | "writing"
    | "citing";
  currentThought?: string;
  markdownProgress?: number;
}

// Parse thoughts with markdown formatting for display
const parseThoughtMarkdown = (text: string): React.ReactNode[] => {
  if (!text) return [];

  const parts: React.ReactNode[] = [];
  let keyIndex = 0;

  // Pattern for **bold** text (headers)
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={keyIndex++} className="text-gray-300">
          {text.substring(lastIndex, match.index)}
        </span>
      );
    }

    parts.push(
      <span
        key={keyIndex++}
        className="block text-clinical-cyan font-semibold text-sm tracking-wide mt-3 mb-1 first:mt-0"
      >
        {match[1]}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={keyIndex++} className="text-gray-400 leading-relaxed">
        {text.substring(lastIndex)}
      </span>
    );
  }

  return parts.length > 0
    ? parts
    : [
        <span key="0" className="text-gray-400">
          {text}
        </span>,
      ];
};

const ThinkingModal: React.FC<Props> = ({
  isThinking,
  stage,
  currentThought,
  markdownProgress = 0,
}) => {
  // ===============================
  // STATE: Timer, Thoughts, and UI Effects
  // ===============================
  const [elapsed, setElapsed] = useState(0);
  const [thoughtHistory, setThoughtHistory] = useState<string[]>([]);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const thoughtContainerRef = useRef<HTMLDivElement>(null);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // 🔧 NEW: Track if we're in complete stage for 100% progress
  const isComplete = stage === "citing";

  // ===============================
  // EFFECTS: Timer and UI Updates
  // ===============================
  // Update elapsed time while modal is open
  useEffect(() => {
    if (!isThinking) return;
    const timer = setInterval(() => setElapsed((prev) => prev + 0.1), 100);
    return () => clearInterval(timer);
  }, [isThinking]);

  // Reset state when modal opens
  useEffect(() => {
    if (isThinking) {
      setThoughtHistory([]);
      setDisplayedText("");
      setElapsed(0);
    }
  }, [isThinking]);

  // Accumulate and animate thoughts with typewriter effect
  useEffect(() => {
    if (!currentThought || !currentThought.trim()) return;

    const newThought = currentThought.trim();

    // Avoid duplicates
    if (
      thoughtHistory.length === 0 ||
      !thoughtHistory[thoughtHistory.length - 1].includes(
        newThought.substring(0, 50)
      )
    ) {
      setThoughtHistory((prev) => [...prev, newThought]);

      // Typewriter animation
      setIsTyping(true);
      let charIndex = displayedText.length;
      const fullText = [...thoughtHistory, newThought].join("\n\n");

      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }

      typingIntervalRef.current = setInterval(() => {
        if (charIndex < fullText.length) {
          setDisplayedText(fullText.substring(0, charIndex + 3));
          charIndex += 3;
        } else {
          setDisplayedText(fullText);
          setIsTyping(false);
          if (typingIntervalRef.current) {
            clearInterval(typingIntervalRef.current);
          }
        }
      }, 10);
    }

    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }
    };
  }, [currentThought]);

  // Auto-scroll thoughts container
  useEffect(() => {
    if (thoughtContainerRef.current) {
      thoughtContainerRef.current.scrollTop =
        thoughtContainerRef.current.scrollHeight;
    }
  }, [displayedText]);

  // ===============================
  // RENDER: Conditional Modal UI
  // ===============================
  if (!isThinking) return null;

  // ===============================
  // 🆕 ENHANCED STAGE CONFIG: 6 Stages (3 Phase 1 + 3 Phase 2)
  // ===============================
  const stageConfig = {
    // Phase 1: Knowledge Graph Building
    extracting: {
      icon: FileSearch,
      title: "Extracting Content",
      subtitle: "READING & PARSING UPLOADED FILES",
      color: "clinical-cyan",
      gradient: "from-cyan-500/20 to-teal-500/10",
      phase: 1,
      phaseStep: 1,
    },
    verifying: {
      icon: Globe,
      title: "Verifying Information",
      subtitle: "CROSS-REFERENCING WITH GOOGLE SEARCH",
      color: "clinical-teal",
      gradient: "from-teal-500/20 to-emerald-500/10",
      phase: 1,
      phaseStep: 2,
    },
    graphing: {
      icon: Network,
      title: "Building Knowledge Graph",
      subtitle: "CONSTRUCTING CLINICAL CONSTELLATION",
      color: "clinical-purple",
      gradient: "from-purple-500/20 to-violet-500/10",
      phase: 1,
      phaseStep: 3,
    },
    // Phase 2: Master Guide Writing
    structuring: {
      icon: BookOpen,
      title: "Structuring Guide",
      subtitle: "PLANNING COMPREHENSIVE LAYOUT",
      color: "clinical-amber",
      gradient: "from-amber-500/20 to-yellow-500/10",
      phase: 2,
      phaseStep: 1,
    },
    writing: {
      icon: PenTool,
      title: "Writing Content",
      subtitle: "SYNTHESIZING DETAILED SECTIONS",
      color: "clinical-rose",
      gradient: "from-rose-500/20 to-pink-500/10",
      phase: 2,
      phaseStep: 2,
    },
    citing: {
      icon: Quote,
      title: "Adding Citations",
      subtitle: "VERIFYING & LINKING SOURCES",
      color: "clinical-teal",
      gradient: "from-teal-500/20 to-cyan-500/10",
      phase: 2,
      phaseStep: 3,
    },
  };

  const config = stageConfig[stage];
  const Icon = config.icon;
  const isPhase2 = config.phase === 2;

  const phase1Stages = ["extracting", "verifying", "graphing"] as const;
  const phase2Stages = ["structuring", "writing", "citing"] as const;
  const currentPhase1Index = phase1Stages.indexOf(stage as any);
  const currentPhase2Index = phase2Stages.indexOf(stage as any);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-clinical-cyan/5 rounded-full blur-[100px] animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-clinical-teal/5 rounded-full blur-[100px] animate-pulse"
          style={{ animationDuration: "6s", animationDelay: "2s" }}
        />
        {isPhase2 && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-clinical-amber/5 rounded-full blur-[150px] animate-pulse"
            style={{ animationDuration: "3s" }}
          />
        )}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      <div className="relative w-full max-w-4xl mx-6 animate-[fadeIn_0.5s_ease-out]">
        {/* Phase Pills */}
        <div className="flex justify-center gap-4 mb-6">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-500 ${
              config.phase === 1
                ? "bg-clinical-cyan/20 border-clinical-cyan/50 text-clinical-cyan shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                : "bg-clinical-teal/10 border-clinical-teal/30 text-clinical-teal"
            }`}
          >
            {config.phase > 1 ? (
              <CheckCircle size={14} className="text-clinical-teal" />
            ) : (
              <Network size={14} className="animate-pulse" />
            )}
            <span className="text-xs font-mono uppercase tracking-wider">
              Phase 1: Graph
            </span>
          </div>
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-500 ${
              config.phase === 2
                ? "bg-clinical-amber/20 border-clinical-amber/50 text-clinical-amber shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                : "bg-white/5 border-white/10 text-gray-500"
            }`}
          >
            {config.phase === 2 ? (
              <Sparkles size={14} className="animate-pulse" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-gray-600" />
            )}
            <span className="text-xs font-mono uppercase tracking-wider">
              Phase 2: Guide
            </span>
          </div>
        </div>

        {/* Main modal - smooth gradient transition */}
        <div
          className={`relative bg-gradient-to-br ${config.gradient} border border-white/10 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-xl transition-all duration-500`}
        >
          {/* Header */}
          <div className="relative px-8 pt-8 pb-6 border-b border-white/5">
            <div className="flex items-center gap-6">
              {/* Icon with smooth transition */}
              <div className="relative">
                <div
                  className="absolute inset-0 blur-xl rounded-full animate-pulse"
                  style={{
                    backgroundColor: `var(--${config.color}, rgba(6,182,212,0.3))`,
                  }}
                />
                <div
                  className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br from-white/10 to-transparent border border-white/20 flex items-center justify-center transition-all duration-300 ${
                    isPhase2 ? "shadow-[0_0_30px_rgba(245,158,11,0.4)]" : ""
                  }`}
                >
                  <Icon
                    size={32}
                    className="text-white transition-all duration-300"
                    style={{
                      animation:
                        stage === "verifying" || stage === "citing"
                          ? "spin 3s linear infinite"
                          : stage === "writing"
                          ? "pulse 1s ease-in-out infinite"
                          : "pulse 2s ease-in-out infinite",
                    }}
                  />
                </div>
              </div>

              <div className="flex-1">
                <h2 className="text-2xl font-light text-white tracking-tight mb-1 transition-all duration-300">
                  {config.title}
                </h2>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse shadow-[0_0_10px_currentColor]" />
                  <span className="text-xs font-mono text-gray-400 tracking-widest uppercase transition-all duration-300">
                    {config.subtitle}
                  </span>
                </div>
              </div>

              {/* Timer */}
              <div className="text-right">
                <div className="text-3xl font-mono font-light text-white tabular-nums">
                  {elapsed.toFixed(1)}s
                </div>
                {isPhase2 && markdownProgress > 0 && (
                  <div className="text-[10px] font-mono text-clinical-amber uppercase tracking-wider mt-1">
                    {(markdownProgress / 1000).toFixed(1)}K chars
                  </div>
                )}
              </div>
            </div>

            {/* Phase 2 Progress Bar - POLISHED */}
            {isPhase2 && (
              <div className="mt-6">
                <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-2">
                  <span>MARKDOWN GENERATION</span>
                  <span>
                    {isComplete
                      ? "100%"
                      : markdownProgress > 0
                      ? `${(markdownProgress / 1000).toFixed(1)}K chars`
                      : "Starting..."}
                  </span>
                </div>

                {/* 🔧 POLISHED: Simple linear progress bar, no gradient */}
                <div className="h-2 bg-white/5 rounded-full overflow-hidden shadow-inner">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isComplete
                        ? "w-full bg-clinical-teal"
                        : "bg-clinical-amber"
                    }`}
                    style={{
                      width: isComplete
                        ? "100%"
                        : markdownProgress > 0
                        ? `${Math.min(
                            Math.max((markdownProgress / 45000) * 100, 3),
                            98
                          )}%`
                        : "3%",
                      transitionDuration: isComplete ? "600ms" : "300ms",
                      transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Thoughts display */}
          <div className="relative">
            <div className="px-8 pt-6 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb size={14} className="text-white/60" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {isPhase2 ? "Synthesis Reasoning" : "Gemini's Reasoning"}
                </span>
              </div>
              {thoughtHistory.length > 0 && (
                <span className="text-[10px] font-mono text-gray-600">
                  {thoughtHistory.length} thought
                  {thoughtHistory.length !== 1 ? "s" : ""} captured
                </span>
              )}
            </div>

            <div
              ref={thoughtContainerRef}
              className="h-[280px] overflow-y-auto px-8 pb-6 scroll-smooth custom-scrollbar"
            >
              {displayedText ? (
                <div className="font-mono text-sm leading-relaxed">
                  {parseThoughtMarkdown(displayedText)}
                  {isTyping && (
                    <span className="inline-block w-2 h-4 bg-white ml-0.5 animate-pulse" />
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="flex gap-1.5 mb-4">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 bg-white/40 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                  <p className="text-gray-500 text-sm font-mono">
                    {stage === "extracting"
                      ? "Parsing uploaded content..."
                      : stage === "verifying"
                      ? "Cross-referencing sources..."
                      : stage === "graphing"
                      ? "Building knowledge connections..."
                      : stage === "structuring"
                      ? "Planning guide structure..."
                      : stage === "writing"
                      ? "Synthesizing content..."
                      : "Verifying citations..."}
                  </p>
                </div>
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          </div>

          {/* Footer with stage indicators */}
          <div className="px-8 py-4 border-t border-white/5 bg-black/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Phase 1 stages */}
                {phase1Stages.map((s, i) => {
                  const isCompleted =
                    config.phase === 2 ||
                    (config.phase === 1 && i < currentPhase1Index);
                  const isCurrent = s === stage;
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <div
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                          isCompleted
                            ? "bg-clinical-teal shadow-[0_0_6px_rgba(20,184,166,0.8)]"
                            : isCurrent
                            ? "bg-white shadow-[0_0_6px_white]"
                            : "bg-gray-700"
                        }`}
                      />
                      <span
                        className={`text-[8px] font-mono uppercase tracking-wider transition-all duration-300 ${
                          isCompleted
                            ? "text-clinical-teal"
                            : isCurrent
                            ? "text-white"
                            : "text-gray-600"
                        }`}
                      >
                        {s === "extracting"
                          ? "Extract"
                          : s === "verifying"
                          ? "Verify"
                          : "Graph"}
                      </span>
                    </div>
                  );
                })}

                <div className="w-px h-3 bg-gray-700 mx-1" />

                {/* Phase 2 stages */}
                {phase2Stages.map((s, i) => {
                  const isCompleted =
                    config.phase === 2 && i < currentPhase2Index;
                  const isCurrent = s === stage;
                  return (
                    <div key={s} className="flex items-center gap-1">
                      <div
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                          isCompleted
                            ? "bg-clinical-teal shadow-[0_0_6px_rgba(20,184,166,0.8)]"
                            : isCurrent
                            ? "bg-white shadow-[0_0_6px_white]"
                            : "bg-gray-700"
                        }`}
                      />
                      <span
                        className={`text-[8px] font-mono uppercase tracking-wider transition-all duration-300 ${
                          isCompleted
                            ? "text-clinical-teal"
                            : isCurrent
                            ? "text-white"
                            : "text-gray-600"
                        }`}
                      >
                        {s === "structuring"
                          ? "Plan"
                          : s === "writing"
                          ? "Write"
                          : "Cite"}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                <Zap size={12} className="text-clinical-amber" />
                <span className="text-[10px] font-mono text-gray-400 tracking-wide">
                  GEMINI 2.5 FLASH
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 2px; }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};

export default ThinkingModal;