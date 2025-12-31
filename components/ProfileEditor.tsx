import React, { useState, useRef, useEffect } from "react";
import {
  UserProfile,
  ClinicalDiscipline,
  TrainingLevel,
  TeachingStyle,
  ExamGoal,
} from "../types";
import {
  Stethoscope,
  User,
  Cake,
  Save,
  X,
  Camera,
  Activity,
  Pill,
  HeartPulse,
  MessageCircle,
  Zap,
  BookOpen,
  Lightbulb,
  Trash2,
  Target,
  Key,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  Heart,
  Coffee,
  Lock,
  Sparkles,
  ArrowRight,
  Brain,
} from "lucide-react";
import { GeminiService } from "../services/geminiService";
import { isSpecialName } from "../utils/specialNameUtils";

interface Props {
  profile: UserProfile;
  onSave: (profile: UserProfile) => void;
  onClose: () => void;
}

const DISCIPLINES: { label: ClinicalDiscipline; icon: any; color: string }[] = [
  { label: "Medical (MD/DO)", icon: Stethoscope, color: "cyan" },
  { label: "Nursing", icon: HeartPulse, color: "rose" },
  { label: "Pharmacy", icon: Pill, color: "purple" },
  { label: "Physiotherapy", icon: Activity, color: "teal" },
  { label: "Dentistry", icon: User, color: "emerald" },
  { label: "Other", icon: User, color: "amber" },
];

const LEVELS: { label: TrainingLevel; description: string }[] = [
  { label: "Student (Pre-clinical)", description: "Foundational sciences" },
  { label: "Student (Clinical)", description: "Clinical rotations" },
  { label: "Intern/Resident", description: "Postgraduate training" },
  { label: "Professional", description: "Practicing clinician" },
];

const TEACHING_STYLES: {
  label: TeachingStyle;
  icon: any;
  description: string;
  color: string;
}[] = [
  {
    label: "Socratic",
    icon: MessageCircle,
    description: "Discovery-based questions",
    color: "cyan",
  },
  {
    label: "Concise",
    icon: Zap,
    description: "Rapid, bullet-point facts",
    color: "amber",
  },
  {
    label: "Detailed",
    icon: BookOpen,
    description: "Comprehensive explanations",
    color: "teal",
  },
  {
    label: "Clinical-Cases",
    icon: Lightbulb,
    description: "Patient scenario learning",
    color: "rose",
  },
  {
    label: "Custom",
    icon: Target,
    description: "Describe your own style",
    color: "purple",
  },
];

