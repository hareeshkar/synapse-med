/**
 * ═══════════════════════════════════════════════════════════════════════════
 * NOTE REPOSITORY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * CRUD operations for study notes.
 * Mirrors Postgres table operations for future Supabase migration.
 */

import { getDB, type NoteRecord } from "../db/schema";

export const NoteRepository = {
  /**
   * Get all notes, sorted by updated_at (newest first)
   */
  async list(): Promise<NoteRecord[]> {
    const db = await getDB();
    const notes = (await db.getAllFromIndex(
      "notes",
      "by_updated"
    )) as NoteRecord[];
    return notes.reverse(); // Newest first
  },

  /**
   * Get a single note by ID
   */
  async get(id: string): Promise<NoteRecord | undefined> {
    const db = await getDB();
    return db.get("notes", id) as Promise<NoteRecord | undefined>;
  },

  /**
   * Create or update a note (upsert)
   */
  async save(note: Partial<NoteRecord> & { id?: string }): Promise<NoteRecord> {
    const db = await getDB();
    const now = new Date().toISOString();

    const record: NoteRecord = {
      id: note.id || crypto.randomUUID(),
      title: note.title || "Untitled",
      markdown_content: note.markdown_content || "",
      summary: note.summary || "",
      eli5_analogy: note.eli5_analogy,
      pearls: note.pearls || [],
      graph_data: note.graph_data || { nodes: [], links: [] },
      cache_name: note.cache_name,
      source_file_names: note.source_file_names || [],
      source_file_ids: (note as any).source_file_ids || [],
      sources: note.sources || [],
      created_at: note.created_at || now,
      updated_at: now,
      synced_at: null, // Mark as needs sync
    };

    await db.put("notes", record);
    console.log(`📝 [NoteRepo] Saved: "${record.title}"`);
    return record;
  },

  /**
   * Delete a note by ID
   */
  async delete(id: string): Promise<void> {
    const db = await getDB();

    // Delete associated files first
    const files = await db.getAllFromIndex("files", "by_note", id);
    for (const file of files) {
      await db.delete("files", file.id);
    }

    // Delete the note
    await db.delete("notes", id);
    console.log(`🗑️ [NoteRepo] Deleted note: ${id}`);
  },

  /**
   * Search notes by title
   */
  async search(query: string): Promise<NoteRecord[]> {
    const notes = await this.list();
    const lowerQuery = query.toLowerCase();
    return notes.filter((note) =>
      note.title.toLowerCase().includes(lowerQuery)
    );
  },

  /**
   * Count total notes
   */
  async count(): Promise<number> {
    const db = await getDB();
    return db.count("notes");
  },

  /**
   * Clear all notes (for reset)
   */
  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear("notes");
    console.log("🗑️ [NoteRepo] Cleared all notes");
  },
};
