/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supabase database type definitions.
 * Run `npx supabase gen types typescript --linked` to regenerate.
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, 'created_at'>;
        Update: Partial<Omit<ProfileRow, 'id'>>;
      };
      collection_items: {
        Row: CollectionItemRow;
        Insert: Omit<CollectionItemRow, 'id' | 'created_at'>;
        Update: Partial<Omit<CollectionItemRow, 'id' | 'user_id'>>;
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export interface ProfileRow {
  id: string; // uuid, matches auth.users.id
  display_name: string | null;
  avatar_url: string | null;
  created_at: string; // timestamptz
}

export interface CollectionItemRow {
  id: string; // uuid
  user_id: string; // uuid, FK → profiles.id
  card_id: string; // e.g. "ARG_15"
  count: number; // >= 0
  updated_at: string; // timestamptz
}
