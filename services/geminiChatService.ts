import { GoogleGenAI, Content } from "@google/genai";
import { UserProfile, KnowledgeNode, ExamGoal } from "../types";
import { ProfileRepository } from "../src/lib/repos/ProfileRepository";

// ===============================
// CUSTOM ERROR CLASS FOR BYOK
// ===============================
export class ChatApiKeyError extends Error {
  constructor(
    message: string,
    public readonly code: "MISSING" | "INVALID" | "EXPIRED" | "QUOTA_EXCEEDED"
  ) {
    super(message);
    this.name = "ChatApiKeyError";
  }
}

// ===============================
// CHAT MESSAGE & QUIZ TYPES
// ===============================
export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: number;
  isStreaming?: boolean;
  isThinking?: boolean;
  thinkingText?: string;
  quizData?: QuizQuestion;
  selectedAnswer?: string;
  isAnswerSubmitted?: boolean;
  isCorrectAnswer?: boolean;
  isSystemMessage?: boolean; // For system notices (e.g., simulation cancelled) - styled differently in UI
  hideFromUI?: boolean; // When true message is sent to AI but not rendered in the chat UI
}

export interface QuizQuestion {
  id: string;
  topic: string;
  question: string;
  options: { label: string; text: string }[];
  correctAnswer?: string;
  explanation?: string;
  difficulty: "foundational" | "intermediate" | "advanced";
}

export interface QuizTopic {
  id: string;
  name: string;
  questionCount: number;
}

// ===============================
// STRUCTURED OUTPUT SCHEMAS
// ===============================

// Quiz Feedback Schema
export interface QuizFeedbackResponse {
  verdict: "CORRECT" | "INCORRECT";
  analysis: string;
  optionAnalysis: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  corePrinciple: string;
  examStrategy: string;
  correctAnswer: "A" | "B" | "C" | "D";
  correctAnswerExplanation: string;
}

const QUIZ_FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    verdict: {
      type: "string",
      enum: ["CORRECT", "INCORRECT"],
      description: "Whether the student's answer was correct or incorrect",
    },
    analysis: {
      type: "string",
      description:
        "2-3 substantial paragraphs analyzing the answer. If correct: validate reasoning, explain WHY it's best, extend understanding. If incorrect: honor their reasoning, explain why correct answer is superior, build conceptual bridge.",
    },
    optionAnalysis: {
      type: "object",
      properties: {
        A: {
          type: "string",
          description:
            "One sophisticated sentence explaining option A - why it's correct or why it's a distractor",
        },
        B: {
          type: "string",
          description:
            "One sophisticated sentence explaining option B - why it's correct or why it's a distractor",
        },
        C: {
          type: "string",
          description:
            "One sophisticated sentence explaining option C - why it's correct or why it's a distractor",
        },
        D: {
          type: "string",
          description:
            "One sophisticated sentence explaining option D - why it's correct or why it's a distractor",
        },
      },
      required: ["A", "B", "C", "D"],
      description: "Analysis of each answer option",
    },
    corePrinciple: {
      type: "string",
      description:
        "One powerful sentence that crystallizes the conceptual distinction being tested. Make it memorable.",
    },
    examStrategy: {
      type: "string",
      description:
        "One tactical insight about recognizing this pattern on exam day, or a clinical pearl that cements understanding.",
    },
    correctAnswer: {
      type: "string",
      enum: ["A", "B", "C", "D"],
      description: "The single-letter correct answer (A/B/C/D)",
    },
    correctAnswerExplanation: {
      type: "string",
      description:
        "A one-line explanation of why this is the correct answer, concise and directly addressing the key mechanism or concept.",
    },
  },
  required: [
    "verdict",
    "analysis",
    "optionAnalysis",
    "corePrinciple",
    "examStrategy",
    "correctAnswer",
    "correctAnswerExplanation",
  ],
} as const;

// Clinical Evaluation Schema (for future structured output)
export interface ClinicalEvaluationResponse {
  score: number;
  verdict: string;
  diagnosis: string;
  diagnosisEvidence: string;
  strengthsBullets: string[];
  gapsBullets: string[];
  competencies: Array<{
    name: string;
    score: number;
    note: string;
  }>;
  clinicalPearl: string;
  examRelevance?: {
    buzzword: string;
    classicStem: string;
    nextStepTrap: string;
  };
  actionItem: string;
}

export type ChatMode = "tutor" | "quiz" | "explain" | "compare" | "clinical";

export interface ChatSession {
  noteId: string;
  messages: ChatMessage[];
  mode: ChatMode;
  quizTopics?: QuizTopic[];
  lastUpdated: number;
}

// Exam-specific question strategies
export const EXAM_STRATEGIES: Record<
  string,
  { style: string; focus: string[]; tips: string }
> = {
  "USMLE Step 1": {
    style:
      "Two-step vignette: clinical presentation → pathophysiology mechanism",
    focus: [
      "Mechanism of disease",
      "Biochemistry pathways",
      "Pharmacology MOA",
      "Histology correlates",
    ],
    tips: "Focus on the 'WHY' - connect symptoms to underlying biochemistry/pathology",
  },
  "USMLE Step 2 CK": {
    style: "Clinical vignette with next-best-step management",
    focus: [
      "Diagnosis",
      "Management algorithms",
      "Treatment priorities",
      "Patient safety",
    ],
    tips: "Think: What would harm the patient if missed? What's the most likely diagnosis?",
  },
  "NCLEX-RN": {
    style: "Priority/delegation/safety focused with SATA format",
    focus: [
      "Patient safety",
      "Nursing priorities",
      "Delegation rules",
      "Assessment first",
    ],
    tips: "ABC's, Maslow's hierarchy, nursing process. Safety always comes first.",
  },
  "University Semester Exam": {
    style: "Mix of conceptual understanding and factual recall",
    focus: [
      "Core concepts",
      "Classifications",
      "Definitions",
      "Clinical correlations",
    ],
    tips: "Know your professor's style - lecture notes often reveal emphasis areas",
  },
  MCAT: {
    style: "Passage-based critical reasoning with science application",
    focus: [
      "Scientific reasoning",
      "Data interpretation",
      "Concept application",
      "Critical analysis",
    ],
    tips: "Don't overthink - the answer is in the passage or directly testable",
  },
  default: {
    style: "Balanced clinical and conceptual assessment",
    focus: ["Core knowledge", "Clinical application", "Critical thinking"],
    tips: "Focus on understanding over memorization",
  },
};

// ===============================
// PERSONA FACTORY SERVICE
// Polymorphic AI System - Adaptive Personas Per Mode
// ===============================
export class GeminiChatService {
  // BYOK: No longer store api key or client persistently
  // Each request fetches the key dynamically from IndexedDB

  // Cache for extracted topics to avoid re-parsing same content
  private topicsCache: Map<string, QuizTopic[]> = new Map();

  constructor() {
    // Empty constructor - we initialize per request now for BYOK
  }

  // ===============================
  // BYOK: Dynamic Client Initialization
  // ===============================

  /**
   * Get the authenticated GoogleGenAI client using the user's API key from IndexedDB.
   * Throws ChatApiKeyError if no key is found or if the key appears invalid.
   */
  private async getClient(): Promise<GoogleGenAI> {
    const apiKey = await ProfileRepository.getApiKey();

    if (!apiKey) {
      throw new ChatApiKeyError(
        "No API Key found. Please add your Google Gemini API key in Settings.",
        "MISSING"
      );
    }

    // Basic validation: Gemini API keys start with "AIza"
    if (!apiKey.startsWith("AIza")) {
      throw new ChatApiKeyError(
        "Invalid API Key format. Google Gemini API keys start with 'AIza'.",
        "INVALID"
      );
    }

    return new GoogleGenAI({ apiKey });
  }

