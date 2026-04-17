import { ReporteFallaService } from './reporte-falla.service';
import { ValidationError } from './inspeccion.service';
import { SemaforoRiesgoService } from './semaforo-riesgo.service';
import { StorageService } from './storage.service';
import {
  CrearReporteFallaDTO,
  FotografiaInput,
  NivelRiesgo,
  FormatoFoto,
} from '@biosur/shared';

// --- Mocks ---
const mockQuery = jest.fn();
const mockRelease = jest.fn();
const mockClientQuery = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
  query: mockClientQuery,
  release: mockRelease,
});
const mockPool = { query: mockQuery, connect: mockConnect } as any;

const mockClasificar = jest.fn();
const mockSemaforoService = { clasificar: mockClasificar } as unknown as SemaforoRiesgoService;

const mockUpload = jest.fn();
const mockStorageService: StorageService = { upload: mockUpload };

// --- Helpers ---
function buildFoto(overrides: Partial<FotografiaInput> = {}): FotografiaInput {
  return {
    archivo: Buffer.from('fake-image-data'),
    formato: FormatoFoto.JPEG,
    tamanoBytes: 500_000,
    ...overrides,
  };
}

function buildCrearDTO(overrides: Partial<CrearReporteFallaDTO> = {}): CrearReporteFallaDTO {
  return {
    inspeccionId: 'inspeccion-1',
    codigoVerificacionId: 5,
    valor: 5,
    descripcion: 'Falla en frenos delanteros',
    fotografias: [buildFoto()],
    ...overrides,
  };
}

function buildReporteRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reporte-1',
    inspeccion_id: 'inspeccion-1',
    unidad_id: 'unidad-1',
    codigo_verificacion_id: 5,
    valor: 5,
    descripcion: 'Falla en frenos delanteros',
    semaforo_riesgo: NivelRiesgo.CRITICO,
    creado_en: new Date('2024-06-15T10:00:00Z'),
    ...overrides,
  };
}

