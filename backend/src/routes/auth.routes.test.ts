import request from 'supertest';
import express from 'express';
import { createAuthRouter } from './auth.routes';
import { AuthService, AuthError } from '../services/auth.service';
import { Rol } from '@biosur/shared';

// --- Mock AuthService ---

function buildMockAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    login: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    validateToken: jest.fn(),
    ...overrides,
  } as unknown as AuthService;
}

function buildAuthResponse(rol: Rol = Rol.ADMINISTRADOR) {
  return {
    accessToken: 'access-token-123',
    refreshToken: 'refresh-token-456',
    user: {
      id: 'user-1',
      email: 'admin@biosur.cl',
      nombre: 'Admin Biosur',
      rol,
    },
  };
}

function createTestApp(authService: AuthService): express.Application {
  const app = express();
  app.use(express.json());
  app.use('/auth', createAuthRouter(authService));
  return app;
}

// --- Tests ---

describe('Auth Routes', () => {
  // =========================================================
  // POST /auth/login
  // =========================================================
  describe('POST /auth/login', () => {
    it('should return 200 with tokens for valid credentials', async () => {
      const authResponse = buildAuthResponse();
      const authService = buildMockAuthService({
        login: jest.fn().mockResolvedValue(authResponse),
      });
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@biosur.cl', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBe('access-token-123');
      expect(res.body.refreshToken).toBe('refresh-token-456');
      expect(res.body.user.email).toBe('admin@biosur.cl');
      expect(authService.login).toHaveBeenCalledWith({
        email: 'admin@biosur.cl',
        password: 'password123',
      });
    });

    it('should return 400 when email is missing', async () => {
      const authService = buildMockAuthService();
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email y contraseña son requeridos');
      expect(authService.login).not.toHaveBeenCalled();
    });

    it('should return 400 when password is missing', async () => {
      const authService = buildMockAuthService();
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@biosur.cl' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Email y contraseña son requeridos');
    });

    it('should return 401 for invalid credentials', async () => {
      const authService = buildMockAuthService({
        login: jest.fn().mockRejectedValue(new AuthError('Credenciales inválidas', 401)),
      });
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@biosur.cl', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Credenciales inválidas');
    });

    it('should include unidadAsignada for Conductor login', async () => {
      const authResponse = {
        ...buildAuthResponse(Rol.CONDUCTOR),
        unidadAsignada: {
          id: 'unidad-1',
          marca: 'Mercedes-Benz',
          modelo: 'Sprinter',
          patente: 'AB-1234',
          anio: 2022,
          estado: 'disponible',
          creadoEn: new Date('2024-01-01'),
        },
      };
      const authService = buildMockAuthService({
        login: jest.fn().mockResolvedValue(authResponse),
      });
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'conductor@biosur.cl', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.unidadAsignada).toBeDefined();
      expect(res.body.unidadAsignada.id).toBe('unidad-1');
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService({
        login: jest.fn().mockRejectedValue(new Error('DB connection lost')),
      });
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@biosur.cl', password: 'password123' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error interno del servidor');
    });
  });

  // =========================================================
  // POST /auth/logout
  // =========================================================
  describe('POST /auth/logout', () => {
    it('should return 200 when authenticated user logs out', async () => {
      const authService = buildMockAuthService({
        validateToken: jest.fn().mockResolvedValue({
          userId: 'user-1',
          rol: Rol.ADMINISTRADOR,
        }),
        logout: jest.fn().mockResolvedValue(undefined),
      });
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Sesión cerrada exitosamente');
      expect(authService.logout).toHaveBeenCalledWith('valid-token');
    });

    it('should return 401 when no token is provided', async () => {
      const authService = buildMockAuthService();
      const app = createTestApp(authService);

      const res = await request(app).post('/auth/logout');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token no proporcionado');
    });

    it('should return 401 for invalid token', async () => {
      const authService = buildMockAuthService({
        validateToken: jest.fn().mockRejectedValue(new AuthError('Token inválido', 401)),
      });
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token inválido');
    });

    it('should work for all roles — Conductor', async () => {
      const authService = buildMockAuthService({
        validateToken: jest.fn().mockResolvedValue({
          userId: 'user-2',
          rol: Rol.CONDUCTOR,
        }),
        logout: jest.fn().mockResolvedValue(undefined),
      });
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer conductor-token');

      expect(res.status).toBe(200);
    });

    it('should work for all roles — Equipo_Mantenimiento', async () => {
      const authService = buildMockAuthService({
        validateToken: jest.fn().mockResolvedValue({
          userId: 'user-3',
          rol: Rol.EQUIPO_MANTENIMIENTO,
        }),
        logout: jest.fn().mockResolvedValue(undefined),
      });
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/logout')
        .set('Authorization', 'Bearer maint-token');

      expect(res.status).toBe(200);
    });
  });

  // =========================================================
  // POST /auth/refresh
  // =========================================================
  describe('POST /auth/refresh', () => {
    it('should return 200 with new tokens for valid refresh token', async () => {
      const authResponse = buildAuthResponse();
      const authService = buildMockAuthService({
        refreshToken: jest.fn().mockResolvedValue(authResponse),
      });
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBe('access-token-123');
      expect(res.body.refreshToken).toBe('refresh-token-456');
      expect(authService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('should return 400 when refreshToken is missing from body', async () => {
      const authService = buildMockAuthService();
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Refresh token es requerido');
      expect(authService.refreshToken).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid refresh token', async () => {
      const authService = buildMockAuthService({
        refreshToken: jest.fn().mockRejectedValue(new AuthError('Token inválido', 401)),
      });
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Token inválido');
    });

    it('should return 401 for expired/blacklisted refresh token', async () => {
      const authService = buildMockAuthService({
        refreshToken: jest.fn().mockRejectedValue(new AuthError('Sesión expirada', 401)),
      });
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'blacklisted-token' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Sesión expirada');
    });

    it('should not require authentication header', async () => {
      const authResponse = buildAuthResponse();
      const authService = buildMockAuthService({
        refreshToken: jest.fn().mockResolvedValue(authResponse),
      });
      const app = createTestApp(authService);

      // No Authorization header — should still work
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    it('should return 500 for unexpected errors', async () => {
      const authService = buildMockAuthService({
        refreshToken: jest.fn().mockRejectedValue(new Error('Redis down')),
      });
      const app = createTestApp(authService);

      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'some-token' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Error interno del servidor');
    });
  });
});