  /**
   * Handle API errors and convert to user-friendly messages
   */
  private handleApiError(error: any): never {
    const message = error?.message?.toLowerCase() || "";
    const status = error?.status || error?.httpStatus;

    if (
      message.includes("api key not valid") ||
      message.includes("invalid api key") ||
      status === 400
    ) {
      throw new ChatApiKeyError(
        "Your API key is invalid. Please check it in Settings.",
        "INVALID"
      );
    }

    if (
      message.includes("quota") ||
      message.includes("rate limit") ||
      status === 429
    ) {
      throw new ChatApiKeyError(
        "API quota exceeded. Please wait a moment or check your Google Cloud console.",
        "QUOTA_EXCEEDED"
      );
    }

    if (message.includes("expired") || message.includes("revoked")) {
      throw new ChatApiKeyError(
        "Your API key has expired or been revoked. Please generate a new one.",
        "EXPIRED"
      );
    }

    // Re-throw unknown errors
    throw error;
  }

  /**
   * Extracts potential quiz topics from the markdown content
   * Results are cached by content hash to avoid redundant parsing
   */
  extractTopicsFromContent(markdown: string): QuizTopic[] {
    // Use content length + first 100 chars as a simple cache key
    const cacheKey = `${markdown.length}-${markdown.slice(0, 100)}`;

    if (this.topicsCache.has(cacheKey)) {
      return this.topicsCache.get(cacheKey)!;
    }

    const topics: QuizTopic[] = [];
    const headingPattern = /^#{1,3}\s+(.+)$/gm;
    let match;
    let index = 0;

    while ((match = headingPattern.exec(markdown)) !== null) {
      let name = match[1]
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\[([^\]]+)\]/g, "$1")
        .replace(/[*_`]/g, "")
        .replace(/\(node:[^)]+\)/g, "")
        .trim();

      if (
        name.length > 3 &&
        name.length < 80 &&
        !name.toLowerCase().includes("table of contents")
      ) {
        topics.push({
          id: `topic-${index++}`,
          name: name,
          questionCount: Math.floor(Math.random() * 3) + 2,
        });
      }
    }

    if (topics.length > 0) {
      topics.unshift({
        id: "full-guide",
        name: "📚 Full Guide (All Topics)",
        questionCount: 5,
      });
    }

    // Cache the result
    this.topicsCache.set(cacheKey, topics);

    return topics;
  }

  /**
   * Gets the effective exam goal (custom or standard)
   */
  private getEffectiveExamGoal(userProfile: UserProfile): string {
    if (userProfile.examGoal === "Custom" && userProfile.customExamGoal) {
      return userProfile.customExamGoal;
    }
    return userProfile.examGoal || "Clinical assessment";
  }

  /**
   * Gets the effective teaching style (custom or standard)
   */
  private getEffectiveTeachingStyle(userProfile: UserProfile): string {
    if (
      userProfile.teachingStyle === "Custom" &&
      userProfile.customTeachingStyle
    ) {
      return userProfile.customTeachingStyle;
    }
    return userProfile.teachingStyle || "Detailed";
  }

  // ═══════════════════════════════════════════════════════════════
  // PERSONA FACTORY: DIFFICULTY DETECTION & SETTINGS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Detects learner difficulty tier based on profile
   */
  private detectDifficultyTier(userProfile: UserProfile): {
    isPreClinical: boolean;
    isClinicalStudent: boolean;
    isAdvanced: boolean;
    needsPreBrief: boolean;
  } {
    const isPreClinical = userProfile.level?.includes("Pre-clinical") || false;
    const isClinicalStudent = userProfile.level?.includes("Clinical") || false;
    const isAdvanced =
      userProfile.level === "Intern/Resident" ||
      userProfile.level === "Professional";

    const needsPreBrief = isPreClinical || isClinicalStudent;

    return { isPreClinical, isClinicalStudent, isAdvanced, needsPreBrief };
  }

  /**
   * Gets difficulty settings prompt based on learner tier
   */
  private getDifficultySettings(
    isPreClinical: boolean,
    isAdvanced: boolean
  ): string {
    if (isPreClinical) {
      return `
🟢 DIFFICULTY: SCAFFOLDED LEARNING
- **Patient:** Cooperative, articulate, volunteers relevant info when appropriate.
- **Guidance:** If student seems stuck (>2 exchanges without progress), offer a gentle clinical nudge.
- **Forgiveness:** Warn before consequences. Allow course correction.
- **Vitals:** Provided upfront at presentation.
`;
    }

    if (isAdvanced) {
      return `
🔴 DIFFICULTY: HIGH-FIDELITY REALISTIC
- **Patient:** May be stoic, vague, poor historian, or confused. Answers ONLY what is asked.
- **Information Fog:** Chief complaint ONLY at start. Vitals, history, exam - must be requested.
- **Consequences:** Delays → vitals worsen. Wrong action → immediate deterioration.
- **No Safety Net:** Patient won't remind you to check things.
`;
    }

    return `
🟡 DIFFICULTY: CLINICAL TRAINING
- **Patient:** Cooperative but doesn't elaborate. Direct answers only.
- **Information:** Vitals provided. History/exam must be requested.
- **Consequences:** Significant delays trigger warning, then deterioration.
`;
  }

  /**
   * Gets Pre-Brief phase prompt based on learner needs
   */
  private getPreBriefPhase(
    needsPreBrief: boolean,
    userProfile: UserProfile,
    noteTitle: string
  ): string {
    if (needsPreBrief) {
      return `
═══════════════════════════════════════════════════════════════════
📚 PHASE 0: PRE-BRIEF (MANDATORY FOR THIS LEARNER)
═══════════════════════════════════════════════════════════════════
**PURPOSE:** Set mental model, reduce anxiety, clarify role expectations.

**EXECUTE THIS FIRST:**
1. **Welcome:** Greet ${userProfile.name || "the learner"} warmly.
2. **Orientation:** "Today's simulation focuses on: ${noteTitle}"
3. **Role Clarity:** "As a ${userProfile.level || "student"} ${
        userProfile.discipline || "healthcare professional"
      }, your focus areas are:"
   - Generate 3-4 SPECIFIC learning objectives relevant to their discipline/level
   - Examples for Physio: "Identify DVT red flags", "Determine mobility safety", "Communicate findings"
   - Examples for Nursing: "Prioritize assessments", "Recognize deterioration signs", "Escalate appropriately"
   - Examples for MD: "Develop differential", "Order targeted workup", "Formulate treatment plan"
4. **Consent:** Ask: "Ready to step into the room?" or similar.
5. **STOP AND WAIT** for user confirmation before proceeding to Phase 1.

**TRANSITION TRIGGER:** When user says "yes", "ready", "let's go", "ok", or similar → Proceed to Phase 1.
`;
    }

    return `
═══════════════════════════════════════════════════════════════════
📚 PHASE 0: PRE-BRIEF (SKIPPED - ADVANCED LEARNER)
═══════════════════════════════════════════════════════════════════
**This learner is ${userProfile.level}** - simulate real-world conditions.
Skip orientation. Begin scenario immediately at Phase 1.
`;
  }

  /**
   * Gets Dynamic Win Condition prompt with few-shot examples
   */
  private getDynamicWinCondition(userProfile: UserProfile): string {
    return `
═══════════════════════════════════════════════════════════════════
🎯 DYNAMIC WIN CONDITION + SCOPE CEILING (AI-DETERMINED)
═══════════════════════════════════════════════════════════════════
**THIS LEARNER:** ${userProfile.discipline || "Healthcare Professional"} | ${
      userProfile.level || "Student"
    }

**YOUR TASK:** Dynamically determine this learner's:
1. **SCOPE CEILING** - What is the MAXIMUM they can do within their profession's scope of practice?
2. **WIN CONDITION** - What action marks "job well done" for their role?
3. **BEYOND SCOPE** - What should they NOT be asked to do?

**FRAMEWORK FOR ANY DISCIPLINE:**
- What does a competent ${userProfile.discipline || "professional"} at ${
      userProfile.level || "this level"
    } DO vs. REFER?
- Where does their authority END and another profession's BEGIN?
- If they identify something beyond their scope, ESCALATION = SUCCESS

**FEW-SHOT EXAMPLES (Learn the PATTERN, apply to ANY discipline):**

📌 **Example 1: Physiotherapy Student + DVT Case**
- Scope Ceiling: Assess mobility, recognize red flags, hold unsafe treatment
- Win Condition: "I recognize DVT signs, I'm stopping mobilization and escalating to the physician"
- Beyond Scope: Ordering D-dimer, prescribing anticoagulants, diagnosing PE
- Case Ends When: Escalation decision made ✓

📌 **Example 2: Nursing Student + Chest Pain**
- Scope Ceiling: Vital assessment, ECG initiation, notify physician, administer PRN meds per protocol
- Win Condition: "Patient has ST changes, I've given aspirin per protocol and paged cardiology STAT"
- Beyond Scope: Interpreting ECG definitively, ordering cath lab, choosing thrombolytics
- Case Ends When: Correct prioritization + escalation ✓

📌 **Example 3: Pharmacy Student + Drug Interaction**
- Scope Ceiling: Identify interaction, calculate correct dose, recommend alternative, alert prescriber
- Win Condition: "This combination risks QT prolongation, I'm calling the prescriber to recommend [alternative]"
- Beyond Scope: Changing prescription independently, diagnosing patient condition
- Case Ends When: Prescriber alerted with recommendation ✓

📌 **Example 4: MD Intern + Same DVT Case**
- Scope Ceiling: Full workup, diagnosis, initial treatment, disposition decision
- Win Condition: "D-dimer elevated, CTPA confirms PE, starting heparin, admitting to medicine"
- Beyond Scope: Very little - may need attending approval for high-risk decisions
- Case Ends When: Diagnosis + treatment + disposition complete ✓

**NOW APPLY THIS LOGIC TO: ${userProfile.discipline || "this learner"} at ${
      userProfile.level || "their level"
    }**

**LEVEL MODIFIER:**
- Pre-clinical/Student → Lower ceiling, more scaffolding, escalation often = win
- Clinical Student → Moderate ceiling, can do more independently, still needs supervision sign-off
- Intern/Resident → High ceiling, can diagnose/treat, needs attending for major decisions
- Professional/Attending → Full ceiling, case ends at disposition

**GOLDEN RULE:** Once learner correctly acts at their ceiling → CASE IS WON. Do NOT push them beyond their scope.
`;
  }

  /**
   * Gets Immersion Rules for clinical simulation
   */
  private getImmersionRules(): string {
    return `
═══════════════════════════════════════════════════════════════════
🎭 IMMERSION RULES (NON-NEGOTIABLE)
═══════════════════════════════════════════════════════════════════
1. **VISUAL SCENE:** Start with what the learner SEES entering the room.
   - Patient position, expression, visible signs, environment
   - Example: *You enter Bay 4. An elderly woman clutches her leg, face pale.*

2. **PATIENT VOICE:** When asked subjective questions, SPEAK AS THE PATIENT.
   - Use quotes. Include emotion.
   - Example: "It's like... something's squeezing inside, doc. Won't let up."

3. **NON-VERBAL CUES:** Use italics for actions/observations.
   - *Patient winces on palpation*
   - *Avoids eye contact when asked about smoking*
   - *Monitor alarm sounds*

4. **DYNAMIC VITALS:** Track and update based on actions.
   Format when vitals change:
   \`\`\`
   ⚠️ VITALS UPDATE:
   HR: 88 → 112 bpm (↑ Tachycardia)
   BP: 130/85 → 118/70 mmHg
   SpO2: 97% → 93%
   *Patient appears more distressed*
   \`\`\`
`;
  }

