/**
 * Unit tests for SyncManager service.
 *
 * Validates: Requirements 4.1, 4.2, 4.4
 *
 * Tests the offline queue, sync logic, retry with backoff,
 * and state management of the SyncManager.
 */

import {
  subscribeSyncState,
  getSyncState,
  enqueueInspeccion,
  enqueueReporte,
  refreshPendingCount,
  syncPendingOperations,
  type SyncState,
} from '../sync-manager';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsertPendingInspeccion = jest.fn();
const mockGetPendingInspecciones = jest.fn().mockResolvedValue([]);
const mockMarkInspeccionSynced = jest.fn();
const mockInsertPendingReporte = jest.fn();
const mockGetPendingReportes = jest.fn().mockResolvedValue([]);
const mockMarkReporteSynced = jest.fn();

jest.mock('../../db/database', () => ({
  insertPendingInspeccion: (...args: unknown[]) => mockInsertPendingInspeccion(...args),
  getPendingInspecciones: () => mockGetPendingInspecciones(),
  markInspeccionSynced: (...args: unknown[]) => mockMarkInspeccionSynced(...args),
  insertPendingReporte: (...args: unknown[]) => mockInsertPendingReporte(...args),
  getPendingReportes: () => mockGetPendingReportes(),
  markReporteSynced: (...args: unknown[]) => mockMarkReporteSynced(...args),
}));

const mockApiPost = jest.fn().mockResolvedValue({ data: {}, status: 201 });

jest.mock('../../api/client', () => ({
  apiClient: {
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

// Speed up retry delays for tests
jest.useFakeTimers();

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPendingInspecciones.mockResolvedValue([]);
  mockGetPendingReportes.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncManager', () => {
  describe('getSyncState', () => {
    it('returns initial idle state', () => {
      const state = getSyncState();
      expect(state.status).toBe('idle');
      expect(state.lastSyncAt).toBeNull();
      expect(state.lastError).toBeNull();
    });
  });

  describe('subscribeSyncState', () => {
    it('emits current state immediately on subscribe', () => {
      const listener = jest.fn();
      const unsubscribe = subscribeSyncState(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ status: expect.any(String) }),
      );

      unsubscribe();
    });

    it('stops receiving updates after unsubscribe', async () => {
      const listener = jest.fn();
      const unsubscribe = subscribeSyncState(listener);

      // Initial call
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      // Trigger a state change
      await refreshPendingCount();

      // Should still be 1 (no additional calls after unsubscribe)
      // Note: refreshPendingCount triggers notify, but listener was removed
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('enqueueInspeccion', () => {
    it('inserts inspection into SQLite with pending status', async () => {
      await enqueueInspeccion('insp-1', { codigos: [] });

      expect(mockInsertPendingInspeccion).toHaveBeenCalledWith(
        'insp-1',
        JSON.stringify({ codigos: [] }),
        expect.any(String), // ISO timestamp
      );
    });

    it('refreshes pending count after enqueue', async () => {
      mockGetPendingInspecciones.mockResolvedValue([{ id: 'insp-1' }]);

      await enqueueInspeccion('insp-1', { codigos: [] });

      const state = getSyncState();
      expect(state.pendingCount).toBe(1);
    });
  });

  describe('enqueueReporte', () => {
    it('inserts report into SQLite with pending status', async () => {
      await enqueueReporte('rep-1', { descripcion: 'Falla en frenos' });

      expect(mockInsertPendingReporte).toHaveBeenCalledWith(
        'rep-1',
        JSON.stringify({ descripcion: 'Falla en frenos' }),
        expect.any(String),
      );
    });
  });

  describe('refreshPendingCount', () => {
    it('returns combined count of pending inspections and reports', async () => {
      mockGetPendingInspecciones.mockResolvedValue([
        { id: '1' },
        { id: '2' },
      ]);
      mockGetPendingReportes.mockResolvedValue([{ id: '3' }]);

      const count = await refreshPendingCount();

      expect(count).toBe(3);
      expect(getSyncState().pendingCount).toBe(3);
    });

    it('returns 0 when no pending operations', async () => {
      const count = await refreshPendingCount();
      expect(count).toBe(0);
    });
  });

  describe('syncPendingOperations', () => {
    it('syncs pending inspections via POST /inspecciones/sync', async () => {
      const pendingInsp = [
        {
          id: 'insp-1',
          datos: JSON.stringify({ codigos: [{ codigoId: 1, valor: 0 }] }),
          timestamp_local: '2024-01-01T10:00:00.000Z',
          sync_status: 'pending',
        },
      ];
      mockGetPendingInspecciones.mockResolvedValue(pendingInsp);

      const result = await syncPendingOperations();

      expect(mockApiPost).toHaveBeenCalledWith('/inspecciones/sync', {
        inspecciones: [
          {
            id: 'insp-1',
            datos: { codigos: [{ codigoId: 1, valor: 0 }] },
            timestampLocal: '2024-01-01T10:00:00.000Z',
          },
        ],
      });
      expect(mockMarkInspeccionSynced).toHaveBeenCalledWith('insp-1');
      expect(result.exitosos).toBe(1);
      expect(result.fallidos).toBe(0);
    });

    it('syncs pending reports via POST /reportes-falla', async () => {
      const pendingRep = [
        {
          id: 'rep-1',
          datos: JSON.stringify({ descripcion: 'Falla' }),
          timestamp_local: '2024-01-01T11:00:00.000Z',
          sync_status: 'pending',
        },
      ];
      mockGetPendingReportes.mockResolvedValue(pendingRep);

      const result = await syncPendingOperations();

      expect(mockApiPost).toHaveBeenCalledWith('/reportes-falla', {
        descripcion: 'Falla',
        creadoOffline: true,
        timestampLocal: '2024-01-01T11:00:00.000Z',
      });
      expect(mockMarkReporteSynced).toHaveBeenCalledWith('rep-1');
      expect(result.exitosos).toBe(1);
    });

    it('returns 0/0 when nothing is pending', async () => {
      const result = await syncPendingOperations();

      expect(result.exitosos).toBe(0);
      expect(result.fallidos).toBe(0);
      expect(mockApiPost).not.toHaveBeenCalled();
    });

    it('updates lastSyncAt after successful sync', async () => {
      await syncPendingOperations();

      const state = getSyncState();
      expect(state.lastSyncAt).not.toBeNull();
      expect(state.status).toBe('idle');
    });

    it('sets status to syncing during operation', async () => {
      const states: SyncState[] = [];
      const unsubscribe = subscribeSyncState((s) => states.push(s));

      await syncPendingOperations();

      unsubscribe();

      const statuses = states.map((s) => s.status);
      expect(statuses).toContain('syncing');
    });
  });
});
