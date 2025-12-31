/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROFILE REPOSITORY
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * User profile and settings storage.
 * Single-user for now, multi-user ready for cloud.
 */

import { getDB, type ProfileRecord } from "../db/schema";

const DEFAULT_PROFILE_ID = "local-user";

export const ProfileRepository = {
  /**
   * Get current user profile
   */
  async get(): Promise<ProfileRecord | undefined> {
    const db = await getDB();
    return db.get("profile", DEFAULT_PROFILE_ID) as Promise<
      ProfileRecord | undefined
    >;
  },

  /**
   * Create or update profile
   */
  async save(profile: Partial<ProfileRecord>): Promise<ProfileRecord> {
    const db = await getDB();
    const now = new Date().toISOString();
    const existing = await this.get();

    const record: ProfileRecord = {
      id: DEFAULT_PROFILE_ID,
      name: profile.name || existing?.name || "",
      discipline: profile.discipline ?? existing?.discipline,
      level: profile.level ?? existing?.level,
      teaching_style: profile.teaching_style ?? existing?.teaching_style,
      custom_teaching_style:
        profile.custom_teaching_style ?? existing?.custom_teaching_style,
      exam_goal: profile.exam_goal ?? existing?.exam_goal,
      custom_exam_goal: profile.custom_exam_goal ?? existing?.custom_exam_goal,
      profile_picture_id:
        profile.profile_picture_id ?? existing?.profile_picture_id,
      birthday: profile.birthday ?? existing?.birthday,
      theme: profile.theme ?? existing?.theme,
      specialties: profile.specialties ?? existing?.specialties,
      learning_goals: profile.learning_goals ?? existing?.learning_goals,
      api_key: profile.api_key ?? existing?.api_key,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    await db.put("profile", record);
    console.log(`👤 [Profile] Saved: "${record.name}"`);
    return record;
  },

  /**
   * Get the API key (convenience method)
   */
  async getApiKey(): Promise<string | undefined> {
    const profile = await this.get();
    return profile?.api_key;
  },

  /**
   * Update only the API key (convenience method for settings)
   */
  async updateApiKey(apiKey: string): Promise<void> {
    await this.save({ api_key: apiKey });
    console.log("🔑 [Profile] API Key updated");
  },

  /**
   * Check if API key is configured
   */
  async hasApiKey(): Promise<boolean> {
    const apiKey = await this.getApiKey();
    return !!apiKey && apiKey.startsWith("AIza");
  },

  /**
   * Check if profile exists
   */
  async exists(): Promise<boolean> {
    const profile = await this.get();
    return profile !== undefined;
  },

  /**
   * Delete profile (for reset)
   */
  async delete(): Promise<void> {
    const db = await getDB();
    await db.delete("profile", DEFAULT_PROFILE_ID);
    console.log("🗑️ [Profile] Deleted");
  },

  /**
   * Clear all profiles
   */
  async clear(): Promise<void> {
    const db = await getDB();
    await db.clear("profile");
    console.log("🗑️ [Profile] Cleared");
  },
};
