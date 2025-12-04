import React, { useState, useRef } from "react";
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
} from "lucide-react";
import BioBackground from "./BioBackground";

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

const Onboarding: React.FC<Props> = ({
  onComplete,
  existingProfile,
  onCancel,
  mode = "onboarding",
}) => {
  const [step, setStep] = useState(1);
  const totalSteps = 4;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Partial<UserProfile>>({
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
      if (file.size > 500 * 1024) {
        alert("Image too large. Please use an image under 500KB.");
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

  const isEditMode = mode === "edit";

  return (
    <>
      {/* Render BioBackground to dedicated container */}
      {ReactDOM.createPortal(
        <BioBackground />,
        document.getElementById("bio-background-root") || document.body
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
            {/* STEP 1: DISCIPLINE & LEVEL */}
            {step === 1 && (
              <div className="space-y-8 animate-[fadeIn_0.4s_ease-out]">
                <div>
                  <p className="text-[10px] font-mono tracking-[0.2em] text-vital-cyan mb-2">
                    Step 01
                  </p>
                  <h2 className="text-2xl font-serif font-light tracking-tight text-serum-white">
                    Clinical Identity
                  </h2>
                  <p className="text-gray-500 text-sm font-sans mt-2">
                    Define your professional context.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-sans font-semibold tracking-wider mb-4 block">
                    Discipline
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
                    Training Stage
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

                <button
                  onClick={handleNext}
                  className="w-full py-4 bg-vital-cyan text-bio-void font-sans font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-vital-cyan/90 transition-all duration-300 shadow-[0_0_30px_rgba(42,212,212,0.2)]"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            )}

            {/* STEP 2: TEACHING STYLE */}
            {step === 2 && (
              <div className="space-y-8 animate-[fadeIn_0.4s_ease-out]">
                <div>
                  <p className="text-[10px] font-mono tracking-[0.2em] text-vital-cyan mb-2">
                    Step 02
                  </p>
                  <h2 className="text-2xl font-serif font-light tracking-tight text-serum-white">
                    Learning Signature
                  </h2>
                  <p className="text-gray-500 text-sm font-sans mt-2">
                    How should we teach you?
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

            {/* STEP 3: EXAM GOAL, SPECIALTIES & GOALS */}
            {step === 3 && (
              <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">
                <div>
                  <p className="text-[10px] font-mono tracking-[0.2em] text-vital-cyan mb-2">
                    Step 03
                  </p>
                  <h2 className="text-2xl font-serif font-light tracking-tight text-serum-white">
                    Focus Areas
                  </h2>
                  <p className="text-gray-500 text-sm font-sans mt-2">
                    Personalize your learning experience.
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
                    Clinical Interests / Specialties
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
                    Learning Goals{" "}
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
                    onClick={handleNext}
                    className="flex-[2] py-3 bg-white text-black font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
                  >
                    Continue <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: IDENTITY & PHOTO */}
            {step === 4 && (
              <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-clinical-cyan mb-1">
                    Step 4
                  </p>
                  <h2 className="text-xl font-light tracking-tight">
                    Your Identity
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">
                    Final personalization touches.
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
                  Click to upload (max 500KB)
                </p>

                {/* Name */}
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider mb-2 block">
                    Display Name
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
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-clinical-cyan/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Birthday */}
                <div>
                  <label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider mb-2 block flex items-center gap-2">
                    Birthday{" "}
                    <span className="text-gray-500 normal-case">
                      (for surprises)
                    </span>
                  </label>
                  <div className="relative">
                    <Cake
                      className="absolute top-3 left-3 text-gray-500"
                      size={18}
                    />
                    <input
                      type="date"
                      value={profile.birthday || ""}
                      onChange={(e) =>
                        setProfile({ ...profile, birthday: e.target.value })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:border-clinical-cyan/50 focus:outline-none transition-colors [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleBack}
                    className="flex-1 py-3 border border-white/10 rounded-xl text-sm text-gray-200 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!profile.name}
                    className="flex-[2] py-3 bg-gradient-to-r from-clinical-cyan to-clinical-teal text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-clinical-cyan/20 hover:shadow-clinical-cyan/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isEditMode ? "Save Changes" : "Launch Synapse"}{" "}
                    <Check size={16} />
                  </button>
                </div>
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
