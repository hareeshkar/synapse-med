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
// Short, punchy, emotional resonance.
// ═══════════════════════════════════════════════════════════════

const GENERIC_SUFFIXES: Record<TimePeriod, string[]> = {
  morning: [
    "You were made for this work.",
    "Breathe. You are ready.",
    "The world needs your hands today.",
    "Step in. Be brave.",
    "Your future patients are waiting.",
  ],
  afternoon: [
    "Keep pushing. It matters.",
    "Your fatigue proves your love.",
    "Hard things build great hearts.",
    "Don't give up. Not now.",
    "You are stronger than you feel.",
  ],
  evening: [
    "You gave enough today.",
    "Be proud of your scars.",
    "Let it go. You did good.",
    "Healing starts with rest.",
    "Peace. You earned it.",
  ],
  late_night: [
    "The quiet hours build heroes.",
    "You are not alone in this.",
    "Your dedication is beautiful.",
    "The world sleeps. You rise.",
    "Rest. The work waits.",
  ],
  early_morning: [
    "Grind now. Save lives later.",
    "This is where you become great.",
    "Eyes up. Keep moving.",
    "Resilience is quiet work.",
    "One foot in front of the other.",
  ],
};

// ═══════════════════════════════════════════════════════════════
// DISCIPLINE-SPECIFIC SUFFIXES
// Tailored to the specific emotional burden of each role.
// ═══════════════════════════════════════════════════════════════

const DISCIPLINE_SUFFIXES: Record<
  ClinicalDiscipline,
  Record<TimePeriod, string[]>
> = {
  "Medical (MD/DO)": {
    morning: [
      "Heavy coat, light heart.",
      "Trust your gut. Train your mind.",
      "Walk with purpose today.",
      "Lead with kindness.",
      "You carry a lot. Carry it well.",
    ],
    afternoon: [
      "Sharpen your mind. Soften your heart.",
      "Lives depend on your focus.",
      "The burden is heavy. You are strong.",
      "Think clearly. Care deeply.",
      "Your decisions matter.",
    ],
    evening: [
      "Leave the hospital in the hospital.",
      "Forgive yourself for today.",
      "You are more than a score.",
      "Rest your diagnostic mind.",
      "Silence the doubts.",
    ],
    late_night: [
      "The sleepless watch over the weak.",
      "You are the light in the dark.",
      "Stand tall. You are needed.",
      "Endure. It's worth it.",
    ],
    early_morning: [
      "Excellence has no closing time.",
      "Forging a doctor in the fire.",
      "This is the price of mastery.",
      "Keep the oath close.",
    ],
  },
  Nursing: {
    morning: [
      "You are the heartbeat here.",
      "Your presence is the medicine.",
      "Be their calm in the storm.",
      "Touch lives. Heal hearts.",
    ],
    afternoon: [
      "Your patience is a superpower.",
      "Don't pour from an empty cup.",
      "You see what others miss.",
      "Hold on. You're doing great.",
      "Your voice saves lives.",
    ],
    evening: [
      "Take off the scrubs. Exhale.",
      "You carried them. Now rest.",
      "Be gentle with yourself tonight.",
      "Your compassion is enough.",
      "Wash away the day.",
    ],
    late_night: [
      "Guardian of the quiet hours.",
      "You are their safe place.",
      "The night trusts you.",
      "Stand watch. Stand strong.",
    ],
    early_morning: [
      "Unseen work. Infinite value.",
      "Tired eyes, full heart.",
      "Keep shining, healer.",
      "Almost home. Stay strong.",
    ],
  },
  Pharmacy: {
    morning: [
      "Precision is your love language.",
      "Protect them. Guide them.",
      "You are the silent guardian.",
      "Accuracy saves lives.",
      "Clear mind, steady hand.",
    ],
    afternoon: [
      "Catch the error. Be the safety.",
      "Your focus is their shield.",
      "Knowledge is your weapon.",
      "Stay sharp. Stay kind.",
      "Every detail matters.",
    ],
    evening: [
      "The safety net holds. Rest now.",
      "Quiet your analytical mind.",
      "You did your duty.",
      "Balance is your prescription.",
      "Disconnect to recharge.",
    ],
    late_night: [
      "Vigilance never sleeps.",
      "The unseen protector.",
      "Your expertise is vital.",
      "Stay awake. Stay true.",
    ],
    early_morning: [
      "Compound wisdom. Distill hope.",
      "Synthesis requires energy.",
      "Focus through the fog.",
      "Your rigor is beautiful.",
    ],
  },
  Physiotherapy: {
    morning: [
      "Help them rise again.",
      "Movement is freedom.",
      "Be their strength today.",
      "Empower every step.",
      "Healing happens in motion.",
    ],
    afternoon: [
      "Push them gently. Push yourself.",
      "Celebrate the small wins.",
      "Your energy moves them.",
      "Pain changes. Hope remains.",
      "Guide them through the struggle.",
    ],
    evening: [
      "Rest your own body now.",
      "You lifted others. Rest.",
      "Reflect on the progress.",
      "Recover to rebuild.",
      "Stretch your spirit.",
    ],
    late_night: [
      "Equilibrium takes time.",
      "Stability comes from within.",
      "Find your center.",
      "Strength in the silence.",
    ],
    early_morning: [
      "Build resilience. Start now.",
      "Motion creates emotion.",
      "Endurance starts here.",
      "Step forward. Always.",
    ],
  },
  Dentistry: {
    morning: [
      "Restore the smile. Restore the soul.",
      "Precision with a gentle touch.",
      "Create confidence today.",
      "Be gentle. Be exact.",
      "Healing is an art.",
    ],
    afternoon: [
      "Steady hands, kind heart.",
      "Focus on the person, not just the tooth.",
      "Relieve their pain.",
      "Craftsmanship takes patience.",
      "Stay calm. They need it.",
    ],
    evening: [
      "Rest your hands. Rest your eyes.",
      "Let go of the perfectionism.",
      "You brought relief today.",
      "Unclench. Breathe.",
      "Silence the drill.",
    ],
    late_night: [
      "Anatomy requires respect.",
      "Study the nerve. Know the pain.",
      "Deep roots. Strong foundation.",
      "Quiet focus.",
    ],
    early_morning: [
      "Fine motor. Fine spirit.",
      "Prepare for the delicate work.",
      "Build something lasting.",
      "Precision mindset.",
    ],
  },
  Other: {
    morning: [
      "Your path is unique. Own it.",
      "Bring your full self today.",
      "Find your place. Fill it.",
      "You belong here.",
      "Start with purpose.",
    ],
    afternoon: [
      "Carve your own way.",
      "Your perspective is needed.",
      "Keep building your legacy.",
      "Stay curious. Stay open.",
      "Work hard. Love harder.",
    ],
    evening: [
      "Honor your journey.",
      "Rest is part of the work.",
      "Trust your timing.",
      "Be proud of where you are.",
      "Close the chapter.",
    ],
    late_night: [
      "Deep work. Deep soul.",
      "The outliers change the world.",
      "Focus on your truth.",
      "Find clarity in the dark.",
    ],
    early_morning: [
      "Blaze a new trail.",
      "Wake up. Show up.",
      "Define your own success.",
      "Begin again.",
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