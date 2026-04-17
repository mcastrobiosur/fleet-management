import { HojaVidaService } from './hoja-vida.service';
import { ValidationError } from './inspeccion.service';
import {
  EstadoUnidad,
  NivelRiesgo,
  EstadoTicket,
  TipoBloqueo,
  FiltroHojaVida,
} from '@biosur/shared';

// --- Mocks ---
const mockQuery = jest.fn();
const mockPool = { query: mockQuery } as any;

// --- Row builders ---
function buildUnidadRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'unidad-1',
    marca: 'Toyota',
    modelo: 'Hilux',
    patente: 'ABC-123',
    anio: 2022,
    estado: EstadoUnidad.OPERATIVA,
    creado_en: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildInspeccionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'insp-1',
    conductor_id: 'conductor-1',
    unidad_id: 'unidad-1',
    timestamp_local: new Date('2024-06-15T07:00:00Z'),
    timestamp_servidor: new Date('2024-06-15T07:01:00Z'),
    creado_offline: false,
    creado_en: new Date('2024-06-15T07:01:00Z'),
    ...overrides,
  };
}

function buildReporteFallaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reporte-1',
    inspeccion_id: 'insp-1',
    unidad_id: 'unidad-1',
    codigo_verificacion_id: 1,
    valor: 1,
    descripcion: 'Frenos desgastados',
    semaforo_riesgo: NivelRiesgo.CRITICO,
    creado_en: new Date('2024-06-15T07:02:00Z'),
    ...overrides,
  };
}

function buildTicketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    reporte_falla_id: 'reporte-1',
    unidad_id: 'unidad-1',
    estado: EstadoTicket.ABIERTO,
    semaforo_riesgo: NivelRiesgo.CRITICO,
    asignado_a: null,
    trabajo_realizado: null,
    validacion_reparacion: null,
    creado_en: new Date('2024-06-15T08:00:00Z'),
    actualizado_en: new Date('2024-06-15T08:00:00Z'),
    ...overrides,
  };
}

function buildEventoBloqueoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evento-1',
    unidad_id: 'unidad-1',
    tipo: TipoBloqueo.BLOQUEO,
    usuario_id: 'admin-1',
    razon: 'Falla crítica activa',
    creado_en: new Date('2024-06-15T09:00:00Z'),
    ...overrides,
  };
}

