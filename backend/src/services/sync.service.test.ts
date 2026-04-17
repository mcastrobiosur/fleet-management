import { SyncService, SyncInspeccionItem } from './sync.service';
import { InspeccionService } from './inspeccion.service';
import { Pool } from 'pg';

// --- Helpers ---

function buildMockPool(queryResults: Record<string, unknown>[] = []): Pool {
  return {
    query: jest.fn().mockResolvedValue({ rows: queryResults }),
    connect: jest.fn(),
  } as unknown as Pool;
}

function buildMockInspeccionService(
  overrides: Partial<InspeccionService> = {},
): InspeccionService {
  return {
    crear: jest.fn().mockResolvedValue({
      id: 'insp-new',
      conductorId: 'conductor-1',
      unidadId: 'unidad-1',
      timestampLocal: new Date(),
      timestampServidor: new Date(),
      creadoOffline: true,
      creadoEn: new Date(),
    }),
    obtenerPorUnidad: jest.fn(),
    obtenerPorConductor: jest.fn(),
    ...overrides,
  } as unknown as InspeccionService;
}

const noDelay = () => Promise.resolve();

function makeCodigos() {
  return Array.from({ length: 39 }, (_, i) => ({ codigoId: i + 1, valor: 0 }));
}

function makeItem(overrides: Partial<SyncInspeccionItem> = {}): SyncInspeccionItem {
  return {
    operacionId: 'op-1',
    datos: {
      conductorId: 'conductor-1',
      unidadId: 'unidad-1',
      codigos: makeCodigos(),
      creadoOffline: true,
      timestampLocal: new Date('2024-06-01T08:00:00Z'),
    },
    ...overrides,
  };
}

// --- Tests ---

