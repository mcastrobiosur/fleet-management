/**
 * Hook que conecta el estado de red con el SyncManager.
 *
 * Detecta transiciones offline → online y dispara la sincronización
 * automática sin acción manual del Conductor.
 *
 * Requerimientos: 4.2, 4.4
 */

import { useEffect, useRef, useState } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import {
  subscribeSyncState,
  syncPendingOperations,
  refreshPendingCount,
  type SyncState,
} from '../services/sync-manager';

export interface UseSyncManagerResult {
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Whether the network status is still loading */
  isLoading: boolean;
  /** Current sync state (status, pendingCount, lastSyncAt, lastError) */
  syncState: SyncState;
}

/**
 * Combines network monitoring with automatic sync.
 *
 * When the device transitions from offline to online, it automatically
 * triggers `syncPendingOperations()` to push queued data to the server.
 */
export function useSyncManager(): UseSyncManagerResult {
  const { isOnline, isLoading } = useNetworkStatus();
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    pendingCount: 0,
    lastSyncAt: null,
    lastError: null,
  });

  const wasOnlineRef = useRef<boolean | null>(null);

  // Subscribe to sync state changes
  useEffect(() => {
    const unsubscribe = subscribeSyncState(setSyncState);
    return unsubscribe;
  }, []);

  // Refresh pending count on mount
  useEffect(() => {
    refreshPendingCount();
  }, []);

  // Auto-sync when transitioning offline → online
  useEffect(() => {
    if (isLoading) return;

    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    // Trigger sync when we transition from offline to online
    if (wasOnline === false && isOnline) {
      syncPendingOperations();
    }
  }, [isOnline, isLoading]);

  return { isOnline, isLoading, syncState };
}
