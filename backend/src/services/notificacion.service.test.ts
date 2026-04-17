import WebSocket from 'ws';
import {
  NotificacionService,
  PushProvider,
  NotificacionMessage,
} from './notificacion.service';
import {
  ReporteFalla,
  Ticket,
  NivelRiesgo,
  EstadoTicket,
  Rol,
} from '@biosur/shared';

// --- Helpers ---

function buildReporteFalla(overrides: Partial<ReporteFalla> = {}): ReporteFalla {
  return {
    id: 'reporte-1',
    inspeccionId: 'inspeccion-1',
    unidadId: 'unidad-1',
    codigoVerificacionId: 1,
    valor: 1,
    descripcion: 'Frenos desgastados',
    semaforoRiesgo: NivelRiesgo.CRITICO,
    creadoEn: new Date('2024-06-15T08:00:00Z'),
    ...overrides,
  };
}

function buildTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'ticket-1',
    reporteFallaId: 'reporte-1',
    unidadId: 'unidad-1',
    estado: EstadoTicket.EN_PROGRESO,
    semaforoRiesgo: NivelRiesgo.CRITICO,
    asignadoA: 'maint-user-1',
    trabajoRealizado: null,
    validacionReparacion: null,
    creadoEn: new Date('2024-06-15T08:00:00Z'),
    actualizadoEn: new Date('2024-06-15T08:00:00Z'),
    ...overrides,
  };
}

function createMockWebSocket(readyState: number = WebSocket.OPEN): WebSocket {
  return {
    readyState,
    send: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  } as unknown as WebSocket;
}

function createMockPushProvider(): PushProvider & { send: jest.Mock } {
  return { send: jest.fn().mockResolvedValue(undefined) };
}

