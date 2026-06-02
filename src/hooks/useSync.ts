/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * useSync — Hook for sync state management and debounced auto-sync.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { syncCollection, type SyncCycleResult } from '../lib/supabase-sync';
import type { CollectionState, SyncStatus, SyncStats } from '../types';

interface UseSyncReturn {
  status: SyncStatus;
  lastSyncedAt: string | null;
  stats: SyncStats | null;
  triggerSync: (
    userId: string,
    collection: CollectionState,
    timestamps: Record<string, string>,
    isFirstSync: boolean
  ) => Promise<SyncCycleResult | null>;
  onCardUpdate: (
    userId: string | null,
    collection: CollectionState,
    timestamps: Record<string, string>
  ) => void;
}

export function useSync(): UseSyncReturn {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [stats, setStats] = useState<SyncStats | null>(null);

  // Track online status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update status based on online state
  useEffect(() => {
    if (!isOnline && status !== 'idle') {
      setStatus('offline');
    }
  }, [isOnline, status]);

  // ── Debounced auto-sync ────────────────────────────────────

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSync = useRef<{
    userId: string;
    collection: CollectionState;
    timestamps: Record<string, string>;
  } | null>(null);

  const executePendingSync = useCallback(async () => {
    const pending = pendingSync.current;
    if (!pending) return;

    setStatus('syncing');
    try {
      const result = await syncCollection(
        pending.userId,
        pending.collection,
        pending.timestamps,
        false // subsequent sync
      );
      setStatus('synced');
      setLastSyncedAt(new Date().toISOString());
      setStats({ pushed: result.stats.pushed, pulled: result.stats.pulled });
      pendingSync.current = null;
    } catch {
      setStatus('error');
    }
  }, []);

  const onCardUpdate = useCallback(
    (userId: string | null, collection: CollectionState, timestamps: Record<string, string>) => {
      if (!userId) return;

      pendingSync.current = { userId, collection, timestamps };

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(executePendingSync, 500);
    },
    [executePendingSync]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  // ── Manual sync ─────────────────────────────────────────────

  const triggerSync = useCallback(
    async (
      userId: string,
      collection: CollectionState,
      timestamps: Record<string, string>,
      isFirstSync: boolean
    ): Promise<SyncCycleResult | null> => {
      if (!isOnline) {
        setStatus('offline');
        return null;
      }

      setStatus('syncing');
      try {
        const result = await syncCollection(userId, collection, timestamps, isFirstSync);
        setStatus('synced');
        setLastSyncedAt(new Date().toISOString());
        setStats({ pushed: result.stats.pushed, pulled: result.stats.pulled });
        return result;
      } catch {
        setStatus('error');
        return null;
      }
    },
    [isOnline]
  );

  return {
    status,
    lastSyncedAt,
    stats,
    triggerSync,
    onCardUpdate,
  };
}
