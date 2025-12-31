/**
 * ═══════════════════════════════════════════════════════════════════════════
 * STORAGE REPOSITORY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Binary file storage (PDFs, audio, images).
 * Mirrors Supabase Storage bucket for future cloud migration.
 *
 * Key Benefits:
 * - Stores Blobs directly (not Base64 strings)
 * - Efficient memory usage
 * - Lazy loading - only fetch when needed
 */

import { getDB, type FileRecord } from "../db/schema";

export const StorageRepository = {
  /**
   * Upload a file to storage
   * @returns File ID (UUID)
   */
  async upload(
    file: File | Blob,
    options?: {
      fileName?: string;
      relatedNoteId?: string;
    }
  ): Promise<string> {
    const db = await getDB();
    const id = crypto.randomUUID();

    const record: FileRecord = {
      id,
      blob: file,
      mime_type: file.type || "application/octet-stream",
      file_name:
        options?.fileName || (file as File).name || `file-${id.slice(0, 8)}`,
      size: file.size,
      related_note_id: options?.relatedNoteId,
      created_at: new Date().toISOString(),
    };

    await db.put("files", record);
    console.log(
      `📁 [Storage] Uploaded: ${record.file_name} (${formatSize(file.size)})`
    );
    return id;
  },

  /**
   * Download a file by ID
   * @returns Blob or undefined
   */
  async download(id: string): Promise<Blob | undefined> {
    const db = await getDB();
    const record = (await db.get("files", id)) as FileRecord | undefined;
    return record?.blob;
  },

  /**
   * Get file metadata (without blob)
   */
  async getMetadata(id: string): Promise<Omit<FileRecord, "blob"> | undefined> {
    const db = await getDB();
    const record = (await db.get("files", id)) as FileRecord | undefined;
    if (!record) return undefined;

    const { blob: _, ...metadata } = record;
    return metadata;
  },

  /**
   * Delete a file
   */
  async delete(id: string): Promise<void> {
    const db = await getDB();
    await db.delete("files", id);
    console.log(`🗑️ [Storage] Deleted: ${id}`);
  },

  /**
   * Get all files for a note
   */
  async getFilesForNote(noteId: string): Promise<FileRecord[]> {
    const db = await getDB();
    return db.getAllFromIndex("files", "by_note", noteId) as Promise<
      FileRecord[]
    >;
  },

  /**
   * Create an Object URL for a file (for playback/display)
   * IMPORTANT: Call URL.revokeObjectURL() when done!
   */
  async createObjectURL(id: string): Promise<string | undefined> {
    const blob = await this.download(id);
    if (!blob) return undefined;
    return URL.createObjectURL(blob);
  },

  /**
   * Get total storage used
   */
  async getTotalSize(): Promise<number> {
    const db = await getDB();
    const files = (await db.getAll("files")) as FileRecord[];
    return files.reduce((sum, f) => sum + f.size, 0);
  },

  /**
   * Clear all files
   */
  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear("files");
    console.log("🗑️ [Storage] Cleared all files");
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format bytes to human-readable size
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Convert Base64 string to Blob
 * Useful for handling Gemini audio output
 */
export function base64ToBlob(
  base64: string,
  mimeType: string = "audio/wav"
): Blob {
  // Remove data URI prefix if present
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;

  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

/**
 * Convert Blob to Base64 (for export/compatibility)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
