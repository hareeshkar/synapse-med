import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
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
  ArrowRight,
  ArrowLeft,
  Check,
  Activity,
  Pill,
  HeartPulse,
  Camera,
  MessageCircle,
  Zap,
  BookOpen,
  Lightbulb,
  X,
  Target,
  GraduationCap,
  Key,
  ShieldCheck,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Heart,
  Coffee,
  Cpu,
} from "lucide-react";
import BioBackground from "./BioBackground";
import { GeminiService } from "../services/geminiService";
import { isSpecialName, AKSHAYA_BIRTHDAY } from "../utils/specialNameUtils";

interface Props {
  onComplete: (profile: UserProfile) => void;
  existingProfile?: UserProfile | null;
  onCancel?: () => void;
  mode?: "onboarding" | "edit";
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
  {
    label: "Student (Pre-clinical)",
    description: "Focus on foundational sciences",
  },
  { label: "Student (Clinical)", description: "Rotations & clinical exposure" },
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
    description: "Questions that guide your discovery",
    color: "cyan",
  },
  {
    label: "Concise",
    icon: Zap,
    description: "Rapid facts, bullet points, efficiency",
    color: "amber",
  },
  {
    label: "Detailed",
    icon: BookOpen,
    description: "Deep explanations, comprehensive coverage",
    color: "teal",
  },
  {
    label: "Clinical-Cases",
    icon: Lightbulb,
    description: "Learn through patient scenarios",
    color: "rose",
  },
  {
    label: "Custom",
    icon: Target,
    description: "Describe your preferred style",
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
    description: "Medical school admission",
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

const StyledName: React.FC<{ name: string; className?: string }> = ({
  name,
  className = "",
}) => {
  if (isSpecialName(name)) {
    const firstName = name.split(" ")[0];
    return (
      <span className={`relative inline-block pr-3 ${className}`}>
        <span className="font-serif italic text-tissue-rose bg-gradient-to-r from-tissue-rose via-pink-400 to-tissue-rose bg-clip-text text-transparent animate-pulse drop-shadow-[0_0_8px_rgba(244,114,182,0.6)]">
          {firstName}
        </span>
        <span className="absolute -top-1 right-0 text-tissue-rose/60 text-[10px]">
          ♡
        </span>
      </span>
    );
  }
  return <span className={className}>{name.split(" ")[0]}</span>;
};

const Onboarding: React.FC<Props> = ({
  onComplete,
  existingProfile,
  onCancel,
  mode = "onboarding",
}) => {
  const [step, setStep] = useState(1);
  const totalSteps = 5; // Added API key step
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Akshaya name detection with animation trigger
  const [isAkshayaDetected, setIsAkshayaDetected] = useState(false);
  const [prevName, setPrevName] = useState("");

  // API Key validation state
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyValidationResult, setKeyValidationResult] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);

  const [profile, setProfile] = useState<Partial<UserProfile>>({
    apiKey: existingProfile?.apiKey || "",
    discipline: existingProfile?.discipline || "Medical (MD/DO)",
    level: existingProfile?.level || "Student (Clinical)",
    teachingStyle: existingProfile?.teachingStyle || "Detailed",
    examGoal: existingProfile?.examGoal || undefined,
    customTeachingStyle: existingProfile?.customTeachingStyle || "",
    customExamGoal: existingProfile?.customExamGoal || "",
    theme: existingProfile?.theme || "obsidian",
    name: existingProfile?.name || "",
    birthday: existingProfile?.birthday || "",
    profilePicture: existingProfile?.profilePicture || "",
    specialties: existingProfile?.specialties || [],
    learningGoals: existingProfile?.learningGoals || "",
  });

  const [specialtyInput, setSpecialtyInput] = useState("");

  const handleNext = () => setStep((p) => Math.min(p + 1, totalSteps));
  const handleBack = () => setStep((p) => Math.max(p - 1, 1));

  const handleSubmit = () => {
    // Only name is required - other fields are optional
    if (profile.name) {
      const now = Date.now();
      onComplete({
        ...profile,
        createdAt: existingProfile?.createdAt || now,
        updatedAt: now,
      } as UserProfile);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image too large. Please use an image under 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string;
        setProfile({ ...profile, profilePicture: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const addSpecialty = () => {
    if (
      specialtyInput.trim() &&
      !profile.specialties?.includes(specialtyInput.trim())
    ) {
      setProfile({
        ...profile,
        specialties: [...(profile.specialties || []), specialtyInput.trim()],
      });
      setSpecialtyInput("");
    }
  };

  const removeSpecialty = (s: string) => {
    setProfile({
      ...profile,
      specialties: profile.specialties?.filter((sp) => sp !== s) || [],
    });
  };

  // Detect Akshaya name - trigger cinematic animation and auto-set birthday ♡
  useEffect(() => {
    const currentName = profile.name || "";
    const wasSpecial = isSpecialName(prevName);
    const isNowSpecial = isSpecialName(currentName);

    if (!wasSpecial && isNowSpecial && !isAkshayaDetected) {
      // Name just changed to Akshaya — trigger animation & auto-set birthday
      setIsAkshayaDetected(true);
      // Auto-set Akshaya's birthday - a little touch that says "I know you" ♡
      if (!profile.birthday) {
        setProfile((prev) => ({ ...prev, birthday: AKSHAYA_BIRTHDAY }));
      }
    } else if (!isNowSpecial && isAkshayaDetected) {
      // Name is no longer Akshaya
      setIsAkshayaDetected(false);
    }
    setPrevName(currentName);
  }, [profile.name, prevName, isAkshayaDetected, profile.birthday]);

  const isEditMode = mode === "edit";

  return (
    <>
      {/* Render BioBackground to dedicated container */}
      {ReactDOM.createPortal(
        <BioBackground />,
        document.getElementById("bio-background-root") || document.body
      )}

      {/* Cinematic Akshaya Detection Animation Overlay */}
      {isAkshayaDetected && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <style>{`
            @keyframes cinematicFadeIn {
              0% {
                opacity: 0;
                background: rgba(0, 0, 0, 0);
                backdrop-filter: blur(0px);
              }
              40% {
                opacity: 0.6;
                background: rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(10px);
              }
              100% {
                opacity: 0;
                background: rgba(0, 0, 0, 0);
                backdrop-filter: blur(0px);
              }
            }
            
            @keyframes glowPulse {
              0% {
                box-shadow: 0 0 0 0 rgba(244, 114, 182, 0.4);
                opacity: 0;
              }
              50% {
                opacity: 1;
              }
              100% {
                box-shadow: 0 0 60px 30px rgba(244, 114, 182, 0);
                opacity: 0;
              }
            }
            
            .akshaya-fade {
              animation: cinematicFadeIn 2.5s cubic-bezier(0.4, 0, 0.6, 1) forwards;
            }
            
            .akshaya-glow {
              animation: glowPulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) forwards;
            }
          `}</style>
          <div className="akshaya-fade absolute inset-0" />
          <div className="akshaya-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full pointer-events-none" />
        </div>
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent text-serum-white overflow-hidden">
        <div className="relative w-full max-w-xl mx-6 z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xs font-serif tracking-[0.3em] text-gray-200">
                {isEditMode ? "Edit Profile" : "SYNAPSE MED"}
              </h1>
            </div>
            {isEditMode && onCancel && (
              <button
                onClick={onCancel}
                className="p-2.5 rounded-xl glass-slide hover:bg-white/[0.04] transition-all duration-300"
              >
                <X size={18} className="text-gray-200" />
              </button>
            )}
          </div>

          {/* Progress Bar - Asymmetric */}
          <div className="flex gap-1.5 mb-10">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-0.5 rounded-full transition-all duration-700 ${
                  i === 0
                    ? "flex-[2]"
                    : i === totalSteps - 1
                    ? "flex-[1.5]"
                    : "flex-1"
                } ${
                  step > i
                    ? "bg-vital-cyan shadow-[0_0_10px_rgba(42,212,212,0.5)]"
                    : "bg-white/[0.06]"
                }`}
              />
            ))}
          </div>

          <div className="glass-slide border border-white/[0.06] p-8 rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto custom-scrollbar">
            {/* STEP 1: API KEY (BYOK) - first step */}
            {step === 1 && <></>}

            {/* STEP 2: IDENTITY & PHOTO */}
            {step === 2 && (
              <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">
                <div>
                  <p className="text-[10px] font-mono tracking-[0.2em] text-vital-cyan mb-2">
                    Step 02
                  </p>
                  <h2 className="text-2xl font-serif font-light tracking-tight text-serum-white transition-all duration-700 ease-out">
                    {profile.name ? (
                      <>
                        Let's make this yours,{" "}
                        <StyledName name={profile.name} />
                      </>
                    ) : (
                      "Your Identity"
                    )}
                  </h2>
                  <p className="text-gray-500 text-sm font-sans mt-2 transition-all duration-500 ease-out">
                    {profile.name
                      ? `A face, a name, a birthday—this is where it all comes together.`
                      : "Let's get to know you personally."}
                  </p>
                </div>

                {/* Profile Picture */}
                <div className="flex justify-center">
                  <div className="relative group">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`w-24 h-24 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-300 flex items-center justify-center overflow-hidden ${
                        profile.profilePicture
                          ? "border-clinical-cyan/50"
                          : "border-white/10 hover:border-white/30 bg-white/3"
                      }`}
                    >
                      {profile.profilePicture ? (
                        <img
                          src={profile.profilePicture}
                          alt="Profile"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera size={28} className="text-gray-500" />
                      )}
                    </div>
                    {profile.profilePicture && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProfile({ ...profile, profilePicture: "" });
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500/80 rounded-full flex items-center justify-center hover:bg-rose-500 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-center text-[10px] text-gray-500">
                  Click to upload (max 5MB)
                </p>

                {/* Name */}
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider mb-2 block">
                    What should we call you?
                  </label>
                  <div className="relative">
                    <User
                      className="absolute top-3 left-3 text-gray-500"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Dr. Strange, Alex, Chief Resident..."
                      value={profile.name || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, name: e.target.value })
                      }
                      className={`w-full bg-white/5 border rounded-xl py-3 pl-10 pr-4 focus:outline-none transition-all duration-300 font-serif italic ${
                        isSpecialName(profile.name)
                          ? "border-tissue-rose/50 focus:border-tissue-rose/70 focus:shadow-[0_0_12px_rgba(244,114,182,0.25)] text-tissue-rose"
                          : "border-white/10 text-white focus:border-clinical-cyan/50 focus:shadow-vital-cyan/5"
                      }`}
                    />
                  </div>
                </div>

                {/* Birthday */}
                <div>
                  <label
                    className={`text-[10px] uppercase font-semibold tracking-wider mb-2 block flex items-center gap-2 ${
                      isSpecialName(profile.name)
                        ? "text-tissue-rose/70"
                        : "text-gray-500"
                    }`}
                  >
                    When's your birthday?{" "}
                    {isSpecialName(profile.name) ? (
                      <span className="text-tissue-rose/60 normal-case font-serif italic">
                        (I already know ♡)
                      </span>
                    ) : (
                      <span className="text-gray-500 normal-case">
                        (we'll remember)
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <Cake
                      className={`absolute top-3 left-3 ${
                        isSpecialName(profile.name)
                          ? "text-tissue-rose/70"
                          : "text-gray-500"
                      }`}
                      size={18}
                    />
                    <input
                      type="date"
                      value={profile.birthday || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, birthday: e.target.value })
                      }
                      className={`w-full bg-white/5 border rounded-xl py-3 pl-10 pr-4 focus:outline-none transition-all duration-300 font-serif italic [color-scheme:dark] ${
                        isSpecialName(profile.name)
                          ? "border-tissue-rose/30 text-tissue-rose focus:border-tissue-rose/70 focus:shadow-[0_0_12px_rgba(244,114,182,0.25)]"
                          : "border-white/10 text-white focus:border-clinical-cyan/50 focus:shadow-vital-cyan/5"
                      }`}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleBack}
                    className="flex-1 py-4 border border-white/[0.1] rounded-xl text-sm font-sans text-gray-200 hover:bg-white/[0.04] transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-[2] py-4 bg-vital-cyan text-bio-void font-sans font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-vital-cyan/90 transition-all duration-300 shadow-[0_0_30px_rgba(42,212,212,0.2)]"
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: DISCIPLINE & LEVEL */}
            {step === 3 && (
              <div className="space-y-8 animate-[fadeIn_0.4s_ease-out]">
                <div>
                  <p className="text-[10px] font-mono tracking-[0.2em] text-vital-cyan mb-2">
                    Step 03
                  </p>
                  <h2 className="text-2xl font-serif font-light tracking-tight text-serum-white transition-all duration-700 ease-out">
                    {profile.name ? (
                      <>
                        Alright <StyledName name={profile.name} />, what's your
                        clinical background?
                      </>
                    ) : (
                      "Clinical Identity"
                    )}
                  </h2>
                  <p className="text-gray-500 text-sm font-sans mt-2 transition-all duration-500 ease-out">
                    {profile.name
                      ? `Your discipline and training level help us understand your world better.`
                      : "Define your professional context."}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-sans font-semibold tracking-wider mb-4 block">
                    What's your discipline?
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {DISCIPLINES.map((d) => (
                      <button
                        key={d.label}
                        onClick={() =>
                          setProfile({ ...profile, discipline: d.label })
                        }
                        className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-all duration-300 ${
                          profile.discipline === d.label
                            ? "bg-vital-cyan/10 border-vital-cyan/30 text-vital-cyan shadow-[0_0_20px_rgba(42,212,212,0.1)]"
                            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1] text-gray-200"
                        }`}
                      >
                        <d.icon size={20} />
                        <span className="text-[9px] font-sans font-medium text-center leading-tight">
                          {d.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-sans font-semibold tracking-wider mb-4 block">
                    Where are you in your training?
                  </label>
                  <div className="space-y-2">
                    {LEVELS.map((l) => (
                      <button
                        key={l.label}
                        onClick={() =>
                          setProfile({ ...profile, level: l.label })
                        }
                        className={`w-full p-4 rounded-xl border text-left transition-all duration-300 ${
                          profile.level === l.label
                            ? "bg-vital-cyan/10 border-vital-cyan/30 shadow-[0_0_20px_rgba(42,212,212,0.1)]"
                            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]"
                        }`}
                      >
                        <div
                          className={`text-sm font-sans font-medium ${
                            profile.level === l.label
                              ? "text-vital-cyan"
                              : "text-gray-200"
                          }`}
                        >
                          {l.label}
                        </div>
                        <div className="text-[10px] text-gray-200 font-sans mt-1">
                          {l.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleBack}
                    className="flex-1 py-4 border border-white/[0.1] rounded-xl text-sm font-sans text-gray-200 hover:bg-white/[0.04] transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-[2] py-4 bg-vital-cyan text-bio-void font-sans font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-vital-cyan/90 transition-all duration-300 shadow-[0_0_30px_rgba(42,212,212,0.2)]"
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: TEACHING STYLE */}
            {step === 4 && (
              <div className="space-y-8 animate-[fadeIn_0.4s_ease-out]">
                <div>
                  <p className="text-[10px] font-mono tracking-[0.2em] text-vital-cyan mb-2">
                    Step 04
                  </p>
                  <h2 className="text-2xl font-serif font-light tracking-tight text-serum-white transition-all duration-700 ease-out">
                    {profile.name ? (
                      <>
                        How does <StyledName name={profile.name} /> learn best?
                      </>
                    ) : (
                      "Learning Signature"
                    )}
                  </h2>
                  <p className="text-gray-500 text-sm font-sans mt-2 transition-all duration-500 ease-out">
                    {profile.name
                      ? `We get it—some people think through questions, others prefer deep reads, some need cases. What's your jam?`
                      : "How should we teach you?"}
                  </p>
                </div>

                <div className="grid gap-3">
                  {TEACHING_STYLES.map((style) => (
                    <button
                      key={style.label}
                      onClick={() =>
                        setProfile({ ...profile, teachingStyle: style.label })
                      }
                      className={`p-5 rounded-xl border text-left transition-all duration-300 flex items-start gap-4 ${
                        profile.teachingStyle === style.label
                          ? "bg-vital-cyan/10 border-vital-cyan/30 shadow-[0_0_20px_rgba(42,212,212,0.1)]"
                          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]"
                      }`}
                    >
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                          profile.teachingStyle === style.label
                            ? "bg-vital-cyan/20 text-vital-cyan"
                            : "bg-white/[0.04] text-gray-200"
                        }`}
                      >
                        <style.icon size={20} />
                      </div>
                      <div>
                        <div
                          className={`text-sm font-sans font-medium ${
                            profile.teachingStyle === style.label
                              ? "text-vital-cyan"
                              : "text-gray-200"
                          }`}
                        >
                          {style.label}
                        </div>
                        <div className="text-[11px] text-gray-500 font-sans mt-1">
                          {style.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Custom Teaching Style Input */}
                {profile.teachingStyle === "Custom" && (
                  <div className="animate-[fadeIn_0.3s_ease-out]">
                    <label className="text-[10px] uppercase text-gray-500 font-sans font-semibold tracking-wider mb-3 block">
                      Describe Your Preferred Style
                    </label>
                    <textarea
                      placeholder="e.g., Focus on visual diagrams, use mnemonics, explain like I'm teaching a friend..."
                      value={profile.customTeachingStyle || ""}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          customTeachingStyle: e.target.value,
                        })
                      }
                      rows={2}
                      className="w-full glass-slide border border-vital-cyan/20 rounded-xl py-4 px-5 text-sm font-sans text-serum-white focus:border-vital-cyan/40 focus:outline-none transition-all duration-300 resize-none"
                    />
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleBack}
                    className="flex-1 py-4 border border-white/[0.1] rounded-xl text-sm font-sans text-gray-200 hover:bg-white/[0.04] transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-[2] py-4 bg-vital-cyan text-bio-void font-sans font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-vital-cyan/90 transition-all duration-300 shadow-[0_0_30px_rgba(42,212,212,0.2)]"
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: EXAM GOAL, SPECIALTIES & GOALS */}
            {step === 5 && (
              <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">
                <div>
                  <p className="text-[10px] font-mono tracking-[0.2em] text-vital-cyan mb-2">
                    Step 05
                  </p>
                  <h2 className="text-2xl font-serif font-light tracking-tight text-serum-white transition-all duration-700 ease-out">
                    {profile.name ? (
                      <>
                        Almost there, <StyledName name={profile.name} />
                        —what are you chasing?
                      </>
                    ) : (
                      "Focus Areas"
                    )}
                  </h2>
                  <p className="text-gray-500 text-sm font-sans mt-2 transition-all duration-500 ease-out">
                    {profile.name
                      ? `Your target exams, favorite specialties, and what keeps you up at night studying.`
                      : "Personalize your learning experience."}
                  </p>
                </div>

                {/* Exam Goal Selection */}
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-sans font-semibold tracking-wider mb-4 block flex items-center gap-2">
                    <Target size={12} className="text-synapse-amber" />
                    Target Exam / Goal
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                    {EXAM_GOALS.filter(
                      (eg) =>
                        eg.disciplines.includes(
                          profile.discipline || "Medical (MD/DO)"
                        ) || eg.label === "General Knowledge"
                    ).map((eg) => (
                      <button
                        key={eg.label}
                        onClick={() =>
                          setProfile({ ...profile, examGoal: eg.label })
                        }
                        className={`p-3 rounded-xl border text-left transition-all duration-300 ${
                          profile.examGoal === eg.label
                            ? "bg-synapse-amber/10 border-synapse-amber/30 shadow-[0_0_15px_rgba(240,180,41,0.1)]"
                            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]"
                        }`}
                      >
                        <div
                          className={`text-xs font-sans font-medium ${
                            profile.examGoal === eg.label
                              ? "text-synapse-amber"
                              : "text-gray-200"
                          }`}
                        >
                          {eg.label}
                        </div>
                        <div className="text-[9px] text-gray-500 font-sans mt-1">
                          {eg.description}
                        </div>
                      </button>
                    ))}
                  </div>
                  {!profile.examGoal && (
                    <p className="text-[10px] text-gray-500 font-sans mt-3 italic">
                      Select an exam goal for personalized quiz questions
                    </p>
                  )}

                  {/* Custom Exam Goal Input */}
                  {profile.examGoal === "Custom" && (
                    <div className="mt-3 animate-[fadeIn_0.3s_ease-out]">
                      <input
                        type="text"
                        placeholder="e.g., MBBS Finals, Nursing State Board, Pharmacy License Exam..."
                        value={profile.customExamGoal || ""}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            customExamGoal: e.target.value,
                          })
                        }
                        className="w-full glass-slide border border-synapse-amber/20 rounded-xl py-3 px-4 text-sm font-sans text-serum-white focus:border-synapse-amber/40 focus:outline-none transition-all duration-300"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-sans font-semibold tracking-wider mb-3 block">
                    What interests you clinically?
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g., Cardiology, Oncology..."
                      value={specialtyInput}
                      onChange={(e) => setSpecialtyInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addSpecialty()}
                      className="flex-1 glass-slide border border-white/[0.08] rounded-xl py-3 px-4 text-sm font-sans text-serum-white focus:border-vital-cyan/30 focus:outline-none transition-all duration-300"
                    />
                    <button
                      onClick={addSpecialty}
                      className="px-5 bg-vital-cyan/20 text-vital-cyan rounded-xl text-sm font-sans font-medium hover:bg-vital-cyan/30 transition-all duration-300"
                    >
                      Add
                    </button>
                  </div>
                  {(profile.specialties?.length || 0) > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {profile.specialties?.map((s) => (
                        <span
                          key={s}
                          className="px-3 py-1 bg-clinical-teal/10 text-clinical-teal rounded-full text-xs flex items-center gap-2"
                        >
                          {s}
                          <button
                            onClick={() => removeSpecialty(s)}
                            className="hover:text-white"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider mb-2 block">
                    What are you working toward?{" "}
                    <span className="text-gray-500">(Optional)</span>
                  </label>
                  <textarea
                    placeholder="What are you preparing for? Any specific areas you want to master?"
                    value={profile.learningGoals || ""}
                    onChange={(e) =>
                      setProfile({ ...profile, learningGoals: e.target.value })
                    }
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:border-clinical-cyan/50 focus:outline-none transition-colors resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleBack}
                    className="flex-1 py-3 border border-white/10 rounded-xl text-sm text-gray-200 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="flex-[2] py-3 bg-vital-cyan text-bio-void font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-vital-cyan/90 transition-all shadow-[0_0_30px_rgba(42,212,212,0.2)]"
                  >
                    {isEditMode ? "Save Changes" : "Launch Synapse"}{" "}
                    <Check size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 1: API KEY (BYOK) - first step */}
            {step === 1 && (
              <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">
                {/* Header */}
                <div>
                  <p className="text-[10px] font-mono tracking-[0.2em] text-vital-cyan mb-2">
                    Step 01
                  </p>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-serif font-light tracking-tight text-serum-white">
                      Neural Connection
                    </h2>
                    <div className="px-2 py-0.5 rounded bg-vital-cyan/10 border border-vital-cyan/20 text-[10px] text-vital-cyan font-mono tracking-wide">
                      REQUIRED
                    </div>
                  </div>
                  <p className="text-gray-500 text-sm font-sans mt-2">
                    Connect directly to Google's neural engine—no backend
                    middleman, no data collection.
                  </p>
                </div>

                {/* Origin story card (placed here under the header as requested) */}
                <div className="relative p-6 rounded-3xl bg-gradient-to-br from-tissue-rose/[0.08] via-tissue-rose/[0.04] to-transparent border border-tissue-rose/20 overflow-hidden group shadow-[inset_0_0_40px_rgba(224,93,93,0.08)]">
                  <div
                    className="absolute -top-20 -right-20 w-56 h-56 bg-tissue-rose/20 rounded-full blur-[80px]"
                    style={{
                      animation: "fluidGlow 5s ease-in-out infinite",
                    }}
                  />
                  <div
                    className="absolute -bottom-10 -left-10 w-40 h-40 bg-tissue-rose/15 rounded-full blur-[70px]"
                    style={{
                      animation: "fluidGlow 6s ease-in-out infinite",
                      animationDelay: "1s",
                    }}
                  />
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-3 text-tissue-rose">
                      <div className="relative w-6 h-6 flex items-center justify-center">
                        <Heart
                          size={18}
                          fill="currentColor"
                          className="opacity-95 heart-pulse relative z-10"
                        />
                        <span className="heart-wave" />
                        <span className="heart-wave delay" />
                        <span className="heart-wave delay-2" />
                      </div>
                      <span className="text-[11px] uppercase tracking-[0.24em] font-bold opacity-95 text-tissue-rose/90">
                        Origin
                      </span>
                    </div>
                    <p className="text-[18px] font-serif italic text-gray-100 leading-8 opacity-100 font-bold">
                      "<span className="text-white">I created</span> Synapse as
                      a heartfelt project to support a special physiotherapy
                      student close to my heart through her challenging
                      curriculum. Witnessing how it transformed her study
                      experience inspired me to share it with the world."
                    </p>
                    <div className="h-px w-full bg-white/[0.06]" />
                    <p
                      className="text-[14px] text-gray-400 font-sans leading-relaxed font-medium"
                      style={{ letterSpacing: "0.04em" }}
                    >
                      As a student developer building this without external
                      funding, I cannot host expensive AI servers. Synapse uses
                      a <strong className="text-gray-300">BYOK</strong> (Bring
                      Your Own Key) model — you connect directly to Google's
                      API. This keeps it{" "}
                      <strong className="text-gray-300">
                        free, private, and unlimited
                      </strong>{" "}
                      for you.
                    </p>
                  </div>
                </div>

                {/* Step-by-Step Instructions */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
                    Get Your Free API Key (2 minutes)
                  </h3>

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

                {/* Input Field */}
                <div className="space-y-3">
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                      <Key size={14} />
                    </div>
                    <input
                      type="password"
                      placeholder="Paste key starting with AIza..."
                      value={profile.apiKey || ""}
                      onChange={(e) => {
                        setProfile({ ...profile, apiKey: e.target.value });
                        setKeyValidationResult(null); // Reset validation on change
                      }}
                      className={`w-full bg-[#050607] border rounded-xl py-4 pl-11 pr-5 text-sm font-mono text-white placeholder:text-gray-600 focus:outline-none transition-all ${
                        keyValidationResult?.valid === false
                          ? "border-red-500/50 focus:border-red-500 focus:shadow-[0_0_20px_rgba(239,68,68,0.1)]"
                          : keyValidationResult?.valid === true
                          ? "border-green-500/50 focus:border-green-500 focus:shadow-[0_0_20px_rgba(34,197,94,0.1)]"
                          : "border-white/10 focus:border-vital-cyan/50 focus:shadow-[0_0_20px_rgba(42,212,212,0.1)]"
                      }`}
                    />
                    {keyValidationResult?.valid === true && (
                      <CheckCircle2
                        size={16}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500"
                      />
                    )}
                    {keyValidationResult?.valid === false && (
                      <AlertCircle
                        size={16}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500"
                      />
                    )}
                  </div>

                  {keyValidationResult?.valid === false && (
                    <p className="text-[11px] text-red-400 flex items-start gap-1.5 p-2 rounded bg-red-500/5 border border-red-500/10">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />
                      <span>{keyValidationResult.error}</span>
                    </p>
                  )}

                  {keyValidationResult?.valid === true && (
                    <p className="text-[11px] text-green-400 flex items-start gap-1.5 p-2 rounded bg-green-500/5 border border-green-500/10">
                      <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
                      API key verified successfully!
                    </p>
                  )}
                </div>

                {/* Footer: Privacy + Support */}
                <div className="flex items-center justify-between px-2 py-2 text-[10px] text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={11} className="text-emerald-500" />
                    <span>Stored locally on your device.</span>
                  </div>

                  <a
                    href="https://www.buymeacoffee.com/yourusername"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-gray-500 hover:text-synapse-amber transition-colors group"
                  >
                    <Coffee size={11} className="group-hover:animate-bounce" />
                    <span>Support future updates</span>
                  </a>
                </div>

                {/* Continue Button */}
                <button
                  onClick={async () => {
                    // Validate API key before proceeding
                    if (!profile.apiKey || !profile.apiKey.startsWith("AIza")) {
                      setKeyValidationResult({
                        valid: false,
                        error:
                          "Please enter a valid API key starting with 'AIza'",
                      });
                      return;
                    }

                    setIsValidatingKey(true);
                    setKeyValidationResult(null);

                    try {
                      const gemini = new GeminiService();
                      const result = await gemini.validateApiKey(
                        profile.apiKey
                      );
                      setKeyValidationResult(result);

                      if (result.valid) {
                        // Small delay to show success state before next
                        setTimeout(() => {
                          handleNext();
                        }, 500);
                      }
                    } catch (error: any) {
                      setKeyValidationResult({
                        valid: false,
                        error: error.message || "Validation failed",
                      });
                    } finally {
                      setIsValidatingKey(false);
                    }
                  }}
                  disabled={
                    !profile.apiKey ||
                    !profile.apiKey.startsWith("AIza") ||
                    isValidatingKey
                  }
                  className="w-full py-4 bg-gradient-to-r from-clinical-cyan to-clinical-teal text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-clinical-cyan/20 hover:shadow-clinical-cyan/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isValidatingKey ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      {isEditMode ? "Save & Proceed" : "Proceed"}{" "}
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>

                {/* Skip option for edit mode if key already exists */}
                {isEditMode && existingProfile?.apiKey && (
                  <button
                    onClick={handleSubmit}
                    className="w-full py-2 text-gray-500 text-sm hover:text-gray-300 transition-colors"
                  >
                    Skip (keep existing key)
                  </button>
                )}
                {/* origin story moved earlier to appear directly under the Neural Connection header */}
              </div>
            )}
          </div>

          {/* Step indicator text */}
          <div className="mt-4 text-center">
            <span className="text-[10px] text-gray-500 font-mono">
              {step} / {totalSteps}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Onboarding;
