import React, { useState, useRef, useEffect } from "react";
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
} from "lucide-react";

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
];

export const ProfileEditor: React.FC<Props> = ({
  profile,
  onSave,
  onClose,
}) => {
  const [editedProfile, setEditedProfile] = useState<UserProfile>({
    ...profile,
  });
  const [activeTab, setActiveTab] = useState<
    "identity" | "preferences" | "learning"
  >("identity");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle profile picture upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Image too large. Max 2MB.");
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-obsidian border border-glass-border shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-glass-border bg-obsidian/95 backdrop-blur-sm">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-clinical-cyan" />
            Edit Profile
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-charcoal/50 transition-colors"
          >
            <X className="w-5 h-5 text-clinical-text/60" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-2 mx-4 mt-4 rounded-lg bg-charcoal/50">
          {[
            { id: "identity", label: "Identity" },
            { id: "preferences", label: "Preferences" },
            { id: "learning", label: "Learning Style" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-clinical-cyan/20 text-clinical-cyan"
                  : "text-clinical-text/60 hover:text-clinical-text hover:bg-charcoal"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-6">
          {/* Identity Tab */}
          {activeTab === "identity" && (
            <>
              {/* Profile Picture */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div
                    className={`w-24 h-24 rounded-full overflow-hidden border-2 ${
                      editedProfile.profilePicture
                        ? "border-clinical-cyan"
                        : "border-glass-border border-dashed"
                    } bg-charcoal flex items-center justify-center cursor-pointer hover:border-clinical-cyan/70 transition-colors`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {editedProfile.profilePicture ? (
                      <img
                        src={editedProfile.profilePicture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-8 h-8 text-clinical-text/40" />
                    )}
                  </div>
                  {editedProfile.profilePicture && (
                    <button
                      onClick={handleRemovePhoto}
                      className="absolute -top-1 -right-1 p-1 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <p className="text-xs text-clinical-text/50">
                  Click to upload (Max 2MB)
                </p>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-clinical-text/80">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editedProfile.name}
                  onChange={(e) =>
                    setEditedProfile({ ...editedProfile, name: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-lg bg-charcoal/50 border border-glass-border text-white placeholder:text-clinical-text/40 focus:border-clinical-cyan focus:outline-none transition-colors"
                  placeholder="Your name"
                />
              </div>

              {/* Birthday */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-clinical-text/80 flex items-center gap-2">
                  <Cake className="w-4 h-4" />
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
                  className="w-full px-4 py-3 rounded-lg bg-charcoal/50 border border-glass-border text-white focus:border-clinical-cyan focus:outline-none transition-colors"
                />
              </div>
            </>
          )}

          {/* Preferences Tab */}
          {activeTab === "preferences" && (
            <>
              {/* Discipline */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-clinical-text/80">
                  Discipline
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DISCIPLINES.map((d) => (
                    <button
                      key={d.label}
                      onClick={() =>
                        setEditedProfile({
                          ...editedProfile,
                          discipline: d.label,
                        })
                      }
                      className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                        editedProfile.discipline === d.label
                          ? `border-clinical-${d.color} bg-clinical-${d.color}/10 text-clinical-${d.color}`
                          : "border-glass-border text-clinical-text/70 hover:border-clinical-text/40"
                      }`}
                    >
                      <d.icon className="w-4 h-4" />
                      <span className="text-sm">{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Level */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-clinical-text/80">
                  Training Level
                </label>
                <div className="space-y-2">
                  {LEVELS.map((l) => (
                    <button
                      key={l.label}
                      onClick={() =>
                        setEditedProfile({ ...editedProfile, level: l.label })
                      }
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                        editedProfile.level === l.label
                          ? "border-clinical-cyan bg-clinical-cyan/10"
                          : "border-glass-border hover:border-clinical-text/40"
                      }`}
                    >
                      <span className="text-sm text-clinical-text">
                        {l.label}
                      </span>
                      <span className="text-xs text-clinical-text/50">
                        {l.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Specialties */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-clinical-text/80">
                  Specialties (comma-separated)
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
                  className="w-full px-4 py-3 rounded-lg bg-charcoal/50 border border-glass-border text-white placeholder:text-clinical-text/40 focus:border-clinical-cyan focus:outline-none transition-colors"
                  placeholder="e.g., Cardiology, Nephrology"
                />
              </div>
            </>
          )}

          {/* Learning Style Tab */}
          {activeTab === "learning" && (
            <>
              {/* Teaching Style */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-clinical-text/80">
                  Preferred Teaching Style
                </label>
                <div className="grid gap-2">
                  {TEACHING_STYLES.map((style) => (
                    <button
                      key={style.label}
                      onClick={() =>
                        setEditedProfile({
                          ...editedProfile,
                          teachingStyle: style.label,
                        })
                      }
                      className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                        editedProfile.teachingStyle === style.label
                          ? `border-clinical-${style.color} bg-clinical-${style.color}/10`
                          : "border-glass-border hover:border-clinical-text/40"
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg ${
                          editedProfile.teachingStyle === style.label
                            ? `bg-clinical-${style.color}/20`
                            : "bg-charcoal"
                        }`}
                      >
                        <style.icon
                          className={`w-5 h-5 ${
                            editedProfile.teachingStyle === style.label
                              ? `text-clinical-${style.color}`
                              : "text-clinical-text/50"
                          }`}
                        />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium text-clinical-text">
                          {style.label}
                        </div>
                        <div className="text-xs text-clinical-text/50">
                          {style.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Learning Goals */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-clinical-text/80">
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
                  className="w-full px-4 py-3 rounded-lg bg-charcoal/50 border border-glass-border text-white placeholder:text-clinical-text/40 focus:border-clinical-cyan focus:outline-none transition-colors resize-none"
                  rows={3}
                  placeholder="What are you hoping to achieve? (e.g., Pass USMLE Step 1, Master cardiology for rotations)"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 p-4 border-t border-glass-border bg-obsidian/95 backdrop-blur-sm">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-glass-border text-clinical-text/70 hover:text-clinical-text hover:border-clinical-text/40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-clinical-cyan text-obsidian font-medium hover:bg-clinical-cyan/90 transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