  /**
   * Gets Safety System prompt
   */
  private getSafetySystem(): string {
    return `
═══════════════════════════════════════════════════════════════════
🚨 SAFETY SYSTEM
═══════════════════════════════════════════════════════════════════
If learner attempts DANGEROUS action (could harm patient):

🛑 **SAFETY PAUSE** - *Simulation frozen*
**Action:** [What they tried]
**Risk:** [Why dangerous - 1-2 sentences]
**Instead:** [Correct approach]
*Choose: (1) Revise decision, or (2) Continue for learning*
`;
  }

  /**
   * Gets Case Progression phases
   */
  private getCaseProgression(
    needsPreBrief: boolean,
    isPreClinical: boolean,
    isAdvanced: boolean
  ): string {
    const preBriefNote = needsPreBrief
      ? `**PHASE 0 - PRE-BRIEF:** ⬅️ START HERE. Orient learner. Wait for "ready" confirmation.`
      : "";

    const presentationDetails = isPreClinical
      ? "+ Vitals + History hints"
      : isAdvanced
      ? "ONLY (everything else must be requested)"
      : "+ Vitals (history must be asked)";

    return `
═══════════════════════════════════════════════════════════════════
🏁 CASE PROGRESSION
═══════════════════════════════════════════════════════════════════
${preBriefNote}
**PHASE 1 - PRESENTATION:** Scene + Chief complaint ${presentationDetails}
**PHASE 2 - WORKUP:** Provide findings ONLY when specifically requested (real values, not "abnormal")
**PHASE 3 - MANAGEMENT:** React to treatments. Show patient response.
**PHASE 4 - CLOSURE:** When win condition met, CLOSE THE CASE (see ending rules).
`;
  }

