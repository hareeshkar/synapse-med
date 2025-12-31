/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DATABASE HOOKS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * React hooks for accessing IndexedDB repositories.
 * Provides loading states and automatic refresh.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { NoteRepository } from "../repos/NoteRepository";
import {
  StorageRepository,
  base64ToBlob,
  blobToBase64,
} from "../repos/StorageRepository";
import { ProfileRepository } from "../repos/ProfileRepository";
import { ChatRepository, type ChatMessage } from "../repos/ChatRepository";
import type { NoteRecord, ProfileRecord } from "../db/schema";

/**
 * Hook for managing the notes library
 */
export function useNotes() {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await NoteRepository.list();
      setNotes(data);
      setError(null);
    } catch (e) {
      setError(e as Error);
      console.error("Failed to load notes:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveNote = useCallback(
    async (note: Partial<NoteRecord> & { id: string }) => {
      const saved = await NoteRepository.save(note);
      await refresh();
      return saved;
    },
    [refresh]
  );

  const deleteNote = useCallback(
    async (id: string) => {
      await NoteRepository.delete(id);
      await refresh();
    },
    [refresh]
  );

  const searchNotes = useCallback(async (query: string) => {
    return NoteRepository.search(query);
  }, []);

  return {
    notes,
    loading,
    error,
    refresh,
    saveNote,
    deleteNote,
    searchNotes,
  };
}

/**
 * Hook for a single note
 */
export function useNote(noteId: string | null) {
  const [note, setNote] = useState<NoteRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!noteId) {
      setNote(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await NoteRepository.get(noteId);
      setNote(data || null);
    } catch (e) {
      console.error("Failed to load note:", e);
      setNote(null);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { note, loading, refresh };
}

/**
 * Hook for user profile
 */
export function useProfile() {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await ProfileRepository.get();
      setProfile(data || null);
    } catch (e) {
      console.error("Failed to load profile:", e);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveProfile = useCallback(async (data: Partial<ProfileRecord>) => {
    const saved = await ProfileRepository.save(data);
    setProfile(saved);
    return saved;
  }, []);

  return { profile, loading, refresh, saveProfile };
}

/**
 * Hook for chat history per note
 */
export function useChat(noteId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    if (!noteId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await ChatRepository.getForNote(noteId);
      setMessages(data);
    } catch (e) {
      console.error("Failed to load chat:", e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Debounced save to avoid too many writes
  const saveMessages = useCallback(
    async (msgs: ChatMessage[]) => {
      if (!noteId) return;

      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Update local state immediately
      setMessages(msgs);

      // Debounce the actual save
      saveTimeoutRef.current = setTimeout(async () => {
        await ChatRepository.saveForNote(noteId, msgs);
      }, 500);
    },
    [noteId]
  );

  const addMessage = useCallback(
    async (message: ChatMessage) => {
      const newMessages = [...messages, { ...message, timestamp: Date.now() }];
      await saveMessages(newMessages);
      return newMessages;
    },
    [messages, saveMessages]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return { messages, loading, refresh, saveMessages, addMessage };
}

/**
 * Hook for file storage
 */
export function useStorage() {
  const upload = useCallback(
    async (
      file: File | Blob,
      options?: { fileName?: string; relatedNoteId?: string }
    ) => {
      return StorageRepository.upload(file, options);
    },
    []
  );

  const download = useCallback(async (fileId: string) => {
    return StorageRepository.download(fileId);
  }, []);

  const deleteFile = useCallback(async (fileId: string) => {
    return StorageRepository.delete(fileId);
  }, []);

  const getFilesForNote = useCallback(async (noteId: string) => {
    return StorageRepository.getFilesForNote(noteId);
  }, []);

  return {
    upload,
    download,
    deleteFile,
    getFilesForNote,
    createObjectURL: StorageRepository.createObjectURL.bind(StorageRepository),
    base64ToBlob,
    blobToBase64,
  };
}

// Export repositories for direct access when needed
export { NoteRepository, StorageRepository, ProfileRepository, ChatRepository };

// Export schema utilities
export { resetDB, hardResetDB, closeDB } from "../db/schema";
export type { NoteRecord, ProfileRecord, ChatMessage };
