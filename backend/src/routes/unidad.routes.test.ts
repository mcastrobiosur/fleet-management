import request from 'supertest';
import express from 'express';
import { createUnidadRouter } from './unidad.routes';
import { BloqueoService, BloqueoError } from '../services/bloqueo.service';
import { HojaVidaService } from '../services/hoja-vida.service';
import { AuthService } from '../services/auth.service';
import { ValidationError } from '../services/inspeccion.service';
import {
  Rol,
  EstadoUnidad,
  EstadoTicket,
  NivelRiesgo,
  HojaVida,
  TipoBloqueo,
} from '@biosur/shared';

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

function buildMockBloqueoService(overrides: Partial<BloqueoService> = {}): BloqueoService {
  return {
    verificarBloqueo: jest.fn(),
    cambiarEstadoUnidad: jest.fn(),
    verificarMarchaPermitida: jest.fn(),
    registrarEvento: jest.fn(),
    ...overrides,
  } as unknown as BloqueoService;
}

function buildMockHojaVidaService(overrides: Partial<HojaVidaService> = {}): HojaVidaService {
  return {
    obtener: jest.fn(),
    registrarEvento: jest.fn(),
    ...overrides,
  } as unknown as HojaVidaService;
}

function createTestApp(
  bloqueoService: BloqueoService,
  authService: AuthService,
  hojaVidaService?: HojaVidaService,
): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/unidades', createUnidadRouter(bloqueoService, authService, hojaVidaService));
  return app;
}

function adminAuth(authService: AuthService) {
  (authService.validateToken as jest.Mock).mockResolvedValue({
    userId: 'admin-1',
    rol: Rol.ADMINISTRADOR,
  });
}

function conductorAuth(authService: AuthService) {
  (authService.validateToken as jest.Mock).mockResolvedValue({
    userId: 'conductor-1',
    rol: Rol.CONDUCTOR,
    unidadId: 'unidad-1',
  });
}

function mantenimientoAuth(authService: AuthService) {
  (authService.validateToken as jest.Mock).mockResolvedValue({
    userId: 'mant-1',
    rol: Rol.EQUIPO_MANTENIMIENTO,
  });
}

// --- Tests ---

