import { GoogleGenAI } from "@google/genai";
import {
  AugmentedNote,
  FileInput,
  Source,
  KnowledgeNode,
  UserProfile,
} from "../types";
import { embedTablesInMarkdown } from "../utils/tableFormatter";
import { ProfileRepository } from "../src/lib/repos/ProfileRepository";

// ===============================
// CUSTOM ERROR CLASSES FOR BYOK
// ===============================
export class ApiKeyError extends Error {
  constructor(
    message: string,
    public readonly code: "MISSING" | "INVALID" | "EXPIRED" | "QUOTA_EXCEEDED"
  ) {
    super(message);
    this.name = "ApiKeyError";
  }
}

export class GeminiService {
  // No longer store api key or client persistently
  // Each request fetches the key dynamically from IndexedDB

  constructor() {
    // Empty constructor - we initialize per request now for BYOK
  }

  // ===============================
  // BYOK: Dynamic Client Initialization
  // ===============================

  /**
   * Get the authenticated GoogleGenAI client using the user's API key from IndexedDB.
   * Throws ApiKeyError if no key is found or if the key appears invalid.
   */
  private async getClient(): Promise<GoogleGenAI> {
    const apiKey = await ProfileRepository.getApiKey();

    if (!apiKey) {
      throw new ApiKeyError(
        "No API Key found. Please add your Google Gemini API key in Settings.",
        "MISSING"
      );
    }

    // Basic validation: Gemini API keys start with "AIza"
    if (!apiKey.startsWith("AIza")) {
      throw new ApiKeyError(
        "Invalid API Key format. Google Gemini API keys start with 'AIza'.",
        "INVALID"
      );
    }

    // Validate minimum length (Gemini keys are typically 39 characters)
    if (apiKey.length < 35) {
      throw new ApiKeyError(
        "API Key appears to be incomplete. Please check and re-enter your key.",
        "INVALID"
      );
    }

    return new GoogleGenAI({ apiKey });
  }

  /**
   * Validate the API key format.
   * Returns true if valid format, false otherwise.
   */
  async validateApiKey(
    apiKey?: string
  ): Promise<{ valid: boolean; error?: string }> {
    const keyToTest = apiKey || (await ProfileRepository.getApiKey());

    if (!keyToTest) {
      return { valid: false, error: "No API key provided" };
    }

    if (!keyToTest.startsWith("AIza")) {
      return {
        valid: false,
        error: "Invalid key format. Keys start with 'AIza'",
      };
    }

    return { valid: true };
  }

  /**
   * Handle API errors and convert them to user-friendly messages.
   * Detects quota, rate limit, and authentication errors.
   */
  private handleApiError(error: any): never {
    const message = error.message || String(error);

    // Quota exceeded
    if (message.includes("RESOURCE_EXHAUSTED") || message.includes("quota")) {
      throw new ApiKeyError(
        "API quota exceeded. Google's free tier has limits. Wait a bit or upgrade your plan at aistudio.google.com.",
        "QUOTA_EXCEEDED"
      );
    }

    // Rate limited
    if (message.includes("RATE_LIMIT") || message.includes("429")) {
      throw new ApiKeyError(
        "Rate limit hit. Please wait a moment and try again. Free tier: 15 requests/minute.",
        "QUOTA_EXCEEDED"
      );
    }

    // Invalid key
    if (
      message.includes("API_KEY_INVALID") ||
      message.includes("invalid") ||
      message.includes("401")
    ) {
      throw new ApiKeyError(
        "Your API key is invalid or expired. Please check and update it in Settings.",
        "INVALID"
      );
    }

    // Permission denied
    if (message.includes("403") || message.includes("permission")) {
      throw new ApiKeyError(
        "Permission denied. Make sure Gemini API is enabled for your key at aistudio.google.com.",
        "INVALID"
      );
    }

    // Re-throw original error if not a known type
    throw error;
  }

  // ===============================
  // UTILITY METHODS: JSON Parsing & Error Handling
  // ===============================
  // Robust JSON extraction with recovery for truncated responses
  private extractJson(text: string): any {
    // 🔧 ENHANCED: Robust extraction with truncation recovery
    const firstBrace = text.indexOf("{");
    if (firstBrace === -1) return {};

    let inString = false;
    let escape = false;
    let braceCount = 0;
    let startIndex = -1;
    let endIndex = -1;

    for (let i = firstBrace; i < text.length; i++) {
      const ch = text[i];

      if (!inString) {
        if (ch === "{") {
          if (startIndex === -1) startIndex = i;
          braceCount++;
        } else if (ch === "}") {
          braceCount--;
          if (braceCount === 0 && startIndex !== -1) {
            endIndex = i;
            break;
          }
        } else if (ch === '"') {
          inString = true;
          escape = false;
        }
      } else {
        // inside a quoted string
        if (escape) {
          escape = false;
        } else if (ch === "\\") {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
      }
    }

    // 🔧 ENHANCED: Handle incomplete JSON (truncated during streaming)
    if (startIndex === -1) return {};

    if (endIndex === -1) {
      // JSON is incomplete - try to recover
      console.warn("⚠️ Incomplete JSON detected, attempting recovery...");
      let jsonStr = text.substring(startIndex);

      // Close any unclosed string
      if (inString) {
        jsonStr += '"';
      }

      // Close all unclosed braces
      while (braceCount > 0) {
        jsonStr += "}";
        braceCount--;
      }

      // Try to parse the recovered JSON
      const recovered = this.tryParseWithSanitization(jsonStr);
      if (recovered && Object.keys(recovered).length > 0) {
        console.log("✅ JSON recovery successful");
        return recovered;
      }

      return {};
    }

    let jsonStr = text.substring(startIndex, endIndex + 1);
    return this.tryParseWithSanitization(jsonStr);
  }

  // Sanitization pipeline for malformed JSON from streaming
  private tryParseWithSanitization(jsonStr: string): any {
    const tryParse = (s: string) => {
      try {
        return JSON.parse(s);
      } catch (err) {
        return null;
      }
    };

    // 1) Try raw parse first (fast path)
    let parsed = tryParse(jsonStr);
    if (parsed) return parsed;

    // 2) Sanitize stray backslashes
    let sanitized = jsonStr.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    parsed = tryParse(sanitized);
    if (parsed) return parsed;

    // 3) Remove trailing commas
    sanitized = sanitized.replace(/,\s*([}\]])/g, "$1");
    parsed = tryParse(sanitized);
    if (parsed) return parsed;

    // 4) Normalize raw newlines
    sanitized = sanitized.replace(/\r?\n/g, "\\n");
    parsed = tryParse(sanitized);
    if (parsed) return parsed;

    // 5) Remove problematic unicode
    sanitized = sanitized.replace(/\u0000/g, "");
    parsed = tryParse(sanitized);
    if (parsed) return parsed;

