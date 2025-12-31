import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import ReactDOM from "react-dom";
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
  MessageSquare,
  BrainCircuit,
  Package,
} from "lucide-react";
import KnowledgeGraph from "./components/KnowledgeGraph";
import ThinkingModal from "./components/ThinkingModal";
import NodeInspector from "./components/NodeInspector";
import ChatInterface from "./components/ChatInterface";
import BioBackground from "./components/BioBackground";
import ExportModal from "./components/ExportModal";
import { GeminiService } from "./services/geminiService";
import {
  NoteRepository,
  ProfileRepository,
  StorageRepository,
  base64ToBlob,
  blobToBase64,
  recordToNote,
  noteToRecord,
  recordToProfile,
  profileToRecord,
} from "./src/lib";
import {
  ProcessingStatus,
  AugmentedNote,
  FileInput,
  KnowledgeNode,
  UserProfile,
} from "./types";
import Onboarding from "./components/Onboarding";
import { ProfileEditor } from "./components/ProfileEditor";
import SplashScreen from "./components/SplashScreen";
import {
  GreetingState,
  createInitialGreeting,
  computeGreeting,
  SUFFIX_ANIMATION_CLASS,
} from "./utils/greetingService";

// ═══════════════════════════════════════════════════════════════════════════
// ATTACHMENT ROW COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
interface AttachmentRowProps {
  fileId: string;
}

const AttachmentRow: React.FC<AttachmentRowProps> = ({ fileId }) => {
  const [metadata, setMetadata] = useState<{
    file_name: string;
    size: number;
    mime_type: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadMetadata() {
      try {
        const blob = await StorageRepository.download(fileId);
        if (!mounted || !blob) return;
        const meta = await StorageRepository.getMetadata(fileId);
        if (mounted && meta) {
          setMetadata({
            file_name: meta.file_name,
            size: meta.size,
            mime_type: meta.mime_type,
          });
        }
      } catch (e) {
        console.warn("Failed to load attachment metadata:", e);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadMetadata();
    return () => {
      mounted = false;
    };
  }, [fileId]);

  const handleOpen = async () => {
    try {
      const url = await StorageRepository.createObjectURL(fileId);
      if (url) {
        window.open(url, "_blank");
      }
    } catch (e) {
      console.warn("Failed to open attachment:", e);
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await StorageRepository.download(fileId);
      if (!blob || !metadata) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = metadata.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("Failed to download attachment:", e);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
        <div className="text-gray-400 text-[13px]">Loading...</div>
      </div>
    );
  }

  if (!metadata) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] hover:border-white/[0.08] transition-all">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-tissue-rose/10 border border-tissue-rose/20 flex items-center justify-center">
          <FileText size={16} className="text-tissue-rose" />
        </div>
        <div className="min-w-0">
          <div className="text-[14px] text-gray-100 truncate font-medium">
            {metadata.file_name}
          </div>
          <div className="text-[12px] text-gray-500">
            {(metadata.size / 1024).toFixed(1)} KB
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleOpen}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md text-[12px] font-medium text-gray-300 hover:text-white transition-all"
          title="Open in new tab"
        >
          Open
        </button>
        <button
          onClick={handleDownload}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-md text-[12px] font-medium text-gray-300 hover:text-white transition-all flex items-center gap-1"
          title="Download file"
        >
          <Download size={12} />
          Download
        </button>
      </div>
    </div>
  );
};

// Initialize Gemini service for API interactions
const gemini = new GeminiService();