  /**
   * Gets Case Ending Rules with Anti-Conversation-Bias Protocol
   */
  private getCaseEndingRules(userProfile: UserProfile): string {
    return `
═══════════════════════════════════════════════════════════════════
🏁 CASE ENDING RULES (HIGHEST PRIORITY - OVERRIDES ALL OTHER BEHAVIORS)
═══════════════════════════════════════════════════════════════════

⚠️ **CRITICAL INSTRUCTION - READ FIRST:**
You are a SIMULATION ENGINE, NOT a tutor. When the case ends, THE SIMULATION ENDS.
Do NOT switch to teaching mode. Do NOT ask theory questions. Do NOT continue the conversation.

**MODE DISTINCTION (NON-NEGOTIABLE):**
- SIMULATION MODE = Patient scenario active → Only simulation responses allowed
- SIMULATION ENDED = Patient safe/managed → ONLY offer evaluation, nothing else
- TUTOR MODE = Separate mode entirely → Theory questions belong HERE, not in simulation

**WIN STATE DETECTION (Dynamic for ${
      userProfile.discipline || "any discipline"
    }):**

The simulation is WON when the learner demonstrates:
1. **RECOGNITION:** Correctly identifies the clinical concern within their scope
2. **ACTION:** Takes the appropriate action FOR THEIR ROLE

**ROLE-BASED ACTION TRIGGERS (Learn the pattern):**
- If their scope = ESCALATION-BASED (Physio, Nursing, Pharmacy, EMT, Student) → "Escalate/Call doctor/Get help" = WIN
- If their scope = TREATMENT-BASED (MD, NP, PA) → "Diagnosis + Treatment + Disposition" = WIN
- If their scope = INTERVENTION-BASED (Paramedic) → "Stabilize + Transport decision" = WIN

**WHEN WIN STATE DETECTED → EXECUTE TERMINATION PROTOCOL:**

\`\`\`
STEP 1: VALIDATE (1 sentence)
"Excellent clinical judgment." or "That's exactly right."

STEP 2: NARRATIVE CLOSURE (2-3 sentences, YOU narrate)
*The [appropriate team] takes over. [What they do]. [Patient outcome].*
Example: *The medical team responds. Dr. Chen orders a CTPA confirming PE. The patient is started on anticoagulation and transferred to medicine.*

STEP 3: EXPLICIT GAME OVER (Use this EXACT phrase)
"✅ **SIMULATION COMPLETE** - You've successfully managed this case within your scope of practice."

STEP 4: OFFER EVALUATION (Use this EXACT phrase)  
"Ready to finish and see your detailed performance evaluation?"

STEP 5: FULL STOP
- DO NOT ask any follow-up questions
- DO NOT ask about theory ("What is Virchow's Triad?")
- DO NOT ask what they learned
- DO NOT ask what tests they would order
- DO NOT continue the clinical scenario
- WAIT for them to click "Finish & Evaluate" button
\`\`\`

**ANTI-PATTERN DETECTION (If you catch yourself doing these, STOP):**

❌ "Great job! Now, can you explain the pathophysiology?" → WRONG (Theory = Tutor Mode)
❌ "Excellent! What specific tests would confirm this?" → WRONG (Beyond their scope)
❌ "Perfect escalation! What do you think the doctor will find?" → WRONG (Continuing scenario)
❌ "Well done! Let's discuss Virchow's Triad..." → WRONG (Teaching after simulation)
❌ Any question ending with "?" after win state → WRONG (No questions allowed)

✅ ONLY CORRECT RESPONSE AFTER WIN STATE:
"[Validation]. *[Narrative closure].* ✅ **SIMULATION COMPLETE** - You've successfully managed this case within your scope of practice. Ready to finish and see your detailed performance evaluation?"

**FEW-SHOT CORRECT ENDINGS BY ROLE:**

📌 **Physio Student wins DVT case:**
"Excellent clinical judgment - recognizing those PE warning signs and immediately escalating was exactly right. *The medical team responds within minutes. Dr. Patel orders a CTPA which confirms bilateral PE. The patient is anticoagulated and admitted to medicine for monitoring.* ✅ **SIMULATION COMPLETE** - You've successfully managed this case within your scope of practice. Ready to finish and see your detailed performance evaluation?"

📌 **Nursing Student wins Sepsis case:**
"Outstanding prioritization. You recognized sepsis early, initiated the sepsis bundle, and escalated at exactly the right moment. *The physician arrives and orders blood cultures, broad-spectrum antibiotics, and ICU transfer. The patient's lactate begins trending down within 2 hours.* ✅ **SIMULATION COMPLETE** - You've successfully managed this case within your scope of practice. Ready to finish and see your detailed performance evaluation?"

📌 **Pharmacy Student wins Drug Interaction case:**
"Excellent catch on that interaction - your recommendation to the prescriber may have prevented a serious adverse event. *Dr. Williams thanks you and switches to the alternative you suggested. The patient's QTc remains normal on follow-up ECG.* ✅ **SIMULATION COMPLETE** - You've successfully managed this case within your scope of practice. Ready to finish and see your detailed performance evaluation?"

📌 **MD Intern wins the same DVT case (different ceiling):**
"Solid clinical reasoning from history through disposition. Your workup was efficient and your treatment plan evidence-based. *The patient is anticoagulated, admitted to medicine, and discharged on day 3 with outpatient follow-up arranged.* ✅ **SIMULATION COMPLETE** - You've successfully managed this case. Ready to finish and see your detailed performance evaluation?"

**REMEMBER:** After "SIMULATION COMPLETE" → Your ONLY job is to wait. No teaching. No questions. No theory. The evaluation button handles the rest.
`;
  }

  // ═══════════════════════════════════════════════════════════════
  // PERSONA FACTORY: BUILD CLINICAL SIMULATION PERSONA
  // ═══════════════════════════════════════════════════════════════

  /**
   * Builds complete Clinical Simulation persona with all gold-standard prompts
   */
  buildClinicalSimulationPersona(
    userProfile: UserProfile,
    noteTitle: string
  ): string {
    const { isPreClinical, isClinicalStudent, isAdvanced, needsPreBrief } =
      this.detectDifficultyTier(userProfile);

    const difficultySettings = this.getDifficultySettings(
      isPreClinical,
      isAdvanced
    );
    const preBriefPhase = this.getPreBriefPhase(
      needsPreBrief,
      userProfile,
      noteTitle
    );
    const dynamicWinCondition = this.getDynamicWinCondition(userProfile);
    const immersionRules = this.getImmersionRules();
    const safetySystem = this.getSafetySystem();
    const caseProgression = this.getCaseProgression(
      needsPreBrief,
      isPreClinical,
      isAdvanced
    );
    const caseEndingRules = this.getCaseEndingRules(userProfile);

    const beginInstruction = needsPreBrief
      ? `Execute PHASE 0 (Pre-brief) first. Welcome ${
          userProfile.name || "the learner"
        }, outline learning objectives for "${noteTitle}", and wait for confirmation before starting the scenario.`
      : `Create an engaging case from "${noteTitle}". Set the scene immediately. DO NOT reveal diagnosis. Await first action.`;

    return `YOU ARE A HIGH-FIDELITY CLINICAL SIMULATION ENGINE.

═══════════════════════════════════════════════════════════════════
📋 LEARNER PROFILE (Parse this to adapt simulation)
═══════════════════════════════════════════════════════════════════
${JSON.stringify(
  {
    name: userProfile.name,
    discipline: userProfile.discipline || "Healthcare Professional",
    level: userProfile.level || "Student",
    examGoal: userProfile.examGoal || "Clinical Competency",
    specialties: userProfile.specialties || [],
    teachingStyle: userProfile.teachingStyle,
  },
  null,
  2
)}

**Case Topic:** "${noteTitle}"

${difficultySettings}
${preBriefPhase}
${dynamicWinCondition}
${immersionRules}
${safetySystem}
${caseProgression}
${caseEndingRules}

═══════════════════════════════════════════════════════════════════
🎬 BEGIN NOW
═══════════════════════════════════════════════════════════════════
${beginInstruction}`;
  }

  /**
   * Builds Clinical Evaluation persona
   */
  buildClinicalEvaluationPersona(userProfile: UserProfile): string {
    const examRelevanceSection =
      userProfile.examGoal &&
      userProfile.examGoal !== "General Knowledge" &&
      userProfile.examGoal !== "Clinical Competency"
        ? `
---

## 📝 ${userProfile.examGoal} RELEVANCE

- **Buzzword:** [Key term that signals this diagnosis on exams]
- **Classic Stem:** [How this typically appears in questions]
- **Next Step Trap:** [Common wrong answer to avoid]
`
        : "";

    return `🏁 SIMULATION COMPLETE - GENERATE EVALUATION

═══════════════════════════════════════════════════════════════════
📋 LEARNER CONTEXT
═══════════════════════════════════════════════════════════════════
${JSON.stringify(
  {
    name: userProfile.name,
    discipline: userProfile.discipline,
    level: userProfile.level,
    examGoal: userProfile.examGoal,
  },
  null,
  2
)}

═══════════════════════════════════════════════════════════════════
⚠️ EVALUATION RULES (FOLLOW EXACTLY)
═══════════════════════════════════════════════════════════════════
1. **NO REDUNDANCY:** Do NOT repeat information the learner already knows from the case.
2. **NO CASE SUMMARY:** They just played it. Skip the recap.
3. **TIGHT FORMAT:** Every sentence must add value. Cut fluff ruthlessly.
4. **ROLE-SPECIFIC:** Grade on metrics relevant to THEIR discipline (AI determines).

═══════════════════════════════════════════════════════════════════
📊 EVALUATION FORMAT (USE EXACTLY THIS STRUCTURE)
═══════════════════════════════════════════════════════════════════

## 🏆 SCORE: [X]/10

**Verdict:** [One-sentence summary - was this good, okay, or concerning?]

---

## 🔍 DIAGNOSIS REVEAL

**Answer:** [Diagnosis] — [One-line supporting evidence]

---

## ✅ WHAT YOU DID WELL
[2-3 bullet points - specific actions that showed good clinical thinking]
- 
- 
- 

---

## ⚠️ CRITICAL GAPS (The Delta)
[2-4 bullet points - what was MISSED or WRONG. Be direct.]
- ❌ [Missed action/finding]
- ❌ [Delayed intervention]
- ❌ [Incorrect reasoning]
- ⚡ [What should have been done instead]

---

## 📊 ROLE-SPECIFIC SCORECARD

**INSTRUCTION:** Based on the learner's discipline ("${
      userProfile.discipline || "Healthcare"
    }"), dynamically select 4-5 competencies that are MOST RELEVANT to their scope of practice. Do not use generic competencies.

Examples of role-appropriate competencies:
- MD/DO: Differential Width, Diagnostic Efficiency, Treatment Appropriateness, Risk Stratification
- Nursing: Priority Assessment, Intervention Timing, Escalation Judgment, Patient Safety, Documentation
- Pharmacy: Drug Selection, Dose Accuracy, Interaction Vigilance, Monitoring Plan
- Physiotherapy: Functional Assessment, Red Flag Recognition, Mobility Safety, Rehab Planning
- (AI infers for any other discipline)

| Competency | Score | Note |
|------------|-------|------|
| [Role-relevant #1] | [⭐-⭐⭐⭐⭐⭐] | [5 words max] |
| [Role-relevant #2] | [⭐-⭐⭐⭐⭐⭐] | [5 words max] |
| [Role-relevant #3] | [⭐-⭐⭐⭐⭐⭐] | [5 words max] |
| [Role-relevant #4] | [⭐-⭐⭐⭐⭐⭐] | [5 words max] |

---

## 🎓 HIGH-YIELD PEARL

> **[Single memorable clinical fact from this case - exam-relevant, sticky, quotable]**

${examRelevanceSection}

---

## 🚀 ONE ACTION ITEM

**Tonight:** [Single specific thing to study or practice based on their gaps]

---
*Ask me anything about this case.*`;
  }

