/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CHAT REPOSITORY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Chat history storage per note.
 * Maps to: Postgres chats table (note_id foreign key)
 */

import { getDB, type ChatRecord } from "../db/schema";
import type { ChatMessage as GeminiChatMessage } from "../../../services/geminiChatService";

// Re-export the ChatMessage type from geminiChatService for consistency
export type ChatMessage = GeminiChatMessage;

export const ChatRepository = {
  /**
   * Get chat history for a note
   */
  async getForNote(noteId: string): Promise<ChatMessage[]> {
    const db = await getDB();
    const record = (await db.get("chats", noteId)) as ChatRecord | undefined;
    return record?.messages || [];
  },

  /**
   * Save chat history for a note
   */
  async saveForNote(noteId: string, messages: ChatMessage[]): Promise<void> {
    const db = await getDB();
    const now = new Date().toISOString();
    const existing = (await db.get("chats", noteId)) as ChatRecord | undefined;

    const record: ChatRecord = {
      note_id: noteId,
      messages,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    await db.put("chats", record);
    console.log(
      `💬 [Chat] Saved ${messages.length} messages for note ${noteId.slice(
        0,
        8
      )}`
    );
  },

  /**
   * Add a single message to chat history
   */
  async addMessage(noteId: string, message: ChatMessage): Promise<void> {
    const messages = await this.getForNote(noteId);
    messages.push({
      ...message,
      timestamp: message.timestamp || Date.now(),
    });
    await this.saveForNote(noteId, messages);
  },

  /**
   * Delete chat history for a note
   */
  async deleteForNote(noteId: string): Promise<void> {
    const db = await getDB();
    await db.delete("chats", noteId);
    console.log(`🗑️ [Chat] Deleted for note ${noteId.slice(0, 8)}`);
  },

  /**
   * Get all chats (for backup/export)
   */
  async listAll(): Promise<ChatRecord[]> {
    const db = await getDB();
    return db.getAll("chats") as Promise<ChatRecord[]>;
  },

  /**
   * Clear all chat history
   */
  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear("chats");
    console.log("🗑️ [Chat] Cleared all");
  },

  /**
   * Get total message count across all chats
   */
  async totalMessageCount(): Promise<number> {
    const chats = await this.listAll();
    return chats.reduce((sum, chat) => sum + chat.messages.length, 0);
  },
};