// Exam goals for personalized quiz generation
const EXAM_GOALS: {
  label: ExamGoal;
  description: string;
  disciplines: ClinicalDiscipline[];
}[] = [
  {
    label: "USMLE Step 1",
    description: "Basic sciences",
    disciplines: ["Medical (MD/DO)"],
  },
  {
    label: "USMLE Step 2 CK",
    description: "Clinical knowledge",
    disciplines: ["Medical (MD/DO)"],
  },
  {
    label: "USMLE Step 3",
    description: "Clinical practice",
    disciplines: ["Medical (MD/DO)"],
  },
  {
    label: "COMLEX",
    description: "Osteopathic boards",
    disciplines: ["Medical (MD/DO)"],
  },
  {
    label: "NCLEX-RN",
    description: "Registered nurse",
    disciplines: ["Nursing"],
  },
  {
    label: "NCLEX-PN",
    description: "Practical nurse",
    disciplines: ["Nursing"],
  },
  {
    label: "NAPLEX",
    description: "Pharmacy licensure",
    disciplines: ["Pharmacy"],
  },
  {
    label: "PANCE/PANRE",
    description: "PA certification",
    disciplines: ["Medical (MD/DO)", "Other"],
  },
  {
    label: "MCAT",
    description: "Med school admission",
    disciplines: ["Medical (MD/DO)", "Other"],
  },
  {
    label: "University Semester Exam",
    description: "College/University exams",
    disciplines: [
      "Medical (MD/DO)",
      "Nursing",
      "Pharmacy",
      "Physiotherapy",
      "Dentistry",
      "Other",
    ],
  },
  {
    label: "Board Certification",
    description: "Specialty boards",
    disciplines: [
      "Medical (MD/DO)",
      "Nursing",
      "Pharmacy",
      "Physiotherapy",
      "Dentistry",
      "Other",
    ],
  },
  {
    label: "Clinical Competency",
    description: "Skills assessment",
    disciplines: [
      "Medical (MD/DO)",
      "Nursing",
      "Pharmacy",
      "Physiotherapy",
      "Dentistry",
      "Other",
    ],
  },
  {
    label: "General Knowledge",
    description: "No specific exam",
    disciplines: [
      "Medical (MD/DO)",
      "Nursing",
      "Pharmacy",
      "Physiotherapy",
      "Dentistry",
      "Other",
    ],
  },
  {
    label: "Custom",
    description: "Specify your own goal",
    disciplines: [
      "Medical (MD/DO)",
      "Nursing",
      "Pharmacy",
      "Physiotherapy",
      "Dentistry",
      "Other",
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SPECIAL NAME STYLING - For Akshaya ♡
// ═══════════════════════════════════════════════════════════════════════════
// isSpecialName is imported from ../utils/specialNameUtils

const StyledNameDisplay: React.FC<{ name: string }> = ({ name }) => {
  if (isSpecialName(name)) {
    return (
      <span className="relative inline-block">
        <span className="font-serif italic text-tissue-rose bg-gradient-to-r from-tissue-rose via-pink-400 to-tissue-rose bg-clip-text text-transparent drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]">
          {name}
        </span>
        <span className="absolute -top-1 -right-4 text-tissue-rose/60 text-xs">
          ♡
        </span>
      </span>
    );
  }
  return <span>{name}</span>;
};

export const ProfileEditor: React.FC<Props> = ({
  profile,
  onSave,
  onClose,
}) => {
  const [editedProfile, setEditedProfile] = useState<UserProfile>({
    ...profile,
  });
  const [activeTab, setActiveTab] = useState<
    "identity" | "preferences" | "learning" | "settings"
  >("identity");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tabHoverIndex, setTabHoverIndex] = useState<number | null>(null);

  // API Key state
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyValidationResult, setKeyValidationResult] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);

  // Validate API key
  const handleValidateApiKey = async () => {
    if (!editedProfile.apiKey || !editedProfile.apiKey.startsWith("AIza")) {
      setKeyValidationResult({
        valid: false,
        error: "Please enter a valid API key starting with 'AIza'",
      });
      return;
    }

    setIsValidatingKey(true);
    setKeyValidationResult(null);

    try {
      const gemini = new GeminiService();
      const result = await gemini.validateApiKey(editedProfile.apiKey);
      setKeyValidationResult(result);
    } catch (error: any) {
      setKeyValidationResult({
        valid: false,
        error: error.message || "Validation failed",
      });
    } finally {
      setIsValidatingKey(false);
    }
  };

  // Handle profile picture upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image too large. Max 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setEditedProfile({
          ...editedProfile,
          profilePicture: ev.target?.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setEditedProfile({ ...editedProfile, profilePicture: undefined });
  };

  const handleSave = () => {
    if (!editedProfile.name.trim()) {
      alert("Name is required.");
      return;
    }
    onSave({
      ...editedProfile,
      updatedAt: Date.now(),
    });
  };

  const tabs = [
    { id: "identity", label: "Identity", icon: User },
    { id: "preferences", label: "Preferences", icon: Activity },
    { id: "learning", label: "Learning Style", icon: BookOpen },
    { id: "settings", label: "API Key", icon: Key },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xl overflow-y-auto overflow-x-hidden py-6">
      {/* Outer glow effect */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-vital-cyan/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-tissue-rose/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-3xl rounded-3xl glass-slide border border-white/[0.08] overflow-hidden">
        {/* PREMIUM HEADER */}
        <div className="sticky top-0 z-20 px-8 py-6 border-b border-white/[0.04] bg-gradient-to-b from-white/[0.02] to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-vital-cyan/20 to-vital-cyan/5 flex items-center justify-center border border-vital-cyan/20">
                <User className="w-5 h-5 text-vital-cyan" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-serum-white tracking-tight">
                  Profile Settings
                </h2>
                <p className="text-xs text-clinical-text/50 mt-0.5">
                  Personalize your learning experience
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl hover:bg-white/[0.08] transition-all duration-300 group"
            >
              <X className="w-5 h-5 text-clinical-text/60 group-hover:text-clinical-text" />
            </button>
          </div>
        </div>

        {/* TAB NAVIGATION - Asymmetrical, Editorial */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex gap-2 rounded-xl p-1.5 bg-white/[0.02] border border-white/[0.05]">
            {tabs.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onMouseEnter={() => setTabHoverIndex(idx)}
                  onMouseLeave={() => setTabHoverIndex(null)}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-500 ease-out relative group ${
                    isActive
                      ? "bg-gradient-to-r from-vital-cyan/30 to-vital-cyan/10 text-vital-cyan shadow-lg shadow-vital-cyan/10"
                      : "text-clinical-text/60 hover:text-clinical-text/80"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 bg-gradient-to-r from-transparent via-vital-cyan to-transparent" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="px-8 py-8 space-y-8 overflow-y-auto max-h-[calc(100vh-300px)]">
          {/* Identity Tab */}
          {activeTab === "identity" && (
            <div className="space-y-8">
              {/* Profile Picture - Premium Card */}
              <div className="group">
                <div className="flex flex-col items-center gap-6">
                  <div className="relative">
                    <div
                      className={`w-32 h-32 rounded-2xl overflow-hidden cursor-pointer relative transition-all duration-500 ${
                        editedProfile.profilePicture
                          ? "border-2 border-vital-cyan/30 shadow-lg shadow-vital-cyan/10"
                          : "border-2 border-dashed border-white/[0.1] hover:border-vital-cyan/50"
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {editedProfile.profilePicture ? (
                        <>
                          <img
                            src={editedProfile.profilePicture}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                            <span className="text-xs text-white font-medium">
                              Click to change
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-white/[0.03] to-white/[0.01]">
                          <Camera className="w-8 h-8 text-vital-cyan/60 mb-2" />
                          <span className="text-xs text-clinical-text/40 text-center px-2">
                            Add photo
                          </span>
                        </div>
                      )}
                    </div>
                    {editedProfile.profilePicture && (
                      <button
                        onClick={handleRemovePhoto}
                        className="absolute -top-2 -right-2 p-2 rounded-lg bg-tissue-rose/90 hover:bg-tissue-rose transition-all duration-300 shadow-lg"
                      >
                        <Trash2 className="w-4 h-4 text-white" />
                      </button>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-clinical-text/50 text-center">
                      Max 5MB • JPG, PNG supported
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {/* Name Input - Premium Field with special styling for Akshaya */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-serum-white flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSpecialName(editedProfile.name)
                        ? "bg-tissue-rose animate-pulse"
                        : "bg-vital-cyan"
                    }`}
                  />
                  Display Name
                  {isSpecialName(editedProfile.name) && (
                    <span className="text-tissue-rose/60 text-xs ml-1">♡</span>
                  )}
                </label>
                <input
                  type="text"
                  value={editedProfile.name}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile, name: e.target.value })
                  }
                  className={`w-full px-5 py-3.5 rounded-xl glass-panel placeholder:text-clinical-text/30 focus:outline-none transition-all duration-500 ease-out font-serif italic ${
                    isSpecialName(editedProfile.name)
                      ? "text-tissue-rose border-tissue-rose/40 focus:border-tissue-rose/70 focus:shadow-[0_0_16px_rgba(244,114,182,0.25)]"
                      : "text-serum-white focus:border-vital-cyan focus:shadow-lg focus:shadow-vital-cyan/10"
                  }`}
                  placeholder="Your name"
                />
                {isSpecialName(editedProfile.name) && (
                  <p className="text-[10px] text-tissue-rose/60 italic font-serif">
                    ✨ Made with love for you
                  </p>
                )}
              </div>

              {/* Birthday Input - Premium Field */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-serum-white flex items-center gap-2">
                  <Cake className="w-4 h-4 text-synapse-amber" />
                  Birthday
                </label>
                <input
                  type="date"
                  value={editedProfile.birthday || ""}
                  onChange={(e) =>
                    setEditedProfile({
                      ...editedProfile,
                      birthday: e.target.value,
                    })
                  }
                  className="w-full px-5 py-3.5 rounded-xl glass-panel text-serum-white focus:border-vital-cyan focus:outline-none transition-all duration-300 focus:shadow-lg focus:shadow-vital-cyan/10"
                />
              </div>

              {/* Mission Statement - Inspirational Card */}
              <div className="relative p-6 rounded-2xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-tissue-rose/8 via-tissue-rose/3 to-transparent">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-tissue-rose/5 rounded-full blur-3xl" />
                <div className="relative z-10 flex items-start gap-4">
                  <Heart
                    size={20}
                    fill="currentColor"
                    className="text-tissue-rose/90 mt-1 flex-shrink-0"
                  />
                  <div className="space-y-2">
                    <p className="text-sm italic text-tissue-rose/90 leading-relaxed font-medium">
                      "I created Synapse to empower medical students and
                      healthcare professionals with AI-driven learning tools. It
                      began as a heartfelt project to support a special
                      physiotherapy student close to my heart through her
                      rigorous curriculum. As a student developer without
                      external funding, I open-sourced it so everyone can
                      benefit from AI-powered clinical learning."
                    </p>
                    <p className="text-xs text-clinical-text/40">
                      Your API key connects you to Google's Gemini AI, enabling
                      personalized study guides, knowledge graphs, and clinical
                      insights. If you find value in Synapse, consider
                      supporting future development through donations.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === "preferences" && (
            <div className="space-y-8">
              {/* Discipline Selection - Premium Grid */}
              <div className="space-y-4">
                <label className="text-sm font-semibold text-serum-white flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-vital-cyan" />
                  Clinical Discipline
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {DISCIPLINES.map((d) => {
                    const DIcon = d.icon;
                    const isSelected = editedProfile.discipline === d.label;
                    return (
                      <button
                        key={d.label}
                        onClick={() =>
                          setEditedProfile({
                            ...editedProfile,
                            discipline: d.label,
                          })
                        }
                        className={`p-4 rounded-xl border transition-all duration-300 group ${
                          isSelected
                            ? `border-vital-cyan/50 bg-vital-cyan/15 shadow-lg shadow-vital-cyan/10`
                            : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg transition-all duration-300 ${
                              isSelected
                                ? "bg-vital-cyan/20"
                                : "bg-white/[0.05] group-hover:bg-white/[0.08]"
                            }`}
                          >
                            <DIcon
                              className={`w-5 h-5 ${
                                isSelected
                                  ? "text-vital-cyan"
                                  : "text-clinical-text/50 group-hover:text-clinical-text/70"
                              }`}
                            />
                          </div>
                          <span
                            className={`text-sm font-medium text-left ${
                              isSelected
                                ? "text-vital-cyan"
                                : "text-clinical-text/70"
                            }`}
                          >
                            {d.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Training Level - Gradient Buttons */}
              <div className="space-y-4">
                <label className="text-sm font-semibold text-serum-white flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-synapse-amber" />
                  Training Level
                </label>
                <div className="space-y-2.5">
                  {LEVELS.map((l) => {
                    const isSelected = editedProfile.level === l.label;
                    return (
                      <button
                        key={l.label}
                        onClick={() =>
                          setEditedProfile({
                            ...editedProfile,
                            level: l.label,
                          })
                        }
                        className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300 group ${
                          isSelected
                            ? "border-synapse-amber/50 bg-gradient-to-r from-synapse-amber/15 to-synapse-amber/5 shadow-lg shadow-synapse-amber/10"
                            : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                        }`}
                      >
                        <span
                          className={`text-sm font-medium ${
                            isSelected
                              ? "text-synapse-amber"
                              : "text-clinical-text/70"
                          }`}
                        >
                          {l.label}
                        </span>
                        <span className="text-xs text-clinical-text/40">
                          {l.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Specialties Input */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-serum-white flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-neural-purple" />
                  Specialties
                </label>
                <input
                  type="text"
                  value={editedProfile.specialties?.join(", ") || ""}
                  onChange={(e) =>
                    setEditedProfile({
                      ...editedProfile,
                      specialties: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                  className="w-full px-5 py-3.5 rounded-xl glass-panel text-serum-white placeholder:text-clinical-text/30 focus:border-vital-cyan focus:outline-none transition-all duration-300 focus:shadow-lg focus:shadow-vital-cyan/10"
                  placeholder="e.g., Cardiology, Nephrology, Neurology"
                />
              </div>
            </div>
          )}

          {/* Learning Style Tab */}
          {activeTab === "learning" && (
            <div className="space-y-8">
              {/* Target Exam / Goal */}
              <div className="space-y-4">
                <label className="text-sm font-semibold text-serum-white flex items-center gap-2">
                  <Target className="w-4 h-4 text-synapse-amber" />
                  Target Exam / Goal
                </label>
                <div className="grid grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-2">
                  {EXAM_GOALS.filter(
                    (eg) =>
                      eg.disciplines.includes(
                        editedProfile.discipline || "Medical (MD/DO)"
                      ) ||
                      eg.label === "General Knowledge" ||
                      eg.label === "Custom"
                  ).map((eg) => {
                    const isSelected = editedProfile.examGoal === eg.label;
                    return (
                      <button
                        key={eg.label}
                        onClick={() =>
                          setEditedProfile({
                            ...editedProfile,
                            examGoal: eg.label,
                          })
                        }
                        className={`p-3.5 rounded-xl border transition-all duration-300 text-left group ${
                          isSelected
                            ? "border-synapse-amber/50 bg-synapse-amber/15 shadow-lg shadow-synapse-amber/10"
                            : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                        }`}
                      >
                        <div
                          className={`text-xs font-semibold ${
                            isSelected
                              ? "text-synapse-amber"
                              : "text-clinical-text/70"
                          }`}
                        >
                          {eg.label}
                        </div>
                        <div className="text-[11px] text-clinical-text/40 mt-1">
                          {eg.description}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Exam Goal Input */}
                {editedProfile.examGoal === "Custom" && (
                  <input
                    type="text"
                    value={editedProfile.customExamGoal || ""}
                    onChange={(e) =>
                      setEditedProfile({
                        ...editedProfile,
                        customExamGoal: e.target.value,
                      })
                    }
                    className="w-full px-5 py-3.5 rounded-xl glass-panel text-serum-white placeholder:text-clinical-text/30 focus:border-synapse-amber focus:outline-none transition-all duration-300 focus:shadow-lg focus:shadow-synapse-amber/10"
                    placeholder="e.g., MBBS Finals, Nursing State Board..."
                  />
                )}
              </div>

              {/* Teaching Style - Premium Cards */}
              <div className="space-y-4">
                <label className="text-sm font-semibold text-serum-white flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-neural-purple" />
                  Preferred Teaching Style
                </label>
                <div className="grid gap-3">
                  {TEACHING_STYLES.map((style) => {
                    const StyleIcon = style.icon;
                    const isSelected =
                      editedProfile.teachingStyle === style.label;
                    return (
                      <button
                        key={style.label}
                        onClick={() =>
                          setEditedProfile({
                            ...editedProfile,
                            teachingStyle: style.label,
                          })
                        }
                        className={`flex items-center gap-4 p-4 rounded-xl border transition-all duration-300 group ${
                          isSelected
                            ? `border-neural-purple/50 bg-neural-purple/15 shadow-lg shadow-neural-purple/10`
                            : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                        }`}
                      >
                        <div
                          className={`p-3 rounded-lg transition-all duration-300 ${
                            isSelected
                              ? "bg-neural-purple/20"
                              : "bg-white/[0.05] group-hover:bg-white/[0.08]"
                          }`}
                        >
                          <StyleIcon
                            className={`w-5 h-5 ${
                              isSelected
                                ? "text-neural-purple"
                                : "text-clinical-text/50 group-hover:text-clinical-text/70"
                            }`}
                          />
                        </div>
                        <div className="text-left flex-1">
                          <div
                            className={`text-sm font-semibold ${
                              isSelected
                                ? "text-neural-purple"
                                : "text-clinical-text/80"
                            }`}
                          >
                            {style.label}
                          </div>
                          <div className="text-xs text-clinical-text/50 mt-0.5">
                            {style.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Teaching Style Input */}
                {editedProfile.teachingStyle === "Custom" && (
                  <textarea
                    value={editedProfile.customTeachingStyle || ""}
                    onChange={(e) =>
                      setEditedProfile({
                        ...editedProfile,
                        customTeachingStyle: e.target.value,
                      })
                    }
                    className="w-full px-5 py-3.5 rounded-xl glass-panel text-serum-white placeholder:text-clinical-text/30 focus:border-neural-purple focus:outline-none transition-all duration-300 focus:shadow-lg focus:shadow-neural-purple/10 resize-none"
                    rows={3}
                    placeholder="Describe your ideal learning experience..."
                  />
                )}
              </div>

              {/* Learning Goals */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-serum-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-synapse-amber" />
                  Learning Goals
                </label>
                <textarea
                  value={editedProfile.learningGoals || ""}
                  onChange={(e) =>
                    setEditedProfile({
                      ...editedProfile,
                      learningGoals: e.target.value,
                    })
                  }
                  className="w-full px-5 py-3.5 rounded-xl glass-panel text-serum-white placeholder:text-clinical-text/30 focus:border-synapse-amber focus:outline-none transition-all duration-300 focus:shadow-lg focus:shadow-synapse-amber/10 resize-none"
                  rows={4}
                  placeholder="What are you hoping to achieve? (e.g., Pass USMLE Step 1, Master cardiology rotations)"
                />
              </div>
            </div>
          )}

          {/* Settings Tab - API Key */}
          {activeTab === "settings" && (
            <div className="space-y-8">
              {/* Neural Link Header */}
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-vital-cyan/20 to-vital-cyan/5 flex items-center justify-center border border-vital-cyan/20">
                    <Brain className="w-5 h-5 text-vital-cyan" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-serum-white">
                      Neural Link Setup
                    </h3>
                    <p className="text-xs text-clinical-text/50 mt-0.5">
                      Connect to Google Gemini API for personalized tutoring
                    </p>
                  </div>
                </div>
              </div>

              {/* Steps Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-serum-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-vital-cyan" />
                  Getting Your API Key
                </h4>

                <div className="space-y-3">
                  {/* Step 1 */}
                  <div className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-vital-cyan/10 border border-vital-cyan/20 flex items-center justify-center text-vital-cyan font-mono text-xs font-bold">
                      1
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-200">
                        Go to{" "}
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-vital-cyan hover:underline inline-flex items-center gap-1"
                        >
                          Google AI Studio
                          <ExternalLink size={10} />
                        </a>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        You'll need a free Google account (Gmail works)
                      </div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-vital-cyan/10 border border-vital-cyan/20 flex items-center justify-center text-vital-cyan font-mono text-xs font-bold">
                      2
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-200">
                        Click "Create API Key"
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        Select "Create new secret key in existing project" (or
                        create a new project)
                      </div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-vital-cyan/10 border border-vital-cyan/20 flex items-center justify-center text-vital-cyan font-mono text-xs font-bold">
                      3
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-200">
                        Copy the API key
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        It starts with{" "}
                        <code className="bg-black/20 px-1.5 py-0.5 rounded text-[9px] font-mono">
                          AIza
                        </code>
                      </div>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                    <div className="shrink-0 w-8 h-8 rounded-full bg-vital-cyan/10 border border-vital-cyan/20 flex items-center justify-center text-vital-cyan font-mono text-xs font-bold">
                      4
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-200">
                        Paste it below
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        We'll verify it works, then you're ready to launch
                        Synapse
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* API Key Input - Premium Field */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-serum-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-neural-purple" />
                  API Key
                </label>
                <div className="relative group">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={editedProfile.apiKey || ""}
                    onChange={(e) => {
                      setEditedProfile({
                        ...editedProfile,
                        apiKey: e.target.value,
                      });
                      setKeyValidationResult(null);
                    }}
                    className={`w-full px-5 py-3.5 pr-12 rounded-xl text-serum-white font-mono text-sm placeholder:text-clinical-text/30 focus:outline-none transition-all duration-500 ease-out ${
                      keyValidationResult?.valid === false
                        ? "glass-panel border-tissue-rose/50 focus:border-tissue-rose shadow-lg shadow-tissue-rose/10"
                        : keyValidationResult?.valid === true
                        ? "glass-panel border-green-500/50 focus:border-green-500 shadow-lg shadow-green-500/10"
                        : "glass-panel focus:border-vital-cyan focus:shadow-lg focus:shadow-vital-cyan/10"
                    }`}
                    placeholder="AIza..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-12 top-1/2 -translate-y-1/2 p-1.5 text-clinical-text/40 hover:text-clinical-text transition-colors"
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  {keyValidationResult?.valid === true && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="p-1 rounded-lg bg-green-500/20">
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                      </div>
                    </div>
                  )}
                  {keyValidationResult?.valid === false && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="p-1 rounded-lg bg-tissue-rose/20">
                        <AlertCircle className="w-5 h-5 text-tissue-rose" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Validation Messages */}
              {keyValidationResult?.valid === false && (
                <div className="p-4 rounded-xl bg-tissue-rose/10 border border-tissue-rose/30 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-tissue-rose flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-tissue-rose">
                      Verification failed
                    </p>
                    <p className="text-xs text-tissue-rose/70 mt-1">
                      {keyValidationResult.error}
                    </p>
                  </div>
                </div>
              )}

              {keyValidationResult?.valid === true && (
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-400">
                      API key verified
                    </p>
                    <p className="text-xs text-green-300/70 mt-1">
                      Your key is valid and connected to your Google account
                    </p>
                  </div>
                </div>
              )}

              {/* Verify Button */}
              <button
                onClick={handleValidateApiKey}
                disabled={!editedProfile.apiKey || isValidatingKey}
                className="w-full py-3.5 bg-gradient-to-r from-vital-cyan/30 to-vital-cyan/10 hover:from-vital-cyan/40 hover:to-vital-cyan/20 text-vital-cyan rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed border border-vital-cyan/20 hover:border-vital-cyan/40"
              >
                {isValidatingKey ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Verify API Key
                  </>
                )}
              </button>

              {/* Security & Privacy Card */}
              <div className="relative p-5 rounded-xl border border-green-500/20 bg-gradient-to-br from-green-500/8 to-green-500/2 overflow-hidden">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-green-500/5 rounded-full blur-3xl" />
                <div className="relative z-10 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-green-400/80 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-serum-white">
                      Your data is completely private
                    </p>
                    <p className="text-xs text-clinical-text/60 leading-relaxed">
                      Your API key lives{" "}
                      <span className="text-vital-cyan font-medium">
                        only on your device
                      </span>
                      , encrypted in your browser's IndexedDB. It's never sent
                      to any server. You're in complete control.
                    </p>
                  </div>
                </div>
              </div>

              {/* Free Tier Benefits */}
              <div className="relative p-5 rounded-xl border border-synapse-amber/20 bg-gradient-to-br from-synapse-amber/8 to-synapse-amber/2 overflow-hidden">
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-synapse-amber/5 rounded-full blur-3xl" />
                <div className="relative z-10 flex items-start gap-3">
                  <Zap className="w-5 h-5 text-synapse-amber/80 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-serum-white">
                      Free Tier Limits
                    </p>
                    <p className="text-xs text-clinical-text/60 leading-relaxed">
                      Google's free plan allows{" "}
                      <span className="font-semibold text-synapse-amber">
                        15 requests/minute
                      </span>{" "}
                      and{" "}
                      <span className="font-semibold text-synapse-amber">
                        1M tokens/day
                      </span>
                      . Perfect for personal study and practice.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PREMIUM FOOTER */}
        <div className="sticky bottom-0 z-20 px-8 py-5 border-t border-white/[0.04] bg-gradient-to-t from-white/[0.02] to-transparent backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-clinical-text/50">
              <Lock className="w-3.5 h-3.5" />
              Saved locally on your device
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl border border-white/[0.1] text-clinical-text/70 hover:text-clinical-text hover:border-white/[0.2] transition-all duration-300 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-vital-cyan/90 to-vital-cyan/70 hover:from-vital-cyan hover:to-vital-cyan/80 text-bio-void font-semibold transition-all duration-300 shadow-lg shadow-vital-cyan/20 text-sm"
              >
                <Save className="w-4 h-4" />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
