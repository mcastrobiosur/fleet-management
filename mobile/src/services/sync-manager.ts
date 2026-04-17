/**
 * SyncManager — Servicio de sincronización offline-first.
 *
 * Gestiona la cola de operaciones pendientes en SQLite y sincroniza
 * automáticamente con el backend cuando se recupera la conexión.
 *
 * Responsabilidades:
 * - Encolar inspecciones y reportes en SQLite cuando no hay conexión
 * - Sincronizar automáticamente al recuperar conexión (POST /inspecciones/sync)
 * - Actualizar sync_status en SQLite tras sincronización exitosa
 * - Exponer el conteo de operaciones pendientes para el indicador visual
 *
 * Requerimientos: 4.1, 4.2, 4.4
 */

import {
  insertPendingInspeccion,
  getPendingInspecciones,
  markInspeccionSynced,
  insertPendingReporte,
  getPendingReportes,
  markReporteSynced,
  type PendingInspeccion,
  type PendingReporte,
} from '../db/database';
import { apiClient } from '../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface SyncState {
  /** Current sync status */
  status: SyncStatus;
  /** Number of pending inspections + reports awaiting sync */
  pendingCount: number;
  /** Timestamp of last successful sync (ISO string), or null */
  lastSyncAt: string | null;
  /** Error message from last failed sync attempt, or null */
  lastError: string | null;
}

export interface SyncResult {
  exitosos: number;
  fallidos: number;
}

type SyncListener = (state: SyncState) => void;

// ---------------------------------------------------------------------------
// SyncManager singleton
// ---------------------------------------------------------------------------

let state: SyncState = {
  status: 'idle',
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
};

const listeners: Set<SyncListener> = new Set();

let syncInProgress = false;

function notify(): void {
  for (const listener of listeners) {
    listener({ ...state });
  }
}

function updateState(partial: Partial<SyncState>): void {
  state = { ...state, ...partial };
  notify();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Subscribe to sync state changes.
 * Returns an unsubscribe function.
 */
export function subscribeSyncState(listener: SyncListener): () => void {
  listeners.add(listener);
  // Emit current state immediately
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}

/** Get current sync state snapshot. */
export function getSyncState(): SyncState {
  return { ...state };
}

/**
 * Queue an inspection for offline storage.
 * Called when the device is offline and the conductor submits an inspection.
 */
export async function enqueueInspeccion(
  id: string,
  datos: Record<string, unknown>,
): Promise<void> {
  const timestampLocal = new Date().toISOString();
  await insertPendingInspeccion(id, JSON.stringify(datos), timestampLocal);
  await refreshPendingCount();
}

/**
 * Queue a fault report for offline storage.
 * Called when the device is offline and the conductor submits a report.
 */
export async function enqueueReporte(
  id: string,
  datos: Record<string, unknown>,
): Promise<void> {
  const timestampLocal = new Date().toISOString();
  await insertPendingReporte(id, JSON.stringify(datos), timestampLocal);
  await refreshPendingCount();
}

/**
 * Refresh the pending count from SQLite.
 * Useful after app launch or after manual operations.
 */
export async function refreshPendingCount(): Promise<number> {
  const inspecciones = await getPendingInspecciones();
  const reportes = await getPendingReportes();
  const count = inspecciones.length + reportes.length;
  updateState({ pendingCount: count });
  return count;
}

/**
 * Attempt to sync all pending operations with the backend.
 *
 * Called automatically when the device transitions from offline → online.
 * Uses the backend's POST /inspecciones/sync endpoint for batch sync.
 *
 * Implements retry with exponential backoff (1s, 5s, 30s) per the design doc.
 */
export async function syncPendingOperations(): Promise<SyncResult> {
  if (syncInProgress) {
    return { exitosos: 0, fallidos: 0 };
  }

  syncInProgress = true;
  updateState({ status: 'syncing', lastError: null });

  const result: SyncResult = { exitosos: 0, fallidos: 0 };

  try {
    // --- Sync pending inspections ---
    await syncInspecciones(result);

    // --- Sync pending reports ---
    await syncReportes(result);

    updateState({
      status: 'idle',
      lastSyncAt: new Date().toISOString(),
      lastError: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de sincronización';
    updateState({ status: 'error', lastError: message });
  } finally {
    syncInProgress = false;
    await refreshPendingCount();
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const BACKOFF_DELAYS = [1000, 5000, 30000]; // 1s, 5s, 30s

async function syncInspecciones(result: SyncResult): Promise<void> {
  const pending: PendingInspeccion[] = await getPendingInspecciones();
  if (pending.length === 0) return;

  // Prepare batch payload
  const batch = pending.map((item) => ({
    id: item.id,
    datos: JSON.parse(item.datos),
    timestampLocal: item.timestamp_local,
  }));

  // Try batch sync with retries
  const success = await retryWithBackoff(async () => {
    await apiClient.post('/inspecciones/sync', { inspecciones: batch });
  });

  if (success) {
    // Mark all as synced
    for (const item of pending) {
      await markInspeccionSynced(item.id);
    }
    result.exitosos += pending.length;
  } else {
    result.fallidos += pending.length;
  }
}

async function syncReportes(result: SyncResult): Promise<void> {
  const pending: PendingReporte[] = await getPendingReportes();
  if (pending.length === 0) return;

  // Sync reports one by one (they may contain photo references)
  for (const item of pending) {
    const datos = JSON.parse(item.datos);
    const success = await retryWithBackoff(async () => {
      await apiClient.post('/reportes-falla', {
        ...datos,
        creadoOffline: true,
        timestampLocal: item.timestamp_local,
      });
    });

    if (success) {
      await markReporteSynced(item.id);
      result.exitosos += 1;
    } else {
      result.fallidos += 1;
    }
  }
}

/**
 * Retry an async operation with exponential backoff.
 * Returns true if the operation succeeded, false after all retries exhausted.
 */
async function retryWithBackoff(
  operation: () => Promise<void>,
): Promise<boolean> {
  for (let attempt = 0; attempt <= BACKOFF_DELAYS.length; attempt++) {
    try {
      await operation();
      return true;
    } catch {
      if (attempt < BACKOFF_DELAYS.length) {
        await delay(BACKOFF_DELAYS[attempt]);
      }
    }
  }
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