const App: React.FC = () => {
  // ===============================
  // APPLICATION STATE MANAGEMENT
  // ===============================
  // Core app state: tracks processing status, user library, and active views
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [library, setLibrary] = useState<AugmentedNote[]>([]); // User's generated notes stored in IndexedDB
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
  const [isGeneratingCards, setIsGeneratingCards] = useState(false); // Unused in current implementation

  // ===============================
  // CHAT INTERFACE STATE (Context-Aware AI Companion)
  // ===============================
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedText, setSelectedText] = useState<string | null>(null);

  // ===============================
  // EXPORT MODAL STATE
  // ===============================
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

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
  const [isProfileLoaded, setIsProfileLoaded] = useState(false); // Prevent onboarding flash on refresh

  // ===============================
  // SPLASH SCREEN STATE
  // ===============================
  const [showSplash, setShowSplash] = useState(true); // Show splash on app launch

  // Load saved profile from IndexedDB on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const record = await ProfileRepository.get();
        if (record) {
          // Load profile picture if stored
          let profilePicture: string | undefined;
          if (record.profile_picture_id) {
            const blob = await StorageRepository.download(
              record.profile_picture_id
            );
            if (blob) {
              profilePicture = await blobToBase64(blob);
            }
          }
          setUserProfile(recordToProfile(record, profilePicture));
        }
      } catch (e) {
        console.warn("Failed to load user profile:", e);
      } finally {
        setIsProfileLoaded(true);
      }
    };
    loadProfile();
  }, []);

  // Save profile to IndexedDB when it changes
  useEffect(() => {
    if (!userProfile || !isProfileLoaded) return;

    const saveProfile = async () => {
      try {
        // Handle profile picture storage
        let profile_picture_id: string | undefined;
        if (userProfile.profilePicture) {
          // Store profile picture as a file
          const blob = await fetch(userProfile.profilePicture).then((r) =>
            r.blob()
          );
          profile_picture_id = await StorageRepository.upload(blob, {
            fileName: "profile-picture",
            relatedNoteId: "profile", // Use 'profile' as the "note" for profile files
          });
        }

        await ProfileRepository.save({
          ...profileToRecord(userProfile),
          profile_picture_id,
        });
        console.log("💾 [Profile] Saved to IndexedDB:", {
          name: userProfile.name,
          discipline: userProfile.discipline,
          level: userProfile.level,
          teachingStyle: userProfile.teachingStyle,
        });
      } catch (e) {
        console.warn("Failed to save profile:", e);
      }
    };
    saveProfile();
  }, [userProfile, isProfileLoaded]);

  // ===============================
  // UPLOAD ZONE TILT EFFECT
  // ===============================
  useEffect(() => {
    const uploadZone = uploadZoneRef.current;
    if (!uploadZone) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = uploadZone.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -8; // max 8deg
      const rotateY = ((x - centerX) / centerX) * 8;
      uploadZone.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    };

    const handleMouseLeave = () => {
      uploadZone.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    };

    uploadZone.addEventListener("mousemove", handleMouseMove);
    uploadZone.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      uploadZone.removeEventListener("mousemove", handleMouseMove);
      uploadZone.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  const handleProfileSave = useCallback((updatedProfile: UserProfile) => {
    setUserProfile(updatedProfile);
    setShowProfileEditor(false);
    console.log("✅ [Profile] Updated:", updatedProfile);
  }, []);

  const isBirthday = useMemo(() => {
    if (!userProfile?.birthday) return false;
    const today = new Date();
    const birth = new Date(userProfile.birthday);
    return (
      today.getMonth() === birth.getMonth() &&
      today.getDate() === birth.getDate()
    );
  }, [userProfile?.birthday]);

  // Live, personalized greeting using the greeting service
  // Discipline-based suffixes rotate every 20s for emotional engagement
  const [greeting, setGreeting] = useState<GreetingState>(() =>
    createInitialGreeting(userProfile?.discipline)
  );

  // Update greeting every 20s to rotate suffixes; also re-compute when discipline changes
  useEffect(() => {
    // Immediate update when discipline changes
    setGreeting(computeGreeting(userProfile?.discipline));
    const id = setInterval(
      () => setGreeting(computeGreeting(userProfile?.discipline)),
      20_000
    );
    return () => clearInterval(id);
  }, [userProfile?.discipline]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadZoneRef = useRef<HTMLDivElement>(null); // Ref for hidden file input

  // ===============================
  // COMPUTED PROPERTIES (memoized)
  // ===============================
  // Find the active note object from the library
  const activeNote = useMemo(
    () => library.find((n) => n.id === activeNoteId),
    [library, activeNoteId]
  );

  // ===============================
  // PERSISTENCE: Load/Save Library to IndexedDB
  // ===============================
  const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
  const libraryLoadedRef = useRef(false); // Track if initial load is done

  // Load library on app mount
  useEffect(() => {
    const loadLibrary = async () => {
      try {
        const records = await NoteRepository.list();
        // Convert records to AugmentedNote format
        const notes: AugmentedNote[] = records.map(recordToNote);
        setLibrary(notes);
        console.log(`📚 [Library] Loaded ${notes.length} notes from IndexedDB`);
      } catch (e) {
        console.warn("Failed to load library from IndexedDB:", e);
      } finally {
        setIsLibraryLoaded(true);
        libraryLoadedRef.current = true;
      }
    };
    loadLibrary();
  }, []);

  // Save library to IndexedDB when it changes (skip initial empty state)
  useEffect(() => {
    // Skip save if we haven't loaded yet
    if (!libraryLoadedRef.current) return;

    const saveLibrary = async () => {
      try {
        for (const note of library) {
          await NoteRepository.save(noteToRecord(note));
        }
        console.log(`💾 [Library] Saved ${library.length} notes to IndexedDB`);
      } catch (e) {
        console.warn("Failed to save library to IndexedDB:", e);
      }
    };
    saveLibrary();
  }, [library]);

  // ===============================
  // FILE HANDLING LOGIC (memoized to prevent re-renders)
  // ===============================
  // Handle file selection from input or drag-drop
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    []
  );

  // Remove a staged file from the queue
  const removeStagedFile = useCallback((index: number) => {
    setStagingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ===============================
  // PROCESSING LOGIC: Streaming Note Generation
  // ===============================
  // Main function: Orchestrates two-phase streaming (Phase 1: Graph, Phase 2: Guide)
  // Backend callbacks: "metadata" → "markdown" (multiple) → "complete"
  // Frontend stages: "building-graph" → "writing-guide" → modal close
  const startDeepDiveStreaming = async () => {
    if (stagingFiles.length === 0) return;
    // REMOVED: API_KEY environment check - users will provide their key via Onboarding/Settings
    // This allows the app to work on GitHub Pages with BYOK architecture
    // if (!process.env.API_KEY) {
    //   alert("Please provide an API_KEY in the environment.");
    //   return;
    // }

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
            // Update with final result including smart links and sources
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

      //  Final update with complete result (smart links + sources)
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

      // Persist original uploaded files to IndexedDB (StorageRepository)
      // so PDFs/audio/images are available later and linked to the note.
      try {
        if (stagingFiles && stagingFiles.length > 0) {
          const uploadedIds: string[] = [];
          for (const f of stagingFiles) {
            try {
              // f.file is a File object (from input); upload as Blob
              if (f.file) {
                const id = await StorageRepository.upload(f.file, {
                  fileName: f.file.name,
                  relatedNoteId: tempNoteId,
                });
                uploadedIds.push(id);
              }
            } catch (innerErr) {
              console.warn(
                "Failed to upload source file to IndexedDB:",
                innerErr
              );
            }
          }

          if (uploadedIds.length > 0) {
            // Attach file IDs to the generated note in local state
            setLibrary((prev) =>
              prev.map((n) =>
                n.id === tempNoteId ? { ...n, sourceFileIds: uploadedIds } : n
              )
            );
          }
        }
      } catch (e) {
        console.warn("Error persisting staged files:", e);
      }

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
  // TEXT SELECTION HANDLER (Chat Integration)
  // ===============================
  // Captures text selected in the Master Guide and opens chat with context
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const text = selection.toString().trim();
      // Only trigger for meaningful selections (5-1500 chars)
      if (text.length >= 5 && text.length <= 1500) {
        setSelectedText(text);
        setIsChatOpen(true);
      }
    }
  }, []);

  // Clear selected text context
  const handleClearSelection = useCallback(() => {
    setSelectedText(null);
  }, []);

  // Toggle chat panel
  const handleToggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
    if (isChatOpen) {
      // Clear selection when closing
      setSelectedText(null);
    }
  }, [isChatOpen]);

  // ===============================
  // RENDER: Main App UI
  // ===============================

  // Show splash screen on initial app launch
  if (showSplash) {
    return (
      <SplashScreen
        onComplete={() => setShowSplash(false)}
        minDuration={5500}
      />
    );
  }

  // Don't render anything until profile is loaded from IndexedDB (prevents flash)
  if (!isProfileLoaded) {
    return null;
  }

  if (!userProfile) {
    return (
      <Onboarding
        onComplete={(profile) => {
          // The useEffect will handle saving to IndexedDB
          setUserProfile(profile);
        }}
      />
    );
  }
  // Hide BioBackground in study workspace (Master Guide / Neural Web) to reduce scrim/noise darkness
  const isStudyWorkspace =
    activeNav === "dashboard" && activeNoteId && activeNote;

  return (
    <>
      {/* Render background to dedicated container — skip in study workspace for cleaner reading */}
      {!isStudyWorkspace &&
        ReactDOM.createPortal(
          <BioBackground />,
          document.getElementById("bio-background-root") || document.body
        )}

      {/* Tablet Landscape Orientation Hint - Shows on tablets in portrait mode */}
      <div className="fixed inset-0 z-[100] bg-bio-void/95 backdrop-blur-xl hidden portrait:flex md:portrait:flex lg:portrait:hidden items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-vital-cyan/10 border border-vital-cyan/20 flex items-center justify-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-vital-cyan animate-pulse"
            >
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M12 18h.01" />
              <path d="M8 22h8" strokeDasharray="2 2" />
            </svg>
          </div>
          <h2 className="text-2xl font-serif italic text-serum-white mb-3">
            Rotate for Best Experience
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Synapse Med works beautifully in{" "}
            <span className="text-vital-cyan font-semibold">
              landscape mode
            </span>{" "}
            on tablets. Please rotate your iPad or tablet horizontally.
          </p>
          <div className="flex items-center justify-center gap-2 text-[11px] text-gray-500 font-mono">
            <span className="w-8 h-5 border border-gray-500 rounded-sm flex items-center justify-center">
              <span className="w-1 h-1 bg-gray-500 rounded-full" />
            </span>
            <span>→</span>
            <span className="w-12 h-7 border border-vital-cyan rounded-sm flex items-center justify-center">
              <span className="w-1 h-1 bg-vital-cyan rounded-full" />
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-screen bg-transparent text-serum-white font-sans flex overflow-hidden transition-colors duration-500 relative">
        {/* Content layers */}

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

        {/* Export Modal */}
        {activeNote && (
          <ExportModal
            note={activeNote}
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
          />
        )}

        {/* Retry Modal for Empty Content Error */}
        {showRetryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
            <div className="relative bg-gradient-to-b from-bio-deep to-bio-void border border-white/[0.06] rounded-3xl shadow-2xl p-10 max-w-lg w-full transform animate-scaleIn overflow-hidden">
              {/* Decorative atmospheric glow */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-vital-cyan/10 rounded-full blur-[100px] pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-synapse-amber/10 rounded-full blur-[80px] pointer-events-none" />

              {/* Top accent line */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-px bg-gradient-to-r from-transparent via-vital-cyan/50 to-transparent" />

              {/* Icon with pulse animation */}
              <div className="flex justify-center mb-8 relative">
                <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full bg-vital-cyan/10 animate-ping" />
                <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-vital-cyan/15 to-clinical-teal/10 border border-vital-cyan/20 flex items-center justify-center backdrop-blur-sm">
                  <Activity className="w-12 h-12 text-vital-cyan animate-pulse" />
                </div>
              </div>

              {/* Title */}
              <h3 className="text-3xl font-serif italic text-center text-serum-white mb-2 relative">
                Taking a Moment
              </h3>

              {/* Subtitle */}
              <p className="text-center text-vital-cyan/80 text-sm font-sans tracking-wide mb-6">
                Our AI system needs to recalibrate
              </p>

              {/* Message */}
              <div className="glass-slide rounded-2xl p-5 mb-8 relative">
                <p className="text-center text-gray-200 text-sm leading-relaxed font-sans">
                  {retryError ||
                    "The content synthesis process requires additional time."}
                </p>
                <p className="text-center text-gray-500 text-xs mt-3 font-mono">
                  Your progress is safely preserved.
                </p>
              </div>

              {/* Countdown Timer */}
              {retryCountdown > 0 && (
                <div className="flex flex-col items-center mb-8">
                  <div className="relative w-28 h-28">
                    <svg className="w-28 h-28 -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r="50"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="transparent"
                        className="text-white/5"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r="50"
                        stroke="currentColor"
                        strokeWidth="3"
                        fill="transparent"
                        strokeDasharray={314}
                        strokeDashoffset={314 - (314 * retryCountdown) / 60}
                        className="text-vital-cyan transition-all duration-1000"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-mono font-light text-serum-white">
                        {retryCountdown}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 tracking-widest uppercase font-sans">
                    Auto-retry in progress
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-4">
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
                  className="flex-1 px-6 py-4 rounded-xl bg-white/[0.03] border border-white/[0.08] text-gray-200 font-medium hover:bg-white/[0.06] hover:border-white/[0.15] hover:text-serum-white transition-all duration-300 flex items-center justify-center gap-2 group"
                >
                  <X
                    size={18}
                    className="group-hover:rotate-90 transition-transform duration-300"
                  />
                  <span className="tracking-wide">Cancel</span>
                </button>

                <button
                  onClick={async () => {
                    if (retryCountdown > 0) return;
                    setRetryCountdown(60);
                    const interval = setInterval(() => {
                      setRetryCountdown((prev) => {
                        if (prev <= 1) {
                          clearInterval(interval);
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
                  className={`flex-1 px-6 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                    retryCountdown > 0
                      ? "bg-white/[0.03] text-gray-500 cursor-not-allowed"
                      : "bg-vital-cyan text-bio-void hover:shadow-[0_0_40px_rgba(42,212,212,0.3)] hover:scale-[1.02]"
                  }`}
                >
                  <Zap size={18} />
                  <span className="tracking-wide">
                    {retryCountdown > 0 ? "Waiting..." : "Retry Now"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
          SIDEBAR: "The Spine" - Functional Minimalist Navigation
          ═══════════════════════════════════════════════════════════════ */}
        <aside
          className={`w-20 border-r border-white/[0.04] flex flex-col items-center py-8 gap-10 z-30 transition-colors duration-500 ${
            activeNoteId ? "bg-[#030406]" : "bg-bio-deep/50 backdrop-blur-sm"
          }`}
        >
          {/* Synapse Neural Mark - Pulsing Life Indicator */}
          <div
            className="relative cursor-pointer group"
            onClick={() => {
              setActiveNoteId(null);
              setActiveNav("dashboard");
            }}
            title="New Session"
          >
            <div className="absolute inset-0 w-4 h-4 m-auto rounded-full bg-vital-cyan/30 animate-ping" />
            <div className="w-4 h-4 rounded-full bg-vital-cyan shadow-[0_0_20px_rgba(42,212,212,0.6)] group-hover:shadow-[0_0_30px_rgba(42,212,212,0.8)] transition-shadow duration-300" />
          </div>

          {/* Navigation Actions */}
          <nav className="flex flex-col gap-2 w-full px-3">
            <button
              onClick={() => {
                setActiveNoteId(null);
                setActiveNav("dashboard");
              }}
              className={`relative p-3.5 rounded-xl transition-all duration-300 flex justify-center group ${
                activeNav === "dashboard" && !activeNoteId
                  ? "text-vital-cyan bg-vital-cyan/[0.08]"
                  : "text-gray-500 hover:text-serum-white hover:bg-white/[0.03]"
              }`}
              title="Upload"
            >
              <UploadCloud size={20} className="relative z-10" />
              {activeNav === "dashboard" && !activeNoteId && (
                <div className="absolute inset-0 rounded-xl border border-vital-cyan/20" />
              )}
              {/* Hover label */}
              <span className="absolute left-full ml-3 text-[10px] font-mono tracking-widest text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                UPLOAD
              </span>
            </button>

            <button
              onClick={() => {
                setActiveNav("library");
                setActiveNoteId(null); // Clear active note when going to library
                setIsChatOpen(false);
                setSelectedText(null);
              }}
              className={`relative p-3.5 rounded-xl transition-all duration-300 flex justify-center group ${
                activeNav === "library"
                  ? "text-vital-cyan bg-vital-cyan/[0.08]"
                  : "text-gray-500 hover:text-serum-white hover:bg-white/[0.03]"
              }`}
              title="Library"
            >
              <Library size={20} className="relative z-10" />
              {activeNav === "library" && (
                <div className="absolute inset-0 rounded-xl border border-vital-cyan/20" />
              )}
              <span className="absolute left-full ml-3 text-[10px] font-mono tracking-widest text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                LIBRARY
              </span>
            </button>
          </nav>

          {/* Bottom: Profile Avatar */}
          <div className="mt-auto">
            <button
              onClick={() => setShowProfileEditor(true)}
              className="relative group"
              title="Edit Profile"
            >
              {userProfile?.profilePicture ? (
                <img
                  src={userProfile.profilePicture}
                  alt="Profile"
                  className="w-9 h-9 rounded-xl object-cover border border-white/10 opacity-70 hover:opacity-100 hover:border-vital-cyan/30 transition-all duration-300"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-center opacity-70 hover:opacity-100 hover:border-vital-cyan/30 transition-all duration-300">
                  <User size={16} className="text-gray-200" />
                </div>
              )}
              <span className="absolute left-full ml-3 text-[10px] font-mono tracking-widest text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                PROFILE
              </span>
            </button>
          </div>
        </aside>

        {/* Main content area with conditional views */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
          {/* ═══════════════════════════════════════════════════════════════
            HEADER: The Editorial Statement
            ═══════════════════════════════════════════════════════════════ */}
          <header
            className={`h-16 border-b border-white/[0.04] flex items-center justify-between px-8 z-20 shrink-0 transition-colors duration-500 ${
              activeNoteId ? "bg-[#030406]" : "bg-bio-deep/30 backdrop-blur-md"
            }`}
          >
            {/* Left: Brand + Context */}
            <div className="flex items-center gap-4">
              <h1 className="text-base font-sans tracking-[0.15em] text-serum-white/90 font-medium uppercase">
                Synapse <span className="font-light text-gray-500">Med</span>
              </h1>
              {activeNote && (
                <>
                  <span className="h-4 w-px bg-white/10" />
                  <span className="text-sm font-serif italic text-vital-cyan/80 truncate max-w-[220px]">
                    {activeNote.title}
                  </span>
                </>
              )}
            </div>

            {/* Right: Status & Profile */}
            <div className="flex items-center gap-5">
              {/* Birthday Banner Accent */}
              {isBirthday && (
                <div className="absolute top-0 left-0 right-0 h-0.5 z-[60] bg-gradient-to-r from-pink-500 via-tissue-rose to-synapse-amber animate-pulse" />
              )}

              {/* Time-Based Greeting (no username) */}
              <div className="hidden md:flex items-center gap-3">
                {isBirthday && (
                  <Cake size={14} className="text-pink-400 animate-bounce" />
                )}
                <span className="text-xs font-sans text-gray-500">
                  {greeting.prefix}
                </span>
              </div>

              {/* Profile Button */}
              <button
                onClick={() => setShowProfileEditor(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-vital-cyan/30 hover:bg-vital-cyan/[0.03] transition-all duration-300 group"
                title="Edit Profile"
              >
                {userProfile?.profilePicture ? (
                  <img
                    src={userProfile.profilePicture}
                    alt="Profile"
                    className="w-5 h-5 rounded-lg object-cover"
                  />
                ) : (
                  <User
                    size={14}
                    className="text-gray-500 group-hover:text-vital-cyan transition-colors"
                  />
                )}
                <Settings
                  size={11}
                  className="text-gray-500 group-hover:text-vital-cyan transition-colors"
                />
              </button>

              {/* Flow State Indicator */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="w-1.5 h-1.5 rounded-full bg-synapse-amber shadow-[0_0_8px_rgba(240,180,41,0.6)] animate-pulse" />
                <span className="text-[9px] font-mono text-gray-200 tracking-[0.2em] uppercase">
                  Flow State
                </span>
              </div>
            </div>
          </header>

          {/* ═══════════════════════════════════════════════════════════════
            VIEW: UPLOAD DASHBOARD - "The Cognitive Canvas"
            ═══════════════════════════════════════════════════════════════ */}
          {activeNav === "dashboard" && !activeNoteId && (
            <div className="flex-1 overflow-y-auto relative">
              {/* Content Layer */}
              <div className="relative z-10 max-w-6xl mx-auto px-8 py-6 lg:px-16 lg:py-8">
                {/* Editorial Header */}
                <div className="mb-6 lg:mb-4 animate-[fadeInUp_0.6s_ease-out]">
                  <div className="flex items-center gap-3 mb-3">
                    {greeting.icon &&
                      (() => {
                        const Icon = greeting.icon;
                        return (
                          <div
                            className={`p-1 rounded-md bg-white/5 ${
                              greeting.accentColor || "text-vital-cyan"
                            } opacity-70`}
                          >
                            <Icon size={12} />
                          </div>
                        );
                      })()}
                    <span className="h-px w-8 bg-vital-cyan/60" />
                    <span className="font-sans text-[11px] uppercase tracking-[0.25em] text-vital-cyan/90 font-semibold">
                      Ready for Synthesis
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <h2 className="font-serif text-5xl lg:text-6xl text-serum-white/95 italic tracking-tight leading-tight">
                      Welcome back,
                    </h2>
                    <div
                      className={`font-serif text-5xl lg:text-6xl not-italic font-semibold tracking-tight leading-tight py-2 ${
                        greeting.gradient
                          ? `bg-gradient-to-r ${greeting.gradient} bg-clip-text text-transparent`
                          : "text-serum-white/95"
                      }`}
                    >
                      {userProfile?.name}.
                    </div>
                    {greeting.suffix && (
                      <div
                        key={greeting.suffix}
                        className={`mt-4 text-sm lg:text-base ${
                          greeting.accentColor || "text-vital-cyan"
                        }/80 font-sans not-italic ${SUFFIX_ANIMATION_CLASS}`}
                      >
                        ✨ {greeting.suffix}
                      </div>
                    )}
                  </div>
                </div>

                {/* Main Grid: Instructions + Upload Zone */}
                <div className="grid grid-cols-12 gap-8 lg:gap-12 items-start">
                  {/* Left Column: Step Instructions */}
                  <div className="col-span-12 lg:col-span-5 mt-8 space-y-10 animate-[fadeInUp_0.6s_ease-out_0.1s_both]">
                    {/* Step 01: Topic */}
                    <div className="relative pl-6 border-l border-white/10">
                      <span className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-vital-cyan shadow-[0_0_8px_rgba(42,212,212,0.4)]" />
                      <h3 className="font-sans text-sm uppercase tracking-[0.2em] text-gray-200 mb-3">
                        Step 01. Context
                      </h3>
                      <input
                        type="text"
                        placeholder="Define your study topic..."
                        value={topicName}
                        onChange={(e) => setTopicName(e.target.value)}
                        className="w-full bg-transparent border-b border-white/10 py-2 font-serif text-2xl lg:text-3xl text-serum-white/95 placeholder-gray-400 focus:outline-none focus:border-vital-cyan transition-colors"
                      />
                    </div>

                    {/* Step 02: Source Info */}
                    <div className="relative pl-6 border-l border-white/10">
                      <span className="absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full bg-gray-700" />
                      <h3 className="font-sans text-sm uppercase tracking-[0.2em] text-gray-200 mb-3">
                        Step 02. Source
                      </h3>
                      <p className="font-sans text-sm text-gray-200 leading-relaxed max-w-sm">
                        Drop lecture slides, textbook PDFs, or handwritten
                        notes.
                        <br />
                        <span className="text-gray-200 text-xs mt-2 block">
                          Synapse will build an interactive topic map, generate
                          a comprehensive study guide with clinical pearls, and
                          provide detailed learning insights.
                        </span>
                      </p>
                    </div>

                    {/* Study Library Stats */}
                    <div className="pt-6 border-t border-white/[0.06] mt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-200 mb-1">
                            Study Library
                          </p>
                          <p className="font-serif text-lg italic text-gray-200">
                            {library.length} Topics Available
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-1">
                            AI Model
                          </p>
                          <p className="font-mono text-xs text-vital-cyan/85">
                            Gemini 2.5 Flash
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Upload Zone (The Petri Dish) */}
                  <div className="col-span-12 lg:col-span-7 animate-[fadeInUp_0.6s_ease-out_0.2s_both] lg:-mt-32">
                    <div
                      ref={uploadZoneRef}
                      onClick={() => fileInputRef.current?.click()}
                      className={`glass-slide interactive-card relative w-full min-h-[420px] rounded-[2rem] p-8 lg:p-10 cursor-pointer overflow-hidden group ${
                        stagingFiles.length > 0
                          ? "border border-vital-cyan/20"
                          : "border border-white/[0.04]"
                      }`}
                    >
                      <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        className="hidden"
                        accept=".pdf,.txt,.png,.jpg,.jpeg,.heic,.heif,.webp,.aac,.flac,.mp3,.m4a,.mpeg,.mpga,.mp4,.ogg,.pcm,.wav,.webm,.flv,.mov,.mpg,.mp4,.webm,.wmv,.3gpp"
                      />

                      {/* Decorative Glow - Enhanced */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-vital-cyan/5 rounded-full blur-[100px] pointer-events-none opacity-0 group-hover:opacity-60 transition-opacity duration-700" />

                      <div className="h-full flex flex-col justify-between relative z-10">
                        {/* Top Row */}
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-vital-cyan/60 animate-pulse shadow-[0_0_10px_rgba(42,212,212,0.5)]" />
                            <span className="font-mono text-[9px] text-vital-cyan/80 tracking-[0.2em] uppercase">
                              Ready to Upload
                            </span>
                          </div>
                          <span className="font-mono text-[8px] text-gray-500 border border-white/[0.06] px-2.5 py-1 rounded-lg tracking-widest uppercase">
                            Safe Upload
                          </span>
                        </div>

                        {/* Center Content - Enhanced Scanner Style */}
                        <div className="flex-1 flex flex-col items-center justify-center py-8">
                          {/* The Portal Upload Target */}
                          <div className="relative w-44 h-44 flex items-center justify-center">
                            {/* Outer Scanner Ring */}
                            <div
                              className={`absolute inset-0 rounded-full border border-dashed transition-all duration-500 ${
                                stagingFiles.length > 0
                                  ? "border-vital-cyan/40"
                                  : "border-white/10 group-hover:border-vital-cyan/30"
                              }`}
                            />

                            {/* Spinning Scanner Animation - Outer */}
                            <div className="absolute inset-0 rounded-full border-2 border-t-transparent border-vital-cyan/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 animate-[spin_4s_linear_infinite]" />

                            {/* Spinning Scanner Animation - Inner */}
                            <div className="absolute inset-[16px] rounded-full border border-b-transparent border-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 animate-[spin_6s_linear_infinite_reverse]" />

                            {/* Inner Circle Background */}
                            <div
                              className={`absolute inset-[24px] rounded-full transition-all duration-500 ${
                                stagingFiles.length > 0
                                  ? "bg-vital-cyan/10 border border-vital-cyan/30"
                                  : "bg-white/[0.02] border border-white/[0.06] group-hover:bg-vital-cyan/5 group-hover:border-vital-cyan/20"
                              }`}
                            />

                            {/* Icon Container */}
                            <div className="relative z-10 flex flex-col items-center transition-transform duration-500 group-hover:scale-110">
                              {stagingFiles.length > 0 ? (
                                <Sparkles
                                  size={36}
                                  className="text-vital-cyan animate-pulse"
                                />
                              ) : (
                                <UploadCloud
                                  size={36}
                                  className="text-gray-400 group-hover:text-vital-cyan transition-colors duration-300"
                                />
                              )}
                            </div>
                          </div>

                          {/* Instruction Text */}
                          <div className="mt-8 text-center space-y-3">
                            <h3 className="font-serif italic text-2xl text-serum-white">
                              {stagingFiles.length > 0
                                ? `${stagingFiles.length} Files Ready`
                                : "Add Your Study Materials"}
                            </h3>
                            <div className="flex gap-3 justify-center text-[10px] font-mono tracking-wide text-gray-500 uppercase">
                              <span>PDF</span>
                              <span className="text-white/20">•</span>
                              <span>TXT</span>
                              <span className="text-white/20">•</span>
                              <span>Images</span>
                              <span className="text-white/20">•</span>
                              <span>Audio</span>
                              <span className="text-white/20">•</span>
                              <span>Video</span>
                            </div>
                          </div>
                        </div>

                        {/* Staged Files Preview */}
                        {stagingFiles.length > 0 && (
                          <div
                            className="mb-6 space-y-2 max-h-32 overflow-y-auto custom-scrollbar"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {stagingFiles.map((f, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-white/[0.04] group/file hover:border-vital-cyan/20 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  {f.type.includes("pdf") ? (
                                    <FileText
                                      size={16}
                                      className="text-tissue-rose"
                                    />
                                  ) : f.type.includes("image") ? (
                                    <FileImage
                                      size={16}
                                      className="text-vital-cyan"
                                    />
                                  ) : (
                                    <FileAudio
                                      size={16}
                                      className="text-neural-purple"
                                    />
                                  )}
                                  <span className="text-xs text-gray-200 truncate max-w-[200px] font-sans">
                                    {f.file.name}
                                  </span>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeStagedFile(i);
                                  }}
                                  className="text-gray-500 hover:text-tissue-rose transition-colors p-1"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Bottom Row */}
                        <div className="flex items-end justify-between font-mono text-[9px] text-gray-500 uppercase tracking-widest">
                          <div
                            className={
                              stagingFiles.length > 0 ? "text-vital-cyan" : ""
                            }
                          >
                            {stagingFiles.length > 0
                              ? `${stagingFiles.length} files detected`
                              : "waiting for your files..."}
                          </div>
                          <div className="text-gray-600">system ready</div>
                        </div>
                      </div>
                    </div>

                    {/* Synthesize Button - Enhanced */}
                    <button
                      onClick={startDeepDiveStreaming}
                      disabled={stagingFiles.length === 0}
                      className={`w-full mt-6 py-5 rounded-2xl font-mono font-bold tracking-[0.15em] uppercase text-sm flex items-center justify-center gap-3 transition-all duration-500 ${
                        stagingFiles.length > 0
                          ? "bg-serum-white text-bio-void hover:shadow-[0_0_50px_rgba(255,255,255,0.25)] hover:scale-[1.01]"
                          : "bg-white/[0.02] text-gray-500 cursor-not-allowed border border-white/[0.04]"
                      }`}
                    >
                      {stagingFiles.length > 0 ? (
                        <>
                          <Zap size={18} className="animate-pulse" />
                          <span>Synthesize Graph</span>
                        </>
                      ) : (
                        <span>Add Files to Begin</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Footer Meta */}
                <footer className="mt-12 lg:mt-10 pt-8 border-t border-white/[0.04] flex justify-between text-[9px] font-mono text-gray-500 tracking-[0.15em] uppercase">
                  <div>AI Model: Gemini 2.5 Flash</div>
                  <div>
                    Status:{" "}
                    {stagingFiles.length > 0
                      ? "Ready for Synthesis"
                      : "Awaiting Input"}
                  </div>
                  <div>Synapse Med</div>
                </footer>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
            VIEW: LIBRARY - Knowledge Archive
            ═══════════════════════════════════════════════════════════════ */}
          {activeNav === "library" && (
            <div className="flex-1 overflow-y-auto relative">
              {/* Atmospheric Background */}
              <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-neural-purple/[0.02] rounded-full blur-[150px] pointer-events-none" />

              <div className="relative z-10 p-10 lg:p-16">
                {/* Header */}
                <div className="mb-12 animate-[fadeInUp_0.6s_ease-out]">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="h-px w-10 bg-neural-purple/50" />
                    <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-neural-purple/90 font-semibold">
                      Study Archive
                    </span>
                  </div>
                  <h2 className="font-serif text-4xl lg:text-5xl text-serum-white italic">
                    Your Study Library
                  </h2>
                  <p className="text-gray-500 mt-3 font-sans text-sm">
                    {library.length} study guides • Click to explore
                  </p>
                </div>

                {/* Library Grid */}
                {library.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-[fadeInUp_0.6s_ease-out_0.1s_both]">
                    {library.map((note, index) => (
                      <div
                        key={note.id}
                        onClick={() => {
                          setActiveNoteId(note.id);
                          setActiveNav("dashboard");
                        }}
                        className="interactive-card glass-slide relative p-7 rounded-2xl cursor-pointer border border-white/[0.04] group overflow-hidden"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        {/* Decorative accent */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-vital-cyan/[0.03] rounded-full blur-[60px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="relative z-10">
                          {/* Top Row */}
                          <div className="flex justify-between items-start mb-5">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-vital-cyan/10 to-clinical-teal/5 border border-vital-cyan/10 flex items-center justify-center">
                              <GraduationCap
                                size={22}
                                className="text-vital-cyan"
                              />
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono tracking-wider">
                              {new Date(note.timestamp).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                }
                              )}
                            </span>
                          </div>

                          {/* Content */}
                          <h3 className="text-xl font-serif text-serum-white group-hover:text-vital-cyan transition-colors duration-300 mb-3 line-clamp-2">
                            {note.title}
                          </h3>
                          <p className="text-sm text-gray-500 line-clamp-2 font-sans leading-relaxed mb-5">
                            {note.summary}
                          </p>

                          {/* Stats */}
                          <div className="flex items-center gap-4 pt-4 border-t border-white/[0.04]">
                            <div className="flex items-center gap-1.5">
                              <Brain size={12} className="text-gray-500" />
                              <span className="text-[10px] text-gray-500 font-mono">
                                {note.graphData.nodes.length} nodes
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Empty State */
                  <div className="flex flex-col items-center justify-center py-20 animate-[fadeInUp_0.6s_ease-out]">
                    <div className="w-24 h-24 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-6">
                      <Library size={40} className="text-gray-500" />
                    </div>
                    <h3 className="font-serif text-2xl text-gray-200 italic mb-2">
                      No guides yet
                    </h3>
                    <p className="text-gray-500 text-sm font-sans mb-6">
                      Upload your first study materials to get started
                    </p>
                    <button
                      onClick={() => setActiveNav("dashboard")}
                      className="px-6 py-3 rounded-xl bg-vital-cyan/10 border border-vital-cyan/20 text-vital-cyan text-sm font-medium hover:bg-vital-cyan/20 transition-colors flex items-center gap-2"
                    >
                      <Plus size={16} />
                      Create Your First Guide
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
            VIEW: STUDY WORKSPACE (Active Note)
            ═══════════════════════════════════════════════════════════════ */}
          {activeNav === "dashboard" && activeNoteId && activeNote && (
            <div className="flex-1 flex overflow-hidden">
              {/* MAIN CONTENT AREA */}
              <div className="flex-1 flex relative overflow-hidden">
                {/* MODE: MASTER GUIDE */}
                {activeTab === "guide" && (
                  <div className="flex-1 flex flex-col animate-[fadeIn_0.3s_ease-out]">
                    {/* Toolbar */}
                    <div className="h-14 border-b border-white/[0.04] flex items-center px-6 bg-[#030406] gap-6 justify-between">
                      <div className="flex gap-3">
                        <button
                          onClick={() => setActiveTab("guide")}
                          className="px-5 py-2 rounded-xl text-xs font-sans font-medium tracking-wide bg-vital-cyan/10 text-vital-cyan border border-vital-cyan/20 transition-all shadow-[0_0_15px_rgba(42,212,212,0.15)]"
                        >
                          Study Guide
                        </button>
                        <button
                          onClick={() => setActiveTab("graph")}
                          className="px-5 py-2 rounded-xl text-xs font-sans font-medium tracking-wide text-gray-500 hover:text-serum-white transition-all hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]"
                        >
                          Topic Map
                        </button>
                      </div>

                      {/* Right Controls */}
                      <div className="flex items-center gap-4">
                        {/* Chat Toggle Button */}
                        <button
                          onClick={handleToggleChat}
                          className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-[10px] font-sans font-semibold uppercase tracking-[0.1em] transition-all duration-300 ${
                            isChatOpen
                              ? "bg-vital-cyan/10 border-vital-cyan/30 text-vital-cyan shadow-[0_0_20px_rgba(42,212,212,0.15)]"
                              : "border-white/[0.06] text-gray-500 hover:text-serum-white hover:border-vital-cyan/30 hover:bg-vital-cyan/[0.03]"
                          }`}
                        >
                          <BrainCircuit size={14} />
                          <span className="hidden md:block">
                            {isChatOpen ? "Close AI" : "Ask AI"}
                          </span>
                          {!isChatOpen && (
                            <span className="hidden lg:flex items-center gap-1 text-[8px] text-gray-500 bg-white/[0.03] px-2 py-0.5 rounded-md font-mono">
                              or highlight
                            </span>
                          )}
                        </button>

                        {/* Export Button */}
                        <button
                          onClick={() => setIsExportModalOpen(true)}
                          className="px-4 py-2 bg-neural-purple/10 hover:bg-neural-purple/15 border border-neural-purple/20 rounded-xl text-neural-purple text-[10px] font-sans font-semibold uppercase tracking-[0.1em] transition-all flex items-center gap-2 hover:shadow-[0_0_20px_rgba(167,139,250,0.15)]"
                          title="Export Study Guide"
                        >
                          <Package size={12} />
                          <span className="hidden md:block">Export</span>
                        </button>
                      </div>
                    </div>

                    {/* Content + Chat Layout */}
                    <div className="flex-1 flex overflow-hidden relative bg-[#080a0d]">
                      {/* Main Guide Content - Adjusts when chat opens */}
                      <div
                        className={`overflow-y-auto scroll-smooth transition-all duration-500 ease-out custom-scrollbar ${
                          isChatOpen ? "pr-[600px]" : "w-full"
                        }`}
                        style={{ flex: 1 }}
                        onMouseUp={handleTextSelection}
                      >
                        <div
                          className={`relative py-12 transition-all duration-500 ${
                            isChatOpen
                              ? "pl-16 pr-12 max-w-5xl"
                              : "px-10 max-w-4xl mx-auto"
                          }`}
                        >
                          {/* Atmospheric Background - brighter glow */}
                          <div className="absolute top-0 -right-1/4 w-[500px] h-[500px] bg-vital-cyan/[0.025] rounded-full blur-[120px] pointer-events-none z-0" />
                          <div className="absolute bottom-1/3 -left-1/4 w-[400px] h-[400px] bg-neural-purple/[0.015] rounded-full blur-[100px] pointer-events-none z-0" />
                          <div className="relative z-10">
                            {showEli5 && activeNote.eli5Analogy && (
                              <div className="mb-10 p-7 bg-gradient-to-br from-neural-purple/10 to-transparent border border-neural-purple/20 rounded-2xl">
                                <h3 className="text-neural-purple font-sans font-semibold mb-3 text-[10px] uppercase tracking-[0.15em]">
                                  Analogy Mode
                                </h3>
                                <p className="text-gray-200 text-lg font-serif italic leading-relaxed">
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
                                            if (
                                              e.key === "Enter" ||
                                              e.key === " "
                                            ) {
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
                                          {props.children}{" "}
                                          <ExternalLink size={8} />
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
                          </div>

                          {/* Clinical Pearls - Enhanced Design */}
                          {activeNote.pearls &&
                            activeNote.pearls.length > 0 &&
                            activeNote.markdownContent &&
                            activeNote.markdownContent.length > 100 && (
                              <div className="mb-10 mt-16 pt-10 border-t border-white/[0.04]">
                                {/* Section Header */}
                                <div className="flex items-center gap-3 mb-6">
                                  <div className="w-10 h-10 rounded-xl bg-synapse-amber/10 border border-synapse-amber/20 flex items-center justify-center">
                                    <Sparkles className="w-5 h-5 text-synapse-amber" />
                                  </div>
                                  <div>
                                    <h3 className="text-lg font-sans font-semibold text-serum-white">
                                      Clinical Pearls
                                    </h3>
                                    <span className="text-[10px] font-mono text-synapse-amber/70 tracking-wide">
                                      {activeNote.pearls.length} high-yield
                                      insights
                                    </span>
                                  </div>
                                </div>

                                {/* Pearl Cards */}
                                <div className="grid gap-4">
                                  {activeNote.pearls.map((pearl, i) => {
                                    const pearlConfig = {
                                      "red-flag": {
                                        icon: AlertTriangle,
                                        bg: "bg-gradient-to-r from-tissue-rose/10 to-tissue-rose/[0.02]",
                                        border: "border-tissue-rose/20",
                                        accent: "bg-tissue-rose",
                                        text: "text-red-200",
                                        label: "🚨 Red Flag",
                                        labelColor: "text-tissue-rose",
                                      },
                                      "exam-tip": {
                                        icon: GraduationCap,
                                        bg: "bg-gradient-to-r from-vital-cyan/10 to-vital-cyan/[0.02]",
                                        border: "border-vital-cyan/20",
                                        accent: "bg-vital-cyan",
                                        text: "text-cyan-200",
                                        label: "📝 Exam Tip",
                                        labelColor: "text-vital-cyan",
                                      },
                                      "gap-filler": {
                                        icon: Layers,
                                        bg: "bg-gradient-to-r from-neural-purple/10 to-neural-purple/[0.02]",
                                        border: "border-neural-purple/20",
                                        accent: "bg-neural-purple",
                                        text: "text-purple-200",
                                        label: "💡 Gap Filler",
                                        labelColor: "text-neural-purple",
                                      },
                                      "fact-check": {
                                        icon: CheckCircle2,
                                        bg: "bg-gradient-to-r from-synapse-amber/10 to-synapse-amber/[0.02]",
                                        border: "border-synapse-amber/20",
                                        accent: "bg-synapse-amber",
                                        text: "text-amber-200",
                                        label: "✅ Fact Check",
                                        labelColor: "text-synapse-amber",
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
                                        className={`relative overflow-hidden rounded-2xl border ${config.border} ${config.bg} p-5 hover:scale-[1.01] transition-all duration-300`}
                                      >
                                        {/* Accent bar */}
                                        <div
                                          className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent}`}
                                        />

                                        {/* Content */}
                                        <div className="flex gap-4 pl-3">
                                          <div
                                            className={`shrink-0 w-9 h-9 rounded-xl ${config.bg} border ${config.border} flex items-center justify-center`}
                                          >
                                            <IconComponent
                                              className={`w-4 h-4 ${config.labelColor}`}
                                            />
                                          </div>
                                          <div className="flex-1">
                                            <div
                                              className={`text-[9px] font-sans font-semibold tracking-[0.15em] uppercase mb-2 ${config.labelColor}`}
                                            >
                                              {config.label}
                                            </div>
                                            <div
                                              className={`text-sm leading-relaxed font-sans ${config.text}`}
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
                                  <div className="mt-8 p-6 rounded-2xl glass-slide border border-white/[0.04]">
                                    <div className="flex items-start gap-4">
                                      <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-neural-purple/20 to-vital-cyan/10 border border-neural-purple/20 flex items-center justify-center overflow-hidden">
                                        {userProfile.profilePicture ? (
                                          <img
                                            src={userProfile.profilePicture}
                                            alt=""
                                            className="w-12 h-12 object-cover"
                                          />
                                        ) : (
                                          <Sparkles className="w-5 h-5 text-neural-purple" />
                                        )}
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-sm text-gray-200 leading-relaxed font-sans">
                                          {isBirthday
                                            ? `🎂 Happy Birthday, ${
                                                userProfile.name
                                              }! What a gift to yourself—mastering ${
                                                activeNote?.title ||
                                                "this topic"
                                              }. May this year bring clinical excellence and countless "aha!" moments. 🌟`
                                            : `Keep pushing, ${
                                                userProfile.name
                                              }! Every pearl you absorb brings you closer to mastery. ${
                                                userProfile.level?.includes(
                                                  "Student"
                                                )
                                                  ? "Your dedication will pay off—future patients are counting on clinicians like you."
                                                  : "Your commitment to learning sets you apart as a true professional."
                                              } 💪`}
                                        </p>
                                        <p className="text-[10px] text-vital-cyan/50 mt-2 font-mono tracking-wider">
                                          — Your Synapse Neural Mentor
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                          {activeNote.sources &&
                            activeNote.sources.length > 0 && (
                              <div className="mt-16 pt-10 border-t border-white/[0.04]">
                                <div className="flex items-center gap-3 mb-6">
                                  <div className="w-10 h-10 rounded-xl bg-clinical-teal/10 border border-clinical-teal/20 flex items-center justify-center">
                                    <CheckCircle2
                                      size={18}
                                      className="text-clinical-teal"
                                    />
                                  </div>
                                  <div>
                                    <h3 className="text-base font-sans font-semibold text-serum-white">
                                      Verified Sources
                                    </h3>
                                    <span className="text-[10px] font-mono text-clinical-teal/70 tracking-wide">
                                      {activeNote.sources.length} references
                                    </span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {activeNote.sources.map((source, idx) => (
                                    <a
                                      key={idx}
                                      href={source.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex flex-col p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:bg-white/[0.04] hover:border-vital-cyan/20 transition-all group"
                                    >
                                      <span className="text-xs font-sans font-medium text-gray-200 truncate group-hover:text-vital-cyan transition-colors">
                                        {source.title}
                                      </span>
                                      <span className="text-[10px] text-gray-500 truncate font-mono mt-1">
                                        {new URL(source.uri).hostname}
                                      </span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                          {/* Attachments Section */}
                          {activeNote.sourceFileIds &&
                            activeNote.sourceFileIds.length > 0 && (
                              <div className="mt-16 pt-10 border-t border-white/[0.04]">
                                <div className="flex items-center gap-3 mb-6">
                                  <div className="w-10 h-10 rounded-xl bg-tissue-rose/10 border border-tissue-rose/20 flex items-center justify-center">
                                    <FileText
                                      size={18}
                                      className="text-tissue-rose"
                                    />
                                  </div>
                                  <div>
                                    <h3 className="text-base font-sans font-semibold text-serum-white">
                                      Attachments
                                    </h3>
                                    <span className="text-[10px] font-mono text-tissue-rose/70 tracking-wide">
                                      {activeNote.sourceFileIds.length} file
                                      {activeNote.sourceFileIds.length !== 1
                                        ? "s"
                                        : ""}
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  {activeNote.sourceFileIds.map(
                                    (fileId, idx) => (
                                      <AttachmentRow
                                        key={idx}
                                        fileId={fileId}
                                      />
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>

                      {/* ═══════════════════════════════════════════════════════════════
                        SLIDING CHAT SIDEBAR - FIXED POSITION
                        ═══════════════════════════════════════════════════════════════ */}
                      <div
                        className={`fixed top-[112px] right-0 bottom-0 bg-[#050607] border-l border-white/[0.04] shadow-[-50px_0_120px_rgba(0,0,0,0.9)] transition-all duration-500 ease-out z-40 ${
                          isChatOpen
                            ? "translate-x-0 opacity-100"
                            : "translate-x-full opacity-0 pointer-events-none"
                        }`}
                        style={{ width: "580px" }}
                      >
                        {isChatOpen && userProfile && activeNote && (
                          <ChatInterface
                            contextMarkdown={activeNote.markdownContent}
                            userProfile={userProfile}
                            graphNodes={activeNote.graphData.nodes}
                            noteTitle={activeNote.title}
                            noteId={activeNote.id}
                            initialSelection={selectedText}
                            onClose={() => {
                              setIsChatOpen(false);
                              setSelectedText(null);
                            }}
                            onClearSelection={handleClearSelection}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* MODE: NEURAL WEB (FULL SCREEN) */}
                {activeTab === "graph" && (
                  <div className="flex-1 flex flex-col relative animate-[fadeIn_0.3s_ease-out] bg-[#030406]">
                    {/* Toolbar */}
                    <div className="h-14 border-b border-white/[0.04] flex items-center px-6 bg-[#030406] gap-6 justify-between shrink-0 z-20">
                      <div className="flex gap-3">
                        <button
                          onClick={() => setActiveTab("guide")}
                          className="px-5 py-2 rounded-xl text-xs font-sans font-medium tracking-wide text-gray-500 hover:text-serum-white transition-all hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]"
                        >
                          Study Guide
                        </button>
                        <button
                          onClick={() => setActiveTab("graph")}
                          className="px-5 py-2 rounded-xl text-xs font-sans font-medium tracking-wide bg-vital-cyan/10 text-vital-cyan border border-vital-cyan/20 transition-all shadow-[0_0_15px_rgba(42,212,212,0.15)]"
                        >
                          Topic Map
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 relative bg-transparent overflow-hidden">
                      {/* Atmospheric glow */}
                      <div className="absolute inset-0 bg-gradient-to-br from-vital-cyan/[0.02] via-transparent to-neural-purple/[0.02] pointer-events-none" />

                      {/* 🆕 Show warning banner if markdown is still generating */}
                      {!isMarkdownComplete &&
                        status === ProcessingStatus.WRITING_GUIDE && (
                          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 animate-[fadeIn_0.3s_ease-out]">
                            <div className="flex items-center gap-3 px-6 py-3 glass-slide border border-synapse-amber/20 rounded-2xl shadow-2xl">
                              <div className="flex gap-1">
                                {[0, 1, 2].map((i) => (
                                  <div
                                    key={i}
                                    className="w-1.5 h-1.5 bg-synapse-amber rounded-full animate-bounce"
                                    style={{ animationDelay: `${i * 0.15}s` }}
                                  />
                                ))}
                              </div>
                              <span className="text-sm text-synapse-amber font-sans font-medium">
                                Study Guide is being created...
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">
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
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 glass-slide border border-white/[0.06] px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-[fadeInUp_0.5s_ease-out_1s_both] pointer-events-none">
                          <div className="w-2.5 h-2.5 rounded-full bg-vital-cyan animate-pulse shadow-[0_0_15px_rgba(42,212,212,0.5)]"></div>
                          <span className="text-xs font-sans font-medium text-gray-200 tracking-wide">
                            {!isMarkdownComplete &&
                            status === ProcessingStatus.WRITING_GUIDE
                              ? "Graph ready • Guide still synthesizing in background"
                              : "Select a topic to explore detailed information"}
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
    </>
  );
};

export default App;
