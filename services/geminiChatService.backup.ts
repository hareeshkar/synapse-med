import { GoogleGenAI, Content } from "@google/genai";
import { UserProfile, KnowledgeNode, ExamGoal } from "../types";

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
  isCorrectAnswer?: boolean; // For quiz feedback messages: true if answer was correct, false if incorrect
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

// Structured output schema for quiz feedback
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

// JSON Schema for Gemini structured output
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
// GEMINI CHAT SERVICE
// Emotional, Intelligent Socratic Tutor
// ===============================
export class GeminiChatService {
  private ai: GoogleGenAI;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.API_KEY || "";
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
  }

  /**
   * Extracts potential quiz topics from the markdown content
   */
  extractTopicsFromContent(markdown: string): QuizTopic[] {
    const topics: QuizTopic[] = [];
    const headingPattern = /^#{1,3}\s+(.+)$/gm;
    let match;
    let index = 0;

    while ((match = headingPattern.exec(markdown)) !== null) {
      // Clean markdown formatting, links, and node references
      let name = match[1]
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove markdown links but keep text
        .replace(/\[([^\]]+)\]/g, "$1") // Remove remaining brackets
        .replace(/[*_`]/g, "") // Remove formatting
        .replace(/\(node:[^)]+\)/g, "") // Remove node references
        .trim();

      if (
        name.length > 3 &&
        name.length < 80 &&
        !name.toLowerCase().includes("table of contents")
      ) {
        topics.push({
          id: `topic-${index++}`,
          name: name,
          questionCount: Math.floor(Math.random() * 3) + 2, // 2-4 questions per topic
        });
      }
    }

    // Add "Full Guide" option
    if (topics.length > 0) {
      topics.unshift({
        id: "full-guide",
        name: "📚 Full Guide (All Topics)",
        questionCount: 5,
      });
    }

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

  /**
   * Builds the emotionally intelligent system instruction
   */
  private buildSystemInstruction(
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
    const teachingStyle = this.getEffectiveTeachingStyle(userProfile);

    // Get exam-specific strategy
    const examStrategy =
      EXAM_STRATEGIES[examGoal] || EXAM_STRATEGIES["default"];

    const modeInstructions = {
      tutor: `
🎓 TUTOR MODE - Adaptive Socratic Guidance

Your approach:
- Guide discovery through thoughtful questions, never just dump information
- When ${userProfile.name} asks something, first gauge what they already know
- Use the "${teachingStyle}" teaching style they prefer
- Celebrate their insights genuinely - "Excellent connection! That's exactly the kind of thinking that..."
- When they struggle, offer scaffolding: "Let me break this down differently..."
- Connect new concepts to things they've already learned from their guide
- End responses with thought-provoking follow-up when appropriate

Emotional Intelligence:
- If they seem confused: "I can see this is tricky - let's approach it from a different angle"
- If they're curious: Match their enthusiasm, dive deeper with "That's a great question to explore!"
- If they're reviewing: "Great to see you revisiting this! What's clicking differently now?"
- If they're frustrated: "Take a breath. This is challenging material, and you're doing the work."

Learning Scaffolds:
- Use analogies relevant to ${userProfile.discipline || "clinical practice"}
- Build on what they already know from the guide
- Create "aha moments" by connecting disparate concepts
- For ${userProfile.level || "students"}: Adjust complexity accordingly`,

      quiz: `
📝 QUIZ MODE - ${examGoal} Style Active Recall

${
  selectedTopic && selectedTopic !== "full-guide"
    ? `FOCUS AREA: Generate questions specifically about "${selectedTopic}"`
    : "SCOPE: Questions can cover any topic from the guide"
}

🎯 EXAM-SPECIFIC STRATEGY FOR ${examGoal}:
• Question Style: ${examStrategy.style}
• Key Focus Areas: ${examStrategy.focus.join(", ")}
• Pro Tip: ${examStrategy.tips}

Question Format Requirements:
1. Generate ONE question at a time as a proper MCQ
2. Format EXACTLY like this:
---QUIZ---
TOPIC: [Brief topic name]
DIFFICULTY: [foundational/intermediate/advanced]
QUESTION: [${examStrategy.style}]
A) [Option A text - must be plausible]
B) [Option B text - common misconception as distractor]  
C) [Option C text - partially correct distractor]
D) [Option D text - clearly different but testable]
---END---

