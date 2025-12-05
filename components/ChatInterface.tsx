import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
  lazy,
  Suspense,
} from "react";
import {
  Send,
  X,
  BrainCircuit,
  Sparkles,
  Quote,
  RotateCcw,
  Copy,
  Check,
  Zap,
  Target,
  Stethoscope,
  BookOpen,
  FlaskConical,
  MessageCircle,
  ClipboardCheck,
  Lightbulb,
  GitCompare,
  Loader2,
  CheckCircle,
  Brain,
  HelpCircle,
  User,
  Info,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  chatService,
  ChatMessage,
  ChatMode,
  QuizQuestion,
  QuizTopic,
} from "../services/geminiChatService";
import { ChatRepository } from "../src/lib";
import { UserProfile, KnowledgeNode } from "../types";

// ═══════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════

interface Props {
  contextMarkdown: string;
  userProfile: UserProfile;
  graphNodes: KnowledgeNode[];
  noteTitle: string;
  noteId?: string;
  initialSelection?: string | null;
  onClose: () => void;
  onClearSelection?: () => void;
}

// Mode descriptions for tooltips - memoized outside component
const MODE_INFO: Record<
  ChatMode,
  { title: string; description: string; example: string }
> = {
  tutor: {
    title: "Socratic Tutor",
    description:
      "Interactive learning through guided questions. I'll help you discover concepts rather than just telling you answers.",
    example: '"Why do you think ACE inhibitors cause a dry cough?"',
  },
  quiz: {
    title: "Quiz Mode",
    description:
      "Practice with MCQs tailored to your exam. Immediate feedback with detailed explanations.",
    example: '"Quiz me on cardiac physiology"',
  },
  explain: {
    title: "Deep Explain",
    description:
      "Get comprehensive explanations of complex concepts with analogies and clinical correlations.",
    example: '"Explain the renin-angiotensin system"',
  },
  compare: {
    title: "Compare & Contrast",
    description:
      "Side-by-side analysis of similar concepts, conditions, or drugs to clarify differences.",
    example: '"Compare Type 1 vs Type 2 diabetes"',
  },
  clinical: {
    title: "Clinical Cases",
    description:
      "Work through patient scenarios with differential diagnosis and management plans.",
    example: '"A 45yo male presents with chest pain..."',
  },
};

// User Avatar Component - Optimized with memo
const UserAvatar: React.FC<{
  profilePicture?: string;
  name: string;
  size?: "sm" | "md";
}> = memo(({ profilePicture, name, size = "sm" }) => {
  const sizeClass = size === "sm" ? "w-7 h-7" : "w-9 h-9";
  const iconSize = size === "sm" ? 13 : 16;

  if (profilePicture) {
    return (
      <img
        src={profilePicture}
        alt={name}
        className={`${sizeClass} rounded-lg object-cover border border-white/10`}
        loading="lazy"
      />
    );
  }

  // Fallback: Generate initials with gradient background
  const initials = useMemo(() => 
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
    [name]
  );

  return (
    <div
      className={`${sizeClass} rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center`}
    >
      {initials ? (
        <span className="text-amber-400 font-semibold text-[10px]">
          {initials}
        </span>
      ) : (
        <User size={iconSize} className="text-amber-400/70" />
      )}
    </div>
  );
});

UserAvatar.displayName = "UserAvatar";

// ═══════════════════════════════════════════════════════════
// THINKING INDICATOR - Optimized with better cleanup
// ═══════════════════════════════════════════════════════════

