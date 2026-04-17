import { TicketService, TransitionError } from './ticket.service';
import { ValidationError } from './inspeccion.service';
import { NivelRiesgo, EstadoTicket, CierreTicketDTO } from '@biosur/shared';

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

function buildCierreDTO(overrides: Partial<CierreTicketDTO> = {}): CierreTicketDTO {
  return {
    trabajoRealizado: 'Se reemplazaron las pastillas de freno',
    validacionReparacion: 'Prueba de frenado exitosa',
    userId: 'maint-user-1',
    ...overrides,
  };
}

describe('TicketService', () => {
  let service: TicketService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
    service = new TicketService(mockPool);
  });

  // =========================================================
  // crear
  // =========================================================
  describe('crear', () => {
    it('should create a ticket for a Crítico reporte de falla', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ unidad_id: 'unidad-1', semaforo_riesgo: NivelRiesgo.CRITICO }],
      });

      const row = buildTicketRow();
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [row] }) // INSERT ticket
        .mockResolvedValueOnce({}) // INSERT historial_ticket
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.crear('reporte-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('ticket-1');
      expect(result!.estado).toBe(EstadoTicket.ABIERTO);
      expect(result!.semaforoRiesgo).toBe(NivelRiesgo.CRITICO);
      expect(result!.unidadId).toBe('unidad-1');
    });

    it('should create a ticket for a Preventivo reporte de falla', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ unidad_id: 'unidad-1', semaforo_riesgo: NivelRiesgo.PREVENTIVO }],
      });

      const row = buildTicketRow({ semaforo_riesgo: NivelRiesgo.PREVENTIVO });
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [row] }) // INSERT ticket
        .mockResolvedValueOnce({}) // INSERT historial_ticket
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.crear('reporte-1');

      expect(result).not.toBeNull();
      expect(result!.semaforoRiesgo).toBe(NivelRiesgo.PREVENTIVO);
    });

    it('should NOT create a ticket for an Informativo reporte de falla', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ unidad_id: 'unidad-1', semaforo_riesgo: NivelRiesgo.INFORMATIVO }],
      });

      const result = await service.crear('reporte-1');

      expect(result).toBeNull();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when reporte de falla not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.crear('nonexistent')).rejects.toThrow(
        'Reporte de falla no encontrado',
      );
    });

    it('should record creation in historial_ticket', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ unidad_id: 'unidad-1', semaforo_riesgo: NivelRiesgo.CRITICO }],
      });

      const row = buildTicketRow();
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [row] }) // INSERT ticket
        .mockResolvedValueOnce({}) // INSERT historial_ticket
        .mockResolvedValueOnce({}); // COMMIT

      await service.crear('reporte-1');

      // Third call is the historial insert
      const historialCall = mockClientQuery.mock.calls[2];
      expect(historialCall[0]).toContain('INSERT INTO historial_ticket');
      expect(historialCall[1]).toEqual([
        'ticket-1',
        EstadoTicket.ABIERTO,
        EstadoTicket.ABIERTO,
        'system',
        expect.stringContaining('reporte-1'),
      ]);
    });

    it('should use a transaction (BEGIN/COMMIT)', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ unidad_id: 'unidad-1', semaforo_riesgo: NivelRiesgo.CRITICO }],
      });

      const row = buildTicketRow();
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [row] })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({}); // COMMIT

      await service.crear('reporte-1');

      expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClientQuery).toHaveBeenLastCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should ROLLBACK on database error and release client', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ unidad_id: 'unidad-1', semaforo_riesgo: NivelRiesgo.CRITICO }],
      });

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('DB error')); // INSERT fails

      await expect(service.crear('reporte-1')).rejects.toThrow('DB error');

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });
  });

  // =========================================================
  // asignar
  // =========================================================
  describe('asignar', () => {
    it('should transition ticket from Abierto to EnProgreso', async () => {
      const updatedRow = buildTicketRow({
        estado: EstadoTicket.EN_PROGRESO,
        asignado_a: 'maint-user-1',
        actualizado_en: new Date('2024-06-15T10:00:00Z'),
      });

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'ticket-1', estado: EstadoTicket.ABIERTO }] }) // SELECT FOR UPDATE
        .mockResolvedValueOnce({ rows: [updatedRow] }) // UPDATE
        .mockResolvedValueOnce({}) // INSERT historial_ticket
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.asignar('ticket-1', 'maint-user-1');

      expect(result.estado).toBe(EstadoTicket.EN_PROGRESO);
      expect(result.asignadoA).toBe('maint-user-1');
    });

    it('should reject transition from EnProgreso (409)', async () => {
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: 'ticket-1', estado: EstadoTicket.EN_PROGRESO }],
        });

      await expect(service.asignar('ticket-1', 'maint-user-1')).rejects.toThrow(
        TransitionError,
      );

      try {
        // Reset mocks for second call
        mockClientQuery
          .mockResolvedValueOnce({}) // BEGIN
          .mockResolvedValueOnce({
            rows: [{ id: 'ticket-1', estado: EstadoTicket.EN_PROGRESO }],
          });
        await service.asignar('ticket-1', 'maint-user-1');
      } catch (e) {
        const err = e as TransitionError;
        expect(err.estadoActual).toBe(EstadoTicket.EN_PROGRESO);
        expect(err.estadoSolicitado).toBe(EstadoTicket.EN_PROGRESO);
      }
    });

    it('should reject transition from Cerrado (409)', async () => {
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: 'ticket-1', estado: EstadoTicket.CERRADO }],
        });

      await expect(service.asignar('ticket-1', 'maint-user-1')).rejects.toThrow(
        TransitionError,
      );
    });

    it('should throw ValidationError when ticket not found', async () => {
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT returns nothing

      await expect(service.asignar('nonexistent', 'maint-user-1')).rejects.toThrow(
        ValidationError,
      );
    });

    it('should record transition in historial_ticket', async () => {
      const updatedRow = buildTicketRow({
        estado: EstadoTicket.EN_PROGRESO,
        asignado_a: 'maint-user-1',
      });

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'ticket-1', estado: EstadoTicket.ABIERTO }] })
        .mockResolvedValueOnce({ rows: [updatedRow] }) // UPDATE
        .mockResolvedValueOnce({}) // INSERT historial_ticket
        .mockResolvedValueOnce({}); // COMMIT

      await service.asignar('ticket-1', 'maint-user-1');

      const historialCall = mockClientQuery.mock.calls[3];
      expect(historialCall[0]).toContain('INSERT INTO historial_ticket');
      expect(historialCall[1]).toEqual([
        'ticket-1',
        EstadoTicket.ABIERTO,
        EstadoTicket.EN_PROGRESO,
        'maint-user-1',
        expect.stringContaining('maint-user-1'),
      ]);
    });

    it('should ROLLBACK on error and release client', async () => {
      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'ticket-1', estado: EstadoTicket.ABIERTO }] })
        .mockRejectedValueOnce(new Error('DB error')); // UPDATE fails

      await expect(service.asignar('ticket-1', 'maint-user-1')).rejects.toThrow('DB error');

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });
  });

  // =========================================================
  // cerrar
  // =========================================================
  describe('cerrar', () => {
    it('should transition ticket from EnProgreso to Cerrado', async () => {
      const cierre = buildCierreDTO();
      const updatedRow = buildTicketRow({
        estado: EstadoTicket.CERRADO,
        asignado_a: 'maint-user-1',
        trabajo_realizado: cierre.trabajoRealizado,
        validacion_reparacion: cierre.validacionReparacion,
        actualizado_en: new Date('2024-06-16T10:00:00Z'),
      });

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'ticket-1', estado: EstadoTicket.EN_PROGRESO }] })
        .mockResolvedValueOnce({ rows: [updatedRow] }) // UPDATE
        .mockResolvedValueOnce({}) // INSERT historial_ticket
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.cerrar('ticket-1', cierre);

      expect(result.estado).toBe(EstadoTicket.CERRADO);
      expect(result.trabajoRealizado).toBe(cierre.trabajoRealizado);
      expect(result.validacionReparacion).toBe(cierre.validacionReparacion);
    });

    it('should reject closing from Abierto (409)', async () => {
      const cierre = buildCierreDTO();

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: 'ticket-1', estado: EstadoTicket.ABIERTO }],
        });

      await expect(service.cerrar('ticket-1', cierre)).rejects.toThrow(TransitionError);
    });

    it('should reject closing from Cerrado (409)', async () => {
      const cierre = buildCierreDTO();

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: 'ticket-1', estado: EstadoTicket.CERRADO }],
        });

      await expect(service.cerrar('ticket-1', cierre)).rejects.toThrow(TransitionError);
    });

    it('should reject closing with empty trabajoRealizado (422)', async () => {
      const cierre = buildCierreDTO({ trabajoRealizado: '' });

      await expect(service.cerrar('ticket-1', cierre)).rejects.toThrow(ValidationError);
      await expect(service.cerrar('ticket-1', cierre)).rejects.toThrow(
        'Debe registrar el trabajo realizado antes de cerrar',
      );
    });

    it('should reject closing with whitespace-only trabajoRealizado (422)', async () => {
      const cierre = buildCierreDTO({ trabajoRealizado: '   ' });

      await expect(service.cerrar('ticket-1', cierre)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError when ticket not found', async () => {
      const cierre = buildCierreDTO();

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] });

      await expect(service.cerrar('nonexistent', cierre)).rejects.toThrow(ValidationError);
    });

    it('should record transition in historial_ticket with trabajoRealizado as description', async () => {
      const cierre = buildCierreDTO();
      const updatedRow = buildTicketRow({
        estado: EstadoTicket.CERRADO,
        trabajo_realizado: cierre.trabajoRealizado,
      });

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'ticket-1', estado: EstadoTicket.EN_PROGRESO }] })
        .mockResolvedValueOnce({ rows: [updatedRow] }) // UPDATE
        .mockResolvedValueOnce({}) // INSERT historial_ticket
        .mockResolvedValueOnce({}); // COMMIT

      await service.cerrar('ticket-1', cierre);

      const historialCall = mockClientQuery.mock.calls[3];
      expect(historialCall[0]).toContain('INSERT INTO historial_ticket');
      expect(historialCall[1]).toEqual([
        'ticket-1',
        EstadoTicket.EN_PROGRESO,
        EstadoTicket.CERRADO,
        cierre.userId,
        cierre.trabajoRealizado,
      ]);
    });

    it('should ROLLBACK on error and release client', async () => {
      const cierre = buildCierreDTO();

      mockClientQuery
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'ticket-1', estado: EstadoTicket.EN_PROGRESO }] })
        .mockRejectedValueOnce(new Error('DB error'));

      await expect(service.cerrar('ticket-1', cierre)).rejects.toThrow('DB error');

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });
  });

  // =========================================================
  // obtenerPorUnidad
  // =========================================================
  describe('obtenerPorUnidad', () => {
    it('should return tickets for a given unit', async () => {
      const rows = [buildTicketRow(), buildTicketRow({ id: 'ticket-2' })];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await service.obtenerPorUnidad('unidad-1');

      expect(result).toHaveLength(2);
      expect(result[0].unidadId).toBe('unidad-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE unidad_id = $1'),
        ['unidad-1'],
      );
    });

    it('should return empty array when no tickets exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.obtenerPorUnidad('unidad-999');
      expect(result).toHaveLength(0);
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
  // obtenerPorAsignado
  // =========================================================
  describe('obtenerPorAsignado', () => {
    it('should return tickets assigned to a user', async () => {
      const rows = [
        buildTicketRow({ asignado_a: 'maint-user-1', estado: EstadoTicket.EN_PROGRESO }),
      ];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await service.obtenerPorAsignado('maint-user-1');

      expect(result).toHaveLength(1);
      expect(result[0].asignadoA).toBe('maint-user-1');
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE asignado_a = $1'),
        ['maint-user-1'],
      );
    });

    it('should return empty array when no tickets assigned', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.obtenerPorAsignado('user-999');
      expect(result).toHaveLength(0);
    });

    it('should order results by creado_en DESC', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.obtenerPorAsignado('maint-user-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY creado_en DESC'),
        expect.any(Array),
      );
    });
  });

  // =========================================================
  // TransitionError
  // =========================================================
  describe('TransitionError', () => {
    it('should contain estadoActual and estadoSolicitado', () => {
      const err = new TransitionError(EstadoTicket.ABIERTO, EstadoTicket.CERRADO);

      expect(err.message).toBe('Transición no permitida');
      expect(err.name).toBe('TransitionError');
      expect(err.estadoActual).toBe(EstadoTicket.ABIERTO);
      expect(err.estadoSolicitado).toBe(EstadoTicket.CERRADO);
    });
  });
});
