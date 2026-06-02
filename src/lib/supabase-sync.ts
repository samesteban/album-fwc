/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supabase Sync Engine
 *
 * Handles push, pull, merge, and full sync cycles between
 * LocalStorage and Supabase for cross-device collection sync.
 */

import { supabase } from './supabase';
import type { CollectionState, TimestampedCard } from '../types';

// ── Config ─────────────────────────────────────────────────────

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 1000;

// ── Helpers ────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if Supabase env vars are configured.
 */
function isSupabaseConfigured(): boolean {
  return !!(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY &&
    import.meta.env.VITE_SUPABASE_URL !== 'https://placeholder.supabase.co'
  );
}

// ── Retry ──────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  attemptLabel: string,
  maxAttempts = MAX_RETRY_ATTEMPTS
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error(`[sync] ${attemptLabel} failed after ${maxAttempts} attempts:`, err);
        throw err;
      }
      console.warn(`[sync] ${attemptLabel} attempt ${attempt} failed, retrying in ${RETRY_BASE_DELAY_MS * attempt}ms...`);
      await delay(RETRY_BASE_DELAY_MS * attempt);
    }
  }
  throw new Error(`[sync] ${attemptLabel} unreachable`);
}

// ── Push ───────────────────────────────────────────────────────

/**
 * Upsert collection items to Supabase.
 * Uses upsert with onConflict to handle inserts + updates in one call.
 */
export async function pushCollection(
  userId: string,
  cards: TimestampedCard[]
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  if (cards.length === 0) return;

  const rows = cards.map(card => ({
    user_id: userId,
    card_id: card.cardId,
    count: card.count,
    updated_at: card.updatedAt,
  }));

  await withRetry(
    async () => {
      const result = await supabase
        .from('collection_items')
        .upsert(rows, { onConflict: 'user_id,card_id', ignoreDuplicates: false });
      if (result.error) throw result.error;
    },
    'pushCollection'
  );
}

// ── Pull ───────────────────────────────────────────────────────

/**
 * Fetch all collection items for a user from Supabase.
 */
export async function pullCollection(userId: string): Promise<TimestampedCard[]> {
  if (!isSupabaseConfigured()) return [];

  const result = await withRetry(
    async () => {
      const res = await supabase
        .from('collection_items')
        .select('card_id, count, updated_at')
        .eq('user_id', userId);
      if (res.error) throw res.error;
      return res;
    },
    'pullCollection'
  );

  if (result.error) throw result.error;

  return (result.data ?? []).map(row => ({
    cardId: row.card_id,
    count: row.count,
    updatedAt: row.updated_at,
  }));
}

// ── Merge ──────────────────────────────────────────────────────

/**
 * Merge local and remote collections.
 *
 * @param local - Local collection (cardId → count)
 * @param localTimestamps - Local timestamps (cardId → ISO string)
 * @param remote - Remote collection from Supabase
 * @param isFirstSync - If true, use MAX heuristic (no timestamps in local yet)
 * @returns Merged array of TimestampedCard
 */
export function mergeCollections(
  local: CollectionState,
  localTimestamps: Record<string, string>,
  remote: TimestampedCard[],
  isFirstSync: boolean
): TimestampedCard[] {
  const remoteMap = new Map<string, TimestampedCard>();
  for (const card of remote) {
    remoteMap.set(card.cardId, card);
  }

  // Collect all unique card IDs
  const allCardIds = new Set([
    ...Object.keys(local),
    ...remote.map(r => r.cardId),
  ]);

  const result: TimestampedCard[] = [];

  for (const cardId of allCardIds) {
    const localCount = local[cardId] ?? 0;
    const localTs = localTimestamps[cardId];
    const remoteCard = remoteMap.get(cardId);
    const now = new Date().toISOString();

    if (!remoteCard) {
      // Only exists locally — keep as-is
      result.push({
        cardId,
        count: localCount,
        updatedAt: localTs ?? now,
      });
    } else if (!localTs || isFirstSync) {
      // First sync or local has no timestamps — use MAX
      result.push({
        cardId,
        count: Math.max(localCount, remoteCard.count),
        updatedAt: now,
      });
    } else {
      // Both have timestamps — latest wins
      result.push({
        cardId,
        count: localTs > remoteCard.updatedAt ? localCount : remoteCard.count,
        updatedAt: localTs > remoteCard.updatedAt ? localTs : remoteCard.updatedAt,
      });
    }
  }

  return result;
}

// ── Full Sync Cycle ────────────────────────────────────────────

export interface SyncCycleResult {
  merged: CollectionState;
  timestamps: Record<string, string>;
  stats: {
    pushed: number;
    pulled: number;
    updated: number;
  };
}

/**
 * Run a full sync cycle: pull → merge → push → return
 */
export async function syncCollection(
  userId: string,
  localCollection: CollectionState,
  localTimestamps: Record<string, string>,
  isFirstSync: boolean
): Promise<SyncCycleResult> {
  if (!isSupabaseConfigured()) {
    return {
      merged: localCollection,
      timestamps: localTimestamps,
      stats: { pushed: 0, pulled: 0, updated: 0 },
    };
  }

  // Pull remote
  const remote = await pullCollection(userId);

  // Merge
  const merged = mergeCollections(localCollection, localTimestamps, remote, isFirstSync);

  // Build collection state + timestamps from merged
  const newCollection: CollectionState = {};
  const newTimestamps: Record<string, string> = {};
  for (const card of merged) {
    newCollection[card.cardId] = card.count;
    newTimestamps[card.cardId] = card.updatedAt;
  }

  // Push merged to Supabase
  await pushCollection(userId, merged);

  return {
    merged: newCollection,
    timestamps: newTimestamps,
    stats: {
      pushed: merged.length,
      pulled: remote.length,
      updated: merged.length,
    },
  };
}
