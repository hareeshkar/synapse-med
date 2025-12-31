/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TYPE CONVERTERS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Convert between app types (AugmentedNote, UserProfile) and
 * database records (NoteRecord, ProfileRecord).
 */

import type { AugmentedNote, UserProfile } from "../../../types";
import type { NoteRecord, ProfileRecord } from "../db/schema";

// ═══════════════════════════════════════════════════════════════════════════
// NOTE CONVERSIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert AugmentedNote (app format) to NoteRecord (DB format)
 */
export function noteToRecord(
  note: AugmentedNote
): Omit<NoteRecord, "created_at" | "updated_at" | "synced_at"> {
  return {
    id: note.id,
    title: note.title,
    markdown_content: note.markdownContent,
    summary: note.summary,
    eli5_analogy: note.eli5Analogy,
    pearls: note.pearls,
    graph_data: note.graphData,
    cache_name: note.cacheName,
    source_file_names: note.sourceFileNames,
    source_file_ids: note.sourceFileIds || [],
    sources: note.sources,
  };
}

/**
 * Convert NoteRecord (DB format) to AugmentedNote (app format)
 */
export function recordToNote(record: NoteRecord): AugmentedNote {
  return {
    id: record.id,
    title: record.title,
    markdownContent: record.markdown_content,
    summary: record.summary,
    eli5Analogy: record.eli5_analogy,
    pearls: record.pearls,
    graphData: record.graph_data,
    cacheName: record.cache_name,
    timestamp: new Date(record.created_at).getTime(),
    sourceFileNames: record.source_file_names,
    sourceFileIds: record.source_file_ids || [],
    sources: record.sources,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFILE CONVERSIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert UserProfile (app format) to ProfileRecord (DB format)
 */
export function profileToRecord(
  profile: UserProfile
): Omit<ProfileRecord, "id" | "created_at" | "updated_at"> {
  return {
    name: profile.name,
    discipline: profile.discipline,
    level: profile.level,
    teaching_style: profile.teachingStyle,
    custom_teaching_style: profile.customTeachingStyle,
    exam_goal: profile.examGoal,
    custom_exam_goal: profile.customExamGoal,
    profile_picture_id: undefined, // profile picture stored separately
    birthday: profile.birthday,
    theme: profile.theme,
    specialties: profile.specialties,
    learning_goals: profile.learningGoals,
    api_key: profile.apiKey,
  };
}

/**
 * Convert ProfileRecord (DB format) to UserProfile (app format)
 */
export function recordToProfile(
  record: ProfileRecord,
  profilePicture?: string
): UserProfile {
  return {
    name: record.name,
    discipline: record.discipline as any,
    level: record.level as any,
    teachingStyle: record.teaching_style as any,
    customTeachingStyle: record.custom_teaching_style,
    examGoal: record.exam_goal as any,
    customExamGoal: record.custom_exam_goal,
    profilePicture,
    birthday: record.birthday,
    theme: record.theme,
    specialties: record.specialties,
    learningGoals: record.learning_goals,
    apiKey: record.api_key,
    createdAt: new Date(record.created_at).getTime(),
    updatedAt: new Date(record.updated_at).getTime(),
  };
}
