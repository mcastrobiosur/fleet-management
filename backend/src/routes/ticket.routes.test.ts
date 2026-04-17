import request from 'supertest';
import express from 'express';
import { createTicketRouter } from './ticket.routes';
import { TicketService, TransitionError } from '../services/ticket.service';
import { ValidationError } from '../services/inspeccion.service';
import { AuthService } from '../services/auth.service';
import { Rol, EstadoTicket, NivelRiesgo } from '@biosur/shared';

// --- Helpers ---

function buildMockAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    login: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    validateToken: jest.fn(),
    ...overrides,
  } as unknown as AuthService;
}

function buildMockTicketService(overrides: Partial<TicketService> = {}): TicketService {
  return {
    crear: jest.fn(),
    asignar: jest.fn(),
    cerrar: jest.fn(),
    obtenerPorUnidad: jest.fn(),
    obtenerPorAsignado: jest.fn(),
    ...overrides,
  } as unknown as TicketService;
}

function createTestApp(
  ticketService: TicketService,
  authService: AuthService,
): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/tickets', createTicketRouter(ticketService, authService));
  return app;
}

function adminAuth(authService: AuthService) {
  (authService.validateToken as jest.Mock).mockResolvedValue({
    userId: 'admin-1',
    rol: Rol.ADMINISTRADOR,
  });
}

function mantenimientoAuth(authService: AuthService) {
  (authService.validateToken as jest.Mock).mockResolvedValue({
    userId: 'mant-1',
    rol: Rol.EQUIPO_MANTENIMIENTO,
  });
}

function conductorAuth(authService: AuthService) {
  (authService.validateToken as jest.Mock).mockResolvedValue({
    userId: 'conductor-1',
    rol: Rol.CONDUCTOR,
    unidadId: 'unidad-1',
  });
}

const sampleTicket = {
  id: 'ticket-1',
  reporteFallaId: 'rf-1',
  unidadId: 'unidad-1',
  estado: EstadoTicket.EN_PROGRESO,
  semaforoRiesgo: NivelRiesgo.CRITICO,
  asignadoA: 'mant-1',
  trabajoRealizado: null,
  validacionReparacion: null,
  creadoEn: new Date('2024-06-01T08:00:00Z'),
  actualizadoEn: new Date('2024-06-01T09:00:00Z'),
};

// --- Tests ---