3. CRITICAL: Wait for ${
        userProfile.name
      } to select their answer before revealing ANYTHING
4. After they submit, provide:
   - Clear verdict with genuine encouragement
   - Detailed explanation referencing specific parts of the guide
   - Why wrong answers are wrong (teaching moment)
   - ${examGoal}-specific clinical pearl or test-taking strategy
   - "Ready for another? I can make it [easier/harder/same level]"

Question Quality Standards:
- Distractors should represent common misconceptions, not random wrong answers
- Include key discriminating features in the stem
- Test understanding, not obscure trivia
- Progress difficulty based on their performance pattern`,

      explain: `
💡 EXPLAIN MODE - Deep Conceptual Dive

Your approach:
- Break down the selected concept into digestible pieces
- Use the Feynman technique: explain as if teaching a curious student
- Include relevant analogies appropriate for ${
        userProfile.level || "their level"
      }
- Connect to clinical relevance when applicable
- Reference specific parts of their study guide
- Build understanding layer by layer (foundation → mechanism → clinical application)
- End with a "check your understanding" question

Explanation Structure:
1. **The Hook**: Start with why this matters clinically
2. **The Core**: Explain the fundamental concept simply
3. **The Mechanism**: How it works at the deeper level
4. **The Clinical**: Real-world application and relevance
5. **The Test**: Quick comprehension check`,

      compare: `
⚖️ COMPARE MODE - Differential Thinking

Your approach:
- Create clear comparison tables for related concepts
- Highlight key distinguishing features
- Use clinical scenarios where differentiation matters
- Reference the guide's coverage of each item
- Focus on exam-relevant differentiating points

Format comparisons as:
| Feature | Concept A | Concept B |
|---------|-----------|-----------|`,

      clinical: `
🏥 CLINICAL MODE - Case-Based Reasoning

Your approach:
- Present realistic clinical scenarios from the guide content
- Walk through clinical reasoning step-by-step
- Use the "Aunt Minnie" approach for classic presentations
- Discuss red flags and must-not-miss diagnoses
- Connect to management algorithms when relevant

