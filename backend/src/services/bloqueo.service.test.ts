import { BloqueoService, BloqueoError } from './bloqueo.service';
import {
  EstadoUnidad,
  EstadoTicket,
  NivelRiesgo,
  TipoBloqueo,
} from '@biosur/shared';

// --- Mocks ---
const mockQuery = jest.fn();
const mockPool = { query: mockQuery } as any;

describe('BloqueoService', () => {
  let service: BloqueoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BloqueoService(mockPool);
  });

  // =========================================================
  // verificarBloqueo
  // =========================================================
  describe('verificarBloqueo', () => {
    it('should return true when unit has active critical tickets', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '2' }] });

      const result = await service.verificarBloqueo('unidad-1');

      expect(result).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('FROM ticket'),
        ['unidad-1', NivelRiesgo.CRITICO, EstadoTicket.ABIERTO, EstadoTicket.EN_PROGRESO],
      );
    });

    it('should return false when unit has no active critical tickets', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      const result = await service.verificarBloqueo('unidad-1');

      expect(result).toBe(false);
    });

    it('should only count Crítico tickets, not Preventivo or Informativo', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await service.verificarBloqueo('unidad-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([NivelRiesgo.CRITICO]),
      );
    });

    it('should only count Abierto and EnProgreso tickets, not Cerrado', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ count: '0' }] });

      await service.verificarBloqueo('unidad-1');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([EstadoTicket.ABIERTO, EstadoTicket.EN_PROGRESO]),
      );
    });
  });

  // =========================================================
  // cambiarEstadoUnidad
  // =========================================================
  describe('cambiarEstadoUnidad', () => {
    it('should block change to Disponible when active critical tickets exist (409)', async () => {
      // obtenerTicketsCriticosActivos query
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'ticket-1', estado: EstadoTicket.ABIERTO, semaforo_riesgo: NivelRiesgo.CRITICO },
        ],
      });
      // registrarEvento query (bloqueo event)
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'evt-1', unidad_id: 'unidad-1', tipo: TipoBloqueo.BLOQUEO,
          usuario_id: 'admin-1', razon: 'test', creado_en: new Date(),
        }],
      });

      await expect(
        service.cambiarEstadoUnidad('unidad-1', EstadoUnidad.DISPONIBLE, 'admin-1'),
      ).rejects.toThrow(BloqueoError);

      try {
        // Reset for second attempt
        mockQuery.mockResolvedValueOnce({
          rows: [
            { id: 'ticket-1', estado: EstadoTicket.ABIERTO, semaforo_riesgo: NivelRiesgo.CRITICO },
          ],
        });
        mockQuery.mockResolvedValueOnce({
          rows: [{
            id: 'evt-1', unidad_id: 'unidad-1', tipo: TipoBloqueo.BLOQUEO,
            usuario_id: 'admin-1', razon: 'test', creado_en: new Date(),
          }],
        });
        await service.cambiarEstadoUnidad('unidad-1', EstadoUnidad.DISPONIBLE, 'admin-1');
      } catch (e) {
        const err = e as BloqueoError;
        expect(err.statusCode).toBe(409);
        expect(err.ticketsCriticos).toHaveLength(1);
        expect(err.ticketsCriticos[0].id).toBe('ticket-1');
      }
    });

    it('should allow change to Disponible when no active critical tickets', async () => {
      // obtenerTicketsCriticosActivos returns empty
      mockQuery.mockResolvedValueOnce({ rows: [] });
      // UPDATE unidad
      mockQuery.mockResolvedValueOnce({});
      // registrarEvento (desbloqueo)
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'evt-1', unidad_id: 'unidad-1', tipo: TipoBloqueo.DESBLOQUEO,
          usuario_id: 'admin-1', razon: 'Unidad cambiada a Disponible', creado_en: new Date(),
        }],
      });

      await expect(
        service.cambiarEstadoUnidad('unidad-1', EstadoUnidad.DISPONIBLE, 'admin-1'),
      ).resolves.toBeUndefined();

      // Verify UPDATE was called
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE unidad SET estado'),
        [EstadoUnidad.DISPONIBLE, 'unidad-1'],
      );
    });

    it('should allow change to non-Disponible states without checking tickets', async () => {
      // Only the UPDATE query should be called
      mockQuery.mockResolvedValueOnce({});

      await service.cambiarEstadoUnidad('unidad-1', EstadoUnidad.EN_MANTENIMIENTO, 'admin-1');

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE unidad SET estado'),
        [EstadoUnidad.EN_MANTENIMIENTO, 'unidad-1'],
      );
    });

    it('should register a BLOQUEO event when blocking a state change', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'ticket-1', estado: EstadoTicket.EN_PROGRESO, semaforo_riesgo: NivelRiesgo.CRITICO },
        ],
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'evt-1', unidad_id: 'unidad-1', tipo: TipoBloqueo.BLOQUEO,
          usuario_id: 'admin-1', razon: 'blocked', creado_en: new Date(),
        }],
      });

      await expect(
        service.cambiarEstadoUnidad('unidad-1', EstadoUnidad.DISPONIBLE, 'admin-1'),
      ).rejects.toThrow(BloqueoError);

      // Second call should be the registrarEvento INSERT
      expect(mockQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO evento_bloqueo'),
        expect.arrayContaining(['unidad-1', TipoBloqueo.BLOQUEO, 'admin-1']),
      );
    });

    it('should register a DESBLOQUEO event when successfully changing to Disponible', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // no critical tickets
      mockQuery.mockResolvedValueOnce({}); // UPDATE unidad
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'evt-1', unidad_id: 'unidad-1', tipo: TipoBloqueo.DESBLOQUEO,
          usuario_id: 'admin-1', razon: 'Unidad cambiada a Disponible', creado_en: new Date(),
        }],
      });

      await service.cambiarEstadoUnidad('unidad-1', EstadoUnidad.DISPONIBLE, 'admin-1');

      expect(mockQuery).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('INSERT INTO evento_bloqueo'),
        expect.arrayContaining(['unidad-1', TipoBloqueo.DESBLOQUEO, 'admin-1']),
      );
    });
  });

  // =========================================================
  // verificarMarchaPermitida
  // =========================================================
  describe('verificarMarchaPermitida', () => {
    it('should throw BloqueoError with 403 when unit has active critical tickets', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { id: 'ticket-1', estado: EstadoTicket.ABIERTO, semaforo_riesgo: NivelRiesgo.CRITICO },
          { id: 'ticket-2', estado: EstadoTicket.EN_PROGRESO, semaforo_riesgo: NivelRiesgo.CRITICO },
        ],
      });

      try {
        await service.verificarMarchaPermitida('unidad-1');
        fail('Should have thrown');
      } catch (e) {
        const err = e as BloqueoError;
        expect(err).toBeInstanceOf(BloqueoError);
        expect(err.statusCode).toBe(403);
        expect(err.message).toBe('Unidad bloqueada');
        expect(err.ticketsCriticos).toHaveLength(2);
      }
    });

    it('should not throw when unit has no active critical tickets', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.verificarMarchaPermitida('unidad-1')).resolves.toBeUndefined();
    });

    it('should not throw when unit only has closed critical tickets', async () => {
      // The query filters by estado IN (abierto, en_progreso), so closed won't appear
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(service.verificarMarchaPermitida('unidad-1')).resolves.toBeUndefined();
    });
  });

  // =========================================================
  // registrarEvento
  // =========================================================
  describe('registrarEvento', () => {
    it('should insert a bloqueo event and return it', async () => {
      const now = new Date('2024-06-15T12:00:00Z');
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'evt-1',
          unidad_id: 'unidad-1',
          tipo: TipoBloqueo.BLOQUEO,
          usuario_id: 'admin-1',
          razon: 'Falla crítica detectada',
          creado_en: now,
        }],
      });

      const result = await service.registrarEvento(
        'unidad-1',
        TipoBloqueo.BLOQUEO,
        'admin-1',
        'Falla crítica detectada',
      );

      expect(result.id).toBe('evt-1');
      expect(result.unidadId).toBe('unidad-1');
      expect(result.tipo).toBe(TipoBloqueo.BLOQUEO);
      expect(result.usuarioId).toBe('admin-1');
      expect(result.razon).toBe('Falla crítica detectada');
      expect(result.creadoEn).toEqual(now);
    });

    it('should insert a desbloqueo event', async () => {
      const now = new Date('2024-06-15T14:00:00Z');
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'evt-2',
          unidad_id: 'unidad-1',
          tipo: TipoBloqueo.DESBLOQUEO,
          usuario_id: 'maint-1',
          razon: 'Último ticket crítico cerrado',
          creado_en: now,
        }],
      });

      const result = await service.registrarEvento(
        'unidad-1',
        TipoBloqueo.DESBLOQUEO,
        'maint-1',
        'Último ticket crítico cerrado',
      );

      expect(result.tipo).toBe(TipoBloqueo.DESBLOQUEO);
      expect(result.usuarioId).toBe('maint-1');
    });

    it('should pass correct parameters to the INSERT query', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'evt-1', unidad_id: 'u-1', tipo: TipoBloqueo.BLOQUEO,
          usuario_id: 'user-1', razon: 'test reason', creado_en: new Date(),
        }],
      });

      await service.registrarEvento('u-1', TipoBloqueo.BLOQUEO, 'user-1', 'test reason');

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO evento_bloqueo'),
        ['u-1', TipoBloqueo.BLOQUEO, 'user-1', 'test reason'],
      );
    });
  });

  // =========================================================
  // BloqueoError
  // =========================================================
  describe('BloqueoError', () => {
    it('should contain statusCode and ticketsCriticos', () => {
      const tickets = [
        { id: 'ticket-1', estado: EstadoTicket.ABIERTO, semaforoRiesgo: NivelRiesgo.CRITICO },
      ];
      const err = new BloqueoError('Unidad bloqueada', 409, tickets);

      expect(err.message).toBe('Unidad bloqueada');
      expect(err.name).toBe('BloqueoError');
      expect(err.statusCode).toBe(409);
      expect(err.ticketsCriticos).toEqual(tickets);
    });
  });
});