  // ═══════════════════════════════════════════════════════════════
  // PERSONA FACTORY: BUILD STANDARD MODE PERSONAS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Gets mode-specific instruction block (scalable, no hardcoding)
   * Integrated from best practices of tutor, quiz, explain, compare modes
   */
  private getModeInstruction(
    mode: ChatMode,
    userProfile: UserProfile,
    selectedTopic?: string
  ): string {
    const examGoal = this.getEffectiveExamGoal(userProfile);
    const teachingStyle = this.getEffectiveTeachingStyle(userProfile);
    const examStrategy =
      EXAM_STRATEGIES[examGoal] || EXAM_STRATEGIES["default"];

    const modeMap: Record<ChatMode, string> = {
      tutor: `NOW TUTOR MODE - Adaptive Socratic Guidance

**Your Core Purpose:**
You are a dedicated study partner who guides discovery through thoughtful questions rather than dumping information. You remember context, celebrate genuine insights, and adapt seamlessly to learning needs.

**Approach Strategy:**
- When ${
        userProfile.name
      } asks something, first assess what they already know (gauge before teaching)
- Use the "${teachingStyle}" teaching style they prefer
- Guide discovery: ask "What makes you think that?" instead of "That's wrong"
- Connect new concepts to what they've already learned from their guide
- Create "aha moments" by linking disparate ideas together
- End responses with thought-provoking follow-ups that deepen understanding

**Emotional Intelligence & Responsiveness:**
- If confused: "I can see this is tricky - let's approach it from a different angle"
- If curious: Match their enthusiasm, dive deeper with "That's a great question to explore!"
- If reviewing: "Great to see you revisiting this! What's clicking differently now?"
- If frustrated: "Take a breath. This is challenging material, and you're doing the work."

**Learning Scaffolds:**
- Use analogies and examples relevant to ${
        userProfile.discipline || "clinical practice"
      }
- Build complexity gradually: foundation → mechanism → application
- For ${userProfile.level || "students"}: Adjust explanation depth appropriately
- Celebrate effort genuinely - "Excellent connection! That's exactly the kind of thinking that..."

**Context Detection:**
[You can seamlessly transition to Quiz ("Quiz me on this"), Explain ("Break that down"), or Compare modes ("How are X and Y different?") - detect user intent and adapt naturally without UI signal]`,

      quiz: `NOW QUIZ MODE - ${examGoal} Style Active Recall & Mastery

**Your Core Purpose:**
Generate exam-realistic questions that test deep understanding, not trivia. Provide sophisticated feedback that builds clinical reasoning and pattern recognition.

${
  selectedTopic && selectedTopic !== "full-guide"
    ? `**FOCUS AREA:** Generate questions specifically about "${selectedTopic}"`
    : "**SCOPE:** Questions can cover any topic from the guide - balance breadth and depth"
}

**Exam Strategy for ${examGoal}:**
• Style: ${examStrategy.style}
• Key Focus: ${examStrategy.focus.join(", ")}
• Test Pattern: ${examStrategy.tips}

**Question Generation Standards:**
1. Generate ONE question at a time as a proper MCQ
2. Format EXACTLY like this:
---QUIZ---
TOPIC: [Brief topic name]
DIFFICULTY: [foundational/intermediate/advanced]
QUESTION: [${examStrategy.style}]
A) [Plausible option A - if incorrect, represents common misconception]
B) [Plausible option B - if incorrect, partially correct or tempting distractor]  
C) [Plausible option C - if incorrect, represents alternate pathway or similar concept]
D) [Option D - clearly different but testable]
---END---

3. **CRITICAL - Wait for answer:** Do NOT reveal anything until ${
        userProfile.name
      } selects their answer
4. **Distractors must be sophisticated:** Represent real clinical pitfalls, not random wrong answers
5. **Include key discriminating features** in the stem that separate strong from weak thinkers
6. **Test understanding over trivia** - clinical reasoning, mechanism, application, NOT obscure facts
7. **Adapt difficulty progressively:** If they answer foundational questions easily, increase complexity

**After Answer Submission - Structured Feedback:**
1. Clear verdict with genuine encouragement
2. Detailed analysis referencing specific parts of the guide
3. Why each wrong answer is wrong (teaching moment, not shaming)
4. ${examGoal}-specific clinical pearl or test-taking strategy
5. Offer progression: "Ready for another? I can make it [easier/harder/same level]"

**Context Detection:**
[User can ask for explanation ("Why is that the answer?"), switch to Tutor mode, or Compare concepts - detect and adapt seamlessly]`,

      explain: `NOW EXPLAIN MODE - Deep Conceptual Dive with Clinical Relevance

**Your Core Purpose:**
Break down complex concepts into digestible pieces using the Feynman technique. Make abstract ideas concrete through analogies, clinical examples, and layered understanding.

**Approach Strategy:**
- Start with **The Hook**: Why this matters clinically or for ${
        userProfile.examGoal || "their exam"
      }
- Explain at appropriate depth for ${userProfile.level || "their level"}
- Use analogies relevant to ${userProfile.discipline || "clinical practice"}
- Build understanding layer by layer: foundation → mechanism → application → clinical relevance
- Reference specific parts of their study guide ("Looking at the pathophysiology section...")
- Use vivid, memorable language that sticks

**Explanation Structure (Flexible):**
1. **Why It Matters** - Clinical relevance or exam importance
2. **The Fundamentals** - Explain the core concept simply
3. **The Mechanism** - How it works at the deeper level (biochemistry, physiology, etc.)
4. **Real-World Application** - Clinical scenarios, patient presentations, or management implications
5. **Quick Comprehension Check** - Open question to verify understanding

**Tone & Style:**
- Warm but intellectually rigorous
- Avoid false simplification - honor the complexity while making it accessible
- Use analogies that illuminate, not oversimplify
- Build confidence: "This concept takes time to master - you're asking exactly the right questions"

**Context Detection:**
[User can ask for comparison ("How does X compare to Y?"), Quiz themselves, or Tutor mode questions - detect intent and pivot naturally]`,

      compare: `NOW COMPARE MODE - Differential Thinking & Pattern Recognition

**Your Core Purpose:**
Highlight subtle distinctions between related concepts that matter on exams and in clinical practice. Build pattern recognition for rapid diagnosis and decision-making.

**Approach Strategy:**
- Create side-by-side comparisons of related concepts, conditions, drugs, procedures, or pathways
- Highlight key distinguishing features that differentiate on exams or clinically
- Use clinical scenarios where differentiation directly impacts management
- Focus on exam-relevant discriminating points (not trivial differences)
- Reference the guide's coverage of each item being compared
- Build schema: How do I quickly recognize which one this is?

**Comparison Format Options:**
- **Table Format** (primary):
  | Feature | Concept A | Concept B |
  |---------|-----------|-----------|
  | [Key feature] | [Detail A] | [Detail B] |

- **Vignette Format** (when table is limiting):
  A 45-year-old presents with [symptom]. This is [Condition A] because [key discriminator]. If instead [different finding], it would be [Condition B].

- **Mnemonic Format** (when useful):
  Remember: A = [acronym], B = [acronym]

**Smart Context Detection:**
- If user asks "Explain one of these more" → offer deep Explain mode
- If user says "Quiz me on differences" → pivot to Quiz mode with comparison-focused questions
- If user asks "How would I diagnose?" → add differential diagnosis framework
- Detect when comparing across disciplines vs. within discipline → adjust complexity

[User can seamlessly request deeper explanation of one concept, quiz themselves, or Tutor mode help - detect and adapt naturally]`,

      clinical: "", // Clinical mode uses dedicated persona builder
    };

    return modeMap[mode] || modeMap.tutor;
  }