For ${userProfile.discipline || "clinical"} ${userProfile.level || "students"}:
- Adjust case complexity appropriately
- Focus on presentations they'd actually encounter`,
    };

    return `
═══════════════════════════════════════════════════════════════
🧠 SYNAPSE - Your Clinical Study Companion
═══════════════════════════════════════════════════════════════

IDENTITY & PERSONALITY:
You are Synapse, an emotionally intelligent clinical tutor who genuinely cares about ${
      userProfile.name
    }'s learning journey. You're not just an AI - you're a dedicated study partner who remembers context, celebrates progress, and adapts to their needs.

Your voice is:
- Warm but professional (not overly casual or stiff)
- Encouraging without being patronizing
- Intellectually curious - you love when students ask deep questions
- Honest about uncertainty - "That's beyond what's in your notes, but based on clinical knowledge..."

═══════════════════════════════════════════════════════════════
👤 STUDENT PROFILE
═══════════════════════════════════════════════════════════════
• Name: ${userProfile.name}
• Discipline: ${userProfile.discipline || "Healthcare Professional"}
• Level: ${userProfile.level || "Student"}
• Teaching Preference: ${teachingStyle}
• Target Exam: ${examGoal}
• Focus Areas: ${userProfile.specialties?.join(", ") || "General"}
• Goals: ${userProfile.learningGoals || "Master this material"}

═══════════════════════════════════════════════════════════════
📖 STUDY GUIDE CONTENT (Primary Source)
═══════════════════════════════════════════════════════════════
${truncatedContext}

═══════════════════════════════════════════════════════════════
🗺️ KEY CONCEPTS FROM KNOWLEDGE GRAPH
═══════════════════════════════════════════════════════════════
${conceptList}

═══════════════════════════════════════════════════════════════
📋 CURRENT MODE
═══════════════════════════════════════════════════════════════
${modeInstructions[mode]}

═══════════════════════════════════════════════════════════════
⚡ CORE BEHAVIORS
═══════════════════════════════════════════════════════════════

1. SOURCE ANCHORING (Critical)
   - Ground answers in the study guide content above
   - Reference naturally: "Looking at the pathophysiology section..."
   - If information isn't in the guide, be transparent about it

2. EMOTIONAL ATTUNEMENT
   - Read between the lines - if they ask the same thing differently, they're confused
   - Adjust complexity based on their responses
   - Acknowledge effort: "I can see you're thinking hard about this"

3. MARKDOWN FORMATTING
   - Use **bold** for key terms and clinical pearls
   - Use bullet points for lists
   - Keep paragraphs short (2-3 sentences)
   - Use > blockquotes for important clinical notes

4. ACCURACY FIRST
   - Never fabricate clinical information
   - Encourage verification: "Always confirm dosages with current guidelines"
   - Distinguish between what's in their notes vs. general knowledge

RESTRICTIONS:
- No specific dosing without verification disclaimer
- No medical advice for real patient scenarios
- Always encourage clinical verification for critical information
`;
  }

  /**
   * Streams a chat response with thinking display
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
    onChunk: (text: string) => void
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error("API Key missing. Please configure your Gemini API key.");
    }

    const contents: Content[] = history
      .filter((msg) => msg.text && msg.text.trim() && !msg.isThinking)
      .slice(-10) // Keep last 10 messages for context
      .map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.text }],
      }));

    contents.push({
      role: "user",
      parts: [{ text: newMessage }],
    });

    const systemInstruction = this.buildSystemInstruction(
      contextMarkdown,
      userProfile,
      graphNodes,
      mode,
      selectedTopic
    );

    // Retry wrapper for transient API errors
    const maxAttempts = 3;
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        const response = await this.ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: systemInstruction,
            temperature: mode === "quiz" ? 0.6 : 0.75,
            topP: 0.9,
            maxOutputTokens: 4096,
            thinkingConfig: {
              thinkingBudget: 4096, // Increased for more visible reasoning
            },
          },
          contents: contents,
        });

        let fullResponse = "";
        let thinkingContent = "";

        for await (const chunk of response) {
          // Handle thinking content
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

        // If we've exhausted attempts, fallthrough to returning user-facing message
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

        // Small exponential backoff before retrying
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }
  }

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
      // Clean markdown formatting from option text
      const cleanText = optionMatch[2]
        .replace(/\*\*(.+?)\*\*/g, "$1") // Remove bold **text**
        .replace(/\*(.+?)\*/g, "$1") // Remove italic *text*
        .replace(/_(.+?)_/g, "$1") // Remove underscore _text_
        .replace(/`(.+?)`/g, "$1") // Remove code `text`
        .trim();

      options.push({
        label: optionMatch[1],
        text: cleanText,
      });
    }

    if (!questionMatch || options.length < 2) return null;

    // Clean markdown from question text as well
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
   * Submit quiz answer and get feedback with robust streaming
   */
  async submitQuizAnswer(
    quizQuestion: QuizQuestion,
    selectedAnswer: string,
    contextMarkdown: string,
    userProfile: UserProfile,
    onThinking?: (text: string) => void,
    onChunk?: (text: string) => void
  ): Promise<{ text: string; isCorrect: boolean }> {
    if (!this.apiKey) {
      throw new Error("API Key missing");
    }

    const examGoal = this.getEffectiveExamGoal(userProfile);
    const examStrategy =
      EXAM_STRATEGIES[examGoal] || EXAM_STRATEGIES["default"];
    const studentName = userProfile.name || "there";

    const systemInstruction = `You are an expert clinical educator with deep mastery of ${examGoal} preparation. Your role is to provide sophisticated, insight-rich feedback that builds true understanding.

  For the analysis field: Write 2-3 focused paragraphs (each paragraph ~1-3 sentences). If the student is CORRECT: validate their reasoning, explain *why* that option is best, and extend understanding with a high-yield clinical correlation. If INCORRECT: acknowledge why the choice was tempting, clearly state the conceptual gap, and bridge to the correct concept.

  For \`optionAnalysis\`: produce a short, explicit label and reason for each option. Each option's value MUST begin with either \`CORRECT:\` or \`INCORRECT:\` (uppercase), followed by one concise sentence that explains *why* that option is correct or incorrect in the context of the question and study guide. Example: \"CORRECT: This choice shifts axial load anteriorly, increasing disc stress.\" Keep it clinical and specific — no hedging language.

  For \`corePrinciple\`: one crisp, memorable sentence that captures the single concept the question tests.

  For \`examStrategy\`: one tactical exam-focused tip (short sentence) that helps the student recognize this pattern quickly during test taking on ${examGoal}.

  For \`correctAnswer\` and \`correctAnswerExplanation\`: ensure \`correctAnswer\` is the single-letter key (\"A\"/\"B\"/\"C\"/\"D\") and \`correctAnswerExplanation\` is a one-line, high-yield rationale (one sentence) that directly states the mechanism making the correct answer best.

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

    // Robust retry with exponential backoff
    const maxAttempts = 4;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Use structured output for guaranteed consistent format
        const response = await this.ai.models.generateContent({
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

        // Parse structured JSON response
        const responseText = response.text;
        if (!responseText) {
          console.warn(`Quiz feedback attempt ${attempt}: Empty response`);
          continue;
        }

        try {
          const feedback = JSON.parse(responseText) as QuizFeedbackResponse;

          // Validate required fields exist
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

          // Format the structured response into beautiful markdown
          const result = this.formatStructuredQuizFeedback(
            quizQuestion,
            selectedAnswer,
            feedback,
            examGoal,
            studentName
          );

          // Stream the formatted result for UI consistency
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

      // Exponential backoff before retry
      if (attempt < maxAttempts) {
        const backoffMs = 500 * Math.pow(2, attempt - 1);
        await new Promise((res) => setTimeout(res, backoffMs));
      }
    }

    // All attempts failed - provide helpful fallback
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
   * Format structured JSON response into beautiful markdown for display.
   * No parsing needed - structure is guaranteed by JSON schema!
   */
  private formatStructuredQuizFeedback(
    quizQuestion: QuizQuestion,
    selectedAnswer: string,
    feedback: QuizFeedbackResponse,
    examGoal: string,
    studentName: string
  ): { markdown: string; isCorrect: boolean } {
    const isCorrect = feedback.verdict === "CORRECT";

    // Helper: keep text concise while preserving sentence boundaries
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

    // Slightly tighten the main analysis for readability (2-3 substantive paragraphs preserved by truncation)
    const conciseAnalysis = truncatePreserveSentences(
      feedback.analysis || "",
      900
    );

    // Build formatted options section WITHOUT the user's selected option and WITHOUT truncation
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

    // Result declaration: keep UI header separate (avoid repeating header text in markdown)
    const resultMessage = isCorrect
      ? `**✓ Correct, ${studentName}!**`
      : `**✗ Not quite, ${studentName}.**`;

    const resultSubtext = isCorrect
      ? `${studentName}, nice work — you spotted the structural clue that matters for prognosis. That level of clinical insight will pay off on exam day.`
      : `Let's refine your diagnostic lens.`;

    // Build result section with proper spacing (do not repeat the green header text)
    const resultLines: string[] = [
      `## Result`,
      ``,
      resultMessage,
      ``,
      resultSubtext,
      ``,
      `**Your Selection:** ${selectedAnswer}`,
    ];

    // If incorrect, include the correct answer letter and a 'Why it's wrong' for the selected option
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
      // NOTE: Do NOT display 'Why it's correct' here; the explanation will appear in the "Why Each Option Matters" section
    } else {
      // If correct, explicitly show why the correct answer is correct (reward + concise rationale)
      if (feedback.correctAnswerExplanation) {
        resultLines.push(``);
        resultLines.push(`**Why Your Answer:**`);
        resultLines.push(``);
        resultLines.push(feedback.correctAnswerExplanation);
      }
    }

    // Compose the final formatted response
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
   * Handle "I don't know" response - gentle teaching moment (STREAMING)
   */
  async handleIDKResponse(
    quizQuestion: QuizQuestion,
    contextMarkdown: string,
    userProfile: UserProfile,
    onThinking?: (text: string) => void,
    onChunk?: (text: string) => void
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error("API Key missing");
    }

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
        const responseStream = await this.ai.models.generateContentStream({
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