describe('HojaVidaService', () => {
  let service: HojaVidaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new HojaVidaService(mockPool);
  });

  // =========================================================
  // obtener — basic consolidation
  // =========================================================
  describe('obtener', () => {
    it('should consolidate unit data with all history sections', async () => {
      const unidadRow = buildUnidadRow();
      const inspeccionRows = [buildInspeccionRow()];
      const reporteRows = [buildReporteFallaRow()];
      const ticketRows = [buildTicketRow()];
      const eventoRows = [buildEventoBloqueoRow()];

      mockQuery
        .mockResolvedValueOnce({ rows: [unidadRow] })       // unidad
        .mockResolvedValueOnce({ rows: inspeccionRows })     // inspecciones
        .mockResolvedValueOnce({ rows: reporteRows })        // reportes falla
        .mockResolvedValueOnce({ rows: ticketRows })         // tickets
        .mockResolvedValueOnce({ rows: eventoRows });        // eventos bloqueo

      const result = await service.obtener('unidad-1');

      expect(result.unidad.id).toBe('unidad-1');
      expect(result.unidad.marca).toBe('Toyota');
      expect(result.unidad.modelo).toBe('Hilux');
      expect(result.unidad.patente).toBe('ABC-123');
      expect(result.unidad.anio).toBe(2022);
      expect(result.inspecciones).toHaveLength(1);
      expect(result.reportesFalla).toHaveLength(1);
      expect(result.tickets).toHaveLength(1);
      expect(result.eventosBloqueDesbloqueo).toHaveLength(1);
    });

    it('should throw ValidationError when unit not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.obtener('nonexistent')).rejects.toThrow('Unidad no encontrada');
    });

    it('should return empty arrays when unit has no history', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [buildUnidadRow()] })
        .mockResolvedValueOnce({ rows: [] })  // inspecciones
        .mockResolvedValueOnce({ rows: [] })  // reportes
        .mockResolvedValueOnce({ rows: [] })  // tickets
        .mockResolvedValueOnce({ rows: [] }); // eventos

      const result = await service.obtener('unidad-1');

      expect(result.inspecciones).toHaveLength(0);
      expect(result.reportesFalla).toHaveLength(0);
      expect(result.tickets).toHaveLength(0);
      expect(result.eventosBloqueDesbloqueo).toHaveLength(0);
    });

    it('should order all results by creado_en DESC', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [buildUnidadRow()] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await service.obtener('unidad-1');

      // Verify all 4 history queries use ORDER BY creado_en DESC
      // Calls: [0]=unidad, [1]=inspecciones, [2]=reportes, [3]=tickets, [4]=eventos
      for (let i = 1; i <= 4; i++) {
        expect(mockQuery.mock.calls[i][0]).toContain('ORDER BY creado_en DESC');
      }
    });
  });

  // =========================================================
  // obtener — filters
  // =========================================================
  describe('obtener with filters', () => {
    const setupMocksForFilters = () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [buildUnidadRow()] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });
    };

    it('should apply fechaDesde filter to all queries', async () => {
      setupMocksForFilters();
      const filtros: FiltroHojaVida = {
        fechaDesde: new Date('2024-06-01T00:00:00Z'),
      };

      await service.obtener('unidad-1', filtros);

      // All 4 history queries should include fechaDesde
      for (let i = 1; i <= 4; i++) {
        expect(mockQuery.mock.calls[i][0]).toContain('creado_en >=');
        expect(mockQuery.mock.calls[i][1]).toContain(filtros.fechaDesde);
      }
    });

    it('should apply fechaHasta filter to all queries', async () => {
      setupMocksForFilters();
      const filtros: FiltroHojaVida = {
        fechaHasta: new Date('2024-06-30T23:59:59Z'),
      };

      await service.obtener('unidad-1', filtros);

      for (let i = 1; i <= 4; i++) {
        expect(mockQuery.mock.calls[i][0]).toContain('creado_en <=');
        expect(mockQuery.mock.calls[i][1]).toContain(filtros.fechaHasta);
      }
    });

    it('should apply tipoFalla filter only to reportes de falla', async () => {
      setupMocksForFilters();
      const filtros: FiltroHojaVida = { tipoFalla: 5 };

      await service.obtener('unidad-1', filtros);

      // reportes query (index 2) should have tipoFalla filter
      expect(mockQuery.mock.calls[2][0]).toContain('codigo_verificacion_id');
      expect(mockQuery.mock.calls[2][1]).toContain(5);

      // Other queries should NOT have tipoFalla
      expect(mockQuery.mock.calls[1][0]).not.toContain('codigo_verificacion_id');
      expect(mockQuery.mock.calls[3][0]).not.toContain('codigo_verificacion_id');
      expect(mockQuery.mock.calls[4][0]).not.toContain('codigo_verificacion_id');
    });

    it('should apply estadoTicket filter only to tickets', async () => {
      setupMocksForFilters();
      const filtros: FiltroHojaVida = { estadoTicket: EstadoTicket.ABIERTO };

      await service.obtener('unidad-1', filtros);

      // tickets query (index 3) should have estado filter
      expect(mockQuery.mock.calls[3][0]).toContain('estado =');
      expect(mockQuery.mock.calls[3][1]).toContain(EstadoTicket.ABIERTO);

      // Other queries should NOT have estado filter
      expect(mockQuery.mock.calls[1][0]).not.toContain('estado =');
      expect(mockQuery.mock.calls[2][0]).not.toContain('estado =');
      expect(mockQuery.mock.calls[4][0]).not.toContain('estado =');
    });

    it('should apply all filters simultaneously', async () => {
      setupMocksForFilters();
      const filtros: FiltroHojaVida = {
        fechaDesde: new Date('2024-06-01T00:00:00Z'),
        fechaHasta: new Date('2024-06-30T23:59:59Z'),
        tipoFalla: 3,
        estadoTicket: EstadoTicket.EN_PROGRESO,
      };

      await service.obtener('unidad-1', filtros);

      // reportes query should have date + tipoFalla
      expect(mockQuery.mock.calls[2][0]).toContain('creado_en >=');
      expect(mockQuery.mock.calls[2][0]).toContain('creado_en <=');
      expect(mockQuery.mock.calls[2][0]).toContain('codigo_verificacion_id');

      // tickets query should have date + estadoTicket
      expect(mockQuery.mock.calls[3][0]).toContain('creado_en >=');
      expect(mockQuery.mock.calls[3][0]).toContain('creado_en <=');
      expect(mockQuery.mock.calls[3][0]).toContain('estado =');
    });
  });

  // =========================================================
  // obtener — correct mapping
  // =========================================================
  describe('obtener — field mapping', () => {
    it('should correctly map all entity fields', async () => {
      const unidadRow = buildUnidadRow();
      const inspeccionRow = buildInspeccionRow();
      const reporteRow = buildReporteFallaRow();
      const ticketRow = buildTicketRow({
        asignado_a: 'maint-1',
        trabajo_realizado: 'Reparado',
        validacion_reparacion: 'OK',
      });
      const eventoRow = buildEventoBloqueoRow();

      mockQuery
        .mockResolvedValueOnce({ rows: [unidadRow] })
        .mockResolvedValueOnce({ rows: [inspeccionRow] })
        .mockResolvedValueOnce({ rows: [reporteRow] })
        .mockResolvedValueOnce({ rows: [ticketRow] })
        .mockResolvedValueOnce({ rows: [eventoRow] });

      const result = await service.obtener('unidad-1');

      // Inspeccion mapping
      const insp = result.inspecciones[0];
      expect(insp.conductorId).toBe('conductor-1');
      expect(insp.unidadId).toBe('unidad-1');
      expect(insp.creadoOffline).toBe(false);

      // ReporteFalla mapping
      const rep = result.reportesFalla[0];
      expect(rep.codigoVerificacionId).toBe(1);
      expect(rep.semaforoRiesgo).toBe(NivelRiesgo.CRITICO);
      expect(rep.descripcion).toBe('Frenos desgastados');

      // Ticket mapping
      const tick = result.tickets[0];
      expect(tick.asignadoA).toBe('maint-1');
      expect(tick.trabajoRealizado).toBe('Reparado');
      expect(tick.validacionReparacion).toBe('OK');

      // EventoBloqueo mapping
      const ev = result.eventosBloqueDesbloqueo[0];
      expect(ev.tipo).toBe(TipoBloqueo.BLOQUEO);
      expect(ev.usuarioId).toBe('admin-1');
      expect(ev.razon).toBe('Falla crítica activa');
    });
  });

  // =========================================================
  // registrarEvento
  // =========================================================
  describe('registrarEvento', () => {
    it('should log an inspeccion event to log_auditoria', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'unidad-1' }] }) // unit exists
        .mockResolvedValueOnce({});                              // INSERT log

      await service.registrarEvento('unidad-1', {
        tipo: 'inspeccion',
        referenciaId: 'insp-1',
        descripcion: 'Inspección registrada',
      });

      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[0]).toContain('INSERT INTO log_auditoria');
      expect(insertCall[1][1]).toBe('hoja_vida:inspeccion');
      expect(insertCall[1][2]).toBe('unidad:unidad-1');
    });

    it('should log a reporte_falla event', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'unidad-1' }] })
        .mockResolvedValueOnce({});

      await service.registrarEvento('unidad-1', {
        tipo: 'reporte_falla',
        referenciaId: 'reporte-1',
        descripcion: 'Reporte de falla registrado',
      });

      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[1][1]).toBe('hoja_vida:reporte_falla');
    });

    it('should log a ticket event', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'unidad-1' }] })
        .mockResolvedValueOnce({});

      await service.registrarEvento('unidad-1', {
        tipo: 'ticket',
        referenciaId: 'ticket-1',
        descripcion: 'Ticket actualizado',
      });

      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[1][1]).toBe('hoja_vida:ticket');
    });

    it('should log a bloqueo event', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'unidad-1' }] })
        .mockResolvedValueOnce({});

      await service.registrarEvento('unidad-1', {
        tipo: 'bloqueo',
        referenciaId: 'evento-1',
        descripcion: 'Unidad bloqueada',
      });

      const insertCall = mockQuery.mock.calls[1];
      expect(insertCall[1][1]).toBe('hoja_vida:bloqueo');
    });

    it('should throw ValidationError when unit not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.registrarEvento('nonexistent', {
          tipo: 'inspeccion',
          referenciaId: 'insp-1',
          descripcion: 'Test',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('should store event details as JSON in detalles field', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: 'unidad-1' }] })
        .mockResolvedValueOnce({});

      const evento = {
        tipo: 'inspeccion' as const,
        referenciaId: 'insp-99',
        descripcion: 'Inspección matutina completada',
      };

      await service.registrarEvento('unidad-1', evento);

      const insertCall = mockQuery.mock.calls[1];
      const detallesJson = insertCall[1][4];
      const parsed = JSON.parse(detallesJson);
      expect(parsed.tipo).toBe('inspeccion');
      expect(parsed.referenciaId).toBe('insp-99');
      expect(parsed.descripcion).toBe('Inspección matutina completada');
    });
  });
});