describe('ReporteFallaService', () => {
  let service: ReporteFallaService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
    mockClasificar.mockResolvedValue(NivelRiesgo.CRITICO);
    mockUpload.mockResolvedValue('https://bucket.s3.region.amazonaws.com/reportes/reporte-1/photo.jpeg');
    service = new ReporteFallaService(mockPool, mockSemaforoService, mockStorageService);
  });

  // =========================================================
  // crear — validation
  // =========================================================
  describe('crear — validación de fotografías', () => {
    it('should reject report with no photos (422)', async () => {
      const dto = buildCrearDTO({ fotografias: [] });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
      try {
        await service.crear(dto);
      } catch (e) {
        const err = e as ValidationError;
        expect(err.statusCode).toBe(422);
        expect(err.message).toBe('Se requiere al menos una fotografía');
      }
    });

    it('should reject report with unsupported photo format (422)', async () => {
      const dto = buildCrearDTO({
        fotografias: [buildFoto({ formato: 'gif' as any })],
      });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
      try {
        await service.crear(dto);
      } catch (e) {
        const err = e as ValidationError;
        expect(err.statusCode).toBe(422);
        expect(err.message).toBe('Formato no soportado. Use JPEG o PNG');
      }
    });

    it('should reject report with photo exceeding 10 MB (413)', async () => {
      const dto = buildCrearDTO({
        fotografias: [buildFoto({ tamanoBytes: 10_485_761 })],
      });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
      try {
        await service.crear(dto);
      } catch (e) {
        const err = e as ValidationError;
        expect(err.statusCode).toBe(413);
        expect(err.message).toBe('La imagen excede el tamaño máximo de 10 MB');
      }
    });

    it('should accept photo at exactly 10 MB boundary', async () => {
      const dto = buildCrearDTO({
        fotografias: [buildFoto({ tamanoBytes: 10_485_760 })],
      });

      mockQuery.mockResolvedValueOnce({ rows: [{ unidad_id: 'unidad-1' }] });
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [buildReporteRow()] }) // INSERT reporte
        .mockResolvedValueOnce({}) // INSERT fotografia
        .mockResolvedValueOnce({}) // INSERT ticket
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.crear(dto);
      expect(result.id).toBe('reporte-1');
    });

    it('should accept JPEG format', async () => {
      const dto = buildCrearDTO({
        fotografias: [buildFoto({ formato: FormatoFoto.JPEG })],
      });

      mockQuery.mockResolvedValueOnce({ rows: [{ unidad_id: 'unidad-1' }] });
      mockClientQuery
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [buildReporteRow()] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await service.crear(dto);
      expect(result.id).toBe('reporte-1');
    });

    it('should accept PNG format', async () => {
      const dto = buildCrearDTO({
        fotografias: [buildFoto({ formato: FormatoFoto.PNG })],
      });

      mockQuery.mockResolvedValueOnce({ rows: [{ unidad_id: 'unidad-1' }] });
      mockClientQuery
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [buildReporteRow()] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await service.crear(dto);
      expect(result.id).toBe('reporte-1');
    });

    it('should reject if second photo has invalid format', async () => {
      const dto = buildCrearDTO({
        fotografias: [
          buildFoto({ formato: FormatoFoto.JPEG }),
          buildFoto({ formato: 'bmp' as any }),
        ],
      });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
    });

    it('should reject if any photo exceeds size limit', async () => {
      const dto = buildCrearDTO({
        fotografias: [
          buildFoto({ tamanoBytes: 1_000 }),
          buildFoto({ tamanoBytes: 11_000_000 }),
        ],
      });

      await expect(service.crear(dto)).rejects.toThrow(ValidationError);
    });
  });

  // =========================================================
  // crear — happy path
  // =========================================================
  describe('crear — happy path', () => {
    it('should create a report with semaforo from SemaforoRiesgoService', async () => {
      const dto = buildCrearDTO();
      mockClasificar.mockResolvedValueOnce(NivelRiesgo.PREVENTIVO);

      mockQuery.mockResolvedValueOnce({ rows: [{ unidad_id: 'unidad-1' }] });
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [buildReporteRow({ semaforo_riesgo: NivelRiesgo.PREVENTIVO })] })
        .mockResolvedValueOnce({}) // INSERT fotografia
        .mockResolvedValueOnce({}) // INSERT ticket (preventivo)
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.crear(dto);

      expect(result.semaforoRiesgo).toBe(NivelRiesgo.PREVENTIVO);
      expect(mockClasificar).toHaveBeenCalledWith(5);
    });

    it('should upload photos to storage service', async () => {
      const dto = buildCrearDTO({
        fotografias: [buildFoto(), buildFoto({ formato: FormatoFoto.PNG })],
      });

      mockQuery.mockResolvedValueOnce({ rows: [{ unidad_id: 'unidad-1' }] });
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [buildReporteRow()] })
        .mockResolvedValueOnce({}) // INSERT fotografia 1
        .mockResolvedValueOnce({}) // INSERT fotografia 2
        .mockResolvedValueOnce({}) // INSERT ticket
        .mockResolvedValueOnce({}); // COMMIT

      await service.crear(dto);

      expect(mockUpload).toHaveBeenCalledTimes(2);
      // First call should be jpeg content type
      expect(mockUpload.mock.calls[0][2]).toBe('image/jpeg');
      // Second call should be png content type
      expect(mockUpload.mock.calls[1][2]).toBe('image/png');
    });

    it('should use a database transaction (BEGIN/COMMIT)', async () => {
      const dto = buildCrearDTO();

      mockQuery.mockResolvedValueOnce({ rows: [{ unidad_id: 'unidad-1' }] });
      mockClientQuery
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [buildReporteRow()] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await service.crear(dto);

      expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClientQuery).toHaveBeenLastCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should ROLLBACK on error and release client', async () => {
      const dto = buildCrearDTO();

      mockQuery.mockResolvedValueOnce({ rows: [{ unidad_id: 'unidad-1' }] });
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('DB error'));

      await expect(service.crear(dto)).rejects.toThrow('DB error');

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should look up unidadId from inspeccion', async () => {
      const dto = buildCrearDTO();

      mockQuery.mockResolvedValueOnce({ rows: [{ unidad_id: 'unidad-42' }] });
      mockClientQuery
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [buildReporteRow({ unidad_id: 'unidad-42' })] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await service.crear(dto);

      expect(result.unidadId).toBe('unidad-42');
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT unidad_id FROM inspeccion WHERE id = $1',
        ['inspeccion-1'],
      );
    });

    it('should throw if inspeccion not found', async () => {
      const dto = buildCrearDTO();
      mockQuery.mockResolvedValueOnce({ rows: [] });

      try {
        await service.crear(dto);
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ValidationError);
        expect((e as ValidationError).message).toBe('Inspección no encontrada');
        expect((e as ValidationError).statusCode).toBe(422);
      }
    });
  });

  // =========================================================
  // crear — ticket creation
  // =========================================================
  describe('crear — ticket creation', () => {
    it('should create ticket for critico semaforo', async () => {
      const dto = buildCrearDTO();
      mockClasificar.mockResolvedValueOnce(NivelRiesgo.CRITICO);

      mockQuery.mockResolvedValueOnce({ rows: [{ unidad_id: 'unidad-1' }] });
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [buildReporteRow()] })
        .mockResolvedValueOnce({}) // INSERT fotografia
        .mockResolvedValueOnce({}) // INSERT ticket
        .mockResolvedValueOnce({}); // COMMIT

      await service.crear(dto);

      // Ticket insert is the 4th client query call (BEGIN, INSERT reporte, INSERT foto, INSERT ticket)
      const ticketCall = mockClientQuery.mock.calls[3];
      expect(ticketCall[0]).toContain('INSERT INTO ticket');
      expect(ticketCall[1]).toContain(NivelRiesgo.CRITICO);
    });

    it('should create ticket for preventivo semaforo', async () => {
      const dto = buildCrearDTO();
      mockClasificar.mockResolvedValueOnce(NivelRiesgo.PREVENTIVO);

      mockQuery.mockResolvedValueOnce({ rows: [{ unidad_id: 'unidad-1' }] });
      mockClientQuery
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ rows: [buildReporteRow({ semaforo_riesgo: NivelRiesgo.PREVENTIVO })] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}) // INSERT ticket
        .mockResolvedValueOnce({});

      await service.crear(dto);

      const ticketCall = mockClientQuery.mock.calls[3];
      expect(ticketCall[0]).toContain('INSERT INTO ticket');
    });

    it('should NOT create ticket for informativo semaforo', async () => {
      const dto = buildCrearDTO();
      mockClasificar.mockResolvedValueOnce(NivelRiesgo.INFORMATIVO);

      mockQuery.mockResolvedValueOnce({ rows: [{ unidad_id: 'unidad-1' }] });
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [buildReporteRow({ semaforo_riesgo: NivelRiesgo.INFORMATIVO })] })
        .mockResolvedValueOnce({}) // INSERT fotografia
        .mockResolvedValueOnce({}); // COMMIT (no ticket insert)

      await service.crear(dto);

      // Should only have 4 calls: BEGIN, INSERT reporte, INSERT foto, COMMIT
      const allCalls = mockClientQuery.mock.calls.map((c: any[]) => c[0]);
      expect(allCalls).not.toContainEqual(expect.stringContaining('INSERT INTO ticket'));
    });
  });

  // =========================================================
  // obtenerPorUnidad
  // =========================================================
  describe('obtenerPorUnidad', () => {
    it('should return reports for a given unit', async () => {
      const rows = [buildReporteRow(), buildReporteRow({ id: 'reporte-2' })];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await service.obtenerPorUnidad('unidad-1');

      expect(result).toHaveLength(2);
      expect(result[0].unidadId).toBe('unidad-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE unidad_id = $1'),
        ['unidad-1'],
      );
    });

    it('should return empty array when no reports exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.obtenerPorUnidad('unidad-999');
      expect(result).toHaveLength(0);
    });

    it('should filter by semaforo', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.obtenerPorUnidad('unidad-1', { semaforo: NivelRiesgo.CRITICO });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('semaforo_riesgo = $2'),
        ['unidad-1', NivelRiesgo.CRITICO],
      );
    });

    it('should filter by fechaDesde', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const desde = new Date('2024-01-01');

      await service.obtenerPorUnidad('unidad-1', { fechaDesde: desde });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('creado_en >= $2'),
        ['unidad-1', desde],
      );
    });

    it('should filter by fechaHasta', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const hasta = new Date('2024-12-31');

      await service.obtenerPorUnidad('unidad-1', { fechaHasta: hasta });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('creado_en <= $2'),
        ['unidad-1', hasta],
      );
    });

    it('should combine semaforo and date filters', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const desde = new Date('2024-01-01');

      await service.obtenerPorUnidad('unidad-1', {
        semaforo: NivelRiesgo.PREVENTIVO,
        fechaDesde: desde,
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('semaforo_riesgo = $2'),
        expect.arrayContaining(['unidad-1', NivelRiesgo.PREVENTIVO, desde]),
      );
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('creado_en >= $3'),
        expect.any(Array),
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
  // obtenerPorSemaforo
  // =========================================================
  describe('obtenerPorSemaforo', () => {
    it('should return reports filtered by semaforo level', async () => {
      const rows = [buildReporteRow()];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await service.obtenerPorSemaforo(NivelRiesgo.CRITICO);

      expect(result).toHaveLength(1);
      expect(result[0].semaforoRiesgo).toBe(NivelRiesgo.CRITICO);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE semaforo_riesgo = $1'),
        [NivelRiesgo.CRITICO],
      );
    });

    it('should return empty array when no reports match', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.obtenerPorSemaforo(NivelRiesgo.INFORMATIVO);
      expect(result).toHaveLength(0);
    });

    it('should order results by creado_en DESC', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.obtenerPorSemaforo(NivelRiesgo.PREVENTIVO);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY creado_en DESC'),
        expect.any(Array),
      );
    });
  });
});