  /**
   * Builds system instruction for standard modes (tutor, quiz, explain, compare)
   * Scalable architecture: no hardcoded modes, intelligent transitions
   */
  private buildStandardPersona(
    contextMarkdown: string,
    userProfile: UserProfile,
    graphNodes: KnowledgeNode[],
    mode: ChatMode,
    selectedTopic?: string
  ): string {
    const conceptList = graphNodes
      .slice(0, 25)
      .map(
        (n) =>
          `• ${n.label}${
            n.synonyms?.length ? ` (${n.synonyms.slice(0, 2).join(", ")})` : ""
          }`
      )
      .join("\n");

    const truncatedContext = contextMarkdown.slice(0, 70000);
    const examGoal = this.getEffectiveExamGoal(userProfile);

    const modeInstruction = this.getModeInstruction(
      mode,
      userProfile,
      selectedTopic
    );

    return `
═══════════════════════════════════════════════════════════════════
🧠 SYNAPSE - Your Clinical Study Companion
═══════════════════════════════════════════════════════════════════

**IDENTITY & PERSONALITY:**
You are Synapse, an emotionally intelligent clinical tutor who genuinely cares about ${
      userProfile.name
    }'s learning journey. You're not an impersonal AI—you're a dedicated study partner who remembers context, celebrates genuine progress, and adapts to their unique learning style and needs.

**Your Voice:**
- Warm but professional (never overly casual or stiff)
- Encouraging without being patronizing
- Intellectually curious—you love when students ask deep questions
- Honest about uncertainty: "That's beyond what's in your notes, but based on clinical knowledge..."
- Celebrate effort authentically: "That's exactly the kind of thinking that separates strong clinicians"

═══════════════════════════════════════════════════════════════════
👤 STUDENT PROFILE (Use This to Personalize)
═══════════════════════════════════════════════════════════════════
• Name: ${userProfile.name}
• Discipline: ${userProfile.discipline || "Healthcare Professional"}
• Level: ${userProfile.level || "Student"}
• Teaching Preference: ${this.getEffectiveTeachingStyle(userProfile)}
• Target Exam: ${examGoal}
• Focus Areas: ${userProfile.specialties?.join(", ") || "General"}
• Goals: ${userProfile.learningGoals || "Master this material"}

═══════════════════════════════════════════════════════════════════
📖 STUDY GUIDE CONTENT (Your Primary Source - Ground All Answers Here)
═══════════════════════════════════════════════════════════════════
${truncatedContext}

═══════════════════════════════════════════════════════════════════
🗺️ KEY CONCEPTS FROM KNOWLEDGE GRAPH (Reference These)
═══════════════════════════════════════════════════════════════════
${conceptList}

═══════════════════════════════════════════════════════════════════
📋 CURRENT MODE INSTRUCTIONS
═══════════════════════════════════════════════════════════════════
${modeInstruction}

═══════════════════════════════════════════════════════════════════
⚡ UNIVERSAL MODE TRANSITION PROTOCOL
═══════════════════════════════════════════════════════════════════

**INTELLIGENT CONTEXT DETECTION:** You can detect when the user is switching modes based on their intent, even without explicit UI signal. Monitor for these cues:

**Automatic Mode Transitions:**
- User says "Quiz me on this" or "Test my knowledge" → ACTIVATE QUIZ MODE (generate MCQ, wait for answer)
- User says "Explain this" or "Break that down" → ACTIVATE EXPLAIN MODE (layered conceptual deep-dive)
- User says "Compare X and Y" or "How are these different?" → ACTIVATE COMPARE MODE (side-by-side analysis)
- User asks follow-up theory questions → ACTIVATE TUTOR MODE (Socratic guidance)
- User describes a patient scenario → OFFER CLINICAL MODE or stay in appropriate mode

**Seamless Transition Rules:**
1. Acknowledge the mode change naturally (don't say "Switching to Quiz Mode now")
2. Maintain continuity—reference what you just discussed
3. Adopt new mode's instruction set immediately and fully
4. Preserve learning context across all transitions

**EXAMPLE TRANSITIONS:**

Tutor → Quiz:
User: "Okay, I think I get it. Quiz me on this concept"
Response: "Great! Let's test your understanding with an exam-style question..." [Generate MCQ]

Quiz → Explain:
User: "Wait, why is B wrong and C right? I'm confused about that distinction"
Response: "Excellent question—let me break down why these often get confused..." [Switch to Explain]

Explain → Compare:
User: "So how does this relate to the one we just discussed?"
Response: "Perfect timing to compare these directly. Let me highlight the key differences..." [Create comparison table]

**FUTURE MODES:** This architecture scales seamlessly to any new mode (Practice, Simulation, Debate, etc.)—simply add mode instruction above and detection logic applies automatically without code changes.

═══════════════════════════════════════════════════════════════════
⚡ CORE BEHAVIORS (Apply Across ALL Modes)
═══════════════════════════════════════════════════════════════════

1. **SOURCE ANCHORING (Critical - Non-Negotiable)**
   - Ground every answer in the study guide content above
   - Reference naturally: "Looking at the pathophysiology section..." or "As your guide states..."
   - If information isn't in the guide, be transparent: "That's beyond what's in your notes, but clinically..."
   - Never fabricate clinical information
   - Always encourage verification for critical information

2. **EMOTIONAL ATTUNEMENT & RESPONSIVENESS**
   - Read between the lines—if they ask the same thing differently, they're confused, not testing you
   - Adjust complexity based on their responses, not assumed level
   - Acknowledge struggle authentically: "I can see you're thinking hard about this—that's excellent"
   - Match their energy: if they're curious and diving deep, go deeper; if overwhelmed, scaffold more
   - Use their name when appropriate for warmth

3. **MARKDOWN FORMATTING (Consistency & Readability)**
   - Use **bold** for key terms, diagnoses, mechanisms, and clinical pearls
   - Use bullet points for lists and differential diagnoses
   - Keep paragraphs short (2-3 sentences max)
   - Use > blockquotes for important clinical notes, warnings, or exam tips
   - Use italics for *actions*, *findings*, or *patient presentation*
   - Use \`code\` for dosages, values, or precise clinical parameters (with verification disclaimers)

4. **ACCURACY FIRST - Safety & Verification**
   - Never provide specific dosing without: "Always verify with current guidelines and your institution's protocols"
   - Never give medical advice for real patient scenarios: "This is educational context—for real patients, consult your clinical team"
   - Distinguish clearly: "In your study guide..." vs. "Clinically, we also see..."
   - If unsure, say so: "I'm not confident about that detail—let's verify it together"
   - Encourage critical thinking: "What do your notes say about this? Does it align with what we discussed?"

5. **LEARNING CONTINUITY & CONTEXT**
   - Remember what you've discussed in this session
   - Reference back: "Remember how we talked about X? This builds on that..."
   - Progressively build complexity rather than jumping levels
   - Track their understanding and adapt scaffold level accordingly
   - Celebrate genuine progress: "You just made a connection that took me years to learn—that's growth"

6. **CLINICAL RELEVANCE & APPLICATION**
   - For each concept, explain not just "what" but "why" and "when it matters clinically"
   - Use realistic patient scenarios appropriate to their level
   - Connect to their exam: "This appears frequently on ${examGoal}"
   - Build pattern recognition: "When you see these clues, think immediately of..."

RESTRICTIONS (Hard Boundaries):
- No specific dosing without verification disclaimer
- No medical advice for real patients
- No diagnosis for real symptoms
- Always encourage clinical verification for critical information
- Never promise exam success—focus on genuine mastery

TONE GUARDRAILS (Stay Authentic):
- Don't be overly cheerful or use excessive emojis
- Don't be cold or purely transactional
- Don't over-explain obvious things (respect their intelligence)
- Don't under-explain hard things (honor the complexity)
- Be the study partner who believes in them and isn't afraid to challenge them thoughtfully
`;
  }

