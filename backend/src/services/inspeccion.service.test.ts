import { InspeccionService, ValidationError } from './inspeccion.service';
import { CrearInspeccionDTO, CodigoVerificacionEntry } from '@biosur/shared';

// --- Mocks ---
const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockClientQuery = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockRelease,
});
const mockPool = { query: mockQuery, connect: mockConnect } as any;

// --- Helpers ---
function buildCodigos(count = 39, valueOverride?: number): CodigoVerificacionEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    codigoId: i + 1,
    valor: valueOverride ?? 0,
  }));
}

function buildCrearDTO(overrides: Partial<CrearInspeccionDTO> = {}): CrearInspeccionDTO {
  return {
    conductorId: 'conductor-1',
    unidadId: 'unidad-1',
    codigos: buildCodigos(),
    creadoOffline: false,
    timestampLocal: new Date('2024-06-15T08:00:00Z'),
    ...overrides,
  };
}

function buildInspeccionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inspeccion-1',
    conductor_id: 'conductor-1',
    unidad_id: 'unidad-1',
    timestamp_local: new Date('2024-06-15T08:00:00Z'),
    timestamp_servidor: new Date('2024-06-15T08:00:01Z'),
    creado_offline: false,
    creado_en: new Date('2024-06-15T08:00:01Z'),
    ...overrides,
  };
}