describe('Unidad Routes', () => {
  describe('PATCH /unidades/:id/estado', () => {
    it('should return 200 when admin changes unit state', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const bloqueoService = buildMockBloqueoService({
        cambiarEstadoUnidad: jest.fn().mockResolvedValue(undefined),
      });
      const app = createTestApp(bloqueoService, authService);

      const res = await request(app)
        .patch('/unidades/unidad-1/estado')
        .set('Authorization', 'Bearer admin-token')
        .send({ estado: 'disponible' });

      expect(res.status).toBe(200);
      expect(res.body.unidadId).toBe('unidad-1');
      expect(res.body.estado).toBe('disponible');
      expect(bloqueoService.cambiarEstadoUnidad).toHaveBeenCalledWith(
        'unidad-1',
        EstadoUnidad.DISPONIBLE,
        'admin-1',
      );
    });

    it('should return 200 for en_mantenimiento state', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const bloqueoService = buildMockBloqueoService({
        cambiarEstadoUnidad: jest.fn().mockResolvedValue(undefined),
      });
      const app = createTestApp(bloqueoService, authService);

      const res = await request(app)
        .patch('/unidades/unidad-1/estado')
        .set('Authorization', 'Bearer admin-token')
        .send({ estado: 'en_mantenimiento' });

      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('en_mantenimiento');
    });

    it('should return 422 for invalid estado value', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const bloqueoService = buildMockBloqueoService();
      const app = createTestApp(bloqueoService, authService);

      const res = await request(app)
        .patch('/unidades/unidad-1/estado')
        .set('Authorization', 'Bearer admin-token')
        .send({ estado: 'invalido' });

      expect(res.status).toBe(422);
      expect(res.body.error).toBe('Estado inválido');
      expect(res.body.estadosPermitidos).toBeDefined();
    });

    it('should return 422 when estado is missing', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const bloqueoService = buildMockBloqueoService();
      const app = createTestApp(bloqueoService, authService);

      const res = await request(app)
        .patch('/unidades/unidad-1/estado')
        .set('Authorization', 'Bearer admin-token')
        .send({});

      expect(res.status).toBe(422);
    });

    it('should return 401 when no token is provided', async () => {
      const authService = buildMockAuthService();
      const bloqueoService = buildMockBloqueoService();
      const app = createTestApp(bloqueoService, authService);

      const res = await request(app)
        .patch('/unidades/unidad-1/estado')
        .send({ estado: 'disponible' });

      expect(res.status).toBe(401);
    });

    it('should return 403 when conductor tries to change state', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const bloqueoService = buildMockBloqueoService();
      const app = createTestApp(bloqueoService, authService);

      const res = await request(app)
        .patch('/unidades/unidad-1/estado')
        .set('Authorization', 'Bearer conductor-token')
        .send({ estado: 'disponible' });

      expect(res.status).toBe(403);
    });

    it('should return 403 when equipo_mantenimiento tries to change state', async () => {
      const authService = buildMockAuthService();
      mantenimientoAuth(authService);
      const bloqueoService = buildMockBloqueoService();
      const app = createTestApp(bloqueoService, authService);

      const res = await request(app)
        .patch('/unidades/unidad-1/estado')
        .set('Authorization', 'Bearer mant-token')
        .send({ estado: 'disponible' });

      expect(res.status).toBe(403);
    });

    it('should return 409 when unit is blocked by critical tickets', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const bloqueoService = buildMockBloqueoService({
        cambiarEstadoUnidad: jest.fn().mockRejectedValue(
          new BloqueoError('Unidad bloqueada por falla crítica', 409, [
            { id: 'ticket-1', estado: EstadoTicket.ABIERTO, semaforoRiesgo: NivelRiesgo.CRITICO },
          ]),
        ),
      });
      const app = createTestApp(bloqueoService, authService);

      const res = await request(app)
        .patch('/unidades/unidad-1/estado')
        .set('Authorization', 'Bearer admin-token')
        .send({ estado: 'disponible' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Unidad bloqueada por falla crítica');
      expect(res.body.ticketsCriticos).toHaveLength(1);
      expect(res.body.ticketsCriticos[0].id).toBe('ticket-1');
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const bloqueoService = buildMockBloqueoService({
        cambiarEstadoUnidad: jest.fn().mockRejectedValue(new Error('DB down')),
      });
      const app = createTestApp(bloqueoService, authService);

      const res = await request(app)
        .patch('/unidades/unidad-1/estado')
        .set('Authorization', 'Bearer admin-token')
        .send({ estado: 'disponible' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error interno del servidor');
    });
  });

  describe('GET /unidades/:id/hoja-vida', () => {
    const sampleHojaVida: HojaVida = {
      unidad: {
        id: 'unidad-1',
        marca: 'Toyota',
        modelo: 'Hilux',
        patente: 'ABC-123',
        anio: 2022,
        estado: EstadoUnidad.OPERATIVA,
        creadoEn: new Date('2024-01-01'),
      },
      inspecciones: [],
      reportesFalla: [],
      tickets: [],
      eventosBloqueDesbloqueo: [],
    };

    it('should return 200 with hoja de vida for admin', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const bloqueoService = buildMockBloqueoService();
      const hojaVidaService = buildMockHojaVidaService({
        obtener: jest.fn().mockResolvedValue(sampleHojaVida),
      });
      const app = createTestApp(bloqueoService, authService, hojaVidaService);

      const res = await request(app)
        .get('/unidades/unidad-1/hoja-vida')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      expect(res.body.unidad.id).toBe('unidad-1');
      expect(res.body.unidad.marca).toBe('Toyota');
      expect(hojaVidaService.obtener).toHaveBeenCalledWith('unidad-1', {});
    });

    it('should pass filter params to service', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const bloqueoService = buildMockBloqueoService();
      const hojaVidaService = buildMockHojaVidaService({
        obtener: jest.fn().mockResolvedValue(sampleHojaVida),
      });
      const app = createTestApp(bloqueoService, authService, hojaVidaService);

      const res = await request(app)
        .get('/unidades/unidad-1/hoja-vida?fechaDesde=2024-01-01&fechaHasta=2024-01-31&tipoFalla=5&estadoTicket=abierto')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
      const callArgs = (hojaVidaService.obtener as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('unidad-1');
      expect(callArgs[1].fechaDesde).toBeInstanceOf(Date);
      expect(callArgs[1].fechaHasta).toBeInstanceOf(Date);
      expect(callArgs[1].tipoFalla).toBe(5);
      expect(callArgs[1].estadoTicket).toBe('abierto');
    });

    it('should return 401 when no token is provided', async () => {
      const authService = buildMockAuthService();
      const bloqueoService = buildMockBloqueoService();
      const hojaVidaService = buildMockHojaVidaService();
      const app = createTestApp(bloqueoService, authService, hojaVidaService);

      const res = await request(app)
        .get('/unidades/unidad-1/hoja-vida');

      expect(res.status).toBe(401);
    });

    it('should return 403 when conductor tries to access', async () => {
      const authService = buildMockAuthService();
      conductorAuth(authService);
      const bloqueoService = buildMockBloqueoService();
      const hojaVidaService = buildMockHojaVidaService();
      const app = createTestApp(bloqueoService, authService, hojaVidaService);

      const res = await request(app)
        .get('/unidades/unidad-1/hoja-vida')
        .set('Authorization', 'Bearer conductor-token');

      expect(res.status).toBe(403);
    });

    it('should return 404 when unit not found', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const bloqueoService = buildMockBloqueoService();
      const hojaVidaService = buildMockHojaVidaService({
        obtener: jest.fn().mockRejectedValue(new ValidationError('Unidad no encontrada', 404)),
      });
      const app = createTestApp(bloqueoService, authService, hojaVidaService);

      const res = await request(app)
        .get('/unidades/nonexistent/hoja-vida')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Unidad no encontrada');
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService();
      adminAuth(authService);
      const bloqueoService = buildMockBloqueoService();
      const hojaVidaService = buildMockHojaVidaService({
        obtener: jest.fn().mockRejectedValue(new Error('DB down')),
      });
      const app = createTestApp(bloqueoService, authService, hojaVidaService);

      const res = await request(app)
        .get('/unidades/unidad-1/hoja-vida')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error interno del servidor');
    });
  });
});