describe('Ticket Routes', () => {
  // =========================================================
  // POST /tickets/:id/asignar
  // =========================================================
  describe('POST /tickets/:id/asignar', () => {
    it('should return 200 when admin assigns a ticket', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const ticketService = buildMockTicketService({
        asignar: jest.fn().mockResolvedValue(sampleTicket),
      });
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .post('/tickets/ticket-1/asignar')
        .set('Authorization', 'Bearer valid-token')
        .send({ equipoMantenimientoId: 'mant-1' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('ticket-1');
      expect(res.body.estado).toBe(EstadoTicket.EN_PROGRESO);
      expect(ticketService.asignar).toHaveBeenCalledWith('ticket-1', 'mant-1');
    });

    it('should return 400 when equipoMantenimientoId is missing', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const ticketService = buildMockTicketService();
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .post('/tickets/ticket-1/asignar')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('equipoMantenimientoId es requerido');
    });

    it('should return 401 when no token is provided', async () => {
      const authService = buildMockAuthService();
      const ticketService = buildMockTicketService();
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .post('/tickets/ticket-1/asignar')
        .send({ equipoMantenimientoId: 'mant-1' });

      expect(res.status).toBe(401);
    });

    it('should return 403 when conductor tries to assign', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const ticketService = buildMockTicketService();
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .post('/tickets/ticket-1/asignar')
        .set('Authorization', 'Bearer conductor-token')
        .send({ equipoMantenimientoId: 'mant-1' });

      expect(res.status).toBe(403);
    });

    it('should return 409 for invalid state transition', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const ticketService = buildMockTicketService({
        asignar: jest.fn().mockRejectedValue(
          new TransitionError(EstadoTicket.EN_PROGRESO, EstadoTicket.EN_PROGRESO),
        ),
      });
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .post('/tickets/ticket-1/asignar')
        .set('Authorization', 'Bearer valid-token')
        .send({ equipoMantenimientoId: 'mant-1' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Transición no permitida');
      expect(res.body.estadoActual).toBe(EstadoTicket.EN_PROGRESO);
    });

    it('should return 422 when ticket not found', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const ticketService = buildMockTicketService({
        asignar: jest.fn().mockRejectedValue(
          new ValidationError('Ticket no encontrado', 422),
        ),
      });
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .post('/tickets/ticket-1/asignar')
        .set('Authorization', 'Bearer valid-token')
        .send({ equipoMantenimientoId: 'mant-1' });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Ticket no encontrado');
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const ticketService = buildMockTicketService({
        asignar: jest.fn().mockRejectedValue(new Error('DB down')),
      });
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .post('/tickets/ticket-1/asignar')
        .set('Authorization', 'Bearer valid-token')
        .send({ equipoMantenimientoId: 'mant-1' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error interno del servidor');
    });
  });

  // =========================================================
  // POST /tickets/:id/cerrar
  // =========================================================
  describe('POST /tickets/:id/cerrar', () => {
    it('should return 200 when equipo_mantenimiento closes a ticket', async () => {
      const closedTicket = { ...sampleTicket, estado: EstadoTicket.CERRADO, trabajoRealizado: 'Reparado' };
      const authService = buildMockAuthService();
      mantenimientoAuth(authService);
      const ticketService = buildMockTicketService({
        cerrar: jest.fn().mockResolvedValue(closedTicket),
      });
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .post('/tickets/ticket-1/cerrar')
        .set('Authorization', 'Bearer valid-token')
        .send({ trabajoRealizado: 'Reparado', validacionReparacion: 'OK' });

      expect(res.status).toBe(200);
      expect(res.body.estado).toBe(EstadoTicket.CERRADO);
      expect(ticketService.cerrar).toHaveBeenCalledWith('ticket-1', {
        trabajoRealizado: 'Reparado',
        validacionReparacion: 'OK',
        userId: 'mant-1',
      });
    });

    it('should return 403 when admin tries to close', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const ticketService = buildMockTicketService();
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .post('/tickets/ticket-1/cerrar')
        .set('Authorization', 'Bearer admin-token')
        .send({ trabajoRealizado: 'Reparado', validacionReparacion: 'OK' });

      expect(res.status).toBe(403);
    });

    it('should return 409 for invalid state transition on close', async () => {
      const authService = buildMockAuthService();
      mantenimientoAuth(authService);
      const ticketService = buildMockTicketService({
        cerrar: jest.fn().mockRejectedValue(
          new TransitionError(EstadoTicket.ABIERTO, EstadoTicket.CERRADO),
        ),
      });
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .post('/tickets/ticket-1/cerrar')
        .set('Authorization', 'Bearer valid-token')
        .send({ trabajoRealizado: 'Reparado', validacionReparacion: 'OK' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Transición no permitida');
    });

    it('should return 422 when trabajoRealizado is empty', async () => {
      const authService = buildMockAuthService();
      mantenimientoAuth(authService);
      const ticketService = buildMockTicketService({
        cerrar: jest.fn().mockRejectedValue(
          new ValidationError('Debe registrar el trabajo realizado antes de cerrar', 422),
        ),
      });
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .post('/tickets/ticket-1/cerrar')
        .set('Authorization', 'Bearer valid-token')
        .send({ trabajoRealizado: '', validacionReparacion: 'OK' });

      expect(res.status).toBe(422);
      expect(res.body.error).toContain('trabajo realizado');
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService();
      mantenimientoAuth(authService);
      const ticketService = buildMockTicketService({
        cerrar: jest.fn().mockRejectedValue(new Error('DB down')),
      });
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .post('/tickets/ticket-1/cerrar')
        .set('Authorization', 'Bearer valid-token')
        .send({ trabajoRealizado: 'Reparado', validacionReparacion: 'OK' });

      expect(res.status).toBe(500);
    });
  });

  // =========================================================
  // GET /tickets?unidadId=X / GET /tickets?asignadoA=X
  // =========================================================
  describe('GET /tickets', () => {
    it('should return 200 with tickets by unidadId for admin', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const ticketService = buildMockTicketService({
        obtenerPorUnidad: jest.fn().mockResolvedValue([sampleTicket]),
      });
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .get('/tickets?unidadId=unidad-1')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('ticket-1');
      expect(ticketService.obtenerPorUnidad).toHaveBeenCalledWith('unidad-1');
    });

    it('should return 200 with tickets by asignadoA for equipo_mantenimiento', async () => {
      const authService = buildMockAuthService();
      mantenimientoAuth(authService);
      const ticketService = buildMockTicketService({
        obtenerPorAsignado: jest.fn().mockResolvedValue([sampleTicket]),
      });
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .get('/tickets?asignadoA=mant-1')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(ticketService.obtenerPorAsignado).toHaveBeenCalledWith('mant-1');
    });

    it('should return 400 when no query param is provided', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const ticketService = buildMockTicketService();
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .get('/tickets')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('unidadId o asignadoA');
    });

    it('should return 403 when conductor tries to list tickets', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const ticketService = buildMockTicketService();
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .get('/tickets?unidadId=unidad-1')
        .set('Authorization', 'Bearer conductor-token');

      expect(res.status).toBe(403);
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const ticketService = buildMockTicketService({
        obtenerPorUnidad: jest.fn().mockRejectedValue(new Error('DB error')),
      });
      const app = createTestApp(ticketService, authService);

      const res = await request(app)
        .get('/tickets?unidadId=unidad-1')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(500);
    });
  });
});