describe('SyncService', () => {
  describe('sincronizarLote', () => {
    it('should process items successfully when no conflicts exist', async () => {
      const pool = buildMockPool([]);
      const inspeccionSvc = buildMockInspeccionService();
      const syncService = new SyncService(pool, inspeccionSvc, noDelay);

      const items = [makeItem(), makeItem({ operacionId: 'op-2' })];
      const result = await syncService.sincronizarLote('conductor-1', items);

      expect(result.exitosos).toBe(2);
      expect(result.fallidos).toBe(0);
      expect(result.conflictos).toHaveLength(0);
      expect(inspeccionSvc.crear).toHaveBeenCalledTimes(2);
    });

    it('should detect conflict when inspection exists for same unit and day', async () => {
      const existingRow = {
        id: 'insp-existing',
        conductor_id: 'conductor-1',
        unidad_id: 'unidad-1',
        timestamp_local: new Date('2024-06-01T07:00:00Z'),
        timestamp_servidor: new Date('2024-06-01T07:00:01Z'),
        creado_offline: false,
        creado_en: new Date('2024-06-01T07:00:01Z'),
      };
      const pool = buildMockPool([existingRow]);
      const inspeccionSvc = buildMockInspeccionService();
      const syncService = new SyncService(pool, inspeccionSvc, noDelay);

      const result = await syncService.sincronizarLote('conductor-1', [makeItem()]);

      expect(result.exitosos).toBe(0);
      expect(result.conflictos).toHaveLength(1);
      expect(result.conflictos[0].operacionId).toBe('op-1');
      expect(result.conflictos[0].razon).toContain('misma unidad');
      // Should have logged the conflict (INSERT into log_sync_conflicto)
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('log_sync_conflicto'),
        expect.any(Array),
      );
      // Should NOT have tried to create the inspection
      expect(inspeccionSvc.crear).not.toHaveBeenCalled();
    });

    it('should retry with backoff on transient errors and succeed', async () => {
      const pool = buildMockPool([]);
      const inspeccionSvc = buildMockInspeccionService({
        crear: jest.fn()
          .mockRejectedValueOnce(new Error('DB timeout'))
          .mockResolvedValueOnce({
            id: 'insp-new',
            conductorId: 'conductor-1',
            unidadId: 'unidad-1',
            timestampLocal: new Date(),
            timestampServidor: new Date(),
            creadoOffline: true,
            creadoEn: new Date(),
          }),
      });
      const delayFn = jest.fn().mockResolvedValue(undefined);
      const syncService = new SyncService(pool, inspeccionSvc, delayFn);

      const result = await syncService.sincronizarLote('conductor-1', [makeItem()]);

      expect(result.exitosos).toBe(1);
      expect(result.fallidos).toBe(0);
      expect(delayFn).toHaveBeenCalledTimes(1);
      expect(delayFn).toHaveBeenCalledWith(1_000); // first backoff delay
      expect(inspeccionSvc.crear).toHaveBeenCalledTimes(2);
    });

    it('should fail after exhausting all retry attempts', async () => {
      const pool = buildMockPool([]);
      const inspeccionSvc = buildMockInspeccionService({
        crear: jest.fn().mockRejectedValue(new Error('Persistent failure')),
      });
      const delayFn = jest.fn().mockResolvedValue(undefined);
      const syncService = new SyncService(pool, inspeccionSvc, delayFn);

      const result = await syncService.sincronizarLote('conductor-1', [makeItem()]);

      expect(result.exitosos).toBe(0);
      expect(result.fallidos).toBe(1);
      // 1 initial attempt + 3 retries = 4 calls to crear
      expect(inspeccionSvc.crear).toHaveBeenCalledTimes(4);
      // 3 delays: 1s, 5s, 30s
      expect(delayFn).toHaveBeenCalledTimes(3);
      expect(delayFn).toHaveBeenNthCalledWith(1, 1_000);
      expect(delayFn).toHaveBeenNthCalledWith(2, 5_000);
      expect(delayFn).toHaveBeenNthCalledWith(3, 30_000);
    });

    it('should handle mixed results (success, conflict, failure)', async () => {
      // First query: no conflict for op-1
      // Second query: conflict for op-2 (returns existing row)
      // Third query: INSERT into log_sync_conflicto for op-2
      // Fourth query: no conflict for op-3
      const pool = {
        query: jest.fn()
          // op-1: no conflict
          .mockResolvedValueOnce({ rows: [] })
          // op-2: conflict found
          .mockResolvedValueOnce({
            rows: [{
              id: 'insp-existing',
              conductor_id: 'conductor-1',
              unidad_id: 'unidad-2',
              timestamp_local: new Date('2024-06-01T07:00:00Z'),
              timestamp_servidor: new Date(),
              creado_offline: false,
              creado_en: new Date(),
            }],
          })
          // op-2: log conflict insert
          .mockResolvedValueOnce({ rows: [] })
          // op-3: no conflict
          .mockResolvedValueOnce({ rows: [] }),
      } as unknown as Pool;

      const inspeccionSvc = buildMockInspeccionService({
        crear: jest.fn()
          // op-1: success
          .mockResolvedValueOnce({ id: 'insp-1' })
          // op-3: persistent failure
          .mockRejectedValue(new Error('fail')),
      });

      const syncService = new SyncService(pool, inspeccionSvc, noDelay);

      const items = [
        makeItem({ operacionId: 'op-1' }),
        makeItem({ operacionId: 'op-2', datos: { ...makeItem().datos, unidadId: 'unidad-2' } }),
        makeItem({ operacionId: 'op-3', datos: { ...makeItem().datos, unidadId: 'unidad-3' } }),
      ];

      const result = await syncService.sincronizarLote('conductor-1', items);

      expect(result.exitosos).toBe(1);
      expect(result.conflictos).toHaveLength(1);
      expect(result.conflictos[0].operacionId).toBe('op-2');
      expect(result.fallidos).toBe(1);
    });

    it('should return empty results for empty input', async () => {
      const pool = buildMockPool([]);
      const inspeccionSvc = buildMockInspeccionService();
      const syncService = new SyncService(pool, inspeccionSvc, noDelay);

      const result = await syncService.sincronizarLote('conductor-1', []);

      expect(result.exitosos).toBe(0);
      expect(result.fallidos).toBe(0);
      expect(result.conflictos).toHaveLength(0);
    });

    it('should pass conductorId and creadoOffline=true to InspeccionService.crear', async () => {
      const pool = buildMockPool([]);
      const inspeccionSvc = buildMockInspeccionService();
      const syncService = new SyncService(pool, inspeccionSvc, noDelay);

      await syncService.sincronizarLote('conductor-99', [makeItem()]);

      expect(inspeccionSvc.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          conductorId: 'conductor-99',
          creadoOffline: true,
        }),
      );
    });
  });
});
