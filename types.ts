export enum ContentType {
  TEXT = "TEXT",
  AUDIO = "AUDIO",
  IMAGE = "IMAGE",
  PDF = "PDF",
}

// Processing status for 2-phase architecture
// Phase 1: Building knowledge graph (metadata extraction + Google Search verification)
// Phase 2: Writing comprehensive markdown guide (streaming with real-time progress)
export enum ProcessingStatus {
  IDLE = "IDLE", // No active processing
  BUILDING_GRAPH = "BUILDING_GRAPH", // Phase 1: Extracting metadata, building knowledge graph
  WRITING_GUIDE = "WRITING_GUIDE", // Phase 2: Generating markdown content
  COMPLETE = "COMPLETE", // Both phases finished successfully
  ERROR = "ERROR", // Processing failed
}

export interface ClinicalPearl {
  type: "gap-filler" | "fact-check" | "exam-tip" | "red-flag";
  content: string;
  citation?: string;
  sourceUrl?: string; // New field for direct clickable links
}

export interface Source {
  title: string;
  uri: string;
}

export interface KnowledgeNode {
  id: string;
  label: string;
  group: number; // 1: Core, 2: Pathology, 3: Medication, 4: Anatomy, 5: Physiology, 6: Diagnostic, 7: Clinical Signs
  val: number; // Size/Importance (8-20)
  description?: string; // Short summary (max 15 words)
  details?: string; // RICH MARKDOWN: 3-6 paragraphs
  synonyms?: string[]; // Alternative terms (e.g., ['MI', 'Heart Attack'])
  clinicalPearl?: string; // One-sentence high-yield exam tip
  differentials?: string[]; // Related conditions for differential diagnosis
  examFindings?: string[]; // Physical exam findings
  labValues?: string[]; // Relevant lab values with normal ranges
  medications?: string[]; // Related medications
  imageKeywords?: string[]; // Keywords for image search
}

export interface KnowledgeLink {
  source: string;
  target: string;
  relationship: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
}

export interface AugmentedNote {
  id: string;
  title: string; // The topic name
  markdownContent: string; // The generated study guide
  summary: string;
  pearls: ClinicalPearl[];
  graphData: KnowledgeGraphData;
  cacheName?: string; // ID for Gemini Context Cache
  eli5Analogy?: string;
  timestamp: number;
  sourceFileNames: string[];
  // IDs of uploaded files persisted to IndexedDB (optional)
  sourceFileIds?: string[];
  sources: Source[]; // Verified sources from Grounding
}

export interface FileInput {
  file: File;
  base64: string;
  type: string;
}

// Profile types for client-side personalization
export type ClinicalDiscipline =
  | "Medical (MD/DO)"
  | "Nursing"
  | "Pharmacy"
  | "Physiotherapy"
  | "Dentistry"
  | "Other";

export type TrainingLevel =
  | "Student (Pre-clinical)"
  | "Student (Clinical)"
  | "Intern/Resident"
  | "Professional";

export type TeachingStyle =
  | "Socratic" // Questions that guide discovery
  | "Concise" // Bullet points, rapid facts
  | "Detailed" // Deep explanations, comprehensive
  | "Clinical-Cases" // Case-based learning
  | "Custom"; // User-defined custom style

// Exam goal types for quiz generation personalization
export type ExamGoal =
  | "USMLE Step 1"
  | "USMLE Step 2 CK"
  | "USMLE Step 3"
  | "COMLEX"
  | "NCLEX-RN"
  | "NCLEX-PN"
  | "NAPLEX"
  | "PANCE/PANRE"
  | "MCAT"
  | "Board Certification"
  | "Clinical Competency"
  | "University Semester Exam"
  | "General Knowledge"
  | "Custom";

export interface UserProfile {
  name: string;
  discipline?: ClinicalDiscipline; // Made optional
  level?: TrainingLevel; // Made optional
  teachingStyle?: TeachingStyle; // Made optional
  customTeachingStyle?: string; // Free text for custom teaching preferences
  examGoal?: ExamGoal; // Target exam for personalized quiz generation
  customExamGoal?: string; // Free text for custom exam description
  profilePicture?: string; // Base64 encoded image
  birthday?: string; // YYYY-MM-DD
  theme?: "obsidian" | "clinical"; // UI preference
  specialties?: string[]; // e.g., ["Cardiology", "Nephrology"]
  learningGoals?: string; // Free-text learning objectives
  apiKey?: string; // Google Gemini API Key (BYOK - stored locally, never sent to our servers)
  createdAt: number; // Timestamp
  updatedAt: number; // Timestamp
}
