import React, { useState, useRef } from "react";
import {
  UserProfile,
  ClinicalDiscipline,
  TrainingLevel,
  TeachingStyle,
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
} from "lucide-react";

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
    if (
      profile.name &&
      profile.discipline &&
      profile.level &&
      profile.teachingStyle
    ) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian text-white overflow-hidden">
      {/* Atmospheric Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-30%] left-[-15%] w-[600px] h-[600px] bg-clinical-cyan/8 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-25%] right-[-10%] w-[500px] h-[500px] bg-clinical-purple/8 rounded-full blur-[130px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-clinical-teal/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-xl mx-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xs uppercase tracking-[0.3em] text-gray-500 font-medium">
              {isEditMode ? "Edit Profile" : "Synapse Med"}
            </h1>
          </div>
          {isEditMode && onCancel && (
            <button
              onClick={onCancel}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X size={18} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Progress Bar - Asymmetric */}
        <div className="flex gap-1 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-0.5 rounded-full transition-all duration-700 ${
                i === 0
                  ? "flex-[2]"
                  : i === totalSteps - 1
                  ? "flex-[1.5]"
                  : "flex-1"
              } ${step > i ? "bg-clinical-cyan" : "bg-gray-800"}`}
            />
          ))}
        </div>

        <div className="bg-charcoal/40 backdrop-blur-2xl border border-white/5 p-8 rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
          {/* STEP 1: DISCIPLINE & LEVEL */}
          {step === 1 && (
            <div className="space-y-8 animate-[fadeIn_0.4s_ease-out]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-clinical-cyan mb-1">
                  Step 1
                </p>
                <h2 className="text-xl font-light tracking-tight">
                  Clinical Identity
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Define your professional context.
                </p>
              </div>

              <div>
                <label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider mb-3 block">
                  Discipline
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DISCIPLINES.map((d) => (
                    <button
                      key={d.label}
                      onClick={() =>
                        setProfile({ ...profile, discipline: d.label })
                      }
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all duration-300 ${
                        profile.discipline === d.label
                          ? "bg-clinical-cyan/10 border-clinical-cyan/50 text-clinical-cyan"
                          : "bg-white/3 border-white/5 hover:bg-white/5 text-gray-400"
                      }`}
                    >
                      <d.icon size={18} />
                      <span className="text-[9px] font-medium text-center leading-tight">
                        {d.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider mb-3 block">
                  Training Stage
                </label>
                <div className="space-y-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l.label}
                      onClick={() => setProfile({ ...profile, level: l.label })}
                      className={`w-full p-3 rounded-xl border text-left transition-all duration-300 ${
                        profile.level === l.label
                          ? "bg-clinical-teal/10 border-clinical-teal/50"
                          : "bg-white/3 border-white/5 hover:bg-white/5"
                      }`}
                    >
                      <div
                        className={`text-sm ${
                          profile.level === l.label
                            ? "text-clinical-teal"
                            : "text-gray-300"
                        }`}
                      >
                        {l.label}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {l.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleNext}
                className="w-full py-3 bg-white text-black font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors"
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: TEACHING STYLE */}
          {step === 2 && (
            <div className="space-y-8 animate-[fadeIn_0.4s_ease-out]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-clinical-cyan mb-1">
                  Step 2
                </p>
                <h2 className="text-xl font-light tracking-tight">
                  Learning Signature
                </h2>
                <p className="text-gray-500 text-sm mt-1">
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
                    className={`p-4 rounded-xl border text-left transition-all duration-300 flex items-start gap-4 ${
                      profile.teachingStyle === style.label
                        ? "bg-clinical-cyan/10 border-clinical-cyan/50"
                        : "bg-white/3 border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        profile.teachingStyle === style.label
                          ? "bg-clinical-cyan/20 text-clinical-cyan"
                          : "bg-white/5 text-gray-400"
                      }`}
                    >
                      <style.icon size={20} />
                    </div>
                    <div>
                      <div
                        className={`text-sm font-medium ${
                          profile.teachingStyle === style.label
                            ? "text-clinical-cyan"
                            : "text-gray-300"
                        }`}
                      >
                        {style.label}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {style.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 border border-white/10 rounded-xl text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
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

          {/* STEP 3: SPECIALTIES & GOALS */}
          {step === 3 && (
            <div className="space-y-6 animate-[fadeIn_0.4s_ease-out]">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-clinical-cyan mb-1">
                  Step 3
                </p>
                <h2 className="text-xl font-light tracking-tight">
                  Focus Areas
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  Optional: Personalize your content.
                </p>
              </div>

              <div>
                <label className="text-[10px] uppercase text-gray-500 font-semibold tracking-wider mb-2 block">
                  Clinical Interests / Specialties
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., Cardiology, Oncology..."
                    value={specialtyInput}
                    onChange={(e) => setSpecialtyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSpecialty()}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-sm text-white focus:border-clinical-cyan/50 focus:outline-none transition-colors"
                  />
                  <button
                    onClick={addSpecialty}
                    className="px-4 bg-clinical-cyan/20 text-clinical-cyan rounded-lg text-sm font-medium hover:bg-clinical-cyan/30 transition-colors"
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
                  <span className="text-gray-600">(Optional)</span>
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
                  className="flex-1 py-3 border border-white/10 rounded-xl text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
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
                  <span className="text-gray-600 normal-case">
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
                  className="flex-1 py-3 border border-white/10 rounded-xl text-sm text-gray-300 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft size={14} /> Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!profile.name}
                  className="flex-[2] py-3 bg-gradient-to-r from-clinical-cyan to-clinical-teal text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-clinical-cyan/20 hover:shadow-clinical-cyan/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
          <span className="text-[10px] text-gray-600 font-mono">
            {step} / {totalSteps}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
