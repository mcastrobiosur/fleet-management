/**
 * Helper de base de datos local — offline storage.
 *
 * En plataformas nativas usa expo-sqlite.
 * En web usa localStorage como fallback.
 */

import { Platform } from 'react-native';

const IS_WEB = Platform.OS === 'web';

// ---------------------------------------------------------------------------
// Web fallback using localStorage
// ---------------------------------------------------------------------------

function webGetItems<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function webSetItems<T>(key: string, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingInspeccion {
  id: string;
  datos: string;
  timestamp_local: string;
  sync_status: string;
}

export interface PendingReporte {
  id: string;
  datos: string;
  timestamp_local: string;
  sync_status: string;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

let nativeDb: any = null;

export async function initDatabase(): Promise<void> {
  if (IS_WEB) return; // localStorage needs no init

  const SQLite = await import('expo-sqlite');
  nativeDb = await SQLite.openDatabaseAsync('biosur_offline.db');
  const { ALL_TABLES } = await import('./schema');
  for (const ddl of ALL_TABLES) {
    await nativeDb.execAsync(ddl);
  }
}

// ---------------------------------------------------------------------------
// Inspecciones
// ---------------------------------------------------------------------------

const WEB_INSPECCIONES_KEY = 'biosur_pending_inspecciones';

export async function insertPendingInspeccion(
  id: string,
  datos: string,
  timestampLocal: string,
): Promise<void> {
  if (IS_WEB) {
    const items = webGetItems<PendingInspeccion>(WEB_INSPECCIONES_KEY);
    items.push({ id, datos, timestamp_local: timestampLocal, sync_status: 'pending' });
    webSetItems(WEB_INSPECCIONES_KEY, items);
    return;
  }
  await nativeDb.runAsync(
    'INSERT INTO pending_inspecciones (id, datos, timestamp_local, sync_status) VALUES (?, ?, ?, ?)',
    [id, datos, timestampLocal, 'pending'],
  );
}

export async function getPendingInspecciones(): Promise<PendingInspeccion[]> {
  if (IS_WEB) {
    return webGetItems<PendingInspeccion>(WEB_INSPECCIONES_KEY).filter(
      (i) => i.sync_status === 'pending',
    );
  }
  return nativeDb.getAllAsync<PendingInspeccion>(
    "SELECT * FROM pending_inspecciones WHERE sync_status = 'pending' ORDER BY timestamp_local ASC",
  );
}

export async function markInspeccionSynced(id: string): Promise<void> {
  if (IS_WEB) {
    const items = webGetItems<PendingInspeccion>(WEB_INSPECCIONES_KEY);
    const updated = items.map((i) => (i.id === id ? { ...i, sync_status: 'synced' } : i));
    webSetItems(WEB_INSPECCIONES_KEY, updated);
    return;
  }
  await nativeDb.runAsync(
    "UPDATE pending_inspecciones SET sync_status = 'synced' WHERE id = ?",
    [id],
  );
}

// ---------------------------------------------------------------------------
// Reportes
// ---------------------------------------------------------------------------

const WEB_REPORTES_KEY = 'biosur_pending_reportes';

export async function insertPendingReporte(
  id: string,
  datos: string,
  timestampLocal: string,
): Promise<void> {
  if (IS_WEB) {
    const items = webGetItems<PendingReporte>(WEB_REPORTES_KEY);
    items.push({ id, datos, timestamp_local: timestampLocal, sync_status: 'pending' });
    webSetItems(WEB_REPORTES_KEY, items);
    return;
  }
  await nativeDb.runAsync(
    'INSERT INTO pending_reportes (id, datos, timestamp_local, sync_status) VALUES (?, ?, ?, ?)',
    [id, datos, timestampLocal, 'pending'],
  );
}

export async function getPendingReportes(): Promise<PendingReporte[]> {
  if (IS_WEB) {
    return webGetItems<PendingReporte>(WEB_REPORTES_KEY).filter(
      (i) => i.sync_status === 'pending',
    );
  }
  return nativeDb.getAllAsync<PendingReporte>(
    "SELECT * FROM pending_reportes WHERE sync_status = 'pending' ORDER BY timestamp_local ASC",
  );
}

export async function markReporteSynced(id: string): Promise<void> {
  if (IS_WEB) {
    const items = webGetItems<PendingReporte>(WEB_REPORTES_KEY);
    const updated = items.map((i) => (i.id === id ? { ...i, sync_status: 'synced' } : i));
    webSetItems(WEB_REPORTES_KEY, updated);
    return;
  }
  await nativeDb.runAsync(
    "UPDATE pending_reportes SET sync_status = 'synced' WHERE id = ?",
    [id],
  );
}