describe('InspeccionService', () => {
  let service: InspeccionService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
    service = new InspeccionService(mockPool);
  });

  // =========================================================
  // crear
  // =========================================================
  describe('crear', () => {
    it('should create an inspection with exactly 39 codes', async () => {
      const dto = buildCrearDTO();
      const row = buildInspeccionRow();

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [row] }) // INSERT inspeccion
        .mockResolvedValueOnce({}) // INSERT detalles
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.crear(dto);

      expect(result.id).toBe('inspeccion-1');
      expect(result.conductorId).toBe('conductor-1');
      expect(result.unidadId).toBe('unidad-1');
      expect(result.timestampLocal).toEqual(new Date('2024-06-15T08:00:00Z'));
      expect(result.timestampServidor).toEqual(new Date('2024-06-15T08:00:01Z'));
      expect(result.creadoOffline).toBe(false);
    });

    it('should use a database transaction (BEGIN/COMMIT)', async () => {
      const dto = buildCrearDTO();
      const row = buildInspeccionRow();

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}); // COMMIT

      await service.crear(dto);

      expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClientQuery).toHaveBeenLastCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should ROLLBACK on database error and release client', async () => {
      const dto = buildCrearDTO();

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('DB error')); // INSERT fails

      await expect(service.crear(dto)).rejects.toThrow('DB error');

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should insert 39 detail records in a single batch query', async () => {
      const dto = buildCrearDTO();
      const row = buildInspeccionRow();

      mockClientQuery
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await service.crear(dto);

      // The third call is the batch INSERT for detalles
      const detailCall = mockClientQuery.mock.calls[2];
      const sql = detailCall[0] as string;
      expect(sql).toContain('INSERT INTO detalle_inspeccion');
      // 39 codes × 3 params each = 117 params
      expect(detailCall[1]).toHaveLength(117);
    });

    it('should support offline inspections', async () => {
      const dto = buildCrearDTO({ creadoOffline: true });
      const row = buildInspeccionRow({ creado_offline: true });

      mockClientQuery
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await service.crear(dto);
      expect(result.creadoOffline).toBe(true);
    });

    // --- Validation: reject incomplete inspections ---

    it('should reject inspection with fewer than 39 codes (422)', async () => {
      const dto = buildCrearDTO({ codigos: buildCodigos(38) });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
      try {
        await service.crear(dto);
      } catch (e) {
        const err = e as ValidationError;
        expect(err.statusCode).toBe(422);
        expect(err.message).toBe('Inspección incompleta');
        expect(err.camposPendientes).toContain(39);
      }
    });

    it('should reject inspection with more than 39 codes (422)', async () => {
      const codigos = buildCodigos(39);
      codigos.push({ codigoId: 1, valor: 0 }); // duplicate → 40 entries
      const dto = buildCrearDTO({ codigos });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
    });

    it('should reject inspection with duplicate codigoIds', async () => {
      const codigos = buildCodigos(39);
      codigos[38] = { codigoId: 1, valor: 0 }; // duplicate of code 1

      const dto = buildCrearDTO({ codigos });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
    });

    it('should reject inspection with value out of range (negative)', async () => {
      const codigos = buildCodigos(39);
      codigos[0] = { codigoId: 1, valor: -1 };

      const dto = buildCrearDTO({ codigos });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
    });

    it('should reject inspection with value out of range (>39)', async () => {
      const codigos = buildCodigos(39);
      codigos[0] = { codigoId: 1, valor: 40 };

      const dto = buildCrearDTO({ codigos });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
    });

    it('should reject inspection with codigoId out of range (0)', async () => {
      const codigos = buildCodigos(38);
      codigos.push({ codigoId: 0, valor: 0 });

      const dto = buildCrearDTO({ codigos });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
    });

    it('should reject inspection with codigoId out of range (40)', async () => {
      const codigos = buildCodigos(38);
      codigos.push({ codigoId: 40, valor: 0 });

      const dto = buildCrearDTO({ codigos });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
    });

    it('should reject inspection with empty codigos array', async () => {
      const dto = buildCrearDTO({ codigos: [] });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
      try {
        await service.crear(dto);
      } catch (e) {
        const err = e as ValidationError;
        expect(err.camposPendientes).toHaveLength(39);
      }
    });

    it('should list pending fields when codes are missing', async () => {
      // Only codes 1-10 provided
      const codigos = buildCodigos(10);
      const dto = buildCrearDTO({ codigos });

      try {
        await service.crear(dto);
        fail('Should have thrown');
      } catch (e) {
        const err = e as ValidationError;
        expect(err.camposPendientes).toBeDefined();
        expect(err.camposPendientes).toHaveLength(29); // 39 - 10
        expect(err.camposPendientes).toContain(11);
        expect(err.camposPendientes).toContain(39);
      }
    });

    it('should accept inspection with all values at boundary (0 and 39)', async () => {
      const codigos = buildCodigos(39).map((c, i) => ({
        ...c,
        valor: i === 0 ? 0 : 39,
      }));
      const dto = buildCrearDTO({ codigos });
      const row = buildInspeccionRow();

      mockClientQuery
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await service.crear(dto);
      expect(result.id).toBe('inspeccion-1');
    });
  });

  // =========================================================
  // obtenerPorUnidad
  // =========================================================
  describe('obtenerPorUnidad', () => {
    it('should return inspections for a given unit', async () => {
      const rows = [buildInspeccionRow(), buildInspeccionRow({ id: 'inspeccion-2' })];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await service.obtenerPorUnidad('unidad-1');

      expect(result).toHaveLength(2);
      expect(result[0].unidadId).toBe('unidad-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE unidad_id = $1'),
        ['unidad-1'],
      );
    });

    it('should return empty array when no inspections exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.obtenerPorUnidad('unidad-999');
      expect(result).toHaveLength(0);
    });

    it('should apply fechaDesde filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const desde = new Date('2024-01-01');

      await service.obtenerPorUnidad('unidad-1', { fechaDesde: desde });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('creado_en >= $2'),
        ['unidad-1', desde],
      );
    });

    it('should apply fechaHasta filter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const hasta = new Date('2024-12-31');

      await service.obtenerPorUnidad('unidad-1', { fechaHasta: hasta });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('creado_en <= $2'),
        ['unidad-1', hasta],
      );
    });

    it('should apply both date filters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const desde = new Date('2024-01-01');
      const hasta = new Date('2024-12-31');

      await service.obtenerPorUnidad('unidad-1', { fechaDesde: desde, fechaHasta: hasta });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('creado_en >= $2'),
        ['unidad-1', desde, hasta],
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('creado_en <= $3'),
        ['unidad-1', desde, hasta],
      );
    });

    it('should order results by creado_en DESC', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.obtenerPorUnidad('unidad-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY creado_en DESC'),
        expect.any(Array),
      );
    });
  });

  // =========================================================
  // obtenerPorConductor
  // =========================================================
  describe('obtenerPorConductor', () => {
    it('should return inspections for a given conductor', async () => {
      const rows = [buildInspeccionRow()];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await service.obtenerPorConductor('conductor-1');

      expect(result).toHaveLength(1);
      expect(result[0].conductorId).toBe('conductor-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE conductor_id = $1'),
        ['conductor-1'],
      );
    });

    it('should return empty array when no inspections exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.obtenerPorConductor('conductor-999');
      expect(result).toHaveLength(0);
    });

    it('should apply date filters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const desde = new Date('2024-06-01');
      const hasta = new Date('2024-06-30');

      await service.obtenerPorConductor('conductor-1', {
        fechaDesde: desde,
        fechaHasta: hasta,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('creado_en >= $2'),
        ['conductor-1', desde, hasta],
      );
    });

    it('should order results by creado_en DESC', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.obtenerPorConductor('conductor-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY creado_en DESC'),
        expect.any(Array),
      );
    });
  });
});