    // 6) 🆕 Try to fix truncated strings
    sanitized = sanitized.replace(/"[^"]*$/g, '"');
    parsed = tryParse(sanitized);
    if (parsed) return parsed;

    console.warn("❌ JSON Parse failed after all sanitization attempts");
    return {};
  }

  // Exponential backoff for API retries (handles rate limits and 500 errors)
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        if (attempt === maxRetries) {
          throw error;
        }

        const delayMs = baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `⚠️ Attempt ${attempt + 1} failed, retrying in ${delayMs}ms...`,
          error.message
        );

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError;
  }

  // Detect if markdown is truncated (for continuation logic)
  // 🔧 ENHANCED: More accurate truncation detection to avoid unnecessary continuations
  private detectTruncation(markdown: string): {
    isTruncated: boolean;
    lastSection?: string;
    lastCompleteHeading?: string;
  } {
    if (!markdown || markdown.length < 100) {
      return { isTruncated: false };
    }

    const trimmed = markdown.trim();

    // 🆕 If content is substantial (>80K chars), don't trigger continuation unless clearly incomplete
    // This prevents unnecessary API calls for already comprehensive content
    if (trimmed.length > 80000) {
      // Only truncate if CLEARLY incomplete (mid-sentence, incomplete code block)
      const codeBlockCount = (trimmed.match(/```/g) || []).length;
      const hasIncompleteCodeBlock = codeBlockCount % 2 !== 0;

      // Check if ends mid-sentence (no punctuation and not a heading)
      const lines = trimmed.split("\n");
      const lastLine = lines[lines.length - 1].trim();
      const isMidSentence =
        lastLine.length > 10 &&
        !lastLine.endsWith(".") &&
        !lastLine.endsWith("!") &&
        !lastLine.endsWith("?") &&
        !lastLine.endsWith(":") &&
        !lastLine.startsWith("#");

      if (hasIncompleteCodeBlock) {
        console.warn(`⚠️ Truncation detected: Incomplete code block`);
        return {
          isTruncated: true,
          lastSection: this.findLastSection(trimmed),
        };
      }

      if (isMidSentence && !lastLine.includes("[") && !lastLine.includes("|")) {
        console.warn(`⚠️ Truncation detected: Mid-sentence ending`);
        return {
          isTruncated: true,
          lastSection: this.findLastSection(trimmed),
        };
      }

      // Content is substantial and appears complete
      return { isTruncated: false };
    }

    // For shorter content, use original detection logic
    const lines = trimmed.split("\n");
    const lastLine = lines[lines.length - 1];

    const endsWithPunctuation = /[.!?:]\s*$/.test(trimmed);
    const hasIncompleteTable =
      /\|[^\n]*$/.test(trimmed) && !trimmed.endsWith("|");
    const codeBlockCount = (trimmed.match(/```/g) || []).length;
    const hasIncompleteCodeBlock = codeBlockCount % 2 !== 0;
    const endsWithListItem = /^\s*[-*]\s+/.test(lastLine);

    const isTruncated =
      !endsWithPunctuation ||
      hasIncompleteTable ||
      hasIncompleteCodeBlock ||
      (endsWithListItem && !endsWithPunctuation);

    if (!isTruncated) {
      return { isTruncated: false };
    }

    const lastSection = this.findLastSection(trimmed);
    console.warn(
      `⚠️ Truncation detected. Last section: "${lastSection || "unknown"}"`
    );

    return { isTruncated: true, lastSection, lastCompleteHeading: lastSection };
  }

  // Helper to find last section heading
  private findLastSection(markdown: string): string | undefined {
    const headingMatches = markdown.match(/^#{1,6}\s+.+$/gm);
    if (!headingMatches) return undefined;
    const lastCompleteHeading = headingMatches[headingMatches.length - 1];
    return lastCompleteHeading.replace(/^#{1,6}\s+/, "").trim();
  }

  // Auto-link clinical terms to knowledge graph nodes
  private linkifyClinicalTerms(text: string, nodes: KnowledgeNode[]): string {
    if (!nodes || nodes.length === 0) {
      console.warn(
        "⚠️ linkifyClinicalTerms: No nodes provided for smart linking"
      );
      return text;
    }
    if (!text) return "";

    const nodeMap = new Map<string, KnowledgeNode>();
    const terms: string[] = [];

    // Helper to normalize text for matching (lowercase, replace hyphens with spaces)
    const normalize = (s: string) => s.toLowerCase().replace(/-/g, " ").trim();

    nodes.forEach((node) => {
      if (node.label && node.label.length >= 3) {
        const normalizedLabel = normalize(node.label);
        if (!nodeMap.has(normalizedLabel)) {
          nodeMap.set(normalizedLabel, node);
          // Add the label pattern (escape special chars)
          terms.push(node.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        }

        // Also map by node ID (often hyphenated like "chronic-neck-pain")
        if (node.id && node.id.length >= 3) {
          const normalizedId = normalize(node.id);
          if (!nodeMap.has(normalizedId)) {
            nodeMap.set(normalizedId, node);
            // Add the ID pattern (escape special chars, replace hyphens with pattern that matches hyphens or spaces)
            const idPattern = node.id
              .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
              .replace(/-/g, "[-\\s]");
            if (!terms.includes(idPattern)) {
              terms.push(idPattern);
            }
          }
        }
      }
    });

    if (terms.length === 0) {
      return text;
    }

    // Silent processing - log only final summary

    const sortedTermsPattern = terms
      .sort((a, b) => b.length - a.length)
      .join("|");

    const lines = text.split("\n");
    let linksCreated = 0;

    const processedLines = lines.map((line) => {
      // Skip headings - but still process bracketed terms in headings
      const isHeading = line.trim().startsWith("#");

      // Match priority:
      // 1) existing markdown links [text](url) - must have ](
      // 2) bracketed-only terms like [Loss of Cervical Lordosis] or [Chronic Neck Pain] - convert to smart link
      // 3) plain occurrences of terms (word boundaries) - only in non-headings

      // For headings, only match bracketed terms (not plain text to avoid messing up heading text)
      const pattern = isHeading
        ? `(\\[.+?\\]\\(.+?\\))|(\\[([^\\]]+)\\])` // In headings: existing links OR any bracketed text
        : `(\\[.+?\\]\\(.+?\\))|(\\[([^\\]]+)\\])|\\b(${sortedTermsPattern})\\b`; // In body: + plain terms

      const masterRegex = new RegExp(pattern, "gi");

      return line.replace(
        masterRegex,
        (match, existingLink, bracketedWhole, bracketedInner, term) => {
          // 1) If it's an existing markdown link [text](url), leave it unchanged
          if (existingLink) return existingLink;

          // 2) Determine which capture matched: bracketedInner or plain term
          const actual = (bracketedInner || term || "").toString();
          if (!actual) return match;

          // Normalize for lookup (lowercase, hyphens to spaces)
          const normalizedTerm = actual.toLowerCase().replace(/-/g, " ").trim();
          const node = nodeMap.get(normalizedTerm);

          if (node) {
            linksCreated++;
            // Convert to smart link format, use original text for display
            return `[${actual}](node:${node.id})`;
          }

          // 🔧 FIX: If bracketed but no node found, REMOVE the brackets to clean up output
          // This prevents ugly [Term] from appearing in the rendered markdown
          // Silently strip brackets for citation-style and unmatched terms
          if (bracketedInner) {
            return actual; // Return text without brackets - silent cleanup
          }

          // Plain text term that didn't match - leave as-is
          return match;
        }
      );
    });

    // Log only on significant link creation (>10 links)
    if (linksCreated > 10) {
      console.log(`🔗 Smart links: ${linksCreated} created`);
    }

    return processedLines.join("\n");
  }

  // Convert JSON code blocks to formatted markdown tables (client-side)
  private processTablesInMarkdown(markdown: string): string {
    return embedTablesInMarkdown(markdown);
  }

  // ===============================
  // TABLE FORMATTERS: Convert JSON to Markdown Tables
  // ===============================

  // 🆕 MISSING METHOD: Generic table formatter for any array of objects
  // This handles JSON structures that don't match predefined types (medications, differentials, etc.)
  // Automatically detects column headers from object keys // Format generic data as table with improved nested object handling
  private formatGenericTable(data: any[]): string {
    if (!data || data.length === 0) return "";

    // Collect all unique keys across all objects
    const allKeys = new Set<string>();
    data.forEach((item) => {
      if (typeof item === "object" && item !== null) {
        Object.keys(item).forEach((key) => allKeys.add(key));
      }
    });

    const headers = Array.from(allKeys).map((key) =>
      key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
    );

    const rows = data.map((item) =>
      Array.from(allKeys).map((key) => {
        const value = item[key];
        if (value === undefined || value === null) return "-";

        // IMPROVED: Handle arrays by joining with commas
        if (Array.isArray(value)) {
          return value.join(", ");
        }

        // IMPROVED: Handle nested objects by extracting key info
        if (typeof value === "object") {
          // If object has 'name' or 'value' field, use that
          if (value.name) return String(value.name);
          if (value.value) return String(value.value);
          // Otherwise, create a compact representation
          const entries = Object.entries(value).slice(0, 2); // Take first 2 properties
          return entries.map(([k, v]) => `${k}: ${v}`).join("; ");
        }

        return String(value);
      })
    );

    return this.createMarkdownTable(headers, rows);
  }

  // Format medication data as table
  private formatMedicationTable(medications: any[]): string {
    if (!medications || medications.length === 0) return "";

    // 🔧 ENHANCED: Detect all available fields dynamically
    const allKeys = new Set<string>();
    medications.forEach((med) => {
      if (typeof med === "object" && med !== null) {
        Object.keys(med).forEach((key) => allKeys.add(key));
      }
    });

    // Common medication fields in priority order
    const priorityFields = [
      "name",
      "class",
      "dose",
      "mechanism",
      "administration",
      "monitoring",
      "indication",
      "adverse_effects",
      "sideEffects",
      "contraindications",
      "reversal",
    ];

    // Use priority fields that exist in the data
    const headers: string[] = [];
    const keys: string[] = [];

    priorityFields.forEach((field) => {
      if (allKeys.has(field)) {
        keys.push(field);
        // Convert camelCase to Title Case
        headers.push(
          field
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())
            .trim()
        );
      }
    });

    // Add any remaining fields
    allKeys.forEach((key) => {
      if (!priorityFields.includes(key)) {
        keys.push(key);
        headers.push(
          key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())
            .trim()
        );
      }
    });

    const rows = medications.map((med) =>
      keys.map((key) => {
        const value = med[key];
        if (value === undefined || value === null) return "-";
        if (Array.isArray(value)) return value.join(", ");
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
      })
    );

    return this.createMarkdownTable(headers, rows);
  }

  // Format differential diagnosis as table
  private formatDifferentialTable(differentials: any[]): string {
    if (!differentials || differentials.length === 0) return "";

    const headers = ["Condition", "Distinguishing Features", "Key Tests"];
    const rows = differentials.map((diff) => [
      diff.condition || "",
      diff.distinguishingFeatures || diff.features || "",
      diff.keyTests || diff.tests || "",
    ]);

    return this.createMarkdownTable(headers, rows);
  }

  // Format lab values as table
  private formatLabValuesTable(labs: any[]): string {
    if (!labs || labs.length === 0) return "";

    const headers = ["Test", "Normal Range", "Abnormal In"];
    const rows = labs.map((lab) => [
      lab.test || lab.name || "",
      lab.normalRange || lab.range || "",
      lab.abnormalIn || lab.abnormal || "",
    ]);

    return this.createMarkdownTable(headers, rows);
  }

  // Format stage data as table
  private formatStageTable(stages: any[]): string {
    if (!stages || stages.length === 0) return "";

    const headers = ["Stage", "Criteria", "Management"];
    const rows = stages.map((stage) => [
      stage.stage || stage.name || "",
      stage.criteria || "",
      stage.management || stage.treatment || "",
    ]);

    return this.createMarkdownTable(headers, rows);
  }

  // Core markdown table generator
  private createMarkdownTable(headers: string[], rows: string[][]): string {
    if (headers.length === 0 || rows.length === 0) return "";

    const headerRow = `| ${headers.join(" | ")} |`;
    const separator = `| ${headers.map(() => "---").join(" | ")} |`;
    const dataRows = rows.map((row) => `| ${row.join(" | ")} |`).join("\n");

    return `${headerRow}\n${separator}\n${dataRows}`;
  }

  // ===============================
  // CONTEXT CACHING: Implicit (Free Tier)
  // ===============================
  // Free tier uses implicit caching; no explicit cache creation needed
  async cacheNoteContext(note: AugmentedNote): Promise<string | undefined> {
    // BYOK: Check if API key exists before proceeding
    const apiKey = await ProfileRepository.getApiKey();
    if (!apiKey) return undefined;

    console.log("✅ Using implicit caching (automatic on Gemini 2.5 models)");
    console.log("💡 Keep consistent prefixes in your prompts for cache hits");

    return undefined;
  }

  // ===============================
  // PHASE 1: Metadata + Knowledge Graph Generation
  // ===============================
  // 🔧 OPTIMIZED: This is a SEPARATE API call with its own 64K output token budget
  // Phase 1 focuses ONLY on JSON metadata and graph structure (no markdown)
  // This ensures we don't exhaust tokens before Phase 2 (Master Guide)
  async generateMetadataAndGraph(
    files: FileInput[],
    topicName: string,
    onThought?: (thought: string) => void,
    onSubStage?: (stage: "extracting" | "verifying" | "graphing") => void,
    userProfile?: UserProfile
  ): Promise<{
    title: string;
    summary: string;
    eli5Analogy?: string;
    pearls: {
      type: "gap-filler" | "exam-tip" | "red-flag" | "fact-check";
      content: string;
    }[];
    graphNodes: KnowledgeNode[];
    graphLinks: { source: string; target: string; relationship: string }[];
  }> {
    // BYOK: Get dynamic client (will throw ApiKeyError if no key)
    const ai = await this.getClient();

    const parts: any[] = [];

    for (const file of files) {
      const base64Data = file.base64.split(",")[1];
      parts.push({
        inlineData: {
          mimeType: file.file.type,
          data: base64Data,
        },
      });
    }

    // 🌟 DYNAMIC SYSTEM PROMPT INJECTION (if userProfile provided)
    // 📊 LOG: Profile context being passed to Gemini
    if (userProfile) {
      console.log("🧠 [Gemini Phase 1] User Profile Context:", {
        name: userProfile.name,
        discipline: userProfile.discipline,
        level: userProfile.level,
        teachingStyle: userProfile.teachingStyle || "Detailed",
        specialties: userProfile.specialties,
        learningGoals: userProfile.learningGoals,
        hasProfilePicture: !!userProfile.profilePicture,
        birthday: userProfile.birthday,
        createdAt: userProfile.createdAt
          ? new Date(userProfile.createdAt).toISOString()
          : undefined,
      });
    }

    // Build teaching style instructions
    const teachingStyleInstructions = (() => {
      switch (userProfile?.teachingStyle) {
        case "Socratic":
          return [
            "TEACHING STYLE: SOCRATIC METHOD",
            "- Ask guiding questions throughout the content",
            "- Encourage critical thinking by posing 'What if...' scenarios",
            "- Build concepts through discovery rather than direct statements",
            "- Include 'Think about this...' prompts before revealing answers",
          ].join("\n");
        case "Concise":
          return [
            "TEACHING STYLE: CONCISE & DIRECT",
            "- Keep explanations brief and to the point",
            "- Use bullet points and numbered lists heavily",
            "- Avoid lengthy prose; prioritize high-yield facts",
            "- Include quick-reference tables and mnemonics",
          ].join("\n");
        case "Clinical-Cases":
          return [
            "TEACHING STYLE: CASE-BASED LEARNING",
            "- Present concepts through clinical scenarios",
            "- Include patient presentations and differential diagnoses",
            "- Connect pathophysiology to clinical decision-making",
          ].join("\n");

        case "Detailed":
        default:
          return [
            "TEACHING STYLE: DETAILED & COMPREHENSIVE",
            "- Provide thorough explanations with clinical context",
            "- Include background information and mechanisms",
            "- Use examples and analogies to reinforce concepts",
            "- Build knowledge systematically from fundamentals",
          ].join("\n");
      }
    })();

    // Build specialty focus if available
    const specialtyInstructions = userProfile?.specialties?.length
      ? `SPECIALTY FOCUS: ${userProfile.specialties.join(
          ", "
        )} - emphasize connections to these fields.`
      : "";

    // Build learning goals if available
    const goalsInstructions = userProfile?.learningGoals
      ? `LEARNING OBJECTIVES: ${userProfile.learningGoals}`
      : "";

    const contextPrompt = userProfile
      ? [
          "═══════════════════════════════════════════════════════════════",
          "👤 USER CONTEXT (PERSONALIZE OUTPUT FOR THIS LEARNER)",
          "═══════════════════════════════════════════════════════════════",
          `- Name: ${userProfile.name || "Learner"}`,
          `- Role: ${userProfile.discipline} (${userProfile.level})`,
          "",
          teachingStyleInstructions,
          "",
          specialtyInstructions,
          goalsInstructions,
          "",
          "INSTRUCTIONAL ADJUSTMENTS:",
          `1. TONE: Act as a senior mentor to a ${userProfile.level} in ${userProfile.discipline}.`,
          `2. DEPTH: ${
            userProfile.level && userProfile.level.includes("Pre-clinical")
              ? "Focus on core mechanisms and pathophysiology."
              : "Focus on clinical management, guidelines, and algorithms."
          }`,
          `3. FOCUS: Emphasize clinically relevant, practice-oriented content for this user's discipline.`,
          `4. RELEVANCE: If the user is Nursing/Allied Health, emphasize patient care and monitoring. If Medical, emphasize diagnosis and treatment.`,
          "═══════════════════════════════════════════════════════════════",
          "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    // 📝 PHASE 1 SYSTEM PROMPT - COMPREHENSIVE KNOWLEDGE GRAPH (JSON OUTPUT ONLY)
    // ⚠️ This phase uses its own 64K output token budget - separate from Phase 2
    const systemPrompt = [
      "You are Synapse Med, a Principal Medical Educator serving ALL healthcare disciplines:",
      "- MBBS/MD students preparing for board exams (USMLE, NEET-PG, PLAB)",
      "- Nursing students (BSN, MSN, NCLEX prep)",
      "- Physiotherapy/Physical Therapy students (DPT, MPT)",
      "- Physician Assistant and Allied Health learners",
      "- Specialty residents (Internal Medicine, Surgery, Pediatrics, etc.)",
      "",
      "YOUR TASK: Generate METADATA and KNOWLEDGE GRAPH as JSON ONLY.",
      "⚠️ DO NOT generate any markdown content - that comes in Phase 2 (separate API call).",
      "",
      "🎯 UNIVERSAL MISSION: CLOSE THE KNOWLEDGE GAP",
      "1. EXTRACT what the provided material DOES cover",
      "2. IDENTIFY what's MISSING but essential for clinical practice/exams",
      "3. FILL those gaps using Google Search (cite everything)",
      "4. CREATE a complete, interconnected knowledge constellation",
      "",
      "═══════════════════════════════════════════════════════════════",
      "KNOWLEDGE GRAPH - CLINICAL CONSTELLATION (15-35 NODES)",
      "═══════════════════════════════════════════════════════════════",
      "",
      "🏗️ HIERARCHICAL ARCHITECTURE:",
      "",
      "HUB NODE (1 node, Group 1, val: 20):",
      "  - The central topic/condition/system",
      "  - Example: 'Congestive Heart Failure', 'Respiratory System', 'Diabetes Mellitus'",
      "",
      "INNER RING - CORE MECHANISMS (3-6 nodes, Groups 1 & 5):",
      "  Group 1: Pathophysiological mechanisms (val: 16-18)",
      "    - e.g., 'Virchow's Triad', 'Frank-Starling Mechanism'",
      "  Group 5: Physiological processes (val: 14-17)",
      "    - e.g., 'Cardiac Output Regulation', 'Gas Exchange'",
      "",
      "MIDDLE RING - CLINICAL MANIFESTATIONS (6-10 nodes, Groups 2, 4, 7):",
      "  Group 2: Pathology/Diseases/Complications (val: 12-16)",
      "    - e.g., 'Pulmonary Edema', 'Myocardial Infarction'",
      "  Group 4: Anatomical structures (val: 10-14)",
      "    - e.g., 'Left Ventricle', 'Alveolar Membrane'",
      "  Group 7: Clinical Signs & Symptoms (val: 11-15)",
      "    - e.g., 'Orthopnea', 'Jugular Venous Distension'",
      "",
      "OUTER RING - DIAGNOSTICS & MANAGEMENT (5-12 nodes, Groups 3 & 6):",
      "  Group 3: Pharmacology/Treatments (val: 10-14)",
      "    - e.g., 'Furosemide', 'ACE Inhibitors', 'Physical Therapy Protocol'",
      "  Group 6: Diagnostic Tools (val: 9-13)",
      "    - e.g., 'Echocardiography', 'BNP Levels', 'Chest X-Ray'",
      "",
      "GROUP DEFINITIONS (Choose appropriate groups for your domain):",
      "  Group 1 (🔵 Cyan): Core concepts, mechanisms, main topic",
      "  Group 2 (🔴 Rose): Pathology, diseases, complications, disorders",
      "  Group 3 (🟣 Purple): Pharmacology, treatments, interventions, therapies",
      "  Group 4 (🟢 Teal): Anatomy, structures, organs, systems",
      "  Group 5 (🟡 Amber): Physiology, normal processes, homeostasis",
      "  Group 6 (🔷 Blue): Diagnostics, tests, imaging, assessments",
      "  Group 7 (🟠 Orange): Clinical signs, symptoms, presentations",
      "",
      "NODE REQUIREMENTS (Generate 25-50 nodes for COMPREHENSIVE coverage):",
      "",
      "⚠️ CRITICAL: Generate nodes for ALL clinical terms you plan to use in brackets!",
      "   - Include ALL related conditions, differentials, and complications",
      "   - Include ALL diagnostic tests, imaging modalities, and clinical signs",
      "   - Include ALL treatments, drugs, and interventions mentioned",
      "   - Include ALL anatomical structures and pathophysiological mechanisms",
      "   - If you will write [Cervical Myelopathy] in Phase 2, create a 'cervical-myelopathy' node HERE",
      "",
      "  - id: kebab-case, descriptive (e.g., 'left-ventricular-failure')",
      "  - label: Title case, clinical term (e.g., 'Left Ventricular Failure')",
      "  - group: 1-7 based on node type",
      "  - val: 8-20 (20=hub, 16-18=inner, 12-16=middle, 8-14=outer)",
      "  - description: ONE clinical sentence (max 15 words)",
      "  - details: 3-6 RICH paragraphs in MARKDOWN:",
      "    * Paragraph 1: Definition & Clinical Significance",
      "    * Paragraph 2: Pathophysiology/Mechanism (if applicable)",
      "    * Paragraph 3: Clinical Presentation & Exam Findings",
      "    * Paragraph 4: Diagnostic Approach",
      "    * Paragraph 5: Management & Prognosis",
      "    * Paragraph 6: High-Yield Clinical Pearl",
      "    Use **bold** for key terms, *italics* for clinical nuance",
      "    Include specific values (e.g., 'EF <40%', 'HR >100 bpm')",
      "  - synonyms: Array of alternative terms (e.g., ['MI', 'Heart Attack'])",
      "  - clinicalPearl: One-sentence high-yield exam/clinical tip",
      "  - differentials: Related conditions (for pathology nodes)",
      "",
      "LINK REQUIREMENTS (Create 30-70 connections):",
      "",
      "🔗 WEB STRUCTURE (Not a tree!):",
      "  1. Hub-to-Inner: Central topic → all mechanisms/physiology",
      "  2. Inner-to-Middle: Mechanisms → pathology/anatomy/signs",
      "  3. Middle-to-Outer: Conditions → diagnostics/treatments",
      "  4. Cross-Ring: Related concepts across all levels",
      "  5. Bidirectional: Drug ↔ Mechanism, Sign ↔ Pathology",
      "",
      "RELATIONSHIP VERBS (Precise clinical language):",
      "  Causation: 'causes', 'leads to', 'results in', 'precipitates'",
      "  Prevention: 'prevents', 'inhibits', 'blocks', 'reduces'",
      "  Location: 'occurs in', 'affects', 'localizes to', 'involves'",
      "  Mechanism: 'activates', 'suppresses', 'modulates', 'regulates'",
      "  Clinical: 'manifests as', 'presents with', 'diagnosed by', 'treated with'",
      "  Physiology: 'increases', 'decreases', 'maintains', 'impairs'",
      "",
      "═══════════════════════════════════════════════════════════════",
      "CLINICAL PEARLS - EXAM-FOCUSED INSIGHTS (6-10 pearls)",
      "═══════════════════════════════════════════════════════════════",
      "",
      "Generate pearls across these types:",
      "  - 'gap-filler': Info NOT in source but essential for practice/exams",
      "  - 'exam-tip': Board exam question patterns, buzzwords",
      "  - 'red-flag': Critical don't-miss scenarios, emergencies",
      "  - 'fact-check': Common misconceptions corrected with evidence",
      "",
      "═══════════════════════════════════════════════════════════════",
      "OUTPUT FORMAT: JSON ONLY (No markdown content)",
      "═══════════════════════════════════════════════════════════════",
      "",
      "{",
      '  "title": "Topic Title",',
      '  "summary": "2-3 sentence clinical abstract",',
      '  "eli5Analogy": "Simple analogy for complex concept",',
      '  "pearls": [{ "type": "gap-filler|exam-tip|red-flag|fact-check", "content": "...", "citation": "..." }],',
      '  "graphNodes": [',
      "    {",
      '      "id": "node-id",',
      '      "label": "Node Label",',
      '      "group": 1-7,',
      '      "val": 8-20,',
      '      "description": "One sentence",',
      '      "details": "**Rich markdown** with *formatting*...",',
      '      "synonyms": ["Alt1", "Alt2"],',
      '      "clinicalPearl": "High-yield tip",',
      '      "differentials": ["Condition A", "Condition B"]',
      "    }",
      "  ],",
      '  "graphLinks": [',
      '    { "source": "id1", "target": "id2", "relationship": "causes" }',
      "  ]",
      "}",
      "",
      "⚠️ PHASE 1 OUTPUT: JSON ONLY - Markdown guide will be generated in Phase 2.",
    ].join("\n");

    parts.push({
      text: `Analyze "${topicName}" from the uploaded lecture material.

YOUR MISSION:
1. EXTRACT what the lecture covers
2. IDENTIFY GAPS - what's missing that students need for exams?
3. FILL GAPS using Google Search
4. BUILD a comprehensive knowledge graph with 25-50 nodes

🚨 CRITICAL FOR PHASE 2 SUCCESS:
Generate nodes for EVERY clinical term you might want to highlight, including:
- All related conditions and differentials (e.g., Cervical Myelopathy, Cervical Radiculopathy)
- All diagnostic tests and imaging modalities (e.g., MRI, CT, X-ray findings)
- All clinical signs and symptoms (e.g., Neurological Symptoms, Muscle Weakness)
- All anatomical structures mentioned (e.g., Intervertebral Discs, Spinal Cord)
- All treatments and interventions (e.g., Physical Therapy, Cervical Traction)

⚠️ In Phase 2, only terms with nodes can become clickable smart links.
   If you don't create a node for "Cervical Myelopathy" here, it can't be linked in Phase 2!

Output: JSON ONLY (metadata + graph structure)
⚠️ DO NOT generate markdown content - that will be done in a separate Phase 2 API call.`,
    });

    return this.retryWithBackoff(
      async () => {
        console.log("═══════════════════════════════════════");
        console.log("🔵 PHASE 1: Metadata + Knowledge Graph");
        console.log("   📊 Separate API call (own 64K output token budget)");
        console.log("═══════════════════════════════════════");

        // Get the dynamic client (BYOK)
        const ai = await this.getClient();

        let fullText = "";
        let thoughtsCapture: string[] = [];
        let currentSubStage: "extracting" | "verifying" | "graphing" =
          "extracting";
        let hasSeenSearchContent = false;
        let hasSeenGraphContent = false;

        if (onSubStage) {
          onSubStage("extracting");
        }

        const fullSystemPrompt = contextPrompt
          ? contextPrompt + "\n\n" + systemPrompt
          : systemPrompt;

        try {
          const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: { parts: parts },
            config: {
              tools: [{ googleSearch: {} }],
              systemInstruction: fullSystemPrompt,
              temperature: 0.3,
              thinkingConfig: {
                thinkingBudget: 12288,
                includeThoughts: true,
              },
            },
          });

          for await (const chunk of stream) {
            if (chunk.candidates?.[0]?.content?.parts) {
              for (const part of chunk.candidates[0].content.parts) {
                const partAny = part as any;

                if (partAny.thought === true) {
                  const thoughtText = partAny.text || "";
                  if (thoughtText && thoughtText.trim()) {
                    thoughtsCapture.push(thoughtText);
                    if (onThought) {
                      onThought(thoughtText);
                    }

                    const lowerThought = thoughtText.toLowerCase();

                    if (
                      !hasSeenSearchContent &&
                      (lowerThought.includes("search") ||
                        lowerThought.includes("google") ||
                        lowerThought.includes("verify") ||
                        lowerThought.includes("cross-reference") ||
                        lowerThought.includes("looking up"))
                    ) {
                      hasSeenSearchContent = true;
                      if (currentSubStage === "extracting") {
                        currentSubStage = "verifying";
                        if (onSubStage) onSubStage("verifying");
                      }
                    }

                    if (
                      !hasSeenGraphContent &&
                      (lowerThought.includes("graph") ||
                        lowerThought.includes("node") ||
                        lowerThought.includes("link") ||
                        lowerThought.includes("constellation") ||
                        lowerThought.includes("json"))
                    ) {
                      hasSeenGraphContent = true;
                      if (currentSubStage !== "graphing") {
                        currentSubStage = "graphing";
                        if (onSubStage) onSubStage("graphing");
                      }
                    }
                  }
                } else if (part.text && !partAny.thought) {
                  fullText += part.text;

                  if (
                    !hasSeenGraphContent &&
                    fullText.includes('"graphNodes"')
                  ) {
                    hasSeenGraphContent = true;
                    currentSubStage = "graphing";
                    if (onSubStage) onSubStage("graphing");
                  }
                }
              }
            }

            if (
              chunk.candidates?.[0]?.groundingMetadata &&
              !hasSeenSearchContent
            ) {
              hasSeenSearchContent = true;
              if (currentSubStage === "extracting") {
                currentSubStage = "verifying";
                if (onSubStage) onSubStage("verifying");
              }
            }
          }

          const parsed = this.extractJson(fullText || "{}");

          if (!parsed || typeof parsed !== "object") {
            throw new Error("Phase 1 failed: Invalid JSON response structure");
          }

          if (!parsed.title) {
            parsed.title = topicName;
          }

          if (!parsed.graphNodes || !Array.isArray(parsed.graphNodes)) {
            throw new Error(
              "Phase 1 failed: No knowledge graph nodes generated"
            );
          }

          const validNodeIds = new Set(parsed.graphNodes.map((n: any) => n.id));

          // 🔧 FIX: Normalize link properties - AI may return 'label' but we need 'relationship'
          const validLinks = (parsed.graphLinks || [])
            .filter(
              (l: any) =>
                validNodeIds.has(l.source) && validNodeIds.has(l.target)
            )
            .map((l: any) => ({
              source: l.source,
              target: l.target,
              relationship: l.relationship || l.label || "relates to", // Handle both property names
            }));

          console.log("✅ PHASE 1 Complete");
          console.log(
            `   📊 Nodes: ${parsed.graphNodes.length} | Links: ${validLinks.length}`
          );
          console.log(`   📝 Phase 1 used its own 64K token budget`);
          console.log("═══════════════════════════════════════\n");

          return {
            title: parsed.title || topicName,
            summary: parsed.summary || "",
            eli5Analogy: parsed.eli5Analogy,
            pearls: (parsed.pearls || []).map((p: any) => ({
              type: p.type as
                | "gap-filler"
                | "exam-tip"
                | "red-flag"
                | "fact-check",
              content: p.content,
              citation: p.citation,
            })),
            graphNodes: parsed.graphNodes || [],
            graphLinks: validLinks,
          };
        } catch (error: any) {
          // Handle API errors with user-friendly messages
          this.handleApiError(error);
        }
      },
      3,
      1000
    );
  }

  // ===============================
  // PHASE 2: Markdown Generation with Auto-Continuation
  // ===============================
  async generateMarkdownStreaming(
    files: FileInput[],
    topicName: string,
    graphNodes: KnowledgeNode[],
    onProgress: (markdown: string) => void,
    previousContent?: string,
    continueFromSection?: string,
    onThought?: (thought: string) => void,
    phase1Context?: {
      title: string;
      summary: string;
      eli5Analogy?: string;
      pearls: { type: string; content: string }[];
    },
    userProfile?: UserProfile
  ): Promise<{ markdown: string; sources: Source[] }> {
    // API key is fetched dynamically via getClient()

    const parts: any[] = [];

    // ⚠️ CRITICAL: Re-send ALL user uploaded files to Phase 2
    // This gives the AI FULL ACCESS to original source material for accurate citations
    for (const file of files) {
      const base64Data = file.base64.split(",")[1];
      parts.push({
        inlineData: {
          mimeType: file.file.type,
          data: base64Data,
        },
      });
    }

    // 🆕 Build comprehensive Phase 1 context for Phase 2
    const phase1ContextSummary = phase1Context
      ? [
          "═══════════════════════════════════════════════════════════════",
          "🟢 PHASE 2: Master Guide Generation (MARKDOWN ONLY)",
          "═══════════════════════════════════════════════════════════════",
          "",
          "⚡ SPEED OPTIMIZATION: Focus on comprehensive clinical content",
          "   - You have FULL 64K output token budget for markdown",
          "   - All uploaded files have been RE-SENT to you (full context)",
          "   - Phase 1 metadata is provided below (don't regenerate it)",
          "   - 🔍 Google Search is ENABLED - use it to fill gaps and CITE sources",
          "",
          "🎯 YOUR EXCLUSIVE MISSION (Phase 2):",
          "Generate a comprehensive, board-exam-ready MARKDOWN study guide that:",
          "   ✅ Uses clinical terms from Phase 1 knowledge graph (auto-linked by client)",
          "   ✅ **CITES authoritative sources inline throughout the text**",
          "   ✅ Fills knowledge gaps not covered in uploaded materials using Google Search",
          "   ✅ Follows the 9+ section structure (dynamic based on complexity)",
          "   ✅ Uses JSON code blocks for tables (medications, differentials, etc.)",
          "",
          "📚 INLINE CITATION REQUIREMENTS (MANDATORY):",
          "   When adding information from Google Search or external knowledge:",
          "   ",
          "   ✅ ALWAYS cite authoritative sources inline like this:",
          "      - 'According to the American Heart Association, [information]...'",
          "      - '...with an annual incidence of 1-2 per 1,000 people [CDC, 2023]'",
          "      - 'The Mayo Clinic guidelines recommend [treatment]...'",
          "      - 'Recent studies from Johns Hopkins indicate [finding]...'",
          "      - '...as reported by the National Institutes of Health'",
          "   ",
          "   ✅ Mention source domains naturally:",
          "      - American College of Cardiology (acc.org)",
          "      - Centers for Disease Control (cdc.gov)",
          "      - Mayo Clinic (mayoclinic.org)",
          "      - National Institutes of Health (nih.gov)",
          "      - UpToDate, Medscape, PubMed studies",
          "   ",
          "   ✅ For uploaded content, use: [Uploaded: Page X]",
          "   ✅ For statistics/data, cite the source: '...affecting 1M people annually [WHO]'",
          "   ",
          "   ❌ DO NOT write generic statements without attribution",
          "   ❌ DO NOT rely solely on uploaded material - actively search for gaps",
          "",
          "⚠️⚠️⚠️ CRITICAL: DO NOT REGENERATE Phase 1 Content ⚠️⚠️⚠️",
          "   ❌ ABSOLUTELY NO 'Clinical Pearls' section in your markdown",
          "   ❌ NO pearl boxes (exam-tip, gap-filler, red-flag, fact-check) ANYWHERE",
          "   ❌ NO pearls at the END of your guide (extremely common mistake - FORBIDDEN)",
          "   ❌ NO 'References' or 'Sources' section (auto-extracted from citations)",
          "   ❌ NO title regeneration (use Phase 1 title provided below)",
          "   ❌ NO ELI5 boxes (Phase 1 analogy shown separately)",
          "",
          "🚫🚫🚫 TRIPLE WARNING: After your last section, STOP WRITING IMMEDIATELY 🚫🚫🚫",
          "   Common AI mistake: Adding exam-tip/gap-filler/red-flag/fact-check at the end",
          "   If you add ANY pearls after your final section, the output will be REJECTED.",
          "",
          "✅ Your markdown will be COMBINED with Phase 1 metadata by the client:",
          "   - Clinical pearls appear in dedicated UI section",
          "   - Verified sources extracted from grounding metadata",
          "   - Smart links auto-created from your clinical term usage",
          "",
          `🔗 KNOWLEDGE GRAPH: ${graphNodes.length} nodes generated in Phase 1`,
          "",
          "⚠️⚠️⚠️ CRITICAL SMART LINKING RULES (READ CAREFULLY) ⚠️⚠️⚠️",
          "",
          "🚫 FORBIDDEN: Using brackets for terms NOT in this list!",
          "   ❌ If a term is NOT listed below, DO NOT put it in [brackets]",
          "   ❌ Brackets are ONLY for terms that exist in the knowledge graph",
          "   ❌ Writing [Random Term] when 'Random Term' is not a node = BROKEN LINK",
          "",
          "✅ CORRECT: Use brackets ONLY for these exact labels:",
          ...graphNodes
            .slice(0, 100) // Show all nodes up to 100
            .map((node, idx) => `  ${idx + 1}. ✅ [${node.label}]`),
          graphNodes.length > 100
            ? `  ... and ${graphNodes.length - 100} more nodes available`
            : "",
          "",
          "📌 SMART LINKING STRATEGY:",
          "1. SCAN the list above before writing each section",
          "2. ONLY use [brackets] for terms that EXACTLY match a label above",
          "3. For terms NOT in the list, write them as plain text (no brackets)",
          "4. Client auto-converts [Label] → clickable link ONLY if Label exists in graph",
          "",
          "Example:",
          "   ✅ If 'Cervical Lordosis' is in list: Write [Cervical Lordosis]",
          "   ❌ If 'Random Syndrome' is NOT in list: Write 'Random Syndrome' (no brackets)",
          "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    // 📝 COMPREHENSIVE PHASE 2 SYSTEM PROMPT (FULL VERSION - NOT SIMPLIFIED)
    // Optimized for implicit caching: stable prefix + variable context
    // Determine preferred word-count ranges dynamically from user's teaching style
    const [targetMin, targetMax] = (() => {
      switch (userProfile?.teachingStyle) {
        case "Socratic":
          return [3000, 4500];
        case "Concise":
          return [2000, 3000];
        case "Detailed":
          return [5000, 8000];
        case "Clinical-Cases":
          return [4500, 7000];

        default:
          return [4000, 6000];
      }
    })();

    const preferredWordRange = `${targetMin}-${targetMax}`;
    // For complex, multi-system topics allow a modest uplift but cap to sane upper bound
    const complexRange = `${Math.min(targetMax + 2000, 8000)}`;

    const systemPrompt = [
      // ═══════════════════════════════════════════════════════════════
      // STABLE PREFIX FOR IMPLICIT CACHING (Keep identical across requests)
      // Gemini 2.5 Flash: 90% discount on cached tokens with consistent prefix
      // ═══════════════════════════════════════════════════════════════
      "You are Synapse Med, a Principal Medical Educator serving ALL healthcare disciplines:",
      "- MBBS/MD students preparing for board exams (USMLE, NEET-PG, PLAB)",
      "- Nursing students (BSN, MSN, NCLEX prep)",
      "- Physiotherapy/Physical Therapy students (DPT, MPT)",
      "- Physician Assistant and Allied Health learners",
      "- Specialty residents (Internal Medicine, Surgery, Pediatrics, Pharmacy, etc.)",
      "",
      "YOUR TASK: Generate a COMPREHENSIVE, BOARD-EXAM FOCUSED MARKDOWN STUDY GUIDE.",
      "",
      "⚠️ CRITICAL ARCHITECTURE: Two-Phase System",
      "   - PHASE 1 (completed): Metadata + Knowledge Graph (JSON, separate API call)",
      "   - PHASE 2 (current): Master Guide Generation (Markdown, this API call)",
      "   - Clinical Pearls were ALREADY generated in Phase 1",
      "   - You have FULL ACCESS to original uploaded files (re-sent for this phase)",
      "   - Use your FULL 64K output token budget for comprehensive markdown",
      "   - Generate 5000-8000 words of detailed, clinically rich material",
      "   - Maintain COHERENCE with Phase 1 metadata (title, summary, pearls)",
      "",
      phase1ContextSummary,
      "",
      "🎯 UNIVERSAL MISSION: CLOSE THE KNOWLEDGE GAP",
      "Lectures and textbooks often leave critical gaps. Your mission:",
      "1. EXTRACT what the uploaded lecture/material DOES cover",
      "   → Cite as [Uploaded: Page X] or [Lecture: Slide Y]",
      "2. IDENTIFY what's MISSING but essential for exams/clinical practice",
      "   → Use diagnostic criteria, treatment values, clinical algorithms, etc.",
      "3. FILL GAPS using Google Search (REQUIRED - not optional)",
      "   → Cite ALL external sources with proper URLs",
      "4. CREATE board-exam focused, comprehensive content",
      "   → Include high-yield facts, clinical pearls embedded in text",
      "5. NATURALLY INTEGRATE terms from Phase 1 knowledge graph",
      "   → Client will auto-link them to interactive graph nodes",
      "",
      "═══════════════════════════════════════════════════════════════",
      "GOOGLE SEARCH INTEGRATION - ACTIVE GAP FILLING (REQUIRED)",
      "═══════════════════════════════════════════════════════════════",
      "",
      "You have access to Google Search via the `googleSearch` tool.",
      "USE IT ACTIVELY - this is NOT optional. Gap filling is MANDATORY.",
      "",
      "🔍 WHEN TO SEARCH (Use for EVERY section):",
      "  ✅ When uploaded material lacks specific numerical values (BP >140/90, EF <40%)",
      "  ✅ When mechanism details are incomplete or superficial",
      "  ✅ When treatment protocols need current evidence-based guidelines",
      "  ✅ When epidemiological data is missing (prevalence, incidence, mortality)",
      "  ✅ When differential diagnosis needs expansion beyond lecture notes",
      "  ✅ When diagnostic criteria are incomplete (DSM-5, ICD-11, clinical scores)",
      "  ✅ When prognostic data is absent (5-year survival, recurrence rates)",
      "",
      "🔍 HOW TO SEARCH EFFECTIVELY:",
      `  1. Specific clinical queries: "${topicName} pathophysiology cellular mechanism"`,
      `  2. Current guidelines: "${topicName} ACC AHA ESC guidelines 2024"`,
      `  3. Diagnostic criteria: "${topicName} diagnostic criteria values DSM ICD"`,
      `  4. Evidence-based treatment: "${topicName} first-line treatment RCT meta-analysis"`,
      `  5. Epidemiology: "${topicName} prevalence incidence mortality demographics"`,
      `  6. Clinical scores: "${topicName} risk stratification calculator score"`,
      "",
      "🔍 SEARCH RESULT VALIDATION (Filter rigorously):",
      "  ✓ ACCEPT: PubMed, Cochrane, NEJM, JAMA, Lancet, BMJ",
      "  ✓ ACCEPT: UpToDate, Mayo Clinic, Cleveland Clinic, Johns Hopkins",
      "  ✓ ACCEPT: WHO, CDC, NIH, FDA, NHS, EMA official guidelines",
      "  ✓ ACCEPT: ACC, AHA, ACP, AMA, ESC, ERS specialty society guidelines",
      "  ✓ ACCEPT: NICE, SIGN, ATS, IDSA evidence-based recommendations",
      "",
      "  ✗ REJECT: Blog posts, health news sites, WebMD-style articles",
      "  ✗ REJECT: Social media, forums, Reddit, Quora discussions",
      "  ✗ REJECT: Commercial product pages, supplement sellers",
      "  ✗ REJECT: Wikipedia, general encyclopedias (use as starting point only)",
      "  ✗ REJECT: Sources older than 5 years (unless landmark studies)",
      "  ✗ REJECT: Unrelated topics or vague search results",
      "",
      "═══════════════════════════════════════════════════════════════",
      "🔵 PHASE 1: Metadata + Knowledge Graph Generation (JSON ONLY)",
      "═══════════════════════════════════════════════════════════════",
      "",
      "⚡ SPEED OPTIMIZATION: This phase uses its OWN 64K token budget",
      "   - Focus ONLY on structured metadata and graph",
      "   - NO markdown content generation (that's Phase 2's job)",
      "   - NO detailed explanations (save for Phase 2)",
      "   - Output PURE JSON for fast parsing",
      "",
      "🎯 YOUR EXCLUSIVE MISSION (Phase 1):",
      "1. Extract/generate TITLE and concise SUMMARY (2-3 sentences)",
      "2. Create ELI5 ANALOGY (one creative analogy for complex concept)",
      "3. Generate 6-10 CLINICAL PEARLS (gap-fillers, exam-tips, red-flags, fact-checks)",
      "4. Build KNOWLEDGE GRAPH with 25-50 nodes and their relationships",
      "",
      "⚠️ CRITICAL: DO NOT GENERATE:",
      "   ❌ Markdown content or explanations (Phase 2 will do this)",
      "   ❌ Detailed pathophysiology discussions (Phase 2 will do this)",
      "   ❌ Treatment protocols or guidelines (Phase 2 will do this)",
      "   ❌ Diagnostic algorithms (Phase 2 will do this)",
      "",
      "✅ Your output will be PASSED TO PHASE 2 which will:",
      "   - Use your graph nodes for smart linking",
      "   - Reference your pearls (so DON'T repeat them in markdown)",
      "   - Use your title and summary as foundation",
      "",
      "═══════════════════════════════════════════════════════════════",
      "MARKDOWN STRUCTURE - COMPLETE CLINICAL GUIDE (DYNAMIC SECTIONS - 9+ AS NEEDED)",
      "═══════════════════════════════════════════════════════════════",
      "",
      "FOR DISEASE/CONDITION TOPICS (Adapt structure to domain):",
      "",
      "1. **Overview & Epidemiology**",
      "   - Definition (1-2 sentences, board-exam level)",
      "   - Prevalence, incidence (with numbers and demographics)",
      "   - Mortality/morbidity statistics",
      "   - Epidemiological trends (regional variations, age/sex predilection)",
      "",
      "2. **Pathophysiology**",
      "   - Cellular and molecular mechanisms (detailed)",
      "   - Affected organ systems and cascade of events",
      "   - Biochemical pathways (with enzyme names, mediators)",
      "   - Pathological changes (gross and microscopic if relevant)",
      "",
      "3. **Etiology & Risk Factors**",
      "   - Genetic factors (specific genes, inheritance patterns)",
      "   - Environmental exposures (chemicals, infections, lifestyle)",
      "   - Modifiable vs. non-modifiable risk factors",
      "   - Relative risk quantification when available",
      "",
      "4. **Clinical Presentation**",
      "   - Cardinal signs and symptoms (with typical onset, duration)",
      "   - Physical examination findings (inspection, palpation, auscultation)",
      "   - Clinical variants (atypical presentations, special populations)",
      "   - Natural history and disease progression",
      "",
      "5. **Diagnostic Workup**",
      "   - Laboratory tests (specific values, sensitivity/specificity)",
      "   - Imaging modalities (findings, when to order)",
      "   - Diagnostic criteria (official guidelines - e.g., 'Revised Jones Criteria')",
      "   - Diagnostic algorithms (step-by-step approach)",
      "   - Differential diagnosis considerations",
      "",
      "6. **Differential Diagnosis**",
      "   - Rule-out conditions (top 5-10 differentials)",
      "   - Distinguishing clinical features (what sets them apart)",
      "   - Key diagnostic tests to differentiate",
      "   - Clinical decision rules when applicable",
      "",
      "7. **Management**",
      "   - Initial stabilization (ABCs, emergency interventions)",
      "   - Pharmacologic therapy:",
      "     * First-line agents (drug names, doses, mechanisms)",
      "     * Second-line options, combination therapy",
      "     * Adverse effects, contraindications, monitoring",
      "   - Non-pharmacologic interventions:",
      "     * Lifestyle modifications, diet, exercise",
      "     * Physical therapy, occupational therapy",
      "     * Psychosocial support",
      "   - Surgical/procedural options (indications, techniques)",
      "   - Treatment algorithms (acute vs. chronic management)",
      "",
      "8. **Complications**",
      "   - Short-term complications (hours to days)",
      "   - Long-term complications (months to years)",
      "   - Prevention strategies for common complications",
      "   - Red flags indicating complications",
      "",
      "9. **Prognosis & Prevention**",
      "   - Natural history without treatment",
      "   - Outcomes with treatment (5-year survival, remission rates)",
      "   - Prognostic factors (good vs. poor prognosis indicators)",
      "   - Primary prevention (vaccines, lifestyle, screening)",
      "   - Secondary prevention (preventing recurrence, complications)",
      "   - Tertiary prevention (rehabilitation, quality of life)",
      "",
      "✅ DYNAMIC COMPREHENSIVE CONTENT - NO ARTIFICIAL SECTION LIMITS",
      "   The sections above are the MINIMUM foundation.",
      "   For complex clinical topics, ADD ADDITIONAL SECTIONS AS NEEDED:",
      "",
      "10. **Advanced Therapeutics** (if relevant)",
      "    - Novel pharmacological agents, biologics, gene therapy",
      "    - Emerging treatment modalities, clinical trials",
      "    - Personalized medicine approaches",
      "",
      "11. **Special Populations** (if relevant)",
      "    - Pediatric considerations (dosing, unique presentations)",
      "    - Geriatric considerations (polypharmacy, altered pharmacokinetics)",
      "    - Pregnancy and lactation (safety, teratogenicity)",
      "    - Immunocompromised patients",
      "",
      "12. **Quality Metrics & Guidelines** (if relevant)",
      "    - Current clinical practice guidelines (AHA, ACC, ESC, etc.)",
      "    - Quality improvement measures",
      "    - Screening recommendations (USPSTF ratings)",
      "",
      "13. **Case-Based Integration** (if helpful for learning)",
      "    - Clinical vignettes demonstrating key concepts",
      "    - Diagnostic reasoning workflows",
      "    - Common exam question patterns",
      "",
      "⚠️ CRITICAL CONTENT RULES:",
      "   ❌ Do NOT add 'Clinical Pearls' section (already in Phase 1 metadata)",
      "   ❌ Do NOT add 'References' or 'Sources' section (extracted via grounding)",
      "   ✅ DO generate as many sections as clinically necessary (10, 12, 15+ sections OK)",
      "   ✅ DO end naturally when topic is comprehensively covered",
      "   ✅ DO prioritize depth over breadth - better to cover fewer topics thoroughly",
      "",
      "═══════════════════════════════════════════════════════════════",
      "FORMATTING RULES - CLINICAL EXCELLENCE & BOARD EXAM FOCUS",
      "═══════════════════════════════════════════════════════════════",
      "",
      "═══════════════════════════════════════════════════════════════",
      "🚨 UNIVERSAL TABLE RULE: JSON ARRAYS ONLY",
      "═══════════════════════════════════════════════════════════════",
      "",
      "⚠️ NEVER use Markdown tables (| col | col |). They break formatting.",
      "✅ ALWAYS use a JSON code block containing an ARRAY of objects.",
      "",
      "FORMAT:",
      "```json",
      "[",
      '  { "Column_Name_1": "Value", "Column_Name_2": "Value" },',
      '  { "Column_Name_1": "Value", "Column_Name_2": "Value" }',
      "]",
      "```",
      "",
      "RULES:",
      "1. The JSON must be a **flat array** of objects.",
      "2. Keys become column headers (e.g., 'Drug_Name', 'Dosage').",
      "3. Values must be STRINGS (no nested objects/arrays).",
      "4. If a value is a list, join it with commas (e.g., 'Nausea, Vomiting').",
      "5. You can create a table for ANY data type (Meds, Labs, Differentials) using this format.",
      "",
      "═══════════════════════════════════════════════════════════════",
      "📚 CITATION & SOURCING REQUIREMENTS - ULTRA-RIGOROUS (MANDATORY)",
      "═══════════════════════════════════════════════════════════════",
      "",
      "🎯 CITATION TARGETS:",
      "   - Minimum 20-30 inline citations per guide",
      "   - At least 1 citation per major section",
      "   - 2-3 citations for key statistics/facts",
      "   - Cite ALL quantitative claims (incidence, prevalence, mortality rates)",
      "",
      "✅ MANDATORY CITATION FORMAT:",
      "   Organization/Journal Name, Year",
      "   ",
      "   Examples:",
      "   - '...VTE affects 1-2 per 1,000 people annually CDC, 2023'",
      "   - '...mortality rates of 2-10% European Society of Cardiology, 2019'",
      "   - 'Factor V Leiden affects 3-8% of Caucasians Mayo Clinic, 2024'",
      "   - 'According to American Heart Association, 2023, DAPT is recommended...'",
      "",
      "🔍 AUTHORITATIVE SOURCES TO USE:",
      "   Medical Organizations:",
      "   - American Heart Association (AHA)",
      "   - American College of Cardiology (ACC)",
      "   - European Society of Cardiology (ESC)",
      "   - American College of Chest Physicians (ACCP)",
      "",
      "   Government/Public Health:",
      "   - Centers for Disease Control (CDC)",
      "   - National Institutes of Health (NIH)",
      "   - World Health Organization (WHO)",
      "",
      "   Clinical Resources:",
      "   - Mayo Clinic",
      "   - Cleveland Clinic",
      "   - UpToDate",
      "   - Medscape",
      "",
      "   Journals (when citing specific studies):",
      "   - New England Journal of Medicine (NEJM)",
      "   - The Lancet",
      "   - JAMA",
      "   - Circulation",
      "",
      "✅ CITATION QUALITY GUIDELINES:",
      "   - Prefer organization guidelines over individual studies",
      "   - Use 2023-2024 sources when possible (critical for board exams)",
      "   - Diversify sources - AIM FOR 12+ UNIQUE SOURCES",
      "   - For uploaded content: [Uploaded: Page X]",
      "",
      "❌❌❌ CRITICAL: CITATIONS MUST BE CLICKABLE MARKDOWN LINKS ❌❌❌",
      "   Every citation MUST use this EXACT format:",
      "   ✅ CORRECT: According to [Mayo Clinic, 2024](https://www.mayoclinic.org/...) the prevalence is...",
      "   ✅ CORRECT: Studies show [Harrison et al., 2014](https://scholar.google.com/scholar?q=Harrison+cervical+lordosis+2014)...",
      "   ✅ CORRECT: The mechanism involves [Cohen, 2015](https://pubmed.ncbi.nlm.nih.gov/...)...",
      "   ",
      "   ❌ WRONG: According to Mayo Clinic, 2024 the prevalence...",
      "   ❌ WRONG: Studies show Harrison et al., 2014...",
      "   ",
      "   FORMAT REQUIRED: [Source Name, Year](full_url)",
      "   - Source Name can be: 'Mayo Clinic', 'CDC', 'Harrison et al.', 'WHO', etc.",
      "   - Year: 4-digit year",
      "   - URL: Use actual URLs when possible (mayo clinic.org, cdc.gov, scholar.google.com, pubmed.gov)",
      "   - If exact URL unknown, use: https://scholar.google.com/scholar?q=[search_terms]",
      "",
      "❌ DO NOT:",
      "   - Use vague attributions ('studies show...' without citation)",
      "   - Cite the same source repeatedly (spread citations across different sources)",
      "   - Use plain text citations like 'Mayo Clinic, 2024' - MUST be clickable links",
      "",
      "═══════════════════════════════════════════════════════════════",
      "CONTENT LENGTH & TOKEN OPTIMIZATION:",
      `  - Target ${preferredWordRange} words for most medical topics (fits comfortably in 64K output tokens)`,
      `  - Complex topics (multi-system diseases, syndromes) may warrant up to ${complexRange} words`,
      "  - Prioritize DEPTH over LENGTH - better to thoroughly cover essential content",
      "  - Each section should be complete - do NOT truncate mid-section due to length",
      "  - If approaching token limit, STOP at natural section break, do NOT cut off abruptly",
      "   - NO artificial section limits - generate sections 10, 11, 12+ if clinically warranted",
      "",
      "═══════════════════════════════════════════════════════════════",
      "⚠️⚠️⚠️ FINAL CRITICAL REMINDER: END YOUR GUIDE CLEANLY ⚠️⚠️═══════════════════════════════════════════════════════════════",
      "",
      "After completing your FINAL section, STOP IMMEDIATELY.",
      "  - Generate sections 9, 10, 11, 12+ as needed for comprehensive coverage",
      "  - When topic is fully covered, end after your last numbered section",
      "",
      "❌ DO NOT append any of the following after your last section:",
      "   - Clinical Pearls section or boxes",
      "   - exam-tip, gap-filler, red-flag, fact-check labels",
      "   - References or Sources section",
      "   - Summary or conclusion paragraphs",
      "   - 'Verified Sources' listings",
      "",
      "✅ Your guide ends CLEANLY after the last section you write.",
      "   Example: If you write sections 1-11, end immediately after section 11.",
      "   Example: If you write sections 1-9, end immediately after section 9.",
      "",
      "═══════════════════════════════════════════════════════════════",
      "🔗 SMART LINKING - Interactive Knowledge Graph (Phase 1 Integration)",
      "═══════════════════════════════════════════════════════════════",
      "",
      `📊 Phase 1 generated ${graphNodes.length} knowledge graph nodes.`,
      "",
      "🎯 HOW SMART LINKS WORK FOR STUDENTS:",
      "   When you mention these terms, they become CLICKABLE links.",
      "   Students can click any term to:",
      "   ✅ Jump directly to the Knowledge Graph visualization",
      "   ✅ See that node highlighted and its connections",
      "   ✅ Explore related concepts interactively",
      "   ✅ Understand relationships between concepts visually",
      "",
      "📝 YOUR TASK - SMART LINKING (CRITICAL):",
      "   - Use these terms NATURALLY throughout your guide",
      "   - Surround them with [square brackets] in your markdown",
      "   - The client auto-converts [term] → [term](node:id) for you",
      "",
      "⚠️⚠️⚠️ CRITICAL: USE EXACT LABELS, NOT HYPHENATED IDs ⚠️⚠️⚠️",
      "   ✅ CORRECT: [Chronic Neck Pain] - uses the LABEL from Phase 1",
      "   ❌ WRONG:  [chronic-neck-pain] - this is the ID, NOT the label!",
      "",
      "   ✅ CORRECT: [Loss of Cervical Lordosis]",
      "   ❌ WRONG:  [loss-of-cervical-lordosis]",
      "",
      "   ✅ CORRECT: [Virchow's Triad]",
      "   ❌ WRONG:  [virchows-triad]",
      "",
      "   The LABEL is human-readable (Title Case with spaces).",
      "   The ID is kebab-case (for internal use only).",
      "   YOU MUST USE THE LABEL, NEVER THE ID.",
      "",
      `🔍 AVAILABLE GRAPH NODES (Top 50 of ${graphNodes.length}):`,
      "   FORMAT: [Label to use] (id: internal-id)",
      ...graphNodes
        .slice(0, 50)
        .map(
          (node, idx) =>
            `  ${idx + 1}. [${node.label}] (id: ${node.id}) - Group ${
              node.group || "?"
            }`
        ),
      "",
      "💡 When writing, use the LABEL in brackets: [${node.label}], NOT [${node.id}]",
      graphNodes.length > 50
        ? `  ... and ${graphNodes.length - 50} more nodes available`
        : "",
      "",
      "📌 INTEGRATION STRATEGY:",
      "  - Use EXACT labels from the list above (Title Case, spaces, proper punctuation)",
      "  - Naturally mention these terms in context (e.g., 'The [Frank-Starling Mechanism]...')",
      "  - Don't force terms if not clinically relevant",
      "  - Client handles the linking syntax - focus on content quality",
      "",
      "═══════════════════════════════════════════════════════════════",
      "CITATION STRATEGY - ULTRA-LEGITIMATE SOURCES & PROPER GROUNDING",
      "═══════════════════════════════════════════════════════════════",
      "",
      "🔍 GOOGLE SEARCH GROUNDING (Free Tier - 1M queries/day limit):",
      `Current topic: "${topicName}"`,
      "",
      "SEARCH QUERY CONSTRUCTION:",
      "  ✅ GOOD: 'congestive heart failure ACC AHA guidelines 2024'",
      "  ✅ GOOD: 'diabetes mellitus type 2 pathophysiology mechanism insulin resistance'",
      "  ✅ GOOD: 'myocardial infarction STEMI diagnostic criteria troponin threshold'",
      "",
      "  ✗ BAD: 'heart failure' (too vague)",
      "  ✗ BAD: 'diabetes treatment' (not specific enough)",
      "",
      "SOURCE FILTERING (BEFORE citing):",
      "  ✓ PubMed: pubmed.ncbi.nlm.nih.gov",
      "  ✓ Mayo Clinic: mayoclinic.org",
      "  ✓ Cleveland Clinic: my.clevelandclinic.org",
      "  ✓ UpToDate: uptodate.com",
      "  ✓ Specialty Societies: acc.org, heart.org, diabetes.org, etc.",
      "  ✓ Government: cdc.gov, nih.gov, fda.gov, who.int",
      "",
      "  ✗ Wikipedia, WebMD, health blogs, forums",
      "  ✗ Commercial sites, news articles",
      "  ✗ Unverified medical sites",
      "",
      "═══════════════════════════════════════════════════════════════",
      "INLINE CITATION STANDARDS - SENTENCE-LEVEL CONTEXTUAL RELEVANCE",
      "═══════════════════════════════════════════════════════════════",
      "",
      "EVERY medical claim needs inline citation IMMEDIATELY after:",
      "",
      "✅ EXCELLENT CITATION EXAMPLES (Contextually relevant):",
      '  "Left ventricular ejection fraction (LVEF) <40% defines systolic heart failure [ACC/AHA HF Guidelines](https://www.ahajournals.org/...)"',
      '  "ACE inhibitors reduce all-cause mortality by 23% in HFrEF [SOLVD Trial](https://pubmed.ncbi.nlm.nih.gov/1463530/)"',
      '  "Hemoglobin A1c >6.5% on two separate occasions confirms diabetes diagnosis [ADA Standards](https://diabetesjournals.org/...)"',
      "",
      "CITATION PLACEMENT RULES:",
      "  ✅ Citation must DIRECTLY support the SPECIFIC claim in THAT sentence",
      "  ✅ Cited source must discuss the EXACT mechanism/drug/value mentioned",
      "  ✅ Aim for 1 citation per 30-50 words (3-4 per paragraph) - TARGET 25-35 CLICKABLE CITATIONS TOTAL",
      "  ✅ EVERY citation MUST be a clickable markdown link: [Source, Year](url)",
      "",
      "  ❌ NOT: Generic citation at paragraph end",
      "  ❌ NOT: Citation vaguely related to general topic",
      "  ❌ NOT: Plain text citations (Mayo Clinic, 2024) - MUST be links!",
      "  ❌ NOT: Same citation repeated for unrelated claims",
      "",
      "📚 SOURCE PRIORITY (Cite in this order):",
      "  1. [Uploaded: Page X] - From user's uploaded lecture/material",
      "  2. [Author Year](url) - Peer-reviewed journal from Google Search",
      "  3. [Society Guidelines Year](url) - ACC, AHA, ESC, etc.",
      "  4. [Institution](url) - Mayo, Cleveland, Johns Hopkins",
      "",
      "CITATION FORMAT EXAMPLES:",
      "  • Uploaded: [Uploaded: Page 15] or [Lecture: Slide 23]",
      "  • Journal: [Harrison et al. 2014](https://pubmed.ncbi.nlm.nih.gov/24847137/)",
      "  • Guideline: [ACC/AHA 2023](https://www.ahajournals.org/doi/10.1161/...)",
      "  • Institution: [Mayo Clinic 2024](https://www.mayoclinic.org/diseases-conditions/...)",
      "",
      "═══════════════════════════════════════════════════════════════",
      "QUALITY CONTROL CHECKLIST (Self-validate before completion)",
      "═══════════════════════════════════════════════════════════════",
      "□ 5000-8000 words of detailed content generated",
      "□ Sections flow naturally (extend beyond 9 if topic complexity demands it)",
      "□ Google Search used to fill knowledge gaps (not just uploaded material)",
      "□ Every major claim has CLICKABLE inline citation (TARGET 25-35 TOTAL, ALL AS MARKDOWN LINKS)",
      "□ Numerical values included with units (BP, labs, EF, etc.)",
      "□ Knowledge graph node terms mentioned naturally",
      "□ JSON code blocks used instead of markdown tables",
      "□ NO 'Clinical Pearls' section added (already in Phase 1)",
      "□ NO 'References' section added (handled by grounding)",
      "□ Guide ends cleanly after your final section (no matter which number it is)",
      "□ Coherent with Phase 1 summary and title",
      "",
      continueFromSection
        ? "═══════════════════════════════════════════════════════════════"
        : "",
      continueFromSection ? "⚠️ CONTINUATION MODE ACTIVATED" : "",
      continueFromSection
        ? "═══════════════════════════════════════════════════════════════"
        : "",
      continueFromSection
        ? `You are generating a COMPREHENSIVE medical study guide.

📌 CONTEXT: This is a CONTINUATION from "${continueFromSection}"

  - Complete all remaining sections
  - Maintain medical accuracy and board-exam focus
  - Use inline citations throughout
  - End cleanly after your final section`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const userPrompt = continueFromSection
      ? `Continue the markdown study guide for "${topicName}" from section "${continueFromSection}".

CRITICAL REQUIREMENTS:
- Complete remaining sections ONLY (pick up from "${continueFromSection}")
- Do NOT repeat any previous content
- Do NOT add 'Clinical Pearls' section (already in Phase 1)
- Do NOT add 'References' section (handled separately)
- End cleanly after your final section (no matter which number it is)`
      : `Generate a comprehensive, board-exam focused markdown study guide for "${topicName}".

🎯 TOPIC: ${topicName}
${
  phase1Context
    ? `📝 PHASE 1 SUMMARY (for coherence): ${phase1Context.summary}`
    : ""
}
${
  phase1Context && phase1Context.pearls.length > 0
    ? `📚 ${phase1Context.pearls.length} Clinical Pearls already in Phase 1 metadata`
    : ""
}

📁 UPLOADED MATERIAL ACCESS:
You have FULL ACCESS to the ${
          files.length
        } uploaded file(s) re-sent for this phase.
Use them to extract core content and cite as [Uploaded: Page X].

🔍 GOOGLE SEARCH REQUIREMENT:
You MUST use Google Search to FILL GAPS in the uploaded material.
Search for:
  - Specific diagnostic criteria, lab values, treatment protocols
  - Current evidence-based guidelines (ACC/AHA/ESC 2023-2024)
  - Epidemiological data, prognosis, clinical scores
  - Mechanism details not covered in the lecture

 KNOWLEDGE GRAPH INTEGRATION:
Naturally mention ${graphNodes.length} clinical terms from Phase 1 graph.
Client will auto-link them to interactive nodes.

  📝 OUTPUT REQUIREMENTS:
- 4000-6000 words of detailed, clinically rich markdown
- Generate ALL necessary sections (typically 9-12 sections, but can be more if needed)
- Every claim cited inline with CLICKABLE MARKDOWN LINKS (TARGET 25-35 TOTAL)
  ✅ REQUIRED FORMAT: [Mayo Clinic, 2024](https://www.mayoclinic.org/...) 
  ✅ REQUIRED FORMAT: [Harrison et al., 2014](https://scholar.google.com/scholar?q=...)
  ❌ WRONG: Plain text like "Mayo Clinic, 2024" or "Harrison et al., 2014"
- Use [Uploaded: Page X] for uploaded file content
- JSON code blocks instead of markdown tables
- End cleanly after your FINAL section (no matter which number it is)

⚠️ FORBIDDEN (will cause rejection):
❌ 'Clinical Pearls' section (already in Phase 1)
❌ 'References' or 'Sources' section (handled by grounding metadata)
❌ Subsections like 9.9 or extras after your final section
❌ Pearl boxes at the end (exam-tip, gap-filler, etc.)
❌ INTRODUCTORY PROSE addressing the user (e.g., "As a senior mentor, [Name]..." or "Welcome, [Name]...")
❌ Personal greetings or conversational opening paragraphs
❌ Using asterisks incorrectly (e.g., *phyio* instead of proper formatting)

🚫🚫🚫 CRITICAL: START DIRECTLY WITH THE TITLE 🚫🚫🚫
Your markdown MUST begin with:
  # [Topic Title]: A Comprehensive Study Guide
  
  [First section starts immediately]

DO NOT START WITH:
  ❌ "As a senior mentor, [Name], it's crucial to understand..."
  ❌ "Welcome to this comprehensive guide..."
  ❌ "Dear [Name], let me walk you through..."
  ❌ Any personalized greeting or introduction

✅ SUCCESS CRITERIA:
- Comprehensive, board-exam quality content
- Proper grounding with authoritative sources (AIM FOR 10+ UNIQUE SOURCES)
- Contextually relevant inline citations
- Coherent with Phase 1 metadata
- Clean ending after your final section (whether it's 9, 11, or 13)`;
    parts.push({ text: userPrompt });

    return this.retryWithBackoff(
      async () => {
        console.log("═══════════════════════════════════════");
        console.log(
          continueFromSection
            ? `🟠 PHASE 2: Continuation from "${continueFromSection}"`
            : "🟢 PHASE 2: Master Guide Generation"
        );
        console.log("   📊 Separate API call (FULL 64K output budget)");
        console.log(
          `   📁 Re-sent ${files.length} uploaded file(s) for full context`
        );
        console.log(
          `   🔗 ${graphNodes.length} Phase 1 nodes for smart linking`
        );
        console.log("   🔍 Google Search enabled (1M queries/day limit)");
        console.log("═══════════════════════════════════════");

        // Get the dynamic client (BYOK)
        const ai = await this.getClient();

        let fullMarkdown = previousContent || "";
        let groundingMetadata: any = null;
        let chunkCount = 0;
        let lastLoggedLength = 0;

        try {
          // 📊 LOG: Profile context being passed to Gemini Phase 2
          if (userProfile) {
            console.log("🧠 [Gemini Phase 2] User Profile Context:", {
              name: userProfile.name,
              discipline: userProfile.discipline,
              level: userProfile.level,
              teachingStyle: userProfile.teachingStyle || "Detailed",
              specialties: userProfile.specialties,
              learningGoals: userProfile.learningGoals,
              hasProfilePicture: !!userProfile.profilePicture,
            });
          }

          // Build teaching style instructions for Phase 2
          const teachingStyleInstructions = (() => {
            switch (userProfile?.teachingStyle) {
              case "Socratic":
                return [
                  "TEACHING STYLE: SOCRATIC METHOD",
                  "- Pose guiding questions throughout the content",
                  "- Encourage critical thinking with 'What if...' scenarios",
                  "- Include 'Think about this...' prompts before key concepts",
                ].join("\n");
              case "Concise":
                return [
                  "TEACHING STYLE: CONCISE & DIRECT",
                  "- Keep explanations brief and focused",
                  "- Use bullet points and tables extensively",
                  "- Prioritize high-yield facts over lengthy explanations",
                ].join("\n");
              case "Clinical-Cases":
                return [
                  "TEACHING STYLE: CASE-BASED LEARNING",
                  "- Present information through clinical scenarios",
                  "- Include patient presentations and management decisions",
                  "- Connect pathophysiology to real-world clinical practice",
                ].join("\n");

              case "Detailed":
              default:
                return [
                  "TEACHING STYLE: DETAILED & COMPREHENSIVE",
                  "- Provide thorough explanations with clinical context",
                  "- Include mechanisms, examples, and analogies",
                ].join("\n");
            }
          })();

          // Build specialty focus if available
          const specialtyInstructions = userProfile?.specialties?.length
            ? `SPECIALTY FOCUS: ${userProfile.specialties.join(
                ", "
              )} - emphasize connections to these fields.`
            : "";

          // Build learning goals if available
          const goalsInstructions = userProfile?.learningGoals
            ? `LEARNING OBJECTIVES: ${userProfile.learningGoals}`
            : "";

          // Inject user-specific context if provided
          const contextPrompt = userProfile
            ? [
                "═══════════════════════════════════════",
                "👤 USER CONTEXT (Phase 2)",
                "═══════════════════════════════════════",
                `- Name: ${userProfile.name || "Learner"}`,
                `- Role: ${userProfile.discipline} (${userProfile.level})`,
                "",
                teachingStyleInstructions,
                "",
                specialtyInstructions,
                goalsInstructions,
                "",
                "INSTRUCTIONAL ADJUSTMENTS:",
                `1. TONE: Act as a senior mentor to a ${userProfile.level} in ${userProfile.discipline}.`,
                `2. DEPTH: ${
                  userProfile.level &&
                  userProfile.level.includes("Pre-clinical")
                    ? "Focus on core mechanisms and pathophysiology."
                    : "Focus on clinical management, guidelines, and algorithms."
                }`,
                `3. FOCUS: Highlight clinically relevant facts tailored to this user's discipline.`,
                "═══════════════════════════════════════",
                "",
              ]
                .filter(Boolean)
                .join("\n")
            : "";

          const fullSystemPrompt = contextPrompt
            ? contextPrompt + "\n\n" + systemPrompt
            : systemPrompt;

          const stream = await ai.models.generateContentStream({
            model: "gemini-2.5-flash",
            contents: { parts: parts },
            config: {
              tools: [{ googleSearch: {} }],
              systemInstruction: fullSystemPrompt,
              temperature: 0.3,
              thinkingConfig: {
                thinkingBudget: 20480,
                includeThoughts: true,
              },
            },
          });

          console.log("   🚀 Stream started...");
          for await (const chunk of stream) {
            chunkCount++;

            // DEBUG: Log first chunk structure to verify API response format
            if (chunkCount === 1) {
              console.log(
                "   🔍 First chunk received:",
                JSON.stringify(chunk, null, 2)
              );
              // Also log the first candidate payload for easier inspection (if present)
              try {
                const firstCandidate = chunk.candidates?.[0] ?? null;
                if (firstCandidate) {
                  console.log(
                    "   🔍 First chunk - first candidate:",
                    JSON.stringify(firstCandidate, null, 2)
                  );
                }
              } catch (err) {
                console.warn("   ⚠️ Unable to stringify first candidate:", err);
              }
            }

            if (chunk.candidates?.[0]?.content?.parts) {
              for (const part of chunk.candidates[0].content.parts) {
                const isThought =
                  (part as any).thought === true ||
                  (part as any).isThought === true;

                if (isThought) {
                  const thoughtText = part.text || "";
                  if (thoughtText && thoughtText.trim() && onThought) {
                    onThought(thoughtText);
                  }
                } else if (part.text) {
                  fullMarkdown += part.text;
                }
              }
            } else if (chunk.candidates && chunk.candidates.length > 0) {
              // Log if candidates exist but no parts found (unusual)
              if (chunkCount <= 5) {
                console.log(
                  `   ⚠️ Chunk ${chunkCount} has candidates but no parts:`,
                  JSON.stringify(chunk.candidates[0])
                );
              }
            }

            const chunkText = chunk.text || "";
            // Fallback to chunk.text if parts processing didn't work or wasn't applicable
            // But be careful not to double-add if parts were already processed
            if (chunkText && !chunk.candidates?.[0]?.content?.parts?.length) {
              // Only add chunk.text if we didn't extract from parts
              fullMarkdown += chunkText;
            }

            if (
              chunkCount % 20 === 0 &&
              fullMarkdown.length > lastLoggedLength
            ) {
              const newChars = fullMarkdown.length - lastLoggedLength;
              console.log(
                `   📊 Progress: ${fullMarkdown.length.toLocaleString()} chars (+${newChars})`
              );
              lastLoggedLength = fullMarkdown.length;
            }

            const processedChunk = this.processTablesInMarkdown(fullMarkdown);
            const smartLinkedChunk = this.linkifyClinicalTerms(
              processedChunk,
              graphNodes
            );
            onProgress(smartLinkedChunk);

            if (chunk.candidates?.[0]?.groundingMetadata) {
              groundingMetadata = chunk.candidates[0].groundingMetadata;
              console.log("   🔍 Found grounding metadata in chunk");
            }
          }

          console.log(`   ✅ Stream finished. Total chunks: ${chunkCount}`);

          // 🔧 FIX: Detect empty stream (API returned 0 chunks) - this is different from short content
          if (chunkCount === 0) {
            console.error(`❌ Empty stream detected: API returned 0 chunks`);
            const emptyStreamError = new Error(
              "Empty stream: API returned no content. This may be a temporary API issue."
            );
            (emptyStreamError as any).code = "EMPTY_STREAM";
            (emptyStreamError as any).retryable = true;
            throw emptyStreamError;
          }

          // CHECK FOR EMPTY CONTENT - Let UI handle retry
          if (fullMarkdown.length < 100) {
            console.error(
              `❌ Generated content is too short (${fullMarkdown.length} chars)`
            );
            const emptyError = new Error(
              "Content generation incomplete. The AI produced empty or minimal output."
            );
            (emptyError as any).code = "EMPTY_CONTENT";
            (emptyError as any).charCount = fullMarkdown.length;
            throw emptyError;
          }
        } catch (e: any) {
          // 🔧 FIX: Handle empty stream errors with longer delay before retry
          if (
            (e as any).code === "EMPTY_STREAM" ||
            e.message?.includes("500") ||
            e.status === 500
          ) {
            const isEmptyStream = (e as any).code === "EMPTY_STREAM";
            console.warn(
              `⚠️ Retrying due to ${
                isEmptyStream ? "empty stream" : "500 error"
              }...`
            );

            // 🔧 FIX: Add longer delay for empty stream to give API time to recover
            if (isEmptyStream) {
              console.log(
                "   ⏳ Waiting 2s before retry (empty stream recovery)..."
              );
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }

            // Reset markdown for retry
            fullMarkdown = previousContent || "";

            const stream = await ai.models.generateContentStream({
              model: "gemini-2.5-flash",
              contents: { parts: parts },
              config: {
                tools: [{ googleSearch: {} }],
                systemInstruction: systemPrompt,
                temperature: 0.3,
                // Disable thinking on retry to be safer
              },
            });

            let retryChunkCount = 0;
            for await (const chunk of stream) {
              retryChunkCount++;
              const chunkText = chunk.text || "";
              fullMarkdown += chunkText;

              const processedChunk = this.processTablesInMarkdown(fullMarkdown);
              const smartLinkedChunk = this.linkifyClinicalTerms(
                processedChunk,
                graphNodes
              );
              onProgress(smartLinkedChunk);

              if (chunk.candidates?.[0]?.groundingMetadata) {
                groundingMetadata = chunk.candidates[0].groundingMetadata;
              }
            }

            // Check for empty stream on retry too
            if (retryChunkCount === 0) {
              const emptyError = new Error(
                "Empty stream persists after retry. Please try again."
              );
              (emptyError as any).code = "EMPTY_STREAM";
              throw emptyError;
            }

            // Check again after retry
            if (fullMarkdown.length < 100) {
              const emptyError = new Error(
                "Content generation incomplete after retry."
              );
              (emptyError as any).code = "EMPTY_CONTENT";
              throw emptyError;
            }
          } else {
            // Check for API key errors and convert to user-friendly messages
            try {
              this.handleApiError(e);
            } catch (apiKeyError) {
              throw apiKeyError;
            }
            // Re-throw all other errors (including EMPTY_CONTENT) for UI to handle
            throw e;
          }
        }

        // POST-PROCESSING: Remove redundant sections
        fullMarkdown = this.removeRedundantSections(fullMarkdown);

        // 🔧 ENHANCED: Source extraction from grounding metadata
        const sources: Source[] = [];

        // 🆕 IMPROVED: Extract from ALL grounding metadata levels simultaneously
        if (groundingMetadata) {
          console.log("   🔍 Processing grounding metadata for citations...");

          // Priority 1: Extract from groundingChunks (Google Search results)
          if (
            groundingMetadata.groundingChunks &&
            Array.isArray(groundingMetadata.groundingChunks)
          ) {
            console.log(
              `   📚 Found ${groundingMetadata.groundingChunks.length} grounding chunks`
            );
            groundingMetadata.groundingChunks.forEach((chunk: any) => {
              if (chunk?.web?.uri && chunk?.web?.title) {
                // 🔧 FILTER: Skip internal Google API endpoints
                if (
                  chunk.web.uri.includes("vertexaisearch.cloud.google.com") ||
                  chunk.web.uri.includes("google.com/search") ||
                  chunk.web.uri.includes("/search?")
                ) {
                  return; // Skip this source
                }

                // Deduplicate by URI
                if (!sources.find((s) => s.uri === chunk.web.uri)) {
                  sources.push({
                    title: chunk.web.title,
                    uri: chunk.web.uri,
                  });
                }
              }
            });
          }

          // Priority 2: Extract from groundingSupports (segment-level grounding)
          if (
            groundingMetadata.groundingSupports &&
            Array.isArray(groundingMetadata.groundingSupports)
          ) {
            groundingMetadata.groundingSupports.forEach((support: any) => {
              if (
                support.groundingChunkIndices &&
                Array.isArray(support.groundingChunkIndices)
              ) {
                support.groundingChunkIndices.forEach((idx: number) => {
                  const chunk = groundingMetadata.groundingChunks?.[idx];
                  if (chunk?.web?.uri && chunk?.web?.title) {
                    if (!sources.find((s) => s.uri === chunk.web.uri)) {
                      sources.push({
                        title: chunk.web.title,
                        uri: chunk.web.uri,
                      });
                    }
                  }
                });
              }
            });
          }

          // Priority 3: Extract from searchEntryPoint (if available)
          if (groundingMetadata.searchEntryPoint?.renderedContent) {
            console.log("   🔎 Found search entry point metadata");
          }

          // Priority 4: Extract from webSearchQueries (search queries used)
          if (
            groundingMetadata.webSearchQueries &&
            Array.isArray(groundingMetadata.webSearchQueries)
          ) {
            console.log(
              `   🔎 Google Search queries used: ${groundingMetadata.webSearchQueries.length}`
            );
            console.log(
              `   📝 Sample queries: ${groundingMetadata.webSearchQueries
                .slice(0, 3)
                .join(", ")}`
            );
          }
        }

        // Priority 5: Fallback - Extract from inline markdown citations
        if (sources.length === 0) {
          console.log(
            "   ⚠️ No grounding metadata found - extracting from inline citations"
          );

          // Enhanced regex to capture various citation formats:
          // 1. "Author et al., Year" or "Last Name et al., Year"
          // 2. "Organization/Journal Name, Year"
          // 3. Markdown links [Source, Year](url)
          const inlineCitationPatterns = [
            // Pattern 1: Author et al., Year (e.g., "Cohen et al., 2021")
            /\b([A-Z][a-z]+(?:\s+et\s+al\.?))\s*,\s*(\d{4})\b/g,
            // Pattern 2: Last & Last, Year (e.g., "Johnson & Bjordal, 2011")
            /\b([A-Z][a-z]+\s*&\s*[A-Z][a-z]+)\s*,\s*(\d{4})\b/g,
            // Pattern 3: Organization/Journal, Year (e.g., "Mayo Clinic, 2024", "WHO, 2023")
            /\b([A-Z][A-Za-z\s&]+(?:Clinic|Institute|Association|Society|Organization|WHO|CDC|NIH|College|Academy))\s*,\s*(\d{4})\b/g,
            // Pattern 4: Single word orgs (WHO, CDC, NIH) + year
            /\b(WHO|CDC|NIH|FDA|AHA|ACC|ESC)\s*,\s*(\d{4})\b/g,
          ];

          const citationSet = new Set<string>();

          inlineCitationPatterns.forEach((pattern) => {
            let match;
            while ((match = pattern.exec(fullMarkdown)) !== null) {
              const source = match[1].trim();
              const year = match[2];
              const citation = `${source}, ${year}`;
              citationSet.add(citation);
            }
          });

          // Convert set to Source array (use placeholder URLs since we don't have actual links)
          citationSet.forEach((citation) => {
            if (!sources.find((s) => s.title === citation)) {
              sources.push({
                title: citation,
                uri: `https://scholar.google.com/scholar?q=${encodeURIComponent(
                  citation
                )}`,
              });
            }
          });

          // Also extract markdown-linked citations [Title](url)
          const urlPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
          let match;
          while ((match = urlPattern.exec(fullMarkdown)) !== null) {
            const [, title, uri] = match;
            // Filter out node links and duplicates
            if (
              !uri.startsWith("node:") &&
              !sources.find((s) => s.uri === uri)
            ) {
              sources.push({ title, uri });
            }
          }
        }

        // 🆕 Log final source count for debugging
        console.log(
          `   ✅ Extracted ${sources.length} unique source citations`
        );
        if (sources.length > 0) {
          console.log(
            `   📖 Sample sources: ${sources
              .slice(0, 3)
              .map((s) => s.title)
              .join(", ")}`
          );
        }

        console.log("✅ PHASE 2 Complete");
        // Check if content seems incomplete (very short or ends abruptly)
        if (fullMarkdown.length < 1000) {
          console.warn(
            `⚠️ Phase 2 generated very short content (${fullMarkdown.length} chars) - may be incomplete`
          );
        }

        // Check for common incomplete endings
        const lastChars = fullMarkdown.slice(-100).trim();
        if (
          lastChars.endsWith("...") ||
          lastChars.endsWith("and") ||
          lastChars.endsWith("or") ||
          lastChars.endsWith(",")
        ) {
          console.warn(
            `⚠️ Phase 2 content may be incomplete - ends with: "${lastChars.slice(
              -20
            )}"`
          );
        }

        console.log(
          `   📝 Generated: ${fullMarkdown.length.toLocaleString()} characters`
        );
        console.log(
          `   📚 Sources: ${sources.length}${
            groundingMetadata?.groundingChunks
              ? " (from Google Search grounding)"
              : " (from inline citations)"
          }`
        );
        console.log("═══════════════════════════════════════\n");

        return { markdown: fullMarkdown, sources };
      },
      3,
      1000
    );
  }

  // Minimal post-processing cleanup (prompts prevent pearls/references)
  private removeRedundantSections(markdown: string): string {
    if (!markdown) return "";

    let cleaned = markdown;

    // Only check for content duplication (AI occasionally outputs twice)
    let lines = cleaned.split("\n");
    const firstH1Index = lines.findIndex((line) => line.match(/^#\s+[^#]/));
    if (firstH1Index !== -1) {
      const firstH1 = lines[firstH1Index];
      const secondH1Index = lines.findIndex(
        (line, idx) => idx > firstH1Index + 10 && line === firstH1
      );
      if (secondH1Index !== -1) {
        console.warn(
          "⚠️ Detected duplicated content, removing second occurrence"
        );
        cleaned = lines.slice(0, secondH1Index).join("\n");
      }
    }

    // Remove duplicate sections (same section number appearing twice)
    const sections = cleaned.split(/(?=^#{1,2}\s+\d+\.)/m);
    const uniqueSections = new Map<string, string>();

    for (const section of sections) {
      const headerMatch = section.match(/^(#{1,2}\s+\d+\.\s*[^\n]+)/);
      if (headerMatch) {
        // Normalize header for comparison (lowercase, single spaces)
        const header = headerMatch[1].toLowerCase().replace(/\s+/g, " ").trim();
        // Only keep the first occurrence of each section
        if (!uniqueSections.has(header)) {
          uniqueSections.set(header, section);
        } else {
          console.warn(`⚠️ Removed duplicate section: ${header}`);
        }
      } else if (section.trim()) {
        // Keep non-numbered sections (intro, title, etc.)
        uniqueSections.set(`_intro_${uniqueSections.size}`, section);
      }
    }

    cleaned = Array.from(uniqueSections.values()).join("");

    // Trim trailing whitespace and ensure clean ending
    cleaned = cleaned.trim();

    return cleaned;
  }

  // ===============================
  // MAIN STREAMING METHOD: Two-Phase Architecture
  // ===============================
  async augmentClinicalNoteStreaming(
    files: FileInput[],
    topicName: string = "General Medical Topic",
    userProfileOrOnUpdate?: any,
    onUpdate?: (update: {
      stage: "metadata" | "markdown" | "complete";
      subStage?:
        | "extracting"
        | "verifying"
        | "graphing"
        | "structuring"
        | "writing"
        | "citing";
      data?: Partial<AugmentedNote>;
    }) => void,
    onThought?: (thought: string) => void
  ): Promise<AugmentedNote> {
    // BYOK: Validate API key exists before starting full generation
    const apiKey = await ProfileRepository.getApiKey();
    if (!apiKey) {
      throw new ApiKeyError(
        "No API Key found. Please add your Google Gemini API key in Settings.",
        "MISSING"
      );
    }

    try {
      console.log(`📁 Starting with ${files.length} uploaded files`);

      // Backwards-compatible parameter handling:
      // - If caller passed (files, topicName, onUpdate, onThought)
      //   then userProfileOrOnUpdate is the onUpdate function
      // - If caller passed (files, topicName, userProfile, onUpdate, onThought)
      //   then userProfileOrOnUpdate is the profile object
      let userProfile: UserProfile | undefined = undefined;
      let onUpdateCallback: any = undefined;

      if (typeof userProfileOrOnUpdate === "function") {
        onUpdateCallback = userProfileOrOnUpdate;
      } else {
        userProfile = userProfileOrOnUpdate;
        onUpdateCallback = onUpdate;
      }

      onUpdateCallback = onUpdateCallback || function () {};

      // PHASE 1
      const metadataResult = await this.generateMetadataAndGraph(
        files,
        topicName,
        onThought,
        (subStage) => {
          onUpdateCallback({ stage: "metadata", subStage: subStage });
        },
        userProfile
      );

      onUpdateCallback({
        stage: "metadata",
        subStage: "graphing",
        data: {
          title: metadataResult.title,
          summary: metadataResult.summary,
          eli5Analogy: metadataResult.eli5Analogy,
          pearls: metadataResult.pearls,
          graphData: {
            nodes: metadataResult.graphNodes,
            links: metadataResult.graphLinks,
          },
        },
      });

      // PHASE 2
      // 🔧 FIX: Add delay between Phase 1 and Phase 2 to avoid API rate issues
      // This prevents empty stream responses when Phase 2 starts immediately after Phase 1
      console.log("⏳ Cooling down before Phase 2 (1.5s)...");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      let fullMarkdown = "";
      let allSources: Source[] = [];
      let continuationAttempts = 0;
      // 🔧 REDUCED: Only continue if truly necessary
      const MAX_CONTINUATIONS = 2;

      let phase2SubStage: "structuring" | "writing" | "citing" = "structuring";
      let lastEmittedSubStage: "structuring" | "writing" | "citing" | null =
        null;

      const emitSubStage = (
        newStage: "structuring" | "writing" | "citing",
        markdown?: string
      ) => {
        if (newStage !== lastEmittedSubStage) {
          lastEmittedSubStage = newStage;
          phase2SubStage = newStage;
          console.log(`📝 Phase 2 transition: ${newStage.toUpperCase()}`);
          onUpdateCallback({
            stage: "markdown",
            subStage: newStage,
            data: markdown ? { markdownContent: markdown } : undefined,
          });
        } else if (markdown) {
          onUpdateCallback({
            stage: "markdown",
            subStage: phase2SubStage,
            data: { markdownContent: markdown },
          });
        }
      };

      emitSubStage("structuring");

      const phase1Context = {
        title: metadataResult.title,
        summary: metadataResult.summary,
        eli5Analogy: metadataResult.eli5Analogy,
        pearls: metadataResult.pearls,
      };

      while (continuationAttempts <= MAX_CONTINUATIONS) {
        const previousLength = fullMarkdown.length;

        const result = await this.generateMarkdownStreaming(
          files,
          topicName,
          metadataResult.graphNodes,
          (markdown) => {
            const contentLength = markdown.length;

            if (phase2SubStage === "structuring" && contentLength > 500) {
              emitSubStage("writing", markdown);
            } else if (phase2SubStage === "writing" && contentLength > 30000) {
              emitSubStage("citing", markdown);
            } else {
              onUpdateCallback({
                stage: "markdown",
                subStage: phase2SubStage,
                data: { markdownContent: markdown },
              });
            }
          },
          continuationAttempts > 0 ? fullMarkdown : undefined,
          continuationAttempts > 0
            ? this.detectTruncation(fullMarkdown).lastSection
            : undefined,
          (thought) => {
            if (onThought) onThought(thought);
          },
          phase1Context,
          userProfile
        );

        fullMarkdown = result.markdown;
        allSources = [...new Set([...allSources, ...result.sources])];

        const truncationCheck = this.detectTruncation(fullMarkdown);

        // 🔧 ENHANCED: Don't continue if content is substantial and no clear truncation
        if (
          !truncationCheck.isTruncated ||
          fullMarkdown.length === previousLength ||
          fullMarkdown.length > 100000
        ) {
          // 100K char limit
          break;
        }

        continuationAttempts++;
        console.log(
          `🔄 Continuation attempt ${continuationAttempts}/${MAX_CONTINUATIONS}`
        );
      }

      const linkedMarkdown = this.linkifyClinicalTerms(
        fullMarkdown,
        metadataResult.graphNodes
      );
      const processedMarkdown = this.processTablesInMarkdown(linkedMarkdown);

      const augmentedNote: AugmentedNote = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        title: metadataResult.title,
        sourceFileNames: files.map((f) => f.file.name),
        markdownContent: processedMarkdown || "Content generation incomplete.",
        summary: metadataResult.summary,
        eli5Analogy: metadataResult.eli5Analogy,
        pearls: metadataResult.pearls,
        graphData: {
          nodes: metadataResult.graphNodes,
          links: metadataResult.graphLinks,
        },
        sources: allSources,
      };

      onUpdateCallback({ stage: "complete", data: augmentedNote });

      return augmentedNote;
    } catch (error) {
      console.error("❌ augmentClinicalNoteStreaming failed:", error);
      throw error;
    }
  }

  // ===============================
  // BACKWARDS COMPATIBILITY: Non-Streaming Version
  // ===============================
  // Legacy method for non-streaming use cases
  async augmentClinicalNote(
    files: FileInput[],
    topicName: string = "General Medical Topic"
  ): Promise<AugmentedNote> {
    return new Promise((resolve, reject) => {
      this.augmentClinicalNoteStreaming(files, topicName, (update) => {
        if (update.stage === "complete" && update.data) {
          resolve(update.data as AugmentedNote);
        }
      }).catch(reject);
    });
  }
}