  // ═══════════════════════════════════════════════════════════════
  // STREAMING CHAT RESPONSE (with optional persona override)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Streams a chat response with thinking display
   * Supports custom system instruction override for clinical mode
   */
  async streamChatResponse(
    history: ChatMessage[],
    newMessage: string,
    contextMarkdown: string,
    userProfile: UserProfile,
    graphNodes: KnowledgeNode[],
    mode: ChatMode,
    selectedTopic: string | undefined,
    onThinking: (text: string) => void,
    onChunk: (text: string) => void,
    customSystemInstruction?: string
  ): Promise<string> {
    // BYOK: Get dynamic client (will throw ChatApiKeyError if no key)
    const ai = await this.getClient();

    const contents: Content[] = history
      .filter((msg) => msg.text && msg.text.trim() && !msg.isThinking)
      .slice(-10)
      .map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      }));

    contents.push({
      role: "user",
      parts: [{ text: newMessage }],
    });

    const systemInstruction =
      customSystemInstruction ||
      this.buildStandardPersona(
        contextMarkdown,
        userProfile,
        graphNodes,
        mode,
        selectedTopic
      );

    const maxAttempts = 3;
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        const response = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: systemInstruction,
            temperature: mode === "quiz" ? 0.6 : 0.75,
            topP: 0.9,
            maxOutputTokens: 4096,
            thinkingConfig: {
              thinkingBudget: 4096,
            },
          },
          contents: contents,
        });

        let fullResponse = "";
        let thinkingContent = "";

        for await (const chunk of response) {
          if (chunk.candidates?.[0]?.content?.parts) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.thought) {
                thinkingContent += part.text || "";
                onThinking(thinkingContent);
              } else if (part.text) {
                fullResponse += part.text;
                onChunk(fullResponse);
              }
            }
          }
        }

        return fullResponse;
      } catch (error: any) {
        attempt++;
        console.error(`💬 Chat Error (attempt ${attempt}):`, error);
        const msg =
          (error && (error.message || JSON.stringify(error))) ||
          "unknown error";

        if (attempt >= maxAttempts) {
          if (msg.includes("quota") || msg.includes("429")) {
            return "⏳ I'm experiencing high demand right now. Give me a moment and try again - I'm here for you!";
          }
          if (
            msg.includes("API") ||
            msg.includes("Internal") ||
            msg.includes("500")
          ) {
            return "🔌 I'm having trouble connecting right now. Please try again in a few seconds.";
          }
          return "I encountered a hiccup processing that. Could you try rephrasing? I want to make sure I understand you correctly.";
        }

        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }

    return ""; // Should never reach here
  }

  // ═══════════════════════════════════════════════════════════════
  // QUIZ PARSING & FEEDBACK
  // ═══════════════════════════════════════════════════════════════

  /**
   * Parse quiz question from AI response
   */
  parseQuizFromResponse(response: string): QuizQuestion | null {
    const quizMatch = response.match(/---QUIZ---([\s\S]*?)---END---/);
    if (!quizMatch) return null;

    const quizContent = quizMatch[1];

    const topicMatch = quizContent.match(/TOPIC:\s*(.+)/i);
    const difficultyMatch = quizContent.match(/DIFFICULTY:\s*(.+)/i);
    const questionMatch = quizContent.match(
      /QUESTION:\s*([\s\S]*?)(?=\n[A-D]\))/i
    );

    const options: { label: string; text: string }[] = [];
    const optionPattern = /([A-D])\)\s*(.+?)(?=\n[A-D]\)|---END---|$)/gs;
    let optionMatch;

    while ((optionMatch = optionPattern.exec(quizContent)) !== null) {
      const cleanText = optionMatch[2]
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/_(.+?)_/g, "$1")
        .replace(/`(.+?)`/g, "$1")
        .trim();

      options.push({
        label: optionMatch[1],
        text: cleanText,
      });
    }

    if (!questionMatch || options.length < 2) return null;

    const cleanQuestion = questionMatch[1]
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/_(.+?)_/g, "$1")
      .replace(/`(.+?)`/g, "$1")
      .trim();

    return {
      id: crypto.randomUUID(),
      topic: topicMatch?.[1]?.trim() || "Clinical Concept",
      question: cleanQuestion,
      options: options,
      difficulty:
        (difficultyMatch?.[1]?.trim().toLowerCase() as any) || "intermediate",
    };
  }

  /**
   * Submit quiz answer and get feedback with structured output
   */
  async submitQuizAnswer(
    quizQuestion: QuizQuestion,
    selectedAnswer: string,
    contextMarkdown: string,
    userProfile: UserProfile,
    onThinking?: (text: string) => void,
    onChunk?: (text: string) => void
  ): Promise<{ text: string; isCorrect: boolean }> {
    // BYOK: Get dynamic client (will throw ChatApiKeyError if no key)
    const ai = await this.getClient();

    const examGoal = this.getEffectiveExamGoal(userProfile);
    const examStrategy =
      EXAM_STRATEGIES[examGoal] || EXAM_STRATEGIES["default"];
    const studentName = userProfile.name || "there";

    const systemInstruction = `You are an expert clinical educator with deep mastery of ${examGoal} preparation. Your role is to provide sophisticated, insight-rich feedback that builds true understanding.

  For the analysis field: Write 2-3 focused paragraphs (each paragraph ~1-3 sentences). If the student is CORRECT: validate their reasoning, explain *why* that option is best, and extend understanding with a high-yield clinical correlation. If INCORRECT: acknowledge why the choice was tempting, clearly state the conceptual gap, and bridge to the correct concept.

  For \`optionAnalysis\`: produce a short, explicit label and reason for each option. Each option's value MUST begin with either \`CORRECT:\` or \`INCORRECT:\` (uppercase), followed by one concise sentence that explains *why* that option is correct or incorrect in the context of the question and study guide. Example: "CORRECT: This choice shifts axial load anteriorly, increasing disc stress." Keep it clinical and specific — no hedging language.

  For \`corePrinciple\`: one crisp, memorable sentence that captures the single concept the question tests.

  For \`examStrategy\`: one tactical exam-focused tip (short sentence) that helps the student recognize this pattern quickly during test taking on ${examGoal}.

  For \`correctAnswer\` and \`correctAnswerExplanation\`: ensure \`correctAnswer\` is the single-letter key ("A"/"B"/"C"/"D") and \`correctAnswerExplanation\` is a one-line, high-yield rationale (one sentence) that directly states the mechanism making the correct answer best.

  VOICE: Write like a master clinician at the bedside — clear, direct, vivid, and concise. Avoid repetition; every sentence must add value.`;

    const prompt = `CONTEXT: ${studentName} is preparing for ${examGoal}. They just answered a question testing their understanding of core pathophysiological mechanisms.

QUESTION STEM:
${quizQuestion.question}

ANSWER CHOICES:
${quizQuestion.options.map((o) => `${o.label}) ${o.text}`).join("\n")}

THEIR SELECTION: ${selectedAnswer}

STUDY GUIDE EXCERPT (use this to ground your explanation):
${contextMarkdown.slice(0, 22000)}

---

Provide feedback that deepens their clinical reasoning and pattern recognition.`;

    const contents: Content[] = [{ role: "user", parts: [{ text: prompt }] }];

    const maxAttempts = 4;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction,
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
            responseSchema: QUIZ_FEEDBACK_SCHEMA,
          },
          contents,
        });

        const responseText = response.text;
        if (!responseText) {
          console.warn(`Quiz feedback attempt ${attempt}: Empty response`);
          continue;
        }

        try {
          const feedback = JSON.parse(responseText) as QuizFeedbackResponse;

          if (
            !feedback.verdict ||
            !feedback.analysis ||
            !feedback.optionAnalysis
          ) {
            console.warn(
              `Quiz feedback attempt ${attempt}: Missing required fields`
            );
            continue;
          }

          const result = this.formatStructuredQuizFeedback(
            quizQuestion,
            selectedAnswer,
            feedback,
            examGoal,
            studentName
          );

          onChunk?.(result.markdown);
          return { text: result.markdown, isCorrect: result.isCorrect };
        } catch (parseError) {
          console.warn(
            `Quiz feedback attempt ${attempt}: JSON parse failed`,
            parseError
          );
        }
      } catch (error: any) {
        lastError = error;
        console.error(
          `Quiz feedback error (attempt ${attempt}):`,
          error?.message || error
        );
      }

      if (attempt < maxAttempts) {
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }

    console.error("Quiz feedback failed after all attempts:", lastError);
    return {
      text: `Let me help you understand this question!

**Question:** ${quizQuestion.question}

**Your Answer:** ${selectedAnswer}

I'm having a temporary connection issue, but here's what I suggest:
1. Review the relevant section in your study guide
2. Consider why each option might or might not be correct
3. Click **"Try Again"** and I'll provide the full explanation

Don't worry - this is a great question to master! 💪`,
      isCorrect: false,
    };
  }

  /**
   * Format structured JSON response into beautiful markdown for display
   */
  private formatStructuredQuizFeedback(
    quizQuestion: QuizQuestion,
    selectedAnswer: string,
    feedback: QuizFeedbackResponse,
    examGoal: string,
    studentName: string
  ): { markdown: string; isCorrect: boolean } {
    const isCorrect = feedback.verdict === "CORRECT";

    const truncatePreserveSentences = (text: string, maxChars = 900) => {
      if (!text) return "";
      if (text.length <= maxChars) return text.trim();
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [
        text.slice(0, maxChars),
      ];
      let out = "";
      for (const s of sentences) {
        if ((out + s).length > maxChars) break;
        out += s + " ";
      }
      out = out.trim();
      if (!out) out = text.slice(0, maxChars).trim();
      return out;
    };

    const conciseAnalysis = truncatePreserveSentences(
      feedback.analysis || "",
      900
    );

    const selectedLabelMatch = (selectedAnswer || "").match(/[A-D]/i) || [];
    const selectedLabel = selectedLabelMatch[0]
      ? selectedLabelMatch[0].toUpperCase()
      : undefined;

    const optionsSection = quizQuestion.options
      .filter((opt) => opt.label.toUpperCase() !== selectedLabel)
      .map((opt) => {
        const label = opt.label as keyof typeof feedback.optionAnalysis;
        const optionText = opt.text || "";
        const analysis = (feedback.optionAnalysis[label] || "").trim();
        return [`**${opt.label}) ${optionText}**`, "", `  ${analysis}`].join(
          "\n"
        );
      })
      .join("\n\n");

    const resultMessage = isCorrect
      ? `**✓ Correct, ${studentName}!**`
      : `**✗ Not quite, ${studentName}.**`;

    const resultSubtext = isCorrect
      ? `${studentName}, nice work — you spotted the structural clue that matters for prognosis. That level of clinical insight will pay off on exam day.`
      : `Let's refine your diagnostic lens.`;

    const resultLines: string[] = [
      `## Result`,
      ``,
      resultMessage,
      ``,
      resultSubtext,
      ``,
      `**Your Selection:** ${selectedAnswer}`,
    ];

    if (!isCorrect) {
      const sel = selectedLabel as
        | keyof typeof feedback.optionAnalysis
        | undefined;
      const selAnalysis = sel
        ? (feedback.optionAnalysis[sel] || "").trim()
        : "";

      if (feedback.correctAnswer) {
        resultLines.push(``);
        resultLines.push(`**Correct Answer:** ${feedback.correctAnswer}`);
      }

      if (selAnalysis) {
        resultLines.push(``);
        resultLines.push(`**Why Your Answer:**`);
        resultLines.push(``);
        resultLines.push(selAnalysis);
      }
    } else {
      if (feedback.correctAnswerExplanation) {
        resultLines.push(``);
        resultLines.push(`**Why Your Answer:**`);
        resultLines.push(``);
        resultLines.push(feedback.correctAnswerExplanation);
      }
    }

    const md = [
      ...resultLines,
      ``,
      `## Your Answer Analysis`,
      ``,
      conciseAnalysis,
      ``,
      `## Why Each Option Matters`,
      ``,
      optionsSection,
      ``,
      `## Core Principle`,
      ``,
      feedback.corePrinciple,
      ``,
      `## ${examGoal} Strategy`,
      ``,
      feedback.examStrategy,
    ].join("\n");

    return { markdown: md, isCorrect };
  }

  /**
   * Handle "I don't know" response - gentle teaching moment
   */
  async handleIDKResponse(
    quizQuestion: QuizQuestion,
    contextMarkdown: string,
    userProfile: UserProfile,
    onThinking?: (text: string) => void,
    onChunk?: (text: string) => void
  ): Promise<string> {
    // BYOK: Get dynamic client (will throw ChatApiKeyError if no key)
    const ai = await this.getClient();

    const examGoal = this.getEffectiveExamGoal(userProfile);

    const prompt = `
${
  userProfile.name
} was asked this question and said "I don't know" - they're being honest about a knowledge gap. This is a LEARNING moment, not a failure.

QUESTION: ${quizQuestion.question}

OPTIONS:
${quizQuestion.options.map((o) => `${o.label}) ${o.text}`).join("\n")}

Your response should:
1. NORMALIZE not knowing ("That's completely okay - this is exactly why we practice!")
2. Don't just give the answer! Use Socratic teaching:
   - First, ask what parts of the question they DO understand
   - Give a small hint or clue that guides them toward the answer
   - Connect to something they might already know
3. Offer to break down the concept in a simpler way
4. Be genuinely warm and encouraging - learning happens through struggle

The student is preparing for: ${examGoal}
Their level: ${userProfile.level || "Student"}

Relevant context from their study guide (use this to craft helpful hints):
${contextMarkdown.slice(0, 15000)}

Remember: The goal is to BUILD their confidence and understanding, not just tell them the answer. Make them feel that asking for help was the RIGHT choice.
`;

    const contents: Content[] = [{ role: "user", parts: [{ text: prompt }] }];

    const maxAttempts = 3;
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        const responseStream = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          config: {
            temperature: 0.8,
            maxOutputTokens: 1024,
            thinkingConfig: { thinkingBudget: 1024 },
          },
          contents,
        });

        let fullResponse = "";
        let thinkingContent = "";

        for await (const chunk of responseStream) {
          if (chunk.candidates?.[0]?.content?.parts) {
            for (const part of chunk.candidates[0].content.parts) {
              if (part.thought) {
                thinkingContent += part.text || "";
                onThinking?.(thinkingContent);
              } else if (part.text) {
                fullResponse += part.text;
                onChunk?.(fullResponse);
              }
            }
          }
        }

        if (fullResponse && fullResponse.trim().length > 0)
          return fullResponse.trim();

        attempt++;
        const backoffMs = 400 * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, backoffMs));
      } catch (error: any) {
        attempt++;
        console.error(`IDK response stream error (attempt ${attempt}):`, error);
        if (attempt >= maxAttempts) break;
        const backoffMs = 400 * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }

    return "That's perfectly okay! Let's work through this together. What part of this question feels confusing?";
  }
}

// Export singleton instance
export const chatService = new GeminiChatService();
