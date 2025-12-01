import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  UploadCloud,
  Zap,
  BookOpen,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Microscope,
  Sparkles,
  LayoutGrid,
  Search,
  FileText,
  FileImage,
  X,
  File,
  Trash2,
  ArrowRight,
  Library,
  Layers,
  GraduationCap,
  Cake,
  Link as LinkIcon,
  ExternalLink,
  FileAudio,
  Headphones,
  Download,
  CreditCard,
  Plus,
  ChevronRight,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  Maximize2,
  Minimize2,
  Settings,
  User,
} from "lucide-react";
import KnowledgeGraph from "./components/KnowledgeGraph";
import PodcastPlayer from "./components/PodcastPlayer";
import ThinkingModal from "./components/ThinkingModal";
import NodeInspector from "./components/NodeInspector";
import { GeminiService } from "./services/geminiService";
import {
  ProcessingStatus,
  AugmentedNote,
  FileInput,
  KnowledgeNode,
  UserProfile,
} from "./types";
import Onboarding from "./components/Onboarding";
import { ProfileEditor } from "./components/ProfileEditor";

// Initialize Gemini service for API interactions
const gemini = new GeminiService();

const App: React.FC = () => {
  // ===============================
  // APPLICATION STATE MANAGEMENT
  // ===============================
  // Core app state: tracks processing status, user library, and active views
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [library, setLibrary] = useState<AugmentedNote[]>([]); // User's generated notes stored in localStorage
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null); // Currently viewed note
  const [activeNav, setActiveNav] = useState<"dashboard" | "library" | "stats">(
    "dashboard"
  ); // Top-level navigation

  // ===============================
  // DASHBOARD STATE (File Upload & Topic Input)
  // ===============================
  const [stagingFiles, setStagingFiles] = useState<FileInput[]>([]); // Files queued for processing
  const [topicName, setTopicName] = useState(""); // User-defined topic for the session

  // ===============================
  // WORKSPACE STATE (Note Viewing & Interaction)
  // ===============================
  const [activeTab, setActiveTab] = useState<"guide" | "graph">("guide"); // Tab in study workspace (guide or graph)
  const [showEli5, setShowEli5] = useState(false); // Toggle for ELI5 analogy display
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null); // Selected node in knowledge graph
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState(false); // Loading state for podcast generation
  const [isGeneratingCards, setIsGeneratingCards] = useState(false); // Unused in current implementation

  // ===============================
  // THINKING MODAL STATE (Real-Time Streaming UI)
  // ===============================
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingStage, setThinkingStage] = useState<
    | "extracting"
    | "verifying"
    | "graphing"
    | "structuring"
    | "writing"
    | "citing"
  >("extracting");
  const [currentThought, setCurrentThought] = useState<string>("");
  const [markdownProgress, setMarkdownProgress] = useState(0);
  const [showRetryModal, setShowRetryModal] = useState<boolean>(false);
  const [retryError, setRetryError] = useState<string>("");
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [isMarkdownComplete, setIsMarkdownComplete] = useState(false);

  // ===============================
  // USER PROFILE (Onboarding)
  // ===============================
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("synapseUserProfile");
      if (saved) setUserProfile(JSON.parse(saved));
    } catch (e) {
      console.warn("Failed to load user profile:", e);
    }
  }, []);

  // Save profile when it changes
  useEffect(() => {
    if (userProfile) {
      try {
        localStorage.setItem("synapseUserProfile", JSON.stringify(userProfile));
        console.log("💾 [Profile] Saved to localStorage:", {
          name: userProfile.name,
          discipline: userProfile.discipline,
          level: userProfile.level,
          teachingStyle: userProfile.teachingStyle,
        });
      } catch (e) {
        console.warn("Failed to save profile:", e);
      }
    }
  }, [userProfile]);

  const handleProfileSave = (updatedProfile: UserProfile) => {
    setUserProfile(updatedProfile);
    setShowProfileEditor(false);
    console.log("✅ [Profile] Updated:", updatedProfile);
  };

  const isBirthday = () => {
    if (!userProfile?.birthday) return false;
    const today = new Date();
    const birth = new Date(userProfile.birthday);
    return (
      today.getMonth() === birth.getMonth() &&
      today.getDate() === birth.getDate()
    );
  };

  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input

  // ===============================
  // COMPUTED PROPERTIES
  // ===============================
  // Find the active note object from the library
  const activeNote = library.find((n) => n.id === activeNoteId);

  // ===============================
  // PERSISTENCE: Load/Save Library to localStorage
  // ===============================
  // Load library on app mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("synapseMedLibrary");
      if (saved) {
        const parsed = JSON.parse(saved);
        setLibrary(parsed);
      }
    } catch (e) {
      console.warn("Failed to load library from localStorage:", e);
    }
  }, []);

  // Save library whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("synapseMedLibrary", JSON.stringify(library));
    } catch (e) {
      console.warn("Failed to save library to localStorage:", e);
    }
  }, [library]);

  // ===============================
  // FILE HANDLING LOGIC
  // ===============================
  // Handle file selection from input or drag-drop
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles: File[] = Array.from(event.target.files);
      newFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          // Add file to staging queue with base64 encoding for API
          setStagingFiles((prev) => [
            ...prev,
            { file, base64, type: file.type },
          ]);
        };
        reader.readAsDataURL(file); // Convert to base64 for multimodal API
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = ""; // Reset input for re-selection
  };

  // Remove a staged file from the queue
  const removeStagedFile = (index: number) => {
    setStagingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ===============================
  // PROCESSING LOGIC: Streaming Note Generation
  // ===============================
  // Main function: Orchestrates two-phase streaming (Phase 1: Graph, Phase 2: Guide)
  // Backend callbacks: "metadata" → "markdown" (multiple) → "complete"
  // Frontend stages: "building-graph" → "writing-guide" → modal close
  const startDeepDiveStreaming = async () => {
    if (stagingFiles.length === 0) return;
    if (!process.env.API_KEY) {
      alert("Please provide an API_KEY in the environment.");
      return;
    }

    try {
      setIsThinking(true);
      setThinkingStage("extracting");
      setCurrentThought("");
      setMarkdownProgress(0);
      setIsMarkdownComplete(false);
      setStatus(ProcessingStatus.BUILDING_GRAPH);

      await new Promise((r) => setTimeout(r, 300));

      const tempNoteId = crypto.randomUUID();
      const tempNote: AugmentedNote = {
        id: tempNoteId,
        timestamp: Date.now(),
        title: "Generating...",
        sourceFileNames: stagingFiles.map((f) => f.file.name),
        markdownContent: "_Connecting to Gemini 2.5 Flash (Thinking Mode)..._",
        summary: "",
        pearls: [],
        graphData: { nodes: [], links: [] },
        podcastScript: [],
        sources: [],
      };

      let lastPhase1Stage: string | null = null;
      let lastPhase2Stage: string | null = null;

      const result = await gemini.augmentClinicalNoteStreaming(
        stagingFiles,
        topicName || "Untitled Session",
        userProfile,
        (update) => {
          if (update.stage === "metadata") {
            if (update.subStage && update.subStage !== lastPhase1Stage) {
              lastPhase1Stage = update.subStage;
              setThinkingStage(update.subStage as any);
              console.log(`📊 Phase 1: ${update.subStage}`);
            }

            if (update.data?.graphData) {
              setThinkingStage("structuring");
              setStatus(ProcessingStatus.WRITING_GUIDE);

              setLibrary((prev) => {
                const exists = prev.find((n) => n.id === tempNoteId);
                if (exists) {
                  return prev.map((n) =>
                    n.id === tempNoteId
                      ? {
                          ...n,
                          title: update.data?.title || n.title,
                          summary: update.data?.summary || n.summary,
                          eli5Analogy: update.data?.eli5Analogy,
                          pearls: update.data?.pearls || [],
                          graphData: update.data?.graphData || n.graphData,
                        }
                      : n
                  );
                }
                return [
                  {
                    ...tempNote,
                    title: update.data?.title || tempNote.title,
                    summary: update.data?.summary || tempNote.summary,
                    eli5Analogy: update.data?.eli5Analogy,
                    pearls: update.data?.pearls || [],
                    graphData: update.data?.graphData || tempNote.graphData,
                  },
                  ...prev,
                ];
              });

              setActiveNoteId(tempNoteId);
              setActiveNav("dashboard");
              setActiveTab("guide");
            }
          } else if (update.stage === "markdown") {
            if (update.subStage && update.subStage !== lastPhase2Stage) {
              lastPhase2Stage = update.subStage;
              setThinkingStage(update.subStage as any);
              console.log(`📝 Phase 2: ${update.subStage}`);
            }

            const content = update.data?.markdownContent || "";
            setMarkdownProgress(content.length);

            setLibrary((prev) =>
              prev.map((n) =>
                n.id === tempNoteId ? { ...n, markdownContent: content } : n
              )
            );
          } else if (update.stage === "complete") {
            // 🔧 FIX: Update with final result including smart links and sources
            if (update.data) {
              setLibrary((prev) =>
                prev.map((n) =>
                  n.id === tempNoteId
                    ? {
                        ...n,
                        markdownContent:
                          update.data?.markdownContent || n.markdownContent,
                        sources: update.data?.sources || [],
                      }
                    : n
                )
              );
              // Update progress to final length
              setMarkdownProgress(update.data.markdownContent?.length || 0);
            }
            setIsThinking(false);
            setIsMarkdownComplete(true);
            setStatus(ProcessingStatus.COMPLETE);
          }
        },
        (thought) => {
          if (thought && thought.trim()) {
            setCurrentThought(thought);
          }
        }
      );

      // 🔧 FIX: Final update with complete result (smart links + sources)
      // This ensures the processed markdown with node links is saved
      result.id = tempNoteId;
      setLibrary((prev) =>
        prev.map((n) =>
          n.id === tempNoteId
            ? {
                ...n,
                ...result, // Overwrite with full result including smart links
                id: tempNoteId, // Keep the temp ID
              }
            : n
        )
      );

      setStagingFiles([]);
      setTopicName("");
      setStatus(ProcessingStatus.COMPLETE);
      setIsThinking(false);
      setIsMarkdownComplete(true);
    } catch (e: any) {
      console.error(e);
      setIsThinking(false);

      // Check if it's an empty content error
      if (e.code === "EMPTY_CONTENT") {
        setRetryError(e.message || "Content generation incomplete");
        setShowRetryModal(true);
        setStatus(ProcessingStatus.ERROR);
      } else {
        setStatus(ProcessingStatus.ERROR);
        alert("Analysis failed. Please try again.");
      }
    }
  };

  // ===============================
  // PODCAST GENERATION
  // ===============================
  // Generate podcast script and audio for active note
  const handleGeneratePodcast = async () => {
    if (!activeNote || !activeNoteId) return;
    setIsGeneratingPodcast(true);
    try {
      // Generate script via Gemini
      const script = await gemini.generatePodcastScript(
        activeNote.title,
        activeNote.summary,
        activeNote.markdownContent
      );

      // Generate audio (may fail due to API limits)
      const audioData = await gemini.generateNativePodcastAudio(script);

      if (!audioData) {
        alert(
          "Neural Audio generation unavailable (Capacity Limit). Showing script only."
        );
      }

      // Update note with podcast data
      setLibrary((prev) =>
        prev.map((n) =>
          n.id === activeNoteId
            ? {
                ...n,
                podcastScript: script,
                audioBase64: audioData || undefined,
              }
            : n
        )
      );
    } catch (e) {
      console.error("Podcast generation failed", e);
      alert("Failed to generate audio. Try again.");
    } finally {
      setIsGeneratingPodcast(false);
    }
  };

  // ===============================
  // RENDER: Main App UI
  // ===============================
  if (!userProfile) {
    return (
      <Onboarding
        onComplete={(profile) => {
          try {
            localStorage.setItem("synapseUserProfile", JSON.stringify(profile));
          } catch (e) {
            console.warn("Failed to save profile:", e);
          }
          setUserProfile(profile);
        }}
      />
    );
  }
  return (
    <div className="min-h-screen bg-obsidian text-gray-200 font-sans flex overflow-hidden transition-colors duration-300">
      {/* 🔧 SIMPLIFIED: Removed isTransitioning prop */}
      <ThinkingModal
        isThinking={isThinking}
        stage={thinkingStage}
        currentThought={currentThought}
        markdownProgress={markdownProgress}
      />

      {/* Profile Editor Modal */}
      {showProfileEditor && userProfile && (
        <ProfileEditor
          profile={userProfile}
          onSave={handleProfileSave}
          onClose={() => setShowProfileEditor(false)}
        />
      )}

      {/* Retry Modal for Empty Content Error */}
      {showRetryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-gradient-to-b from-charcoal to-obsidian border border-glass-border rounded-3xl shadow-2xl p-8 max-w-lg w-full transform animate-scaleIn">
            {/* Decorative top accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-clinical-cyan/50 to-transparent rounded-full" />

            {/* Icon with pulse animation */}
            <div className="flex justify-center mb-6 relative">
              <div className="absolute inset-0 w-20 h-20 mx-auto rounded-full bg-clinical-cyan/10 animate-ping" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-clinical-cyan/20 to-clinical-teal/10 border border-clinical-cyan/30 flex items-center justify-center">
                <Activity className="w-10 h-10 text-clinical-cyan animate-pulse" />
              </div>
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-center text-white mb-2">
              Taking a Quick Break
            </h3>

            {/* Subtitle */}
            <p className="text-center text-clinical-cyan/80 text-sm font-medium mb-4">
              Our AI needs a moment to recharge
            </p>

            {/* Message */}
            <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/10">
              <p className="text-center text-gray-300 text-sm leading-relaxed">
                {retryError ||
                  "The content generation service is temporarily busy."}
              </p>
              <p className="text-center text-gray-500 text-xs mt-2">
                This happens occasionally with complex topics. Don't worry -
                your progress is safe!
              </p>
            </div>

            {/* Countdown Timer */}
            {retryCountdown > 0 && (
              <div className="flex flex-col items-center mb-6">
                <div className="relative w-24 h-24">
                  <svg className="w-24 h-24 -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      className="text-charcoal"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray={276}
                      strokeDashoffset={276 - (276 * retryCountdown) / 60}
                      className="text-clinical-cyan transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white">
                      {retryCountdown}s
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Auto-retry in progress...
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              {/* Cancel / Return to Upload */}
              <button
                onClick={() => {
                  setShowRetryModal(false);
                  setRetryCountdown(0);
                  setStatus(ProcessingStatus.IDLE);
                  setLibrary((prev) =>
                    prev.filter((n) => n.id !== activeNoteId)
                  );
                  setActiveNoteId(null);
                  setStagingFiles([]);
                  setTopicName("");
                  setActiveNav("dashboard");
                }}
                className="flex-1 px-6 py-3.5 rounded-xl bg-charcoal/80 border border-glass-border text-gray-300 font-medium hover:bg-charcoal hover:border-gray-500 transition-all duration-200 hover:scale-[1.02] flex items-center justify-center gap-2"
              >
                <X size={18} />
                Cancel
              </button>

              {/* Try Again */}
              <button
                onClick={async () => {
                  if (retryCountdown > 0) return; // Prevent clicking during countdown

                  // Start 60s countdown
                  setRetryCountdown(60);
                  const interval = setInterval(() => {
                    setRetryCountdown((prev) => {
                      if (prev <= 1) {
                        clearInterval(interval);
                        // Auto-retry after countdown
                        setShowRetryModal(false);
                        setStatus(ProcessingStatus.BUILDING_GRAPH);
                        setIsThinking(true);
                        startDeepDiveStreaming().catch((e) => {
                          console.error("Auto-retry failed:", e);
                          setShowRetryModal(true);
                          setRetryError(
                            "Auto-retry failed. Please try again or start over."
                          );
                        });
                        return 0;
                      }
                      return prev - 1;
                    });
                  }, 1000);
                }}
                disabled={retryCountdown > 0}
                className={`flex-1 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  retryCountdown > 0
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-clinical-teal to-clinical-cyan text-white hover:shadow-lg hover:shadow-clinical-teal/30 hover:scale-[1.02]"
                }`}
              >
                <Zap size={18} />
                {retryCountdown > 0 ? "Waiting..." : "Retry Now"}
              </button>
            </div>

            {/* Encouraging message */}
            <p className="text-center text-gray-500 text-xs mt-4">
              💡 Tip: Smaller files or simpler topics process faster
            </p>
          </div>
        </div>
      )}

      {/* Sidebar: Navigation between dashboard and library */}
      <aside className="w-20 border-r border-glass-border flex flex-col items-center py-6 gap-8 bg-charcoal/50 z-30 transition-colors duration-300">
        <div
          className="w-10 h-10 rounded-xl bg-clinical-cyan flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.3)] cursor-pointer hover:scale-105 transition-transform"
          onClick={() => {
            setActiveNoteId(null);
            setActiveNav("dashboard");
          }}
          title="New Session"
        >
          <Brain className="text-black" size={24} />
        </div>

        <nav className="flex flex-col gap-6 w-full px-4">
          <button
            onClick={() => {
              setActiveNoteId(null);
              setActiveNav("dashboard");
            }}
            className={`p-3 rounded-lg transition-all flex justify-center ${
              activeNav === "dashboard" && !activeNoteId
                ? "text-clinical-cyan bg-clinical-cyan/10"
                : "text-gray-500 hover:text-white"
            }`}
          >
            <UploadCloud size={20} />
          </button>
          <button
            onClick={() => setActiveNav("library")}
            className={`p-3 rounded-lg transition-all flex justify-center ${
              activeNav === "library"
                ? "text-clinical-cyan bg-clinical-cyan/10"
                : "text-gray-500 hover:text-white"
            }`}
          >
            <Library size={20} />
          </button>
        </nav>
      </aside>

      {/* Main content area with conditional views */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Global header with branding and status */}
        <header className="h-14 border-b border-glass-border flex items-center justify-between px-6 bg-charcoal/30 backdrop-blur-sm z-20 shrink-0 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-medium tracking-wide text-white font-sans">
              SYNAPSE <span className="font-light text-gray-400">MED</span>
            </h1>
            {activeNote && (
              <>
                <span className="text-gray-600">/</span>
                <span className="text-sm font-mono text-clinical-cyan truncate max-w-[200px]">
                  {activeNote.title}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isBirthday() && (
              <div className="absolute top-0 left-0 right-0 h-1 z-[60] bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 animate-pulse" />
            )}
            <div className="flex items-center gap-3">
              {isBirthday() && (
                <Cake size={16} className="text-pink-400 animate-bounce" />
              )}
              <span className="text-xs font-mono text-gray-400 hidden md:block">
                Welcome,{" "}
                <span className="text-clinical-cyan">{userProfile?.name}</span>
              </span>
              {/* Profile Edit Button */}
              <button
                onClick={() => setShowProfileEditor(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-clinical-cyan/50 hover:bg-clinical-cyan/10 transition-all group"
                title="Edit Profile"
              >
                {userProfile?.profilePicture ? (
                  <img
                    src={userProfile.profilePicture}
                    alt="Profile"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <User
                    size={14}
                    className="text-clinical-text/60 group-hover:text-clinical-cyan transition-colors"
                  />
                )}
                <Settings
                  size={12}
                  className="text-clinical-text/40 group-hover:text-clinical-cyan transition-colors"
                />
              </button>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <Zap size={12} className="text-clinical-amber" />
              <span className="text-[10px] font-mono text-gray-300">
                FLOW STATE: ON
              </span>
            </div>
          </div>
        </header>

        {/* --- VIEW: UPLOAD DASHBOARD --- */}
        {activeNav === "dashboard" && !activeNoteId && (
          <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
            <div className="max-w-3xl w-full space-y-8 animate-[fadeIn_0.5s_ease-out]">
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-light text-white font-sans">
                  Clinical Intelligence Engine
                </h2>
                <p className="text-gray-400">
                  Upload lectures, PDFs, or photos. We'll build the knowledge
                  graph.
                </p>
              </div>

              {/* Staging Area */}
              <div className="bg-charcoal/50 border border-glass-border rounded-2xl p-6 space-y-6 shadow-2xl">
                <div>
                  <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2 block">
                    Session Topic
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Ischemic Heart Disease"
                    value={topicName}
                    onChange={(e) => setTopicName(e.target.value)}
                    className="w-full bg-obsidian border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-clinical-cyan focus:outline-none transition-colors"
                  />
                </div>

                {/* File Drop */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-700 hover:border-clinical-cyan/50 bg-white/5 hover:bg-white/10 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all gap-4"
                >
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.txt,.png,.jpg,.jpeg,.heic,.heif,.webp,.mp3,.wav,.m4a,.aac,.flac,.ogg,.mp4,.webm,.mov,.mpeg,.mpg,.3gpp,.wmv,.avi,.mp4,.flv"
                  />
                  <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center border border-white/5 shadow-lg">
                    <Layers className="text-clinical-cyan" size={32} />
                  </div>
                  <div className="text-center">
                    <p className="text-white font-medium">
                      Click to upload files
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      PDF • Images (PNG, JPG, HEIC, WebP) • Audio (MP3, WAV,
                      M4A) • Video (MP4, WebM, MOV)
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Max 500MB input • Up to 3,000 files • Videos ≤45min •
                      Audio ≤8hrs
                    </p>
                  </div>
                </div>

                {/* Staged Files List */}
                {stagingFiles.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2 block">
                      Queued Resources ({stagingFiles.length})
                    </label>
                    {stagingFiles.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"
                      >
                        <div className="flex items-center gap-3">
                          {f.type.includes("pdf") ? (
                            <FileText size={18} className="text-red-400" />
                          ) : f.type.includes("image") ? (
                            <FileImage size={18} className="text-blue-400" />
                          ) : (
                            <FileAudio size={18} className="text-purple-400" />
                          )}
                          <span className="text-sm text-gray-200 truncate max-w-[300px]">
                            {f.file.name}
                          </span>
                        </div>
                        <button
                          onClick={() => removeStagedFile(i)}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={startDeepDiveStreaming} // 4️⃣ UPDATED BUTTON
                  disabled={stagingFiles.length === 0}
                  className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                    stagingFiles.length > 0
                      ? "bg-clinical-cyan text-black hover:bg-cyan-400 hover:scale-[1.01]"
                      : "bg-gray-800 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <Sparkles size={18} />
                  <span>
                    {stagingFiles.length > 0
                      ? "Synthesize Master Guide"
                      : "Add Files to Begin"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- VIEW: LIBRARY --- */}
        {activeNav === "library" && (
          <div className="flex-1 overflow-y-auto p-8">
            <h2 className="text-2xl font-light text-white mb-6">
              Knowledge Library
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {library.map((note) => (
                <div
                  key={note.id}
                  onClick={() => {
                    setActiveNoteId(note.id);
                    setActiveNav("dashboard");
                  }}
                  className="bg-charcoal/50 border border-glass-border p-6 rounded-2xl cursor-pointer hover:border-clinical-cyan/50 hover:bg-white/5 transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-clinical-teal/20 flex items-center justify-center text-clinical-teal">
                      <GraduationCap size={20} />
                    </div>
                    <span className="text-xs text-gray-500 font-mono">
                      {new Date(note.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-xl font-medium text-white group-hover:text-clinical-cyan transition-colors mb-2">
                    {note.title}
                  </h3>
                  <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                    {note.summary}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- VIEW: STUDY WORKSPACE (Active Note) --- */}
        {activeNoteId && activeNote && (
          <div className="flex-1 flex overflow-hidden">
            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex relative overflow-hidden">
              {/* MODE: MASTER GUIDE */}
              {activeTab === "guide" && (
                <div className="flex-1 flex flex-col animate-[fadeIn_0.3s_ease-out]">
                  {/* Toolbar */}
                  <div className="h-12 border-b border-glass-border flex items-center px-4 bg-charcoal/20 gap-4 justify-between">
                    <div className="flex gap-4">
                      <button
                        onClick={() => setActiveTab("guide")}
                        className="px-4 py-1.5 rounded-full text-xs font-medium bg-clinical-cyan text-black transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                      >
                        Master Guide
                      </button>
                      <button
                        onClick={() => setActiveTab("graph")}
                        className="px-4 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-white transition-all hover:bg-white/5"
                      >
                        Neural Web
                      </button>
                    </div>

                    {/* Podcast Controls */}
                    <div className="flex items-center gap-2">
                      {activeNote.podcastScript &&
                      activeNote.podcastScript.length > 0 ? (
                        <PodcastPlayer
                          script={activeNote.podcastScript}
                          audioBase64={activeNote.audioBase64}
                        />
                      ) : (
                        <button
                          onClick={handleGeneratePodcast}
                          disabled={isGeneratingPodcast}
                          className="px-3 py-1.5 bg-clinical-rose/10 hover:bg-clinical-rose/20 border border-clinical-rose/30 rounded-lg text-clinical-rose text-[10px] font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeneratingPodcast ? (
                            <>
                              <div className="w-2 h-2 border-2 border-current border-t-transparent rounded-full animate-spin"></div>{" "}
                              SYNTHESIZING...
                            </>
                          ) : (
                            <>
                              <Headphones size={12} /> GENERATE PODCAST
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto bg-obsidian p-10 scroll-smooth">
                    <div className="max-w-3xl mx-auto">
                      {showEli5 && activeNote.eli5Analogy && (
                        <div className="mb-8 p-6 bg-gradient-to-br from-clinical-purple/10 to-transparent border border-clinical-purple/30 rounded-xl">
                          <h3 className="text-clinical-purple font-bold mb-2 text-sm uppercase">
                            Analogy Time
                          </h3>
                          <p className="text-gray-200 text-lg font-medium italic">
                            "{activeNote.eli5Analogy}"
                          </p>
                        </div>
                      )}

                      <div className="markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          urlTransform={(url) => url} // Allow custom protocols like node:
                          components={{
                            // Prevent links in headings
                            h1: ({ node, children, ...props }) => (
                              <h1 {...props}>{children}</h1>
                            ),
                            h2: ({ node, children, ...props }) => (
                              <h2 {...props}>{children}</h2>
                            ),
                            h3: ({ node, children, ...props }) => (
                              <h3 {...props}>{children}</h3>
                            ),
                            h4: ({ node, children, ...props }) => (
                              <h4 {...props}>{children}</h4>
                            ),
                            h5: ({ node, children, ...props }) => (
                              <h5 {...props}>{children}</h5>
                            ),
                            h6: ({ node, children, ...props }) => (
                              <h6 {...props}>{children}</h6>
                            ),
                            a: ({ node, ...props }) => {
                              const href = props.href || "";

                              // 🔧 FIXED: Enhanced smart link handler with proper node resolution
                              if (href.startsWith("node:")) {
                                const nodeId = href.split(":")[1];
                                return (
                                  <span
                                    className="smart-link"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();

                                      // Find node by exact ID match
                                      const targetNode =
                                        activeNote.graphData.nodes.find(
                                          (n) => n.id === nodeId
                                        );

                                      if (targetNode) {
                                        setSelectedNode(targetNode);
                                        setActiveTab("graph");
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        const targetNode =
                                          activeNote.graphData.nodes.find(
                                            (n) => n.id === nodeId
                                          );
                                        if (targetNode) {
                                          setSelectedNode(targetNode);
                                          setActiveTab("graph");
                                        }
                                      }
                                    }}
                                  >
                                    {props.children}
                                  </span>
                                );
                              }
                              if (href.startsWith("http")) {
                                return (
                                  <a
                                    {...props}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 text-[0.8em] font-sans font-medium text-gray-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 hover:border-clinical-cyan hover:text-clinical-cyan transition-all align-middle mx-1"
                                  >
                                    {props.children} <ExternalLink size={8} />
                                  </a>
                                );
                              }
                              return (
                                <span
                                  className="text-clinical-cyan/80 border-b border-dotted border-clinical-cyan/50 cursor-help"
                                  title="Reference"
                                >
                                  {props.children}
                                </span>
                              );
                            },
                          }}
                        >
                          {activeNote.markdownContent}
                        </ReactMarkdown>
                      </div>

                      {/* Clinical Pearls - Enhanced Design */}
                      {activeNote.pearls &&
                        activeNote.pearls.length > 0 &&
                        activeNote.markdownContent &&
                        activeNote.markdownContent.length > 100 && (
                          <div className="mb-8">
                            {/* Section Header */}
                            <div className="flex items-center gap-2 mb-4">
                              <Sparkles className="w-5 h-5 text-clinical-amber" />
                              <h3 className="text-lg font-bold text-white">
                                Clinical Pearls
                              </h3>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-clinical-amber/10 text-clinical-amber border border-clinical-amber/20">
                                {activeNote.pearls.length} pearls
                              </span>
                            </div>

                            {/* Pearl Cards */}
                            <div className="grid gap-3">
                              {activeNote.pearls.map((pearl, i) => {
                                const pearlConfig = {
                                  "red-flag": {
                                    icon: AlertTriangle,
                                    bg: "bg-gradient-to-r from-red-500/10 to-red-500/5",
                                    border: "border-red-500/30",
                                    accent: "bg-red-500",
                                    text: "text-red-200",
                                    label: "🚨 RED FLAG",
                                    labelColor: "text-red-400",
                                  },
                                  "exam-tip": {
                                    icon: GraduationCap,
                                    bg: "bg-gradient-to-r from-blue-500/10 to-blue-500/5",
                                    border: "border-blue-500/30",
                                    accent: "bg-blue-500",
                                    text: "text-blue-200",
                                    label: "📝 EXAM TIP",
                                    labelColor: "text-blue-400",
                                  },
                                  "gap-filler": {
                                    icon: Layers,
                                    bg: "bg-gradient-to-r from-cyan-500/10 to-cyan-500/5",
                                    border: "border-cyan-500/30",
                                    accent: "bg-cyan-500",
                                    text: "text-cyan-200",
                                    label: "💡 GAP FILLER",
                                    labelColor: "text-cyan-400",
                                  },
                                  "fact-check": {
                                    icon: CheckCircle2,
                                    bg: "bg-gradient-to-r from-amber-500/10 to-amber-500/5",
                                    border: "border-amber-500/30",
                                    accent: "bg-amber-500",
                                    text: "text-amber-200",
                                    label: "✅ FACT CHECK",
                                    labelColor: "text-amber-400",
                                  },
                                };
                                const config =
                                  pearlConfig[
                                    pearl.type as keyof typeof pearlConfig
                                  ] || pearlConfig["fact-check"];
                                const IconComponent = config.icon;

                                return (
                                  <div
                                    key={i}
                                    className={`relative overflow-hidden rounded-xl border ${config.border} ${config.bg} p-4 hover:scale-[1.01] transition-all duration-200`}
                                  >
                                    {/* Accent bar */}
                                    <div
                                      className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent}`}
                                    />

                                    {/* Content */}
                                    <div className="flex gap-3 pl-2">
                                      <div
                                        className={`shrink-0 w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}
                                      >
                                        <IconComponent
                                          className={`w-4 h-4 ${config.labelColor}`}
                                        />
                                      </div>
                                      <div className="flex-1">
                                        <div
                                          className={`text-[10px] font-bold tracking-widest mb-1 ${config.labelColor}`}
                                        >
                                          {config.label}
                                        </div>
                                        <div
                                          className={`text-sm leading-relaxed ${config.text}`}
                                        >
                                          {pearl.content}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Motivational Message */}
                            {userProfile && (
                              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-clinical-purple/10 to-clinical-cyan/10 border border-clinical-purple/20">
                                <div className="flex items-start gap-3">
                                  <div className="shrink-0 w-10 h-10 rounded-full bg-clinical-purple/20 flex items-center justify-center">
                                    {userProfile.profilePicture ? (
                                      <img
                                        src={userProfile.profilePicture}
                                        alt=""
                                        className="w-10 h-10 rounded-full object-cover"
                                      />
                                    ) : (
                                      <Sparkles className="w-5 h-5 text-clinical-purple" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                      {isBirthday()
                                        ? `🎂 Happy Birthday, ${
                                            userProfile.name
                                          }! What a gift to yourself—mastering ${
                                            activeNote?.title || "this topic"
                                          }. May this year bring you clinical excellence and countless "aha!" moments. Keep shining! 🌟`
                                        : `Keep pushing, ${
                                            userProfile.name
                                          }! Every pearl you absorb today brings you closer to clinical mastery. ${
                                            userProfile.level?.includes(
                                              "Student"
                                            )
                                              ? "Your dedication as a student will pay off—future patients are counting on brilliant clinicians like you."
                                              : "Your commitment to learning sets you apart as a true professional."
                                          } 💪`}
                                    </p>
                                    <p className="text-xs text-clinical-cyan/60 mt-1">
                                      — Your Synapse Med AI Mentor
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      {activeNote.sources && activeNote.sources.length > 0 && (
                        <div className="mt-16 pt-8 border-t border-glass-border">
                          <h3 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase mb-4">
                            <CheckCircle2
                              size={14}
                              className="text-clinical-teal"
                            />{" "}
                            Verified Sources
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {activeNote.sources.map((source, idx) => (
                              <a
                                key={idx}
                                href={source.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col p-3 bg-white/5 border border-white/5 rounded-lg hover:bg-white/10 transition-all group"
                              >
                                <span className="text-xs font-medium text-gray-200 truncate group-hover:text-clinical-cyan">
                                  {source.title}
                                </span>
                                <span className="text-[10px] text-gray-500 truncate">
                                  {new URL(source.uri).hostname}
                                </span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* MODE: NEURAL WEB (FULL SCREEN) */}
              {activeTab === "graph" && (
                <div className="flex-1 flex flex-col relative animate-[fadeIn_0.3s_ease-out]">
                  {/* Toolbar */}
                  <div className="h-12 border-b border-glass-border flex items-center px-4 bg-charcoal/20 gap-4 justify-between shrink-0 backdrop-blur-sm z-20">
                    <div className="flex gap-4">
                      <button
                        onClick={() => setActiveTab("guide")}
                        className="px-4 py-1.5 rounded-full text-xs font-medium text-gray-400 hover:text-white transition-all hover:bg-white/5"
                      >
                        Master Guide
                      </button>
                      <button
                        onClick={() => setActiveTab("graph")}
                        className="px-4 py-1.5 rounded-full text-xs font-medium bg-clinical-cyan text-black transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                      >
                        Neural Web
                      </button>
                    </div>

                    {/* Podcast Controls */}
                    <div className="flex items-center gap-2">
                      {activeNote.podcastScript &&
                      activeNote.podcastScript.length > 0 ? (
                        <PodcastPlayer
                          script={activeNote.podcastScript}
                          audioBase64={activeNote.audioBase64}
                        />
                      ) : (
                        <button
                          onClick={handleGeneratePodcast}
                          disabled={isGeneratingPodcast}
                          className="px-3 py-1.5 bg-clinical-rose/10 hover:bg-clinical-rose/20 border border-clinical-rose/30 rounded-lg text-clinical-rose text-[10px] font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {isGeneratingPodcast ? (
                            <>
                              <div className="w-2 h-2 border-2 border-current border-t-transparent rounded-full animate-spin"></div>{" "}
                              SYNTHESIZING...
                            </>
                          ) : (
                            <>
                              <Headphones size={12} /> GENERATE PODCAST
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 relative bg-black/20 overflow-hidden">
                    {/* 🆕 Show warning banner if markdown is still generating */}
                    {!isMarkdownComplete &&
                      status === ProcessingStatus.WRITING_GUIDE && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 animate-[fadeIn_0.3s_ease-out]">
                          <div className="flex items-center gap-3 px-5 py-3 bg-clinical-amber/10 border border-clinical-amber/30 rounded-xl backdrop-blur-md shadow-lg">
                            <div className="flex gap-1">
                              {[0, 1, 2].map((i) => (
                                <div
                                  key={i}
                                  className="w-1.5 h-1.5 bg-clinical-amber rounded-full animate-bounce"
                                  style={{ animationDelay: `${i * 0.15}s` }}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-clinical-amber font-medium">
                              Master Guide is being synthesized...
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                              ({(markdownProgress / 1000).toFixed(1)}K chars)
                            </span>
                          </div>
                        </div>
                      )}

                    {/* D3 knowledge graph component */}
                    <KnowledgeGraph
                      data={activeNote.graphData}
                      onNodeSelect={(node) => setSelectedNode(node)}
                      selectedNodeId={selectedNode?.id}
                      inspectorOpen={selectedNode !== null}
                      className="w-full h-full"
                    />

                    {/* Floating instruction text */}
                    {!selectedNode && (
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-[fadeInUp_0.5s_ease-out_1s_both] pointer-events-none">
                        <div className="w-2 h-2 rounded-full bg-clinical-cyan animate-pulse"></div>
                        <span className="text-xs font-medium text-gray-300 tracking-wide">
                          {!isMarkdownComplete &&
                          status === ProcessingStatus.WRITING_GUIDE
                            ? "Graph ready • Guide still synthesizing in background"
                            : "Select a node to unlock deep clinical insights"}
                        </span>
                      </div>
                    )}

                    {/* Node inspector panel for selected node */}
                    <NodeInspector
                      node={selectedNode}
                      graphData={activeNote.graphData}
                      onClose={() => setSelectedNode(null)}
                      onNodeClick={(nodeId) => {
                        const node = activeNote.graphData.nodes.find(
                          (n) => n.id === nodeId
                        );
                        if (node) setSelectedNode(node);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