const ThinkingIndicator: React.FC<{ thinkingText?: string }> = memo(
  function ThinkingIndicator({ thinkingText }) {
    const [dots, setDots] = useState("");
    const [isExpanded, setIsExpanded] = useState(false);
    const [displayedText, setDisplayedText] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const thoughtContainerRef = useRef<HTMLDivElement>(null);
    const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const dotsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Cleanup all intervals on unmount
    useEffect(() => {
      return () => {
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        if (dotsIntervalRef.current) clearInterval(dotsIntervalRef.current);
      };
    }, []);

    // Animated dots - reduced frequency
    useEffect(() => {
      dotsIntervalRef.current = setInterval(() => {
        setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
      }, 500); // Increased from 400ms
      return () => {
        if (dotsIntervalRef.current) clearInterval(dotsIntervalRef.current);
      };
    }, []);

    // Typewriter effect - optimized batch size
    useEffect(() => {
      if (!thinkingText || !thinkingText.trim()) return;

      if (thinkingText.length > 10 && !isExpanded) {
        setIsExpanded(true);
      }

      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
      }

      setIsTyping(true);
      let charIndex = displayedText.length;

      if (thinkingText.startsWith(displayedText)) {
        charIndex = displayedText.length;
      } else {
        charIndex = 0;
        setDisplayedText("");
      }

      // Faster typing: 8 chars at 12ms (was 5 at 10ms)
      typingIntervalRef.current = setInterval(() => {
        if (charIndex < thinkingText.length) {
          setDisplayedText(thinkingText.substring(0, charIndex + 8));
          charIndex += 8;
        } else {
          setDisplayedText(thinkingText);
          setIsTyping(false);
          if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
        }
      }, 12);

      return () => {
        if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      };
    }, [thinkingText]);

    // Auto-scroll with RAF
    useEffect(() => {
      if (thoughtContainerRef.current && isExpanded) {
        requestAnimationFrame(() => {
          if (thoughtContainerRef.current) {
            thoughtContainerRef.current.scrollTop = thoughtContainerRef.current.scrollHeight;
          }
        });
      }
    }, [displayedText, isExpanded]);

    const handleToggle = useCallback(() => {
      if (thinkingText) setIsExpanded((prev) => !prev);
    }, [thinkingText]);

    return (
      <div className="flex items-start gap-3 group">
        <div className="w-9 h-9 rounded-xl bg-vital-cyan/10 border border-vital-cyan/20 flex items-center justify-center shrink-0 relative">
          <Brain size={16} className="text-vital-cyan animate-pulse" />
          <div className="absolute inset-0 rounded-xl border-2 border-vital-cyan/20 animate-ping" />
        </div>
        <div className="flex-1 glass-slide border-2 border-vital-cyan/20 rounded-2xl rounded-tl-sm overflow-hidden shadow-[0_0_40px_rgba(42,212,212,0.1)] relative">
          <div className="absolute inset-0 bg-gradient-to-r from-vital-cyan/5 via-neural-purple/5 to-vital-cyan/5 opacity-50 animate-pulse pointer-events-none" />

          <div className="relative">
            <div
              className="px-4 py-3 border-b border-vital-cyan/10 bg-vital-cyan/[0.03] flex items-center justify-between cursor-pointer hover:bg-vital-cyan/[0.05] transition-colors"
              onClick={handleToggle}
            >
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 bg-vital-cyan rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <span className="text-vital-cyan text-xs font-sans font-semibold tracking-wide">
                  Thinking{dots}
                </span>
              </div>
              {thinkingText && (
                <button className="text-[10px] text-vital-cyan/60 hover:text-vital-cyan transition-colors flex items-center gap-1 font-sans">
                  {isExpanded ? "Hide" : "Show"}
                  <svg
                    className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Thinking content - collapsible with typewriter effect */}
            {thinkingText && (
              <div
                className={`px-4 transition-all duration-300 ease-in-out overflow-hidden ${
                  isExpanded ? "max-h-96 py-3" : "max-h-0 py-0"
                }`}
              >
                <div
                  ref={thoughtContainerRef}
                  className="text-gray-200 text-[11px] leading-relaxed font-mono bg-bio-deep/50 rounded-xl p-4 border border-white/[0.04] max-h-80 overflow-y-auto custom-scrollbar"
                >
                  {displayedText}
                  {isTyping && (
                    <span className="inline-block w-1.5 h-3 bg-vital-cyan ml-0.5 animate-pulse" />
                  )}
                </div>
              </div>
            )}

            {/* Progress bar */}
            <div className="h-0.5 bg-vital-cyan/10 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-vital-cyan to-transparent animate-shimmer" />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

// ═══════════════════════════════════════════════════════════
// QUIZ CARD - Interactive MCQ with IDK option
// ═══════════════════════════════════════════════════════════

const QuizCard: React.FC<{
  quiz: QuizQuestion;
  selectedAnswer?: string;
  isSubmitted: boolean;
  onSelect: (answer: string) => void;
  onSubmit: () => void;
  onIDK: () => void;
  isLoading: boolean;
}> = memo(function QuizCard({
  quiz,
  selectedAnswer,
  isSubmitted,
  onSelect,
  onSubmit,
  onIDK,
  isLoading,
}) {
  return (
    <div className="relative bg-gradient-to-br from-[#0d0e12] to-[#08090b] rounded-2xl border border-cyan-500/20 overflow-hidden shadow-2xl shadow-cyan-500/5">
      {/* Atmospheric gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(6,182,212,0.08),transparent_50%)] pointer-events-none" />

      {/* Header with refined typography */}
      <div className="relative px-4 py-3 bg-gradient-to-r from-cyan-500/[0.08] via-cyan-500/[0.06] to-transparent border-b border-cyan-500/10 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-5 bg-gradient-to-b from-cyan-400 to-teal-500 rounded-full" />
          <ClipboardCheck size={14} className="text-cyan-400" />
          <span className="text-cyan-300 font-medium text-[13px] tracking-wide">
            {quiz.topic}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-2.5 py-1 rounded-full font-medium tracking-wide backdrop-blur-sm border transition-all ${
              quiz.difficulty === "foundational"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : quiz.difficulty === "intermediate"
                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                : "bg-rose-500/15 text-rose-400 border-rose-500/30"
            }`}
          >
            {quiz.difficulty}
          </span>
        </div>
      </div>

      {/* Question with enhanced typography */}
      <div className="relative p-5">
        <div className="flex items-start gap-3 mb-5">
          <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-cyan-400/60 mt-2" />
          <p className="text-zinc-200 text-[14px] font-medium leading-[1.7] tracking-wide">
            {quiz.question}
          </p>
        </div>

        {/* Options with refined interactions */}
        <div className="space-y-2.5">
          {quiz.options.map((opt, idx) => (
            <button
              key={opt.label}
              onClick={() => !isSubmitted && onSelect(opt.label)}
              disabled={isSubmitted}
              className={`group/opt relative w-full text-left px-4 py-3 rounded-xl border transition-all duration-300 flex items-start gap-3.5 overflow-hidden ${
                isSubmitted
                  ? selectedAnswer === opt.label
                    ? "bg-gradient-to-r from-cyan-500/15 to-teal-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/10"
                    : "bg-zinc-900/40 border-zinc-800/40 opacity-40"
                  : selectedAnswer === opt.label
                  ? "bg-gradient-to-r from-cyan-500/12 to-teal-500/8 border-cyan-500/50 shadow-xl shadow-cyan-500/10 scale-[1.01]"
                  : "bg-zinc-900/30 border-zinc-800/50 hover:border-cyan-500/30 hover:bg-cyan-500/[0.04] hover:translate-x-0.5"
              }`}
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Hover shimmer effect */}
              {!isSubmitted && selectedAnswer !== opt.label && (
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/[0.03] to-transparent opacity-0 group-hover/opt:opacity-100 transition-opacity duration-500 -translate-x-full group-hover/opt:translate-x-full"
                  style={{ transition: "transform 900ms, opacity 400ms" }}
                />
              )}

              {/* Option label circle */}
              <span
                className={`relative shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  selectedAnswer === opt.label
                    ? isSubmitted
                      ? "bg-gradient-to-br from-cyan-400 to-teal-500 border-cyan-400 text-black shadow-lg shadow-cyan-400/30"
                      : "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20"
                    : "border-zinc-500 text-zinc-300 group-hover/opt:border-zinc-400 group-hover/opt:text-zinc-300"
                }`}
              >
                {opt.label}
              </span>

              {/* Option text */}
              <span
                className={`flex-1 text-[13px] leading-[1.65] transition-colors duration-300 ${
                  selectedAnswer === opt.label
                    ? "text-zinc-200"
                    : "text-zinc-300 group-hover/opt:text-zinc-200"
                }`}
              >
                {opt.text}
              </span>
            </button>
          ))}
        </div>

        {/* Actions with refined design */}
        {!isSubmitted && (
          <div className="mt-5 flex gap-3">
            <button
              onClick={onIDK}
              disabled={isLoading}
              className="group/idk flex-1 py-3 rounded-xl font-medium text-[13px] bg-gradient-to-br from-zinc-800/80 to-zinc-900/60 border border-zinc-700/50 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-200 hover:border-zinc-600/50 transition-all duration-300 flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-zinc-900/50 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent opacity-0 group-hover/idk:opacity-100 transition-opacity duration-500" />
              <HelpCircle size={14} className="relative" />
              <span className="relative">I'm not sure</span>
            </button>
            <button
              onClick={onSubmit}
              disabled={!selectedAnswer || isLoading}
              className={`group/submit flex-1 py-3 rounded-xl font-medium text-[13px] transition-all duration-300 flex items-center justify-center gap-2 relative overflow-hidden ${
                selectedAnswer && !isLoading
                  ? "bg-gradient-to-r from-cyan-500 to-teal-500 text-black hover:shadow-xl hover:shadow-cyan-500/30 hover:scale-[1.02] active:scale-[0.98]"
                  : "bg-zinc-800/80 text-zinc-500 cursor-not-allowed border border-zinc-700/30"
              }`}
            >
              {selectedAnswer && !isLoading && (
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover/submit:opacity-100 transition-opacity duration-500 -translate-x-full group-hover/submit:translate-x-full"
                  style={{ transition: "transform 800ms, opacity 300ms" }}
                />
              )}
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin relative" />
                  <span className="relative">Checking...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={14} className="relative" />
                  <span className="relative tracking-wide">Submit Answer</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════

const MessageBubble: React.FC<{
  message: ChatMessage;
  userName: string;
  userProfile: UserProfile;
  onCopy: (text: string) => void;
  onSelectQuizAnswer?: (answer: string) => void;
  onSubmitQuiz?: () => void;
  onIDK?: () => void;
  isSubmittingQuiz?: boolean;
  onRetry?: () => void;
  onNextQuiz?: () => void;
  onChangeTopic?: () => void;
  onExitQuiz?: () => void;
  showQuizActions?: boolean;
  animatedMessageIds: Set<string>;
  markMessageAsAnimated: (messageId: string) => void;
}> = memo(function MessageBubble({
  message,
  userName,
  userProfile,
  onCopy,
  onSelectQuizAnswer,
  onSubmitQuiz,
  onIDK,
  isSubmittingQuiz,
  onRetry,
  onNextQuiz,
  onChangeTopic,
  onExitQuiz,
  showQuizActions,
  animatedMessageIds,
  markMessageAsAnimated,
}) {
  const [copied, setCopied] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isUser = message.role === "user";

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, []);

  // Typewriter effect for AI responses (optimized)
  useEffect(() => {
    if (isUser || !message.text || message.isThinking) return;

    // If this message has already been animated, show it immediately
    if (animatedMessageIds.has(message.id)) {
      setDisplayedText(message.text);
      return;
    }

    // Clear any existing typing animation
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    setIsTyping(true);
    let charIndex = 0;

    // Faster typing speed (4 chars at a time, 8ms interval)
    typingIntervalRef.current = setInterval(() => {
      if (charIndex < message.text.length) {
        setDisplayedText(message.text.substring(0, charIndex + 4));
        charIndex += 4;
      } else {
        setDisplayedText(message.text);
        setIsTyping(false);
        markMessageAsAnimated(message.id); // Mark this message as animated
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
      }
    }, 8);

    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, [
    message.text,
    message.id,
    isUser,
    message.isThinking,
    animatedMessageIds,
    markMessageAsAnimated,
  ]);

  // Thinking state
  if (message.isThinking) {
    return <ThinkingIndicator thinkingText={message.thinkingText} />;
  }

  // Quiz state
  if (message.quizData && onSelectQuizAnswer && onSubmitQuiz && onIDK) {
    return (
      <QuizCard
        quiz={message.quizData}
        selectedAnswer={message.selectedAnswer}
        isSubmitted={message.isAnswerSubmitted || false}
        onSelect={onSelectQuizAnswer}
        onSubmit={onSubmitQuiz}
        onIDK={onIDK}
        isLoading={isSubmittingQuiz || false}
      />
    );
  }

  const handleCopy = () => {
    onCopy(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Detect if this is an error/failure message
  const isErrorMessage =
    message.role === "model" &&
    (message.text.includes("I'm having trouble") ||
      message.text.includes("Something went wrong") ||
      message.text.includes("Please try again"));

  // System messages - centered, muted styling (e.g., simulation cancelled)
  if (message.isSystemMessage) {
    return (
      <div className="flex justify-center py-3">
        <div className="bg-zinc-800/50 text-zinc-200 text-[13px] px-5 py-2.5 rounded-xl border border-zinc-700/40 max-w-[85%] text-center shadow-sm">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <span>{children}</span>,
              strong: ({ children }) => (
                <span className="font-semibold text-zinc-100">{children}</span>
              ),
            }}
          >
            {message.text}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col ${isUser ? "items-end" : "items-start"} group`}
    >
      {/* Bubble with avatar */}
      <div
        className={`flex gap-2.5 max-w-[92%] ${
          isUser ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Avatar */}
        {isUser ? (
          <UserAvatar
            profilePicture={userProfile.profilePicture}
            name={userName}
            size="sm"
          />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/15 to-teal-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <BrainCircuit size={13} className="text-cyan-400" />
          </div>
        )}

        <div
          className={`relative rounded-2xl px-4 py-3 text-[14px] leading-[1.7] ${
            isUser
              ? "bg-gradient-to-br from-zinc-800/80 to-zinc-900/60 text-zinc-50 rounded-tr-sm border border-zinc-700/50"
              : "bg-[#0f1012] text-zinc-200 rounded-tl-sm border border-white/[0.06]"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.text}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => {
                    const text = String(children).trim();
                    // Detect option blocks: **A) option text** followed by CORRECT:/INCORRECT: explanation
                    const optionMatch = text.match(
                      /^\*\*([A-D])\)\s+(.+?)\*\*\s*$/
                    );

                    if (optionMatch) {
                      const optionLetter = optionMatch[1];
                      const optionText = optionMatch[2];
                      const selectedMatch = message.text.match(
                        /\*\*Your Selection:\*\*\s*([A-D])/i
                      );
                      const selected = selectedMatch ? selectedMatch[1] : null;
                      const isSelected = optionLetter === selected;

                      return (
                        <div
                          className={`mb-4 last:mb-0 rounded-lg border-l-4 overflow-hidden transition-all ${
                            isSelected
                              ? "bg-amber-500/10 border-l-amber-500 shadow-md shadow-amber-500/5"
                              : "bg-zinc-900/30 border-l-zinc-700"
                          }`}
                        >
                          <div
                            className={`px-4 py-2.5 flex items-start gap-3 ${
                              isSelected ? "bg-amber-500/5" : ""
                            }`}
                          >
                            <span
                              className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                                isSelected
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                                  : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                              }`}
                            >
                              {optionLetter}
                            </span>
                            <span
                              className={`flex-1 ${
                                isSelected
                                  ? "text-zinc-100 font-medium"
                                  : "text-zinc-300"
                              }`}
                            >
                              {optionText}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    // Check if this line contains CORRECT: or INCORRECT: label
                    const correctnessMatch = text.match(
                      /^(CORRECT|INCORRECT):\s*(.+)$/
                    );
                    if (correctnessMatch) {
                      const isCorrect = correctnessMatch[1] === "CORRECT";
                      const explanation = correctnessMatch[2];

                      return (
                        <div
                          className={`mb-3 last:mb-0 rounded-lg p-3 border-l-4 ${
                            isCorrect
                              ? "bg-emerald-500/10 border-l-emerald-500 text-emerald-200"
                              : "bg-rose-500/10 border-l-rose-500 text-rose-200"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={`shrink-0 text-lg ${
                                isCorrect ? "" : ""
                              }`}
                            >
                              {isCorrect ? "✓" : "✗"}
                            </span>
                            <span className="text-[13px] leading-relaxed">
                              <strong className="font-semibold">
                                {correctnessMatch[1]}:
                              </strong>{" "}
                              {explanation}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <p className="mb-3 last:mb-0 text-zinc-100 leading-relaxed text-[14px]">
                        {children}
                      </p>
                    );
                  },
                  strong: ({ children }) => (
                    <strong className="text-white font-semibold">
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => (
                    <em className="text-zinc-200">{children}</em>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-none space-y-2 my-3 pl-0">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 space-y-2 my-3 marker:text-cyan-500/60 marker:font-medium">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="relative pl-4 text-[14px] text-zinc-100 leading-relaxed before:absolute before:left-0 before:top-2 before:w-1.5 before:h-1.5 before:bg-gradient-to-br before:from-cyan-400 before:to-teal-500 before:rounded-full">
                      {children}
                    </li>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-cyan-500/30 pl-3 my-2.5 italic text-zinc-200 bg-cyan-500/[0.03] py-1.5 rounded-r">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="bg-black/40 text-amber-400/80 px-1.5 py-0.5 rounded text-xs font-mono">
                      {children}
                    </code>
                  ),
                  h2: ({ children }) => {
                    const text = String(children).toLowerCase();
                    const isResult = text.includes("result");
                    const isAnalysis = text.includes("analysis");
                    const isOptions =
                      text.includes("option") || text.includes("matters");
                    const isPrinciple =
                      text.includes("principle") ||
                      text.includes("core") ||
                      text.includes("learning");
                    const isStrategy =
                      text.includes("strategy") ||
                      text.includes("tip") ||
                      text.includes("pearl");

                    // Distinctive color schemes for each section type
                    let config = {
                      gradient:
                        "from-slate-800/80 via-slate-800/60 to-transparent",
                      accent: "bg-cyan-500",
                      badge: "📋",
                      badgeBg: "bg-cyan-500/15",
                      textColor: "text-cyan-200",
                      borderColor: "border-cyan-500/20",
                    };

                    if (isResult) {
                      // Use the message's isCorrectAnswer flag for robust detection
                      const isIncorrect = message.isCorrectAnswer === false;

                      config = isIncorrect
                        ? {
                            gradient:
                              "from-rose-950/60 via-rose-900/30 to-transparent",
                            accent: "bg-rose-400",
                            badge: "✗",
                            badgeBg: "bg-rose-500/20",
                            textColor: "text-rose-200",
                            borderColor: "border-rose-500/30",
                          }
                        : {
                            gradient:
                              "from-emerald-950/60 via-emerald-900/30 to-transparent",
                            accent: "bg-emerald-400",
                            badge: "✓",
                            badgeBg: "bg-emerald-500/20",
                            textColor: "text-emerald-200",
                            borderColor: "border-emerald-500/30",
                          };
                    } else if (isAnalysis) {
                      config = {
                        gradient:
                          "from-sky-950/50 via-sky-900/25 to-transparent",
                        accent: "bg-sky-400",
                        badge: "🔬",
                        badgeBg: "bg-sky-500/15",
                        textColor: "text-sky-200",
                        borderColor: "border-sky-500/25",
                      };
                    } else if (isOptions) {
                      config = {
                        gradient:
                          "from-amber-950/50 via-amber-900/25 to-transparent",
                        accent: "bg-amber-400",
                        badge: "🔍",
                        badgeBg: "bg-amber-500/15",
                        textColor: "text-amber-200",
                        borderColor: "border-amber-500/25",
                      };
                    } else if (isPrinciple) {
                      config = {
                        gradient:
                          "from-violet-950/50 via-violet-900/25 to-transparent",
                        accent: "bg-violet-400",
                        badge: "⚡",
                        badgeBg: "bg-violet-500/15",
                        textColor: "text-violet-200",
                        borderColor: "border-violet-500/25",
                      };
                    } else if (isStrategy) {
                      config = {
                        gradient:
                          "from-rose-950/50 via-rose-900/25 to-transparent",
                        accent: "bg-rose-400",
                        badge: "🎯",
                        badgeBg: "bg-rose-500/15",
                        textColor: "text-rose-200",
                        borderColor: "border-rose-500/25",
                      };
                    }

                    return (
                      <div
                        className={`relative mt-5 mb-3 rounded-xl overflow-hidden border ${config.borderColor}`}
                      >
                        {/* Accent line */}
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent}`}
                        />
                        {/* Content */}
                        <div
                          className={`flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r ${config.gradient}`}
                        >
                          <span
                            className={`flex items-center justify-center w-7 h-7 rounded-lg ${config.badgeBg} text-base`}
                          >
                            {config.badge}
                          </span>
                          <h2
                            className={`font-semibold text-[13px] tracking-wide uppercase ${config.textColor}`}
                          >
                            {children}
                          </h2>
                        </div>
                      </div>
                    );
                  },
                  h3: ({ children }) => (
                    <h3 className="text-white font-semibold text-sm mt-3 mb-1.5 flex items-center gap-2">
                      <div className="w-0.5 h-3.5 bg-gradient-to-b from-cyan-400 to-teal-500 rounded-full" />
                      {children}
                    </h3>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2.5 rounded-lg border border-white/10">
                      <table className="w-full text-xs">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="bg-white/5 px-2.5 py-1.5 text-left text-cyan-400 font-semibold border-b border-white/10">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="px-2.5 py-1.5 border-b border-white/5 text-zinc-100">
                      {children}
                    </td>
                  ),
                }}
              >
                {displayedText || "..."}
              </ReactMarkdown>
              {isTyping && (
                <span className="inline-block w-1 h-3.5 bg-cyan-400/80 ml-0.5 animate-pulse" />
              )}
            </div>
          )}

          {/* Copy */}
          {!isUser && message.text && (
            <button
              onClick={handleCopy}
              className="absolute -bottom-1.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-zinc-800 border border-white/10 rounded hover:bg-zinc-700"
            >
              {copied ? (
                <Check size={10} className="text-emerald-400" />
              ) : (
                <Copy size={10} className="text-zinc-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Action buttons container - appears below the message bubble */}
      {!isUser && message.text && (
        <div className="ml-9 mt-2.5 flex flex-wrap items-center gap-2">
          {/* Retry button for error messages */}
          {isErrorMessage && onRetry && (
            <button
              onClick={onRetry}
              className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:border-rose-400/40 text-rose-400 hover:text-rose-300 text-[11px] font-medium transition-all duration-200 hover:bg-rose-500/15"
            >
              <RotateCcw
                size={12}
                className="transition-transform duration-300 group-hover:rotate-180"
              />
              <span>Try Again</span>
            </button>
          )}

          {/* Quiz continuation buttons - show after quiz explanations */}
          {showQuizActions && !isErrorMessage && (
            <>
              {onNextQuiz && (
                <button
                  onClick={onNextQuiz}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/15 to-teal-500/10 border border-cyan-500/25 hover:border-cyan-400/50 text-cyan-400 hover:text-cyan-300 text-[11px] font-medium transition-all duration-200 hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  <Zap size={12} />
                  <span>Next Question</span>
                </button>
              )}
              {onChangeTopic && (
                <button
                  onClick={onChangeTopic}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 hover:border-amber-400/40 text-amber-400 hover:text-amber-300 text-[11px] font-medium transition-all duration-200"
                >
                  <Target size={12} />
                  <span>Switch Topic</span>
                </button>
              )}
              {onExitQuiz && (
                <button
                  onClick={onExitQuiz}
                  className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/40 hover:border-zinc-600/50 text-zinc-300 hover:text-zinc-300 text-[11px] font-medium transition-all duration-200"
                >
                  <MessageCircle size={12} />
                  <span>Explore More</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════
// MODE SELECTOR - With Tooltips
// ═══════════════════════════════════════════════════════════

const ModeSelector: React.FC<{
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}> = memo(function ModeSelector({ mode, onModeChange }) {
  const [hoveredMode, setHoveredMode] = useState<ChatMode | null>(null);

  const modes = [
    { id: "tutor", icon: MessageCircle, label: "Tutor" },
    { id: "quiz", icon: ClipboardCheck, label: "Quiz" },
    { id: "explain", icon: Lightbulb, label: "Explain" },
    { id: "compare", icon: GitCompare, label: "Compare" },
    { id: "clinical", icon: Stethoscope, label: "Clinical" },
  ] as const;

  return (
    <div className="relative">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {modes.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onModeChange(id)}
            onMouseEnter={() => setHoveredMode(id)}
            onMouseLeave={() => setHoveredMode(null)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-sans font-medium transition-all duration-300 whitespace-nowrap ${
              mode === id
                ? "bg-vital-cyan/10 text-vital-cyan border border-vital-cyan/20 shadow-[0_0_20px_rgba(42,212,212,0.15)]"
                : "text-gray-500 hover:text-serum-white hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]"
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tooltip */}
      {hoveredMode && (
        <div className="absolute top-full left-0 right-0 mt-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="glass-slide border border-white/[0.06] rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-vital-cyan font-sans font-semibold text-xs">
                {MODE_INFO[hoveredMode].title}
              </span>
            </div>
            <p className="text-gray-300 text-[11px] font-sans leading-relaxed mb-2">
              {MODE_INFO[hoveredMode].description}
            </p>
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className="text-gray-300 font-sans">Try:</span>
              <span className="text-gray-200 italic font-sans">
                {MODE_INFO[hoveredMode].example}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// Topic Panel - Response-style component at bottom with sophisticated design
const TopicPanel: React.FC<{
  topics: QuizTopic[];
  selected: string;
  onSelect: (id: string) => void;
}> = memo(function TopicPanel({ topics, selected, onSelect }) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Show 3 topics by default to keep the panel compact and avoid pushing content
  const COLLAPSED_COUNT = 4;
  const displayedTopics = isExpanded
    ? topics
    : topics.slice(0, COLLAPSED_COUNT);
  const hasMore = topics.length > COLLAPSED_COUNT;
  const firstTopicRef = React.useRef<HTMLButtonElement | null>(null);

  // When the panel expands, focus the first topic for keyboard users
  React.useEffect(() => {
    if (isExpanded) {
      firstTopicRef.current?.focus();
    }
  }, [isExpanded]);

  return (
    <div className="flex flex-col items-start group animate-fadeIn">
      {/* AI Avatar */}
      <div className="flex gap-2.5 max-w-[92%]">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500/15 to-teal-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <BrainCircuit size={13} className="text-cyan-400" />
        </div>

        <div className="relative rounded-2xl rounded-tl-sm bg-[#0f1012] border border-white/[0.05] overflow-hidden backdrop-blur-sm">
          {/* Atmospheric gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.03] via-transparent to-teal-500/[0.02] pointer-events-none" />

          {/* Header with elegant typography */}
          <div className="relative px-4 py-3 border-b border-cyan-500/10 bg-gradient-to-r from-cyan-500/[0.04] to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-4 bg-gradient-to-b from-cyan-400 to-teal-500 rounded-full" />
              <span className="text-[11px] font-medium tracking-wide text-cyan-300">
                Choose Your Focus Area
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 ml-[18px] italic">
              Select a topic to begin your personalized quiz journey
            </p>
          </div>

          {/* Topic Grid - Asymmetric layout */}
          <div
            id="topic-list"
            role="list"
            aria-label="Available topics"
            className="relative p-4 space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar"
          >
            {displayedTopics.map((t, idx) => (
              <button
                key={t.id}
                ref={idx === 0 ? firstTopicRef : undefined}
                onClick={() => onSelect(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(t.id);
                  }
                }}
                aria-pressed={selected === t.id}
                role="listitem"
                className={`group/topic w-full text-left px-3.5 py-3 rounded-xl text-xs transition-all duration-300 flex items-center gap-3 relative overflow-hidden ${
                  selected === t.id
                    ? "bg-gradient-to-r from-cyan-500/15 to-teal-500/10 border border-cyan-500/40 shadow-lg shadow-cyan-500/10 scale-[1.02]"
                    : "bg-zinc-900/30 border border-zinc-800/50 hover:border-cyan-500/30 hover:bg-cyan-500/[0.05] hover:translate-x-1"
                }`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                {/* Hover gradient */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/5 to-transparent opacity-0 group-hover/topic:opacity-100 transition-opacity duration-500 -translate-x-full group-hover/topic:translate-x-full"
                  style={{ transition: "transform 800ms, opacity 300ms" }}
                />

                {/* Icon */}
                {t.id === "full-guide" ? (
                  <div className="shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <BookOpen size={12} className="text-cyan-400" />
                  </div>
                ) : (
                  <div
                    className={`shrink-0 w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      selected === t.id
                        ? "bg-cyan-400 shadow-lg shadow-cyan-400/50"
                        : "bg-zinc-600 group-hover/topic:bg-cyan-500/50"
                    }`}
                  />
                )}

                {/* Text with gradient on selection */}
                <span
                  className={`flex-1 leading-relaxed transition-colors duration-300 ${
                    selected === t.id
                      ? "text-cyan-300 font-medium"
                      : "text-zinc-300 group-hover/topic:text-zinc-300"
                  }`}
                >
                  {t.name.replace("📚 ", "")}
                </span>

                {/* Selection indicator */}
                {selected === t.id && (
                  <CheckCircle
                    size={14}
                    className="text-cyan-400 shrink-0 animate-in zoom-in duration-200"
                  />
                )}
              </button>
            ))}

            {/* Expand/Collapse button */}
            {hasMore && (
              <div className="pt-2">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  aria-expanded={isExpanded}
                  aria-controls="topic-list"
                  className="w-full text-center py-2.5 px-3 rounded-xl text-xs transition-all duration-300 flex items-center justify-center gap-2 bg-zinc-900/50 border border-zinc-800/50 hover:border-cyan-500/30 hover:bg-cyan-500/[0.05] text-zinc-300 hover:text-cyan-300"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp size={14} />
                      <span>Show less</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown size={14} />
                      <span>
                        Show {topics.length - COLLAPSED_COUNT} more topics
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="relative px-4 py-2.5 border-t border-white/[0.03] bg-black/20">
            <p className="text-[10px] text-zinc-400 text-center italic">
              Click any topic to generate a challenging question
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════
// QUICK ACTIONS - Context-aware chips
// ═══════════════════════════════════════════════════════════

const QuickActions: React.FC<{
  examGoal: string;
  onSelect: (prompt: string) => void;
}> = memo(function QuickActions({ examGoal, onSelect }) {
  const getActions = useCallback(() => {
    if (examGoal?.includes("USMLE")) {
      return [
        {
          icon: Target,
          label: "Vignette",
          prompt:
            "Generate a USMLE-style clinical vignette with a realistic patient scenario from this topic.",
          color: "cyan",
        },
        {
          icon: FlaskConical,
          label: "Mechanism",
          prompt:
            "Explain the key pathophysiology mechanisms I should know for USMLE from this topic.",
          color: "amber",
        },
        {
          icon: GitCompare,
          label: "Differentials",
          prompt:
            "What are the important differential diagnoses from this topic?",
          color: "emerald",
        },
      ];
    }
    if (examGoal?.includes("NCLEX")) {
      return [
        {
          icon: Target,
          label: "Priority",
          prompt:
            "Create an NCLEX-style priority question: What should the nurse do FIRST?",
          color: "cyan",
        },
        {
          icon: ClipboardCheck,
          label: "SATA",
          prompt:
            "Generate a 'Select all that apply' question from this content.",
          color: "amber",
        },
        {
          icon: Stethoscope,
          label: "Process",
          prompt:
            "Walk me through the nursing process for managing a patient based on this topic.",
          color: "emerald",
        },
      ];
    }
    if (examGoal?.includes("University") || examGoal?.includes("Semester")) {
      return [
        {
          icon: BookOpen,
          label: "Essay Prep",
          prompt:
            "What are the key points I should include if asked to write an essay on this topic?",
          color: "cyan",
        },
        {
          icon: HelpCircle,
          label: "Exam Qs",
          prompt:
            "What questions might a professor ask about this topic? Help me prepare for MCQ and short answer.",
          color: "amber",
        },
        {
          icon: GitCompare,
          label: "Connect",
          prompt:
            "How does this topic connect to other related concepts I should know?",
          color: "emerald",
        },
      ];
    }
    return [
      {
        icon: Sparkles,
        label: "Summarize",
        prompt: "Summarize the key takeaways from this topic concisely.",
        color: "cyan",
      },
      {
        icon: Zap,
        label: "Clinical Pearl",
        prompt: "What's the most important clinical pearl from this topic?",
        color: "amber",
      },
      {
        icon: HelpCircle,
        label: "Explain",
        prompt:
          "Explain the most important concept from this topic in simple terms.",
        color: "emerald",
      },
    ];
  }, [examGoal]);

  const colorClasses: Record<string, string> = useMemo(
    () => ({
      cyan: "hover:border-cyan-500/30 hover:text-cyan-400 hover:bg-cyan-500/5",
      amber:
        "hover:border-amber-500/30 hover:text-amber-400 hover:bg-amber-500/5",
      emerald:
        "hover:border-emerald-500/30 hover:text-emerald-400 hover:bg-emerald-500/5",
    }),
    []
  );

  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {getActions().map(({ icon: Icon, label, prompt, color }) => (
        <button
          key={label}
          onClick={() => onSelect(prompt)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[12px] text-zinc-400 transition-all group ${colorClasses[color]}`}
        >
          <Icon size={12} className="transition-colors" />
          <span className="font-medium">{label}</span>
        </button>
      ))}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════
// MAIN CHAT INTERFACE
// ═══════════════════════════════════════════════════════════

const ChatInterface: React.FC<Props> = ({
  contextMarkdown,
  userProfile,
  graphNodes,
  noteTitle,
  noteId,
  initialSelection,
  onClose,
  onClearSelection,
}) => {
  const effectiveNoteId =
    noteId || noteTitle?.toLowerCase().replace(/\s+/g, "-") || "default";

  // ═══ STATE ═══
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Track if a clinical simulation is currently active
  const [simulationActive, setSimulationActive] = useState(false);
  // If user performed a reset, allow starting a new simulation even if previously active
  const [allowSimulationAfterReset, setAllowSimulationAfterReset] =
    useState(false);
  // Banner text when navigation is blocked due to active simulation
  const [blockedNotice, setBlockedNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<ChatMode>("tutor");
  const [quizTopics, setQuizTopics] = useState<QuizTopic[]>([]);
  const [selectedQuizTopic, setSelectedQuizTopic] = useState("full-guide");
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);
  const [showTopicSelector, setShowTopicSelector] = useState(true); // Show topic selector until quiz starts
  const [selectionKey, setSelectionKey] = useState(0); // Force update when selection changes
  const [isSelectionFading, setIsSelectionFading] = useState(false);
  const [animatedMessageIds, setAnimatedMessageIds] = useState<Set<string>>(
    new Set()
  ); // Track which messages have been animated
  const [lastQuizContext, setLastQuizContext] = useState<{
    messageId: string;
    quizData: QuizQuestion;
    selectedAnswer: string;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ═══ MEMOIZED VALUES ═══
  // Filter out hidden messages once, reuse across renders
  const visibleMessages = useMemo(
    () => messages.filter((m) => !m.hideFromUI),
    [messages]
  );

  // Helper function to mark a message as animated
  const markMessageAsAnimated = useCallback((messageId: string) => {
    setAnimatedMessageIds((prev) => {
      if (prev.has(messageId)) return prev; // Avoid creating new Set if already present
      return new Set([...prev, messageId]);
    });
  }, []);

  // ═══ ROBUST SCROLL HELPER ═══
  // Call this after any action that appends/updates messages to ensure view scrolls to latest
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth", delay: number = 50) => {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior,
          });
        }
      }, delay);
    },
    []
  );

  // ═══ PERSISTENCE (debounced to prevent lag) ═══
  // Track if initial load is done
  const initialLoadDoneRef = useRef(false);

  // Load saved chat from IndexedDB on mount
  useEffect(() => {
    const loadChat = async () => {
      try {
        const savedMessages = await ChatRepository.getForNote(effectiveNoteId);
        if (savedMessages && savedMessages.length > 0) {
          const restoredMessages = savedMessages.filter(
            (m: ChatMessage) => !m.isThinking
          );
          setMessages(restoredMessages);
          // Mode is not stored separately anymore, default to tutor
          setMode("tutor");

          // Mark all restored messages as already animated so they don't re-animate
          // when the component remounts (e.g., switching between Neural Web and Master Guide)
          if (restoredMessages.length > 0) {
            setAnimatedMessageIds(
              new Set(restoredMessages.map((m: ChatMessage) => m.id))
            );
          }
        }
      } catch (e) {
        console.error("Failed to load chat from IndexedDB:", e);
        setMessages([]);
      } finally {
        initialLoadDoneRef.current = true;
      }
    };
    loadChat();
  }, [effectiveNoteId]);

  // Debounced save to IndexedDB (500ms delay to batch rapid updates)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Skip save if initial load hasn't completed
    if (!initialLoadDoneRef.current) return;
    if (messages.length === 0) return;

    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce: wait 500ms after last change before saving
    saveTimeoutRef.current = setTimeout(async () => {
      const messagesToSave = messages.filter((m) => !m.isThinking);
      try {
        await ChatRepository.saveForNote(effectiveNoteId, messagesToSave);
      } catch (e) {
        console.error("Failed to save chat to IndexedDB:", e);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [messages, mode, effectiveNoteId]);

  // ═══ EXTRACT TOPICS (only once when markdown changes) ═══
  useEffect(() => {
    if (contextMarkdown) {
      // Run in next tick to not block render
      const timeoutId = setTimeout(() => {
        setQuizTopics(chatService.extractTopicsFromContent(contextMarkdown));
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [contextMarkdown]);

  // ═══ AUTO-SCROLL (debounced) ═══
  const lastScrollRef = useRef<number>(0);
  useEffect(() => {
    const now = Date.now();
    // Throttle scrolling to max once per 150ms
    if (now - lastScrollRef.current < 150) return;
    lastScrollRef.current = now;
    scrollToBottom("smooth", 100);
  }, [messages.length, isLoading, scrollToBottom]);

  // Watch simulation completion in messages. When the service outputs the explicit
  // "SIMULATION COMPLETE" game-over phrase, clear the simulationActive flag so
  // new simulations can be started normally.
  useEffect(() => {
    const found = messages.some(
      (m) =>
        m.role === "model" && m.text?.includes("✅ **SIMULATION COMPLETE**")
    );
    if (found) {
      setSimulationActive(false);
    }
  }, [messages]);

  // ═══ FOCUS ═══
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ═══ SELECTION CHANGE DETECTION ═══
  useEffect(() => {
    if (initialSelection) {
      setMode("explain");
      setSelectionKey((prev) => prev + 1); // Force re-render when selection changes
    }
  }, [initialSelection]);

  // ═══ CLINICAL CASE TRIGGER (Scalable AI-Driven Simulation Engine) ═══
  const triggerClinicalCase = useCallback(() => {
    // ═══════════════════════════════════════════════════════════════
    // PERSONA FACTORY: Delegate to Service Layer
    // ═══════════════════════════════════════════════════════════════
    const systemPrompt = chatService.buildClinicalSimulationPersona(
      userProfile,
      noteTitle
    );

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: "🏥 Start Clinical Simulation",
      timestamp: Date.now(),
    };

    const thinkingId = crypto.randomUUID();
    const thinkingMsg: ChatMessage = {
      id: thinkingId,
      role: "model",
      text: "",
      timestamp: Date.now(),
      isThinking: true,
      thinkingText: `Analyzing learner profile... Setting difficulty... Creating patient scenario...`,
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setIsLoading(true);
    // Mark that a simulation is active (guard prevents concurrent starts)
    setSimulationActive(true);
    scrollToBottom("smooth", 100);

    chatService
      .streamChatResponse(
        messages,
        systemPrompt,
        contextMarkdown,
        userProfile,
        graphNodes,
        "clinical",
        undefined,
        (thinking) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingId ? { ...m, thinkingText: thinking } : m
            )
          ),
        (chunk) =>
          setMessages((prev) =>
            prev.map((m) => (m.id === thinkingId ? { ...m, text: chunk } : m))
          )
      )
      .then((response) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? { ...m, text: response, isThinking: false }
              : m
          )
        );
      })
      .catch((e) => {
        console.error("Clinical case generation error:", e);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? {
                  ...m,
                  text: "I'm having trouble generating a clinical case. Please try again.",
                  isThinking: false,
                }
              : m
          )
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [
    messages,
    contextMarkdown,
    userProfile,
    graphNodes,
    noteTitle,
    scrollToBottom,
  ]);

  // ═══ CLINICAL CASE EVALUATION (Tight, High-Density, No Fluff) ═══
  const handleFinishEvaluation = useCallback(async () => {
    if (isLoading) return;

    // ═══════════════════════════════════════════════════════════════
    // PERSONA FACTORY: Delegate to Service Layer
    // ═══════════════════════════════════════════════════════════════
    const evalPrompt = chatService.buildClinicalEvaluationPersona(userProfile);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: "📝 Finish case and evaluate my performance.",
      timestamp: Date.now(),
    };

    const thinkingId = crypto.randomUUID();
    const thinkingMsg: ChatMessage = {
      id: thinkingId,
      role: "model",
      text: "",
      timestamp: Date.now(),
      isThinking: true,
      thinkingText:
        "Analyzing decisions... Calculating score... Identifying gaps...",
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setIsLoading(true);
    scrollToBottom("smooth", 100);

    try {
      const response = await chatService.streamChatResponse(
        messages,
        evalPrompt, // This is the evaluation persona
        contextMarkdown,
        userProfile,
        graphNodes,
        "clinical",
        undefined,
        (thinking) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingId ? { ...m, thinkingText: thinking } : m
            )
          ),
        (chunk) =>
          setMessages((prev) =>
            prev.map((m) => (m.id === thinkingId ? { ...m, text: chunk } : m))
          ),
        evalPrompt // Pass as custom system instruction override
      );

      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId ? { ...m, text: response, isThinking: false } : m
        )
      );

      setMode("tutor");
    } catch (e) {
      console.error("Clinical evaluation error:", e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? {
                ...m,
                text: "I'm having trouble evaluating the case. Please try again.",
                isThinking: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    messages,
    contextMarkdown,
    userProfile,
    graphNodes,
    noteTitle,
    scrollToBottom,
  ]);

  // ═══ MODE CHANGE HANDLER (Active Context Triggering) ═══
  const handleModeChange = useCallback(
    (newMode: ChatMode) => {
      // If a clinical simulation is active, block navigation to any other mode
      if (simulationActive && !allowSimulationAfterReset) {
        // If trying to switch to clinical while already in clinical, do nothing
        if (newMode === "clinical") {
          setMode("clinical");
          return;
        }

        // Block switching to other modes while simulation is running
        setBlockedNotice(
          "A clinical simulation is currently running. Finish, Cancel, or Reset to change modes."
        );
        // Auto-hide after 3s
        setTimeout(() => setBlockedNotice(null), 3000);
        return;
      }

      // If user explicitly allowed a simulation after reset, consume the flag
      if (allowSimulationAfterReset) setAllowSimulationAfterReset(false);

      // Get human-readable mode names for context
      const getModeLabel = (m: ChatMode): string => {
        const labels: Record<ChatMode, string> = {
          tutor: "Tutor",
          quiz: "Quiz",
          explain: "Explain",
          compare: "Compare",
          clinical: "Clinical Simulation",
        };
        return labels[m] || m;
      };

      const previousMode = mode;
      const previousModeLabel = getModeLabel(previousMode);
      const newModeLabel = getModeLabel(newMode);

      // Add system message for mode transition (so AI understands context change)
      // Don't add for clinical mode - it has its own case presentation flow
      if (newMode !== "clinical" && previousMode !== newMode) {
        const modeTransitionMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user", // AI sees this in history for context
          text: `🔄 **Mode Changed:** ${previousModeLabel} → **${newModeLabel}**`,
          timestamp: Date.now(),
          isSystemMessage: true, // Special UI styling (centered, muted)
        };
        setMessages((prev) => [...prev, modeTransitionMsg]);
      }

      // Normal mode switching
      setMode(newMode);

      if (newMode === "quiz") {
        setShowTopicSelector(true);
        scrollToBottom("smooth", 150);
      } else if (newMode === "clinical") {
        // Start simulation when switching to clinical
        triggerClinicalCase();
      }
    },
    [
      mode,
      triggerClinicalCase,
      scrollToBottom,
      simulationActive,
      allowSimulationAfterReset,
    ]
  );

  // ═══ SEND MESSAGE ═══
  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    // Build the full message with selection context if present
    let fullMessage = input;
    if (initialSelection) {
      fullMessage = `Regarding this text: "${initialSelection}"\n\n${input}`;
    }
    // Keep the selection pill visible for reference; do not auto-clear selection here

    // Detect if user is asking to retry/explain the last quiz answer
    const isTryAgainRequest =
      /try again|explain.*answer|why.*wrong|what.*correct/i.test(input.trim());

    if (isTryAgainRequest && lastQuizContext) {
      // User wants explanation for their quiz answer, not a new quiz
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: input,
        timestamp: Date.now(),
      };
      const thinkingId = crypto.randomUUID();
      const thinkingMsg: ChatMessage = {
        id: thinkingId,
        role: "model",
        text: "",
        timestamp: Date.now(),
        isThinking: true,
        thinkingText: "",
      };

      setMessages((prev) => [...prev, userMsg, thinkingMsg]);
      setInput("");
      // Reset textarea height to default
      if (inputRef.current) {
        inputRef.current.style.height = "52px";
      }
      setIsLoading(true);

      // Scroll to show the new user message and thinking indicator
      scrollToBottom("smooth", 100);

      try {
        const result = await chatService.submitQuizAnswer(
          lastQuizContext.quizData,
          lastQuizContext.selectedAnswer,
          contextMarkdown,
          userProfile,
          (thinking) =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === thinkingId ? { ...m, thinkingText: thinking } : m
              )
            ),
          (chunk) =>
            setMessages((prev) =>
              prev.map((m) => (m.id === thinkingId ? { ...m, text: chunk } : m))
            )
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? {
                  ...m,
                  text: result.text,
                  isThinking: false,
                  isCorrectAnswer: result.isCorrect,
                }
              : m
          )
        );
      } catch (e) {
        console.error(e);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? {
                  ...m,
                  text: "Something went wrong. Please try again.",
                  isThinking: false,
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        if (initialSelection) {
          setIsSelectionFading(true);
          setTimeout(() => {
            onClearSelection?.();
            setIsSelectionFading(false);
          }, 220);
        }
      }
      return;
    }

    // Detect if user is asking for a quiz even when not in quiz mode
    const isQuizRequest = /quiz|test me|question|mcq|assess/i.test(
      input.trim()
    );
    const effectiveMode = isQuizRequest ? "quiz" : mode;

    // Show the full message (including selected context) in the user's chat bubble
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: fullMessage,
      timestamp: Date.now(),
    };
    const thinkingId = crypto.randomUUID();
    const thinkingMsg: ChatMessage = {
      id: thinkingId,
      role: "model",
      text: "",
      timestamp: Date.now(),
      isThinking: true,
      thinkingText: "",
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setInput("");
    // Reset textarea height to default
    if (inputRef.current) {
      inputRef.current.style.height = "52px";
    }
    setIsLoading(true);
    setShowTopicSelector(false); // Hide topic selector once chat starts

    // Scroll to show the new user message and thinking indicator
    scrollToBottom("smooth", 100);

    try {
      const response = await chatService.streamChatResponse(
        messages,
        fullMessage,
        contextMarkdown,
        userProfile,
        graphNodes,
        effectiveMode,
        selectedQuizTopic === "full-guide" ? undefined : selectedQuizTopic,
        (thinking) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingId ? { ...m, thinkingText: thinking } : m
            )
          ),
        (chunk) =>
          setMessages((prev) =>
            prev.map((m) => (m.id === thinkingId ? { ...m, text: chunk } : m))
          )
      );

      // Try to parse quiz from response (works in quiz mode or when quiz is detected)
      const quizData =
        effectiveMode === "quiz" || isQuizRequest
          ? chatService.parseQuizFromResponse(response)
          : null;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? {
                ...m,
                text: response,
                isThinking: false,
                quizData: quizData || undefined,
              }
            : m
        )
      );
    } catch (e) {
      console.error(e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? {
                ...m,
                text: "Something went wrong. Please try again.",
                isThinking: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      // Fade out the selection pill after response completes
      if (initialSelection) {
        setIsSelectionFading(true);
        setTimeout(() => {
          onClearSelection?.();
          setIsSelectionFading(false);
        }, 220);
      }
    }
  }, [
    input,
    isLoading,
    messages,
    contextMarkdown,
    userProfile,
    graphNodes,
    mode,
    selectedQuizTopic,
    onClearSelection,
    scrollToBottom,
    initialSelection,
    lastQuizContext,
  ]);

  // ═══ QUIZ HANDLERS ═══
  const handleQuizSelect = (messageId: string, answer: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, selectedAnswer: answer } : m
      )
    );
  };

  const handleQuizSubmit = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.quizData || !msg.selectedAnswer) return;

    // Save quiz context for potential retry
    setLastQuizContext({
      messageId,
      quizData: msg.quizData,
      selectedAnswer: msg.selectedAnswer,
    });

    setIsSubmittingQuiz(true);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, isAnswerSubmitted: true } : m
      )
    );

    // Create a thinking message that will be updated as the stream arrives
    const thinkingId = crypto.randomUUID();
    const thinkingMsg: ChatMessage = {
      id: thinkingId,
      role: "model",
      text: "",
      timestamp: Date.now(),
      isThinking: true,
      thinkingText: "",
    };

    setMessages((prev) => [...prev, thinkingMsg]);

    // Scroll to show the thinking indicator
    scrollToBottom("smooth", 100);

    try {
      const result = await chatService.submitQuizAnswer(
        msg.quizData,
        msg.selectedAnswer,
        contextMarkdown,
        userProfile,
        // onThinking
        (thinking) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingId ? { ...m, thinkingText: thinking } : m
            )
          ),
        // onChunk
        (chunk) =>
          setMessages((prev) =>
            prev.map((m) => (m.id === thinkingId ? { ...m, text: chunk } : m))
          )
      );

      // Finalize the thinking message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? {
                ...m,
                text: result.text,
                isThinking: false,
                isCorrectAnswer: result.isCorrect,
              }
            : m
        )
      );
    } catch (e) {
      console.error(e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? {
                ...m,
                text: "Something went wrong. Please try again.",
                isThinking: false,
              }
            : m
        )
      );
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  const handleQuizIDK = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg?.quizData) return;

    setIsSubmittingQuiz(true);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, isAnswerSubmitted: true, selectedAnswer: "IDK" }
          : m
      )
    );

    // Create thinking message for streaming IDK response
    const thinkingId = crypto.randomUUID();
    const thinkingMsg: ChatMessage = {
      id: thinkingId,
      role: "model",
      text: "",
      timestamp: Date.now(),
      isThinking: true,
      thinkingText: "",
    };

    setMessages((prev) => [...prev, thinkingMsg]);

    // Scroll to show the thinking indicator
    scrollToBottom("smooth", 100);

    try {
      const finalText = await chatService.handleIDKResponse(
        msg.quizData,
        contextMarkdown,
        userProfile,
        // onThinking
        (thinking) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingId ? { ...m, thinkingText: thinking } : m
            )
          ),
        // onChunk
        (chunk) =>
          setMessages((prev) =>
            prev.map((m) => (m.id === thinkingId ? { ...m, text: chunk } : m))
          )
      );

      // Finalize the thinking message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId ? { ...m, text: finalText, isThinking: false } : m
        )
      );
    } catch (e) {
      console.error(e);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === thinkingId
            ? {
                ...m,
                text: "Something went wrong. Please try again.",
                isThinking: false,
              }
            : m
        )
      );
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  // ═══ RESET ═══
  const handleReset = async () => {
    setMessages([]);
    try {
      await ChatRepository.deleteForNote(effectiveNoteId);
    } catch (e) {
      console.error("Failed to delete chat from IndexedDB:", e);
    }
    setMode("tutor");
    setLastQuizContext(null);
    // Reset simulation state and allow starting a new one after reset
    setSimulationActive(false);
    setAllowSimulationAfterReset(true);
    // Clear any blocked navigation notice when resetting
    setBlockedNotice(null);
  };

  // ═══ CANCEL ACTIVE SIMULATION ═══
  const handleCancelSimulation = useCallback(() => {
    // Stop simulation and return to tutor mode
    setSimulationActive(false);
    setAllowSimulationAfterReset(true);
    setMode("tutor");
    setBlockedNotice(null);

    // 1) Add an AI-only system instruction so the model is explicitly told the sim ended
    const aiSystemNotice: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user", // keep as user so it appears in model history
      text: "[SYSTEM: Clinical simulation was cancelled by the user. The simulation has ended. Do not continue or reference the clinical case unless the user explicitly asks about it. You are now in Tutor mode for subsequent interactions. Respond to new questions normally.]",
      timestamp: Date.now(),
      hideFromUI: true, // do not render this message in the chat UI
    };

    // 2) Add a friendly user-visible notice for the UI
    const uiCancelNotice: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: "🔄 Simulation cancelled — you're back in Tutor mode. You can start chatting or start a new simulation when you're ready.",
      timestamp: Date.now(),
      isSystemMessage: true,
    };

    setMessages((prev) => [...prev, aiSystemNotice, uiCancelNotice]);
  }, []);

  // ═══ HANDLE SIMULATION COMPLETION (AI finished case) ═══
  // When AI sends SIMULATION COMPLETE, we also want to notify if needed
  // This is already handled by the effect watching for "SIMULATION COMPLETE" phrase

  // ═══ RETRY HANDLER ═══
  const handleRetry = () => {
    if (lastQuizContext) {
      // Quiz retry: Remove failed message and re-submit with same answer
      setMessages((prev) => prev.slice(0, -1));
      handleQuizSubmit(lastQuizContext.messageId);
    } else {
      // General chat retry: Preserve full context and regenerate
      const lastUserMessage = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMessage) {
        // Store the conversation history (all messages before the failed response)
        const conversationHistory = [...messages];
        const failedResponseIndex = conversationHistory.findIndex(
          (m) =>
            m.role === "model" &&
            (m.text.includes("I'm having trouble") ||
              m.text.includes("Something went wrong") ||
              m.text.includes("Please try again"))
        );

        // Remove only the failed AI response, keep all context
        setMessages((prev) => prev.slice(0, -1));

        // Re-trigger with full context preserved
        setInput(lastUserMessage.text);

        // Auto-submit after state update
        setTimeout(() => {
          const sendBtn = document.querySelector(
            "[data-send-button]"
          ) as HTMLButtonElement;
          if (sendBtn) sendBtn.click();
        }, 100);
      }
    }
  };

  // ═══ QUIZ ACTION HANDLERS ═══

  // Generate next quiz question in current topic
  const handleNextQuiz = useCallback(() => {
    const topicName =
      selectedQuizTopic === "full-guide"
        ? "the full guide content"
        : quizTopics.find((t) => t.id === selectedQuizTopic)?.name ||
          "general concepts";

    const prompt =
      selectedQuizTopic === "full-guide"
        ? "Generate another challenging MCQ question from any topic in the guide. Make it different from previous questions."
        : `Generate another challenging MCQ question about ${topicName}. Make it different from previous questions.`;

    // Switch to quiz mode if not already
    if (mode !== "quiz") {
      setMode("quiz");
    }

    // Build and send
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: prompt,
      timestamp: Date.now(),
    };
    const thinkingId = crypto.randomUUID();
    const thinkingMsg: ChatMessage = {
      id: thinkingId,
      role: "model",
      text: "",
      timestamp: Date.now(),
      isThinking: true,
      thinkingText: "",
    };

    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    setIsLoading(true);
    setShowTopicSelector(false);

    // Scroll to show the new user message and thinking indicator
    scrollToBottom("smooth", 100);

    chatService
      .streamChatResponse(
        messages,
        prompt,
        contextMarkdown,
        userProfile,
        graphNodes,
        "quiz",
        selectedQuizTopic === "full-guide" ? undefined : selectedQuizTopic,
        (thinking) =>
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingId ? { ...m, thinkingText: thinking } : m
            )
          ),
        (chunk) => {
          const quiz = chatService.parseQuizFromResponse(chunk);
          if (quiz) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === thinkingId
                  ? { ...m, text: "", isThinking: false, quizData: quiz }
                  : m
              )
            );
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.id === thinkingId ? { ...m, text: chunk } : m))
            );
          }
        }
      )
      .then((fullText) => {
        const quiz = chatService.parseQuizFromResponse(fullText);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? quiz
                ? { ...m, text: "", isThinking: false, quizData: quiz }
                : { ...m, text: fullText, isThinking: false }
              : m
          )
        );
      })
      .catch((error) => {
        console.error("Next quiz error:", error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === thinkingId
              ? {
                  ...m,
                  text: "Let me try generating another question...",
                  isThinking: false,
                }
              : m
          )
        );
      })
      .finally(() => setIsLoading(false));
  }, [
    messages,
    contextMarkdown,
    userProfile,
    graphNodes,
    mode,
    selectedQuizTopic,
    quizTopics,
    scrollToBottom,
  ]);

  // Show topic selector to change quiz topic
  const handleChangeTopic = useCallback(() => {
    setMode("quiz");
    setShowTopicSelector(true);
    // Scroll to bottom where topic panel will appear
    scrollToBottom("smooth", 150);
  }, [scrollToBottom]);

  // Exit quiz mode and switch to another mode
  const handleExitQuiz = useCallback(() => {
    setMode("tutor"); // Switch to tutor as default
    setShowTopicSelector(false);
  }, []);

  // Determine if we should show quiz actions for a message
  const shouldShowQuizActions = useCallback(
    (msg: ChatMessage, index: number): boolean => {
      // Only show on model text responses (not quiz cards, not thinking, not errors)
      if (msg.role !== "model" || msg.isThinking || msg.quizData) return false;
      if (!msg.text || msg.text.length < 50) return false;

      // Don't show on error messages
      if (
        msg.text.includes("I'm having trouble") ||
        msg.text.includes("Please try again")
      )
        return false;

      // Check if there's a submitted quiz earlier in the conversation
      const previousMessages = messages.slice(0, index);
      const hasSubmittedQuiz = previousMessages.some(
        (m) => m.quizData && m.isAnswerSubmitted
      );

      if (!hasSubmittedQuiz) return false;

      // Show actions on the most recent model response that's after a quiz
      // Find the last submitted quiz
      const lastSubmittedQuizIndex = [...previousMessages]
        .reverse()
        .findIndex((m) => m.quizData && m.isAnswerSubmitted);
      if (lastSubmittedQuizIndex === -1) return false;

      const actualQuizIndex =
        previousMessages.length - 1 - lastSubmittedQuizIndex;

      // This message should be the first model response after that quiz
      const messagesAfterQuiz = messages.slice(actualQuizIndex + 1);
      const firstModelResponse = messagesAfterQuiz.find(
        (m) => m.role === "model" && !m.quizData && !m.isThinking
      );

      return firstModelResponse?.id === msg.id;
    },
    [messages]
  );

  // ═══ AUTO-QUIZ GENERATION ═══
  const triggerQuizGeneration = useCallback(
    (topicId: string) => {
      const topicName =
        quizTopics.find((t) => t.id === topicId)?.name || "this topic";
      const quizPrompt =
        topicId === "full-guide"
          ? "Generate a challenging MCQ quiz question from the full guide content."
          : `Generate a challenging MCQ quiz question about ${topicName}.`;

      // Build and send the quiz request directly
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: quizPrompt,
        timestamp: Date.now(),
      };
      const thinkingId = crypto.randomUUID();
      const thinkingMsg: ChatMessage = {
        id: thinkingId,
        role: "model",
        text: "",
        timestamp: Date.now(),
        isThinking: true,
        thinkingText: "",
      };

      setMessages((prev) => [...prev, userMsg, thinkingMsg]);
      setIsLoading(true);

      // Scroll to show the new user message and thinking indicator
      scrollToBottom("smooth", 100);

      chatService
        .streamChatResponse(
          messages,
          quizPrompt,
          contextMarkdown,
          userProfile,
          graphNodes,
          "quiz",
          topicId === "full-guide" ? undefined : topicId,
          (thinking) =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === thinkingId ? { ...m, thinkingText: thinking } : m
              )
            ),
          (chunk) =>
            setMessages((prev) =>
              prev.map((m) => (m.id === thinkingId ? { ...m, text: chunk } : m))
            )
        )
        .then((response) => {
          const quizData = chatService.parseQuizFromResponse(response);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingId
                ? {
                    ...m,
                    text: response,
                    isThinking: false,
                    quizData: quizData || undefined,
                  }
                : m
            )
          );
        })
        .catch((e) => {
          console.error(e);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === thinkingId
                ? {
                    ...m,
                    text: "Something went wrong. Please try again.",
                    isThinking: false,
                  }
                : m
            )
          );
        })
        .finally(() => {
          setIsLoading(false);
        });
    },
    [
      messages,
      contextMarkdown,
      userProfile,
      graphNodes,
      quizTopics,
      scrollToBottom,
    ]
  );

  // ═══ KEYBOARD ═══
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ═══ COPY ═══
  const handleCopy = (text: string) => navigator.clipboard.writeText(text);

  // ═══ PLACEHOLDER ═══
  const getPlaceholder = () => {
    if (initialSelection) {
      return "Ask about the selected text...";
    }
    const base = noteTitle?.slice(0, 30) || "your notes";
    switch (mode) {
      case "quiz":
        return "Type 'quiz me' or ask for questions...";
      case "explain":
        return "Paste a concept to explain...";
      case "compare":
        return "Compare two concepts or conditions...";
      case "clinical":
        // Dynamic action-oriented placeholder for clinical simulation
        return messages.length > 1
          ? "What's your next step? (e.g., 'Order CBC', 'Start IV fluids', 'Check for JVD')"
          : "Click Clinical mode to start a simulation...";
      default:
        return `Ask anything about ${base}...`;
    }
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-full bg-[#030406] relative overflow-hidden">
      {/* Atmospheric Ambient Layers */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-vital-cyan/[0.015] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-neural-purple/[0.02] rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-vital-cyan/[0.01] rounded-full blur-[200px] pointer-events-none" />

      {/* ═══ HEADER ═══ */}
      <div className="h-14 border-b border-white/[0.04] flex items-center justify-between px-5 glass-slide z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-2.5 h-2.5 rounded-full bg-vital-cyan shadow-[0_0_15px_rgba(42,212,212,0.6)]" />
            <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-vital-cyan animate-ping opacity-20" />
          </div>
          <div>
            <span className="text-xs font-serif font-medium tracking-wide text-serum-white">
              Synapse <span className="text-vital-cyan">AI</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="p-2 hover:bg-white/[0.04] rounded-xl text-gray-500 hover:text-serum-white transition-all duration-300"
            title="Reset"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/[0.04] rounded-xl text-gray-500 hover:text-serum-white transition-all duration-300"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ═══ MODE BAR ═══ */}
      <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-2 bg-bio-deep/30">
        <ModeSelector mode={mode} onModeChange={handleModeChange} />
      </div>

      {/* ═══ MESSAGES ═══ */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-5 space-y-4 custom-scrollbar"
      >
        {/* Topic Panel for Quiz Mode - ALWAYS shows at bottom when in quiz mode */}
        {mode === "quiz" &&
        showTopicSelector &&
        quizTopics &&
        quizTopics.length > 0 ? (
          <div className="flex flex-col h-full">
            {/* Show welcome or messages first */}
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-fadeIn mb-4">
                <div className="relative mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-teal-500/10 border border-cyan-500/15 flex items-center justify-center shadow-xl shadow-cyan-500/5">
                    <ClipboardCheck size={28} className="text-cyan-400" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#08090a] flex items-center justify-center">
                    <Sparkles size={10} className="text-white" />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-white mb-1">
                  Quiz Mode Active 🎯
                </h3>
                <p className="text-sm text-zinc-400 max-w-[280px] leading-relaxed mb-2">
                  Select a topic below to start testing your knowledge
                </p>
              </div>
            ) : (
              <div className="space-y-4 mb-4">
                {visibleMessages.map((m, idx) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    userName={userProfile.name}
                    userProfile={userProfile}
                    onCopy={handleCopy}
                    onSelectQuizAnswer={(a) => handleQuizSelect(m.id, a)}
                    onSubmitQuiz={() => handleQuizSubmit(m.id)}
                    onIDK={() => handleQuizIDK(m.id)}
                    isSubmittingQuiz={isSubmittingQuiz}
                    onRetry={handleRetry}
                    onNextQuiz={handleNextQuiz}
                    onChangeTopic={handleChangeTopic}
                    onExitQuiz={handleExitQuiz}
                    showQuizActions={shouldShowQuizActions(m, idx)}
                    animatedMessageIds={animatedMessageIds}
                    markMessageAsAnimated={markMessageAsAnimated}
                  />
                ))}
              </div>
            )}

            {/* Topic Panel appears at bottom */}
            <TopicPanel
              topics={quizTopics}
              selected={selectedQuizTopic}
              onSelect={(id) => {
                setSelectedQuizTopic(id);
                setShowTopicSelector(false);
                triggerQuizGeneration(id);
              }}
            />
          </div>
        ) : mode === "quiz" &&
          showTopicSelector &&
          (!quizTopics || quizTopics.length === 0) ? (
          <div className="flex flex-col h-full">
            {/* Loading state while extracting topics */}
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-fadeIn">
              <div className="relative mb-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-teal-500/10 border border-cyan-500/15 flex items-center justify-center shadow-xl shadow-cyan-500/5">
                  <ClipboardCheck size={28} className="text-cyan-400" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-cyan-400" />
                <span className="text-sm text-zinc-300">
                  Extracting quiz topics...
                </span>
              </div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 animate-fadeIn">
            <div className="relative mb-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-teal-500/10 border border-cyan-500/15 flex items-center justify-center shadow-xl shadow-cyan-500/5">
                <BrainCircuit size={28} className="text-cyan-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-[#08090a] flex items-center justify-center">
                <Sparkles size={10} className="text-white" />
              </div>
            </div>

            <h3 className="text-lg font-medium text-white mb-1">
              Hey {userProfile.name} 👋
            </h3>
            <p className="text-sm text-zinc-400 max-w-[280px] leading-relaxed mb-2">
              I've analyzed{" "}
              <span className="text-cyan-400 font-medium">{noteTitle}</span>.
            </p>
            {userProfile.examGoal &&
              userProfile.examGoal !== "General Knowledge" && (
                <p className="text-xs text-zinc-400 mb-5">
                  Tailored for{" "}
                  <span className="text-amber-400/80 font-medium">
                    {userProfile.examGoal}
                  </span>
                </p>
              )}

            <QuickActions
              examGoal={userProfile.examGoal || ""}
              onSelect={(p) => {
                setInput(p);
                inputRef.current?.focus();
              }}
            />

            {/* Hint */}
            <div className="mt-6 flex items-center gap-2 text-[11px] text-zinc-400">
              <Info size={11} className="text-zinc-400" />
              <span>Hover over modes above to learn what they do</span>
            </div>
          </div>
        ) : (
          <>
            {visibleMessages.map((m, idx) => (
              <MessageBubble
                key={m.id}
                message={m}
                userName={userProfile.name}
                userProfile={userProfile}
                onCopy={handleCopy}
                onSelectQuizAnswer={(a) => handleQuizSelect(m.id, a)}
                onSubmitQuiz={() => handleQuizSubmit(m.id)}
                onIDK={() => handleQuizIDK(m.id)}
                isSubmittingQuiz={isSubmittingQuiz}
                onRetry={handleRetry}
                onNextQuiz={handleNextQuiz}
                onChangeTopic={handleChangeTopic}
                onExitQuiz={handleExitQuiz}
                showQuizActions={shouldShowQuizActions(m, idx)}
                animatedMessageIds={animatedMessageIds}
                markMessageAsAnimated={markMessageAsAnimated}
              />
            ))}
          </>
        )}
      </div>

      {/* ═══ CONTEXT PILL - Full scrollable selection ═══ */}
      {(initialSelection || isSelectionFading) && (
        <div
          key={selectionKey}
          className={`px-4 pb-2 transition-all duration-200 ${
            isSelectionFading
              ? "opacity-0 translate-y-2"
              : "opacity-100 translate-y-0"
          }`}
        >
          <div className="bg-gradient-to-r from-cyan-950/40 to-teal-950/30 border border-cyan-500/20 rounded-xl overflow-hidden backdrop-blur-sm">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/10">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Quote size={9} className="text-cyan-400" />
                </div>
                <span className="text-[10px] uppercase tracking-wider text-cyan-500/70 font-semibold">
                  Selected Text
                </span>
                {initialSelection && (
                  <span className="text-[11px] text-zinc-400">
                    ({initialSelection.length} chars)
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  // smooth fade then clear
                  setIsSelectionFading(true);
                  setTimeout(() => {
                    onClearSelection?.();
                    setIsSelectionFading(false);
                  }, 220);
                }}
                className="text-zinc-300 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X size={12} />
              </button>
            </div>
            {/* Full text content - always visible, scrollable */}
            <div className="px-3 py-2.5">
              <p className="text-[12px] text-cyan-100/90 leading-relaxed max-h-[140px] overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                {initialSelection}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CLINICAL MODE: FINISH & EVALUATE BUTTON ═══ */}
      {mode === "clinical" && !isLoading && messages.length > 2 && (
        <div className="px-4 pb-2 flex justify-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <button
            onClick={handleFinishEvaluation}
            className="group flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-500/10 via-orange-500/10 to-amber-500/10 border border-rose-500/30 hover:border-rose-400/50 text-rose-400 hover:text-rose-300 transition-all duration-300 text-xs font-bold uppercase tracking-wider shadow-lg shadow-rose-900/20 hover:shadow-rose-900/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <ClipboardCheck
              size={14}
              className="transition-transform group-hover:scale-110"
            />
            <span>Finish & Evaluate Case</span>
            <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
          </button>

          <button
            onClick={handleCancelSimulation}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-200 hover:bg-zinc-900/80 hover:text-white transition-colors duration-200 text-xs font-medium"
            title="Cancel simulation and return to Tutor"
          >
            <X size={14} />
            <span>Cancel</span>
          </button>
        </div>
      )}

      {/* ═══ QUICK ACTIONS (contextual) - Hide during clinical mode ═══ */}
      {mode !== "clinical" &&
        messages.length > 0 &&
        messages.length < 5 &&
        !input && (
          <div className="px-4 pb-2">
            <QuickActions
              examGoal={userProfile.examGoal || ""}
              onSelect={(p) => {
                setInput(p);
                inputRef.current?.focus();
              }}
            />
          </div>
        )}

      {/* ═══ INPUT ═══ */}
      {/* Blocked navigation notice (shown above input when sim blocks mode change) */}
      {blockedNotice && (
        <div className="px-4">
          <div className="mx-auto max-w-3xl w-full">
            <div className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-900/7 border border-amber-700/10 text-amber-200 text-sm rounded-2xl shadow-sm">
              <div className="flex items-center gap-3">
                <Info size={16} className="text-amber-300" />
                <div className="text-[13px] leading-snug">{blockedNotice}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBlockedNotice(null)}
                  className="p-1 rounded hover:bg-white/5"
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 pb-5 pt-3 bg-gradient-to-t from-bio-void via-bio-void/95 to-transparent relative z-10">
        <div className="relative glass-slide border border-white/[0.06] rounded-2xl overflow-hidden focus-within:border-vital-cyan/30 focus-within:shadow-[0_0_30px_rgba(42,212,212,0.1)] transition-all duration-300">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              const newValue = e.target.value;
              setInput(newValue);
              // Auto-resize: reset to default if empty, otherwise expand
              const target = e.target;
              if (!newValue.trim()) {
                target.style.height = "56px";
              } else {
                target.style.height = "56px";
                target.style.height = `${Math.min(target.scrollHeight, 160)}px`;
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            rows={1}
            className="w-full bg-transparent px-5 py-4 pr-16 text-[15px] font-sans text-serum-white placeholder:text-zinc-400 focus:outline-none resize-none custom-scrollbar leading-relaxed"
            style={{ minHeight: "56px", maxHeight: "160px" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            data-send-button
            className="absolute right-3 bottom-3 p-3 bg-vital-cyan text-bio-void rounded-xl hover:bg-vital-cyan/90 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_20px_rgba(42,212,212,0.3)] disabled:shadow-none"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>

        <p className="text-[11px] text-zinc-400 text-center mt-3 tracking-wide font-sans">
          <span className="text-zinc-400">Enter</span> to send ·{" "}
          <span className="text-zinc-400">Shift+Enter</span> for new line
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;
