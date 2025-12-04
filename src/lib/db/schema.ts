/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SYNAPSE MED - LOCAL DATABASE SCHEMA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Clean IndexedDB setup using the idb library.
 * Mirrors Supabase/Postgres architecture for future cloud migration.
 *
 * Object Stores (Tables):
 * - notes: Study guides, knowledge graphs, metadata
 * - files: Binary storage bucket (audio, PDFs, images)
 * - profile: User settings and preferences
 * - chats: AI conversation history
 */

import { openDB, type IDBPDatabase } from "idb";

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const DB_NAME = "synapse_med_v1";
const DB_VERSION = 1;

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Note record - study guide with knowledge graph */
export interface NoteRecord {
  id: string;
  title: string;
  markdown_content: string;
  summary: string;
  eli5_analogy?: string;
  pearls: Array<{
    type: "gap-filler" | "fact-check" | "exam-tip" | "red-flag";
    content: string;
    citation?: string;
    sourceUrl?: string;
  }>;
  graph_data: {
    nodes: Array<any>;
    links: Array<any>;
  };
  podcast_script?: Array<{
    speaker: "Professor" | "Student";
    text: string;
    mood: "neutral" | "curious" | "humorous" | "serious";
  }>;
  audio_file_id?: string;
  cache_name?: string;
  source_file_names: string[];
  // References to uploaded file IDs stored in `files` object store
  source_file_ids?: string[];
  sources: Array<{ title: string; uri: string }>;
  created_at: string;
  updated_at: string;
  synced_at?: string | null;
}

/** File record - binary storage */
export interface FileRecord {
  id: string;
  blob: Blob;
  mime_type: string;
  file_name: string;
  size: number;
  related_note_id?: string;
  created_at: string;
}

/** Profile record - user settings */
export interface ProfileRecord {
  id: string;
  name: string;
  discipline?: string;
  level?: string;
  teaching_style?: string;
  custom_teaching_style?: string;
  exam_goal?: string;
  custom_exam_goal?: string;
  profile_picture_id?: string;
  birthday?: string;
  theme?: "obsidian" | "clinical";
  specialties?: string[];
  learning_goals?: string;
  created_at: string;
  updated_at: string;
}

/** Chat record - conversation history */
export interface ChatRecord {
  note_id: string;
  mode?: string; // tutor, quiz, explain, compare, clinical
  // Store messages as-is to support the full ChatMessage type from geminiChatService
  messages: Array<any>;
  created_at: string;
  updated_at: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE CONNECTION
// ═══════════════════════════════════════════════════════════════════════════

let dbInstance: IDBPDatabase | null = null;

/**
 * Get database connection (singleton)
 */
export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      console.log("🔧 [DB] Creating object stores...");

      // Notes store
      if (!db.objectStoreNames.contains("notes")) {
        const notesStore = db.createObjectStore("notes", { keyPath: "id" });
        notesStore.createIndex("by_updated", "updated_at");
        notesStore.createIndex("by_title", "title");
        console.log("  ✓ Created notes store");
      }

      // Files store (binary bucket)
      if (!db.objectStoreNames.contains("files")) {
        const filesStore = db.createObjectStore("files", { keyPath: "id" });
        filesStore.createIndex("by_note", "related_note_id");
        filesStore.createIndex("by_type", "mime_type");
        console.log("  ✓ Created files store");
      }

      // Profile store
      if (!db.objectStoreNames.contains("profile")) {
        db.createObjectStore("profile", { keyPath: "id" });
        console.log("  ✓ Created profile store");
      }

      // Chats store (keyed by note_id so each note maps to a single chat record)
      if (!db.objectStoreNames.contains("chats")) {
        const chatsStore = db.createObjectStore("chats", {
          keyPath: "note_id",
        });
        // index for listing/searching by note if needed
        chatsStore.createIndex("by_note", "note_id");
        console.log("  ✓ Created chats store (keyPath: note_id)");
      }

      console.log("✅ [DB] Schema ready");
    },
  });

  console.log(`✅ [DB] Connected to ${DB_NAME} v${DB_VERSION}`);
  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDB(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log("🔌 [DB] Connection closed");
  }
}

/**
 * Delete entire database (for development/reset)
 */
export async function resetDB(): Promise<void> {
  closeDB();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      console.log("🗑️ [DB] Database deleted");
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Hard reset - delete DB and reload page
 */
export async function hardResetDB(): Promise<void> {
  await resetDB();
  window.location.reload();
}
