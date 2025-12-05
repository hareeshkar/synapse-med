// ═══════════════════════════════════════════════════════════════════════════
// SPECIAL NAME UTILITIES - For Akshaya ♡
// Centralized detection and styling for special names across the app
// ═══════════════════════════════════════════════════════════════════════════

// Akshaya's birthday - a little personal touch ♡
export const AKSHAYA_BIRTHDAY = "2003-08-04";

/**
 * Detects if the given name is Akshaya (or her nickname)
 * This powers all the special styling and personalization across the app
 */
export const isSpecialName = (name: string | undefined): boolean => {
  if (!name) return false;
  const normalized = name.toLowerCase().trim();
  return normalized.includes("akshaya") || normalized.includes("akshu");
};

/**
 * Returns special styling classes for Akshaya's name
 */
export const getSpecialNameClasses = (isSpecial: boolean) => ({
  text: isSpecial ? "text-tissue-rose font-serif italic" : "text-serum-white",
  border: isSpecial ? "border-tissue-rose/40" : "border-white/10",
  glow: isSpecial ? "shadow-[0_0_15px_rgba(244,114,182,0.2)]" : "",
  focusGlow: isSpecial
    ? "focus:shadow-[0_0_20px_rgba(244,114,182,0.4)] focus:border-tissue-rose"
    : "focus:shadow-vital-cyan/10 focus:border-vital-cyan",
});
