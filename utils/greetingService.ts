/**
 * greetingService.ts
 *
 * A modular, extensible greeting system with:
 * - Time-based prefixes (Good morning/afternoon/evening/night)
 * - Discipline-specific personalized suffixes with clinical depth and emotional support
 * - Animation configuration for UI components
 * - Visual metadata: icons, accent colors, gradients for adaptive UI
 *
 * EXTENSIBILITY:
 * - Add new disciplines by extending DISCIPLINE_SUFFIXES
 * - Add new time periods by modifying TIME_RANGES
 * - Add new animation presets in ANIMATION_PRESETS
 */

import { ClinicalDiscipline } from "../types";
import {
  Sun,
  Moon,
  Sunrise,
  Sunset,
  Stethoscope,
  Activity,
  Zap,
  BookOpen,
  BrainCircuit,
  Microscope,
  ShieldCheck,
  Coffee,
  Star,
  Flame,
  Heart,
  Sparkles,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type TimePeriod =
  | "early_morning"
  | "morning"
  | "afternoon"
  | "evening"
  | "late_night";

export interface GreetingConfig {
  prefix: string; // "Good morning", "Good afternoon", etc.
  timePeriod: TimePeriod;
  suffix?: string; // Motivational phrase with clinical insight and emotional support
  animation?: AnimationPreset;
  icon?: any; // Lucide Icon Component
  accentColor?: string; // Tailwind color class for glowing accents
  gradient?: string; // Tailwind text-clip gradient
}

export type AnimationPreset =
  | "fadeIn"
  | "fadeInUp"
  | "pulse"
  | "glow"
  | "slideIn";

// ═══════════════════════════════════════════════════════════════
// TIME-BASED GREETING CONFIGURATION
// ═══════════════════════════════════════════════════════════════

interface TimeRange {
  start: number; // Hour (0-23)
  end: number; // Hour (0-23)
  period: TimePeriod;
  prefix: string;
  icon: any;
  accentColor: string;
  gradient: string;
}

const TIME_RANGES: TimeRange[] = [
  {
    start: 5,
    end: 11,
    period: "morning",
    prefix: "Good morning",
    icon: Sunrise,
    accentColor: "text-vital-cyan",
    // Morning: "Biological Dawn". Sterile white → Vital Cyan → Organic Emerald. Fresh, oxygenated start.
    gradient: "from-serum-white via-vital-cyan to-emerald-300",
  },
  {
    start: 11,
    end: 17,
    period: "afternoon",
    prefix: "Good afternoon",
    icon: Sun,
    accentColor: "text-synapse-amber",
    // Afternoon: "Synaptic Spark". Amber energy → Bright Gold → System Cyan. High-contrast cognitive burn.
    gradient: "from-synapse-amber via-amber-100 to-vital-cyan",
  },
  {
    start: 17,
    end: 22,
    period: "evening",
    prefix: "Good evening",
    icon: Sunset,
    accentColor: "text-neural-purple",
    // Evening: "Homeostatic Balance". Purple wisdom → Soft Violet → Grounding Slate. Cooling down.
    gradient: "from-neural-purple via-violet-200 to-clinical-slate",
  },
  {
    start: 22,
    end: 1,
    period: "late_night",
    prefix: "Good night",
    icon: Moon,
    accentColor: "text-vital-cyan",
    // Late Night: "Bioluminescence". Deep Indigo → Glowing Cyan → Muted Slate. Submerged focus.
    gradient: "from-indigo-300 via-vital-cyan to-slate-400",
  },
  {
    start: 1,
    end: 5,
    period: "early_morning",
    prefix: "Hello",
    icon: Coffee,
    accentColor: "text-clinical-slate",
    // Early Morning: "The Fog". Muted Slate → Clearing Gray → Serum White. Resilience in the quiet.
    gradient: "from-clinical-slate via-gray-200 to-serum-white",
  }, // The "Student Grind" hours
];

// ═══════════════════════════════════════════════════════════════
// GENERIC SUFFIXES (used when no discipline or as fallback)
// Blending clinical insight with emotional support
// ═══════════════════════════════════════════════════════════════

const GENERIC_SUFFIXES: Record<TimePeriod, string[]> = {
  morning: [
    "Rise & shine — your clinical journey awaits.",
    "Ready to learn? Your future patients are counting on it.",
    "Small wins stack up — start one now, with compassion.",
    "Your future self will thank you for this dedication.",
    "Fresh start, fresh mind — embrace the science and the heart.",
  ],
  afternoon: [
    "Keep going — you're building something meaningful.",
    "Fuel your focus, nurture your spirit.",
    "Small steps, big impacts — in medicine and in life.",
    "A little progress beats perfection — be kind to yourself.",
    "You're closer than you think to making a difference.",
  ],
  evening: [
    "Nice work today — reflect with gratitude.",
    "Reflect & relax — you've earned this balance.",
    "You did well today — honor your effort.",
    "Close the loop with a quick recap and self-compassion.",
    "Finish strong — one tidy summary, one moment of peace.",
  ],
  late_night: [
    "Rest well — your brain will thank you, your heart too.",
    "Quiet wins happen overnight — trust the process.",
    "Tomorrow's gains start with tonight's rest — you deserve it.",
    "Sleep consolidates learning and restores your empathy.",
    "Dream big, rest deep — medicine needs your whole self.",
  ],
  early_morning: [
    // The brutal hours for students
    "The world sleeps, you build mastery — and that's heroic.",
    "Forging resilience in the quiet — you're stronger than you know.",
    "Remember why you started this — compassion drives you.",
    "Neuroplasticity honors the effort — and so do we.",
    "In these hours, you're not alone — keep going, healer.",
  ],
};

// ═══════════════════════════════════════════════════════════════
// DISCIPLINE-SPECIFIC SUFFIXES
// Add new disciplines here to extend personalization
// ═══════════════════════════════════════════════════════════════

const DISCIPLINE_SUFFIXES: Record<
  ClinicalDiscipline,
  Record<TimePeriod, string[]>
> = {
  "Medical (MD/DO)": {
    morning: [
      "Time to round on some knowledge — with empathy in every diagnosis.",
      "Differential diagnosis awaits — approach with curiosity and care.",
      "Every patient teaches something new — honor that wisdom.",
      "Clinical pearls don't find themselves — but they find compassionate minds.",
      "First, do no harm — but also, learn with heart.",
    ],
    afternoon: [
      "Keep that clinical acumen sharp — and your compassion sharper.",
      "One more case, one more insight — one more life touched.",
      "The wards are calling — answer with skill and kindness.",
      "Pathophysiology powers understanding — empathy powers healing.",
      "Evidence-based excellence — rooted in human connection.",
    ],
    evening: [
      "Chart your learning today — and your gratitude.",
      "Sign off with a solid review — and self-compassion.",
      "Tomorrow's attending is learning today — be gentle with yourself.",
      "Consolidate those differentials — and your sense of purpose.",
      "Rest now, diagnose better tomorrow — you've earned the balance.",
    ],
    late_night: [
      "The wards never sleep — but neither does your dedication.",
      "On-call for knowledge — and for the hearts you serve.",
      "Emergency medicine mindset — fueled by rest and resilience.",
      "Diagnostic reasoning in progress — trust your journey.",
    ],
    early_morning: [
      "Residency preparation protocol — remember your 'why'.",
      "Grit is a vital sign — so is self-care.",
      "Doctors are made in these hours — with compassion as your guide.",
      "Endurance is part of the curriculum — so is emotional intelligence.",
    ],
  },
  Nursing: {
    morning: [
      "Compassion starts with you — ready to advocate for your patients?",
      "Holistic care, one patient at a time — including yourself.",
      "Assessment skills on point today — paired with genuine care.",
      "Care plans don't write themselves — but they heal with love.",
    ],
    afternoon: [
      "Stay vigilant, stay caring — your presence matters.",
      "Patient safety is in your hands — and so is your well-being.",
      "One intervention at a time — one moment of connection.",
      "Critical thinking in action — guided by empathy.",
      "Charting excellence — and charting your own needs.",
    ],
    evening: [
      "End of shift, not end of learning — reflect with kindness.",
      "Reflect on today's care moments — celebrate your impact.",
      "Tomorrow's patients need today's prep — and so do you.",
      "Self-care is part of patient care — prioritize it.",
      "Review those nursing diagnoses — and your own resilience.",
    ],
    late_night: [
      "Night shift vigilance — honor your strength.",
      "The quiet watch — filled with quiet courage.",
      "Monitoring never stops — neither does your dedication.",
      "Empathy tank: Refilling — you've given so much.",
    ],
    early_morning: [
      "Nursing excellence takes stamina — and grace.",
      "Care doesn't adhere to clocks — neither does your compassion.",
      "Resilience is part of the uniform — wear it proudly.",
      "Almost shift change. Finish strong — you've got this.",
    ],
  },
  Pharmacy: {
    morning: [
      "Drug interactions don't review themselves — but they save lives.",
      "Pharmacokinetics fuel the day — and your passion for healing.",
      "Dose calculations, here we go — with precision and care.",
      "Medication safety starts now — your vigilance protects.",
      "Ready to optimize therapy? — And optimize hope.",
    ],
    afternoon: [
      "Keep those drug facts flowing — and your empathy flowing.",
      "One more mechanism, one more mastery — one more patient helped.",
      "Therapeutic levels, therapeutic learning — therapeutic self-care.",
      "Compounding knowledge daily — compounding compassion.",
      "Formulary mastery in progress — formulary of the heart too.",
    ],
    evening: [
      "Wrap up with a pharmacy pearl — and a moment of gratitude.",
      "Tomorrow's counseling, today's prep — you've prepared well.",
      "Review those drug classes — and your own well-being.",
      "Patient education starts with yours — teach yourself kindness.",
      "Dispense wisdom, absorb knowledge — and absorb peace.",
    ],
    late_night: [
      "Metabolism pathways active — so is your quiet strength.",
      "Clearance rates are key — clear your mind too.",
      "Precision dosing mode — precise self-compassion.",
      "Molecule to medicine — heart to healing.",
    ],
    early_morning: [
      "Compound effect of study — compound effect of care.",
      "Bioavailability of knowledge — bioavailability of joy.",
      "The lab is quiet, the mind is loud — listen to both.",
      "Synthesis in progress — synthesis of skill and soul.",
    ],
  },
  Physiotherapy: {
    morning: [
      "Movement is medicine — yours too, healer.",
      "Ready to restore function? — And restore hope.",
      "Biomechanics and beyond — empathy in every adjustment.",
      "Range of motion, range of knowledge — range of compassion.",
      "Rehab starts with understanding — and understanding yourself.",
    ],
    afternoon: [
      "Keep that momentum going — momentum of healing.",
      "One exercise, one breakthrough — one life transformed.",
      "Functional gains in progress — functional heart too.",
      "Evidence-based movement — evidence-based kindness.",
      "Anatomy in action — anatomy of the soul.",
    ],
    evening: [
      "Stretch your mind tonight — stretch your spirit.",
      "Reflect on today's progressions — and your own growth.",
      "Recovery is part of learning — recovery is part of life.",
      "Tomorrow's patients, today's plans — tomorrow's you too.",
      "Cool down with a review — cool down with gratitude.",
    ],
    late_night: [
      "Static equilibrium — find your balance.",
      "Neuro-muscular connections — connect with your heart.",
      "Stability check — stability of mind and body.",
      "Recovery physiology — recovery of the spirit.",
    ],
    early_morning: [
      "Movement is life — movement of the soul.",
      "Hypertrophy of the mind — hypertrophy of compassion.",
      "Endurance training — endurance of the heart.",
      "Strength in stillness — strength in vulnerability.",
    ],
  },
  Dentistry: {
    morning: [
      "Time to brush up on knowledge — and brush up on care.",
      "Oral health, overall health — holistic healing.",
      "Cavity prevention starts with you — prevention of suffering.",
      "Smile — it's learning time, it's healing time.",
      "Crown your knowledge today — crown your compassion.",
    ],
    afternoon: [
      "Keep drilling into the details — drilling into empathy.",
      "One more procedure, one more skill — one more smile restored.",
      "Enamel your expertise — enamel your kindness.",
      "Precision in every concept — precision in every touch.",
      "Root cause analysis time — root cause of healing.",
    ],
    evening: [
      "Floss through today's material — floss through gratitude.",
      "Polish off your review — polish your spirit.",
      "Tomorrow's patients, today's prep — tomorrow's hope.",
      "Seal in the knowledge — seal in the care.",
      "Mouthguard your mind with rest — protect your well-being.",
    ],
    late_night: [
      "Anatomy of the nerve — anatomy of resilience.",
      "Maxillofacial complex — complexity of care.",
      "Emergency protocols — protocols for self-care.",
      "Quiet extraction of data — quiet extraction of wisdom.",
    ],
    early_morning: [
      "Fine motor endurance — endurance of the healer.",
      "Roots run deep — roots of compassion.",
      "Early procedural prep — prep your heart.",
      "Structure and stability — structure of the soul.",
    ],
  },
  Other: {
    morning: [
      "Every discipline has its pearls — and its heart.",
      "Ready to specialize your knowledge? — And your empathy.",
      "Cross-disciplinary excellence — cross-disciplinary care.",
      "Unique paths, universal dedication — universal compassion.",
      "Your field, your focus — your healing touch.",
    ],
    afternoon: [
      "Keep building expertise — build character too.",
      "One concept at a time — one patient at a time.",
      "Specialization in progress — compassion in progress.",
      "Interdisciplinary insights — interdisciplinary healing.",
      "Your journey, your pace — your heart, your guide.",
    ],
    evening: [
      "Reflect on your unique path — with gratitude.",
      "Tomorrow needs today's prep — and today's rest.",
      "Wind down, wisdom up — wind down, peace up.",
      "Review your specialties — review your blessings.",
      "Rest fuels focus — rest fuels healing.",
    ],
    late_night: [
      "Deep dive analysis — deep dive into care.",
      "Variable isolation — isolation of suffering.",
      "Peer review mode — peer support mode.",
      "Critical appraisal — critical self-appraisal.",
    ],
    early_morning: [
      "Breakthrough potential — breakthrough compassion.",
      "Novel connections — connections of the heart.",
      "The cutting edge — edge of healing.",
      "Rigorous inquiry — rigorous self-care.",
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// ANIMATION PRESETS
// Add new animations here for UI flexibility
// ═══════════════════════════════════════════════════════════════

export const ANIMATION_PRESETS: Record<AnimationPreset, string> = {
  fadeIn: "animate-[fadeIn_0.4s_ease-out]",
  fadeInUp: "animate-[fadeInUp_0.35s_ease-out]",
  pulse: "animate-[pulse_2s_ease-in-out_infinite]",
  glow: "animate-[glow_2s_ease-in-out_infinite]",
  slideIn: "animate-[slideIn_0.3s_ease-out]",
};

// Combined animation for suffix (entrance + subtle pulse)
// Uses Tailwind's defined animations from index.html
export const SUFFIX_ANIMATION_CLASS = "animate-fadeInUp animate-subtlePulse";

// ═══════════════════════════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get the current time period and prefix
 */
export function getTimeBasedGreeting(): {
  prefix: string;
  timePeriod: TimePeriod;
  icon: any;
  accentColor: string;
  gradient: string;
} {
  const hour = new Date().getHours();

  for (const range of TIME_RANGES) {
    // Handle overnight range (late_night: 22-1, early_morning: 1-5)
    if (range.start > range.end) {
      if (hour >= range.start || hour < range.end) {
        return {
          prefix: range.prefix,
          timePeriod: range.period,
          icon: range.icon,
          accentColor: range.accentColor,
          gradient: range.gradient,
        };
      }
    } else {
      if (hour >= range.start && hour < range.end) {
        return {
          prefix: range.prefix,
          timePeriod: range.period,
          icon: range.icon,
          accentColor: range.accentColor,
          gradient: range.gradient,
        };
      }
    }
  }

  // Fallback (default to morning for fresh starts)
  return {
    prefix: "Welcome",
    timePeriod: "morning",
    icon: Sunrise,
    accentColor: "text-vital-cyan",
    gradient: "from-serum-white via-vital-cyan to-emerald-300",
  };
}

/**
 * Get a personalized suffix based on discipline and time
 * Falls back to generic if discipline not found
 */
export function getPersonalizedSuffix(
  timePeriod: TimePeriod,
  discipline?: ClinicalDiscipline,
  rotationIntervalMs: number = 20000
): string {
  // Get the appropriate suffix pool
  let pool: string[];

  if (discipline && DISCIPLINE_SUFFIXES[discipline]) {
    pool = DISCIPLINE_SUFFIXES[discipline][timePeriod];
  } else {
    pool = GENERIC_SUFFIXES[timePeriod];
  }

  // Deterministic rotation based on time
  const index = Math.floor(Date.now() / rotationIntervalMs) % pool.length;
  return pool[index];
}

/**
 * Get complete greeting configuration
 * Main entry point for components
 */
export function getGreetingConfig(
  discipline?: ClinicalDiscipline,
  rotationIntervalMs: number = 20000
): GreetingConfig {
  const { prefix, timePeriod, icon, accentColor, gradient } =
    getTimeBasedGreeting();
  const suffix = getPersonalizedSuffix(
    timePeriod,
    discipline,
    rotationIntervalMs
  );

  return {
    prefix,
    timePeriod,
    suffix,
    animation: "fadeInUp",
    icon,
    accentColor,
    gradient,
  };
}

/**
 * Hook-friendly greeting state type
 */
export interface GreetingState {
  prefix: string; // Time-based greeting
  suffix: string; // Personalized motivational phrase
  timePeriod: TimePeriod;
  icon?: any; // Lucide Icon Component
  accentColor?: string; // Tailwind color class
  gradient?: string; // Tailwind gradient class
}

/**
 * Create initial greeting state (for useState initialization)
 */
export function createInitialGreeting(
  discipline?: ClinicalDiscipline
): GreetingState {
  const config = getGreetingConfig(discipline);
  return {
    prefix: config.prefix,
    suffix: config.suffix || "",
    timePeriod: config.timePeriod,
    icon: config.icon,
    accentColor: config.accentColor,
    gradient: config.gradient,
  };
}

/**
 * Compute updated greeting (for interval callbacks)
 */
export function computeGreeting(
  discipline?: ClinicalDiscipline
): GreetingState {
  return createInitialGreeting(discipline);
}

/**
 * Enhanced greeting with visual metadata (for advanced UI components)
 * Returns a config object with icon, colors, and gradient for rich theming
 */
export function getSmartGreeting(
  discipline: ClinicalDiscipline = "Other"
): GreetingConfig {
  return getGreetingConfig(discipline);
}

// ═══════════════════════════════════════════════════════════════
// CSS KEYFRAMES (add to your global CSS if not present)
// ═══════════════════════════════════════════════════════════════
/*
Add these keyframes to your global CSS (e.g., index.css) if not already present:

@keyframes subtlePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

@keyframes glow {
  0%, 100% { text-shadow: 0 0 0 transparent; }
  50% { text-shadow: 0 0 8px rgba(42, 212, 212, 0.3); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { opacity: 0; transform: translateX(-10px); }
  to { opacity: 1; transform: translateX(0); }
}
*/
