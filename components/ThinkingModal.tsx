import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import BioBackground from "./BioBackground";
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

// Maximum thoughts to keep in history (prevents memory leak)
const MAX_THOUGHT_HISTORY = 50;

// Parse thoughts with markdown formatting for display (memoized outside component)
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
        <span key={keyIndex++} className="text-gray-200">
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
      <span key={keyIndex++} className="text-gray-300 leading-relaxed">
        {text.substring(lastIndex)}
      </span>
    );
  }

  return parts.length > 0
    ? parts
    : [
        <span key="0" className="text-gray-300">
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
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isComplete = stage === "citing";

  // ===============================
  // EFFECTS: Timer and UI Updates (with proper cleanup)
  // ===============================
  // Update elapsed time while modal is open
  useEffect(() => {
    if (!isThinking) {
      // Clear timer when modal closes
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => setElapsed((prev) => prev + 0.1), 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isThinking]);

  // Reset state when modal opens
  useEffect(() => {
    if (isThinking) {
      setThoughtHistory([]);
      setDisplayedText("");
      setElapsed(0);
    }
  }, [isThinking]);

  // Accumulate and animate thoughts with typewriter effect (with memory limit)
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
      // Limit history size to prevent memory leak
      setThoughtHistory((prev) => {
        const updated = [...prev, newThought];
        return updated.length > MAX_THOUGHT_HISTORY
          ? updated.slice(-MAX_THOUGHT_HISTORY)
          : updated;
      });

      // Typewriter animation
      setIsTyping(true);
      let charIndex = displayedText.length;
      const fullText = [...thoughtHistory, newThought].join("\n\n");

      // Clear existing interval before starting new one
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
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
            typingIntervalRef.current = null;
          }
        }
      }, 10);
    }

    // Cleanup interval on effect re-run or unmount
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, [currentThought]);

  // Auto-scroll thoughts container (debounced)
  useEffect(() => {
    if (thoughtContainerRef.current) {
      // Use requestAnimationFrame for smoother scrolling
      requestAnimationFrame(() => {
        if (thoughtContainerRef.current) {
          thoughtContainerRef.current.scrollTop =
            thoughtContainerRef.current.scrollHeight;
        }
      });
    }
  }, [displayedText]);

  // Memoize parsed markdown to prevent re-parsing on every render
  const parsedThoughts = useMemo(
    () => parseThoughtMarkdown(displayedText),
    [displayedText]
  );

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Note: global `BioBackground` is rendered in `App.tsx`.
          Remove the modal-local background to avoid duplication
          and allow the global background to show through. */}

      {/* Semi-transparent overlay on top of global BioBackground (reduced opacity so background remains visible) */}
      <div className="absolute inset-0 bg-bio-void/20 backdrop-blur-xl" />

      {/* Animated background - Subtle CSS overlays for color accents */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Subtle phase overlays for color accents */}
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-vital-cyan/[0.03] rounded-full blur-[120px] animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-neural-purple/[0.03] rounded-full blur-[120px] animate-pulse"
          style={{ animationDuration: "6s", animationDelay: "2s" }}
        />
        {isPhase2 && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-synapse-amber/[0.02] rounded-full blur-[160px] animate-pulse"
            style={{ animationDuration: "3s" }}
          />
        )}
      </div>

      <div className="relative w-full max-w-4xl mx-6 animate-[fadeIn_0.5s_ease-out]">
        {/* Phase Pills */}
        <div className="flex justify-center gap-4 mb-8">
          <div
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl border transition-all duration-500 ${
              config.phase === 1
                ? "bg-vital-cyan/10 border-vital-cyan/30 text-vital-cyan shadow-[0_0_30px_rgba(42,212,212,0.2)]"
                : "bg-vital-cyan/5 border-vital-cyan/20 text-vital-cyan/70"
            }`}
          >
            {config.phase > 1 ? (
              <CheckCircle size={14} className="text-vital-cyan" />
            ) : (
              <Network size={14} className="animate-pulse" />
            )}
            <span className="text-xs font-mono tracking-wider">
              Phase 1: Graph
            </span>
          </div>
          <div
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl border transition-all duration-500 ${
              config.phase === 2
                ? "bg-synapse-amber/10 border-synapse-amber/30 text-synapse-amber shadow-[0_0_30px_rgba(240,180,41,0.2)]"
                : "bg-white/[0.02] border-white/[0.06] text-gray-500"
            }`}
          >
            {config.phase === 2 ? (
              <Sparkles size={14} className="animate-pulse" />
            ) : (
              <div className="w-3.5 h-3.5 rounded-full border border-gray-500" />
            )}
            <span className="text-xs font-mono tracking-wider">
              Phase 2: Guide
            </span>
          </div>
        </div>

        {/* Main modal - glass-slide aesthetic */}
        <div
          className={`relative glass-slide border border-white/[0.08] rounded-3xl overflow-hidden shadow-2xl transition-all duration-500`}
        >
          {/* Header */}
          <div className="relative px-8 pt-8 pb-6 border-b border-white/[0.04]">
            <div className="flex items-center gap-6">
              {/* Icon with smooth transition */}
              <div className="relative">
                <div
                  className="absolute inset-0 blur-xl rounded-full animate-pulse"
                  style={{
                    backgroundColor: isPhase2
                      ? "rgba(240, 180, 41, 0.3)"
                      : "rgba(42, 212, 212, 0.3)",
                  }}
                />
                <div
                  className={`relative w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center transition-all duration-300 ${
                    isPhase2
                      ? "shadow-[0_0_40px_rgba(240,180,41,0.3)]"
                      : "shadow-[0_0_40px_rgba(42,212,212,0.3)]"
                  }`}
                >
                  <Icon
                    size={32}
                    className="text-serum-white transition-all duration-300"
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
                <h2 className="text-2xl font-serif font-light text-serum-white tracking-tight mb-2 transition-all duration-300">
                  {config.title}
                </h2>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_10px_currentColor] ${
                      isPhase2 ? "bg-synapse-amber" : "bg-vital-cyan"
                    }`}
                  />
                  <span className="text-[10px] font-mono text-gray-300 tracking-[0.2em] transition-all duration-300">
                    {config.subtitle}
                  </span>
                </div>
              </div>

              {/* Timer */}
              <div className="text-right">
                <div className="text-3xl font-mono font-light text-serum-white tabular-nums">
                  {elapsed.toFixed(1)}s
                </div>
                {isPhase2 && markdownProgress > 0 && (
                  <div className="text-[10px] font-mono text-synapse-amber tracking-wider mt-1">
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

                {/* Progress bar with glass-slide aesthetic */}
                <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isComplete
                        ? "w-full bg-vital-cyan shadow-[0_0_10px_rgba(42,212,212,0.5)]"
                        : "bg-synapse-amber shadow-[0_0_10px_rgba(240,180,41,0.5)]"
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
                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                  {isPhase2 ? "Synthesis Reasoning" : "Gemini's Reasoning"}
                </span>
              </div>
              {thoughtHistory.length > 0 && (
                <span className="text-[10px] font-mono text-gray-500">
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
                  {parsedThoughts}
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
                            : "text-gray-500"
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
                            : "text-gray-500"
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
                <span className="text-[10px] font-mono text-gray-300 tracking-wide">
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
