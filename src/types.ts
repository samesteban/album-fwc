/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Card {
  id: string; // e.g. "ARG_15", "FWC_00", "CC_5"
  sectionId: string; // e.g. "ARG", "FWC", "CC"
  num: string; // "00", "1", "2", etc.
  playerName?: string; // only for selection/team cards
  count: number; // 0 = missing, 1 = pasted/pegada, >=2 = pasted + (count - 1) duplicadas/repetidas
}

export interface Section {
  id: string; // "MEX", "FWC", etc.
  name: string; // "México", "Especiales FWC", etc.
  type: 'team' | 'special';
  flag?: string; // Flag emoji or representative icon
  cards: Card[];
}

export interface CollectionState {
  [cardId: string]: number; // Map of cardId to its count
}

export interface CollectionStats {
  totalCards: number;
  uniquesPasted: number; // Cards with count >= 1
  missingCount: number; // Cards with count === 0
  repeatedCount: number; // Number of duplicate cards (sum of (count - 1) for count >= 2)
  completionPercentage: number;
}

// ── Sync / Auth Types ──────────────────────────────────────────

export interface TimestampedCard {
  cardId: string;
  count: number;
  updatedAt: string; // ISO 8601
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface SyncStats {
  pushed: number;
  pulled: number;
}

export interface StorageV2 {
  version: 2;
  collection: CollectionState;
  timestamps: Record<string, string>; // cardId → ISO timestamp
}