describe('NotificacionService', () => {
  let service: NotificacionService;

  beforeEach(() => {
    service = new NotificacionService();
  });

  afterEach(() => {
    service.close();
  });

  // =========================================================
  // suscribir
  // =========================================================
  describe('suscribir', () => {
    it('should register a user for websocket channel', () => {
      service.suscribir('admin-1', 'websocket', Rol.ADMINISTRADOR);

      expect(service.getConnectedCount()).toBe(1);
      const conns = service.getClientConnections('admin-1');
      expect(conns).toHaveLength(1);
      expect(conns[0].canal).toBe('websocket');
      expect(conns[0].rol).toBe(Rol.ADMINISTRADOR);
    });

    it('should register a user for push channel', () => {
      service.suscribir('user-1', 'push', Rol.CONDUCTOR);

      expect(service.getConnectedCount()).toBe(1);
      const conns = service.getClientConnections('user-1');
      expect(conns).toHaveLength(1);
      expect(conns[0].canal).toBe('push');
    });

    it('should allow a user to subscribe to both channels', () => {
      service.suscribir('admin-1', 'websocket', Rol.ADMINISTRADOR);
      service.suscribir('admin-1', 'push', Rol.ADMINISTRADOR);

      expect(service.getConnectedCount()).toBe(2);
      const conns = service.getClientConnections('admin-1');
      expect(conns).toHaveLength(2);
    });

    it('should not duplicate subscriptions for the same channel', () => {
      service.suscribir('admin-1', 'websocket', Rol.ADMINISTRADOR);
      service.suscribir('admin-1', 'websocket', Rol.ADMINISTRADOR);

      const conns = service.getClientConnections('admin-1');
      expect(conns).toHaveLength(1);
    });

    it('should default to Conductor role when not specified', () => {
      service.suscribir('user-1', 'push');

      const conns = service.getClientConnections('user-1');
      expect(conns[0].rol).toBe(Rol.CONDUCTOR);
    });
  });

  // =========================================================
  // enviarAlertaCritica
  // =========================================================
  describe('enviarAlertaCritica', () => {
    it('should send WebSocket message to all admin connections', async () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();

      // Manually register admin websocket connections
      service.suscribir('admin-1', 'websocket', Rol.ADMINISTRADOR);
      service.suscribir('admin-2', 'websocket', Rol.ADMINISTRADOR);

      // Inject mock WebSocket objects
      const conns1 = service.getClientConnections('admin-1');
      conns1[0].ws = ws1;
      const conns2 = service.getClientConnections('admin-2');
      conns2[0].ws = ws2;

      const reporte = buildReporteFalla();
      await service.enviarAlertaCritica(reporte);

      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).toHaveBeenCalledTimes(1);

      const sent1 = JSON.parse((ws1.send as jest.Mock).mock.calls[0][0]) as NotificacionMessage;
      expect(sent1.tipo).toBe('alerta_critica');
      expect(sent1.payload.reporteFallaId).toBe('reporte-1');
      expect(sent1.payload.unidadId).toBe('unidad-1');
      expect(sent1.timestamp).toBeDefined();
    });

    it('should NOT send to non-admin users', async () => {
      const wsAdmin = createMockWebSocket();
      const wsConductor = createMockWebSocket();

      service.suscribir('admin-1', 'websocket', Rol.ADMINISTRADOR);
      service.suscribir('conductor-1', 'websocket', Rol.CONDUCTOR);

      service.getClientConnections('admin-1')[0].ws = wsAdmin;
      service.getClientConnections('conductor-1')[0].ws = wsConductor;

      await service.enviarAlertaCritica(buildReporteFalla());

      expect(wsAdmin.send).toHaveBeenCalledTimes(1);
      expect(wsConductor.send).not.toHaveBeenCalled();
    });

    it('should skip WebSocket connections that are not OPEN', async () => {
      const wsClosed = createMockWebSocket(WebSocket.CLOSED);

      service.suscribir('admin-1', 'websocket', Rol.ADMINISTRADOR);
      service.getClientConnections('admin-1')[0].ws = wsClosed;

      await service.enviarAlertaCritica(buildReporteFalla());

      expect(wsClosed.send).not.toHaveBeenCalled();
    });

    it('should send push notification to admin push subscribers', async () => {
      const pushProvider = createMockPushProvider();
      service = new NotificacionService(pushProvider);

      service.suscribir('admin-1', 'push', Rol.ADMINISTRADOR);

      await service.enviarAlertaCritica(buildReporteFalla());

      expect(pushProvider.send).toHaveBeenCalledTimes(1);
      expect(pushProvider.send).toHaveBeenCalledWith('admin-1', {
        title: 'Alerta Crítica',
        body: expect.stringContaining('unidad-1'),
        data: {
          reporteFallaId: 'reporte-1',
          unidadId: 'unidad-1',
        },
      });
    });

    it('should not call push provider when none is configured', async () => {
      // service has no push provider by default
      service.suscribir('admin-1', 'push', Rol.ADMINISTRADOR);

      // Should not throw
      await expect(service.enviarAlertaCritica(buildReporteFalla())).resolves.not.toThrow();
    });

    it('should handle no connected admins gracefully', async () => {
      await expect(service.enviarAlertaCritica(buildReporteFalla())).resolves.not.toThrow();
    });
  });

  // =========================================================
  // enviarNotificacionTicket
  // =========================================================
  describe('enviarNotificacionTicket', () => {
    it('should send WebSocket message to the assigned maintenance user', async () => {
      const ws = createMockWebSocket();

      service.suscribir('maint-user-1', 'websocket', Rol.EQUIPO_MANTENIMIENTO);
      service.getClientConnections('maint-user-1')[0].ws = ws;

      const ticket = buildTicket();
      await service.enviarNotificacionTicket(ticket, 'asignado');

      expect(ws.send).toHaveBeenCalledTimes(1);

      const sent = JSON.parse((ws.send as jest.Mock).mock.calls[0][0]) as NotificacionMessage;
      expect(sent.tipo).toBe('ticket_evento');
      expect(sent.payload.ticketId).toBe('ticket-1');
      expect(sent.payload.evento).toBe('asignado');
      expect(sent.payload.estado).toBe(EstadoTicket.EN_PROGRESO);
    });

    it('should send push notification to the assigned user', async () => {
      const pushProvider = createMockPushProvider();
      service = new NotificacionService(pushProvider);

      service.suscribir('maint-user-1', 'push', Rol.EQUIPO_MANTENIMIENTO);

      const ticket = buildTicket();
      await service.enviarNotificacionTicket(ticket, 'asignado');

      expect(pushProvider.send).toHaveBeenCalledTimes(1);
      expect(pushProvider.send).toHaveBeenCalledWith('maint-user-1', {
        title: 'Ticket asignado',
        body: expect.stringContaining('ticket-1'),
        data: {
          ticketId: 'ticket-1',
          unidadId: 'unidad-1',
        },
      });
    });

    it('should NOT send to other users', async () => {
      const wsTarget = createMockWebSocket();
      const wsOther = createMockWebSocket();

      service.suscribir('maint-user-1', 'websocket', Rol.EQUIPO_MANTENIMIENTO);
      service.suscribir('maint-user-2', 'websocket', Rol.EQUIPO_MANTENIMIENTO);

      service.getClientConnections('maint-user-1')[0].ws = wsTarget;
      service.getClientConnections('maint-user-2')[0].ws = wsOther;

      const ticket = buildTicket({ asignadoA: 'maint-user-1' });
      await service.enviarNotificacionTicket(ticket, 'asignado');

      expect(wsTarget.send).toHaveBeenCalledTimes(1);
      expect(wsOther.send).not.toHaveBeenCalled();
    });

    it('should do nothing when ticket has no assigned user', async () => {
      const ws = createMockWebSocket();
      service.suscribir('maint-user-1', 'websocket', Rol.EQUIPO_MANTENIMIENTO);
      service.getClientConnections('maint-user-1')[0].ws = ws;

      const ticket = buildTicket({ asignadoA: null });
      await service.enviarNotificacionTicket(ticket, 'creado');

      expect(ws.send).not.toHaveBeenCalled();
    });

    it('should skip closed WebSocket connections', async () => {
      const wsClosed = createMockWebSocket(WebSocket.CLOSED);

      service.suscribir('maint-user-1', 'websocket', Rol.EQUIPO_MANTENIMIENTO);
      service.getClientConnections('maint-user-1')[0].ws = wsClosed;

      const ticket = buildTicket();
      await service.enviarNotificacionTicket(ticket, 'cerrado');

      expect(wsClosed.send).not.toHaveBeenCalled();
    });

    it('should handle user not subscribed gracefully', async () => {
      const ticket = buildTicket({ asignadoA: 'unknown-user' });
      await expect(
        service.enviarNotificacionTicket(ticket, 'asignado'),
      ).resolves.not.toThrow();
    });
  });

  // =========================================================
  // close
  // =========================================================
  describe('close', () => {
    it('should clear all client connections', () => {
      service.suscribir('admin-1', 'websocket', Rol.ADMINISTRADOR);
      service.suscribir('user-1', 'push', Rol.CONDUCTOR);

      expect(service.getConnectedCount()).toBe(2);

      service.close();

      expect(service.getConnectedCount()).toBe(0);
    });
  });

  // =========================================================
  // getConnectedCount
  // =========================================================
  describe('getConnectedCount', () => {
    it('should return 0 when no clients are connected', () => {
      expect(service.getConnectedCount()).toBe(0);
    });

    it('should count all connections across users', () => {
      service.suscribir('admin-1', 'websocket', Rol.ADMINISTRADOR);
      service.suscribir('admin-1', 'push', Rol.ADMINISTRADOR);
      service.suscribir('user-1', 'push', Rol.CONDUCTOR);

      expect(service.getConnectedCount()).toBe(3);
    });
  });
});
