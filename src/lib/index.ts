/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DATABASE BARREL EXPORTS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single entry point for all database functionality.
 *
 * Usage:
 *   import { useNotes, NoteRepository, resetDB } from '@/lib/db';
 */

// Hooks
export {
  useNotes,
  useNote,
  useProfile,
  useChat,
  useStorage,
} from "./hooks/useDB";

// Repositories
export { NoteRepository } from "./repos/NoteRepository";
export {
  StorageRepository,
  base64ToBlob,
  blobToBase64,
} from "./repos/StorageRepository";
export { ProfileRepository } from "./repos/ProfileRepository";
export { ChatRepository } from "./repos/ChatRepository";

// Converters
export {
  noteToRecord,
  recordToNote,
  profileToRecord,
  recordToProfile,
} from "./utils/converters";

// Schema & utilities
export { getDB, closeDB, resetDB, hardResetDB } from "./db/schema";

// Types
export type {
  NoteRecord,
  FileRecord,
  ProfileRecord,
  ChatRecord,
} from "./db/schema";

export type { ChatMessage } from "./repos/ChatRepository";
