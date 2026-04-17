import { Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from './rbac.middleware';
import { AuthService, AuthError } from '../services/auth.service';
import { Rol, TokenPayload } from '@biosur/shared';

// --- Helpers ---

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    method: 'GET',
    path: '/test',
    user: undefined,
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function mockNext(): NextFunction {
  return jest.fn();
}

function buildAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    validateToken: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    ...overrides,
  } as unknown as AuthService;
}

// --- authenticate ---

describe('authenticate middleware', () => {
  it('should return 401 when no Authorization header is present', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();
    const authSvc = buildAuthService();

    await authenticate(authSvc)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token no proporcionado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header does not start with Bearer', async () => {
    const req = mockReq({ headers: { authorization: 'Basic abc123' } });
    const res = mockRes();
    const next = mockNext();
    const authSvc = buildAuthService();

    await authenticate(authSvc)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should attach user to req and call next for a valid token', async () => {
    const payload: TokenPayload = { userId: 'user-1', rol: Rol.ADMINISTRADOR };
    const authSvc = buildAuthService({
      validateToken: jest.fn().mockResolvedValue(payload),
    });
    const req = mockReq({ headers: { authorization: 'Bearer valid-token' } });
    const res = mockRes();
    const next = mockNext();

    await authenticate(authSvc)(req, res, next);

    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return AuthError status code when validateToken throws AuthError', async () => {
    const authSvc = buildAuthService({
      validateToken: jest.fn().mockRejectedValue(new AuthError('Token inválido', 401)),
    });
    const req = mockReq({ headers: { authorization: 'Bearer bad-token' } });
    const res = mockRes();
    const next = mockNext();

    await authenticate(authSvc)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for unexpected errors during token validation', async () => {
    const authSvc = buildAuthService({
      validateToken: jest.fn().mockRejectedValue(new Error('unexpected')),
    });
    const req = mockReq({ headers: { authorization: 'Bearer some-token' } });
    const res = mockRes();
    const next = mockNext();

    await authenticate(authSvc)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should include unidadId in req.user for Conductor tokens', async () => {
    const payload: TokenPayload = {
      userId: 'user-2',
      rol: Rol.CONDUCTOR,
      unidadId: 'unidad-5',
    };
    const authSvc = buildAuthService({
      validateToken: jest.fn().mockResolvedValue(payload),
    });
    const req = mockReq({ headers: { authorization: 'Bearer conductor-token' } });
    const res = mockRes();
    const next = mockNext();

    await authenticate(authSvc)(req, res, next);

    expect(req.user).toEqual(payload);
    expect(req.user?.unidadId).toBe('unidad-5');
  });
});

// --- authorize ---

describe('authorize middleware', () => {
  const mockPoolQuery = jest.fn();
  const mockPool = { query: mockPoolQuery } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolQuery.mockResolvedValue({ rows: [] });
  });

  it('should return 401 when req.user is not set', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await authorize([Rol.ADMINISTRADOR], mockPool)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No autenticado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next when user role is in allowed roles', async () => {
    const req = mockReq();
    req.user = { userId: 'user-1', rol: Rol.ADMINISTRADOR };
    const res = mockRes();
    const next = mockNext();

    await authorize([Rol.ADMINISTRADOR, Rol.CONDUCTOR], mockPool)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('should return 403 when user role is not in allowed roles', async () => {
    const req = mockReq({ method: 'POST', path: '/tickets/assign' });
    req.user = { userId: 'user-3', rol: Rol.CONDUCTOR };
    const res = mockRes();
    const next = mockNext();

    await authorize([Rol.ADMINISTRADOR], mockPool)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acceso no autorizado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should log unauthorized access to log_auditoria', async () => {
    const req = mockReq({ method: 'DELETE', path: '/unidades/123' });
    req.user = { userId: 'user-5', rol: Rol.EQUIPO_MANTENIMIENTO };
    const res = mockRes();
    const next = mockNext();

    await authorize([Rol.ADMINISTRADOR], mockPool)(req, res, next);

    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    const [query, params] = mockPoolQuery.mock.calls[0];
    expect(query).toContain('INSERT INTO log_auditoria');
    expect(params[0]).toBe('user-5'); // usuario_id
    expect(params[1]).toBe('acceso_no_autorizado'); // accion
    expect(params[2]).toBe('DELETE /unidades/123'); // recurso
    expect(params[3]).toBe(403); // codigo_http
    // detalles should contain the role info
    const detalles = JSON.parse(params[4]);
    expect(detalles.rol).toBe(Rol.EQUIPO_MANTENIMIENTO);
    expect(detalles.rolesPermitidos).toEqual([Rol.ADMINISTRADOR]);
  });

  it('should still return 403 even if audit logging fails', async () => {
    mockPoolQuery.mockRejectedValueOnce(new Error('DB connection lost'));
    const req = mockReq({ method: 'GET', path: '/dashboard/bi' });
    req.user = { userId: 'user-7', rol: Rol.CONDUCTOR };
    const res = mockRes();
    const next = mockNext();

    await authorize([Rol.ADMINISTRADOR], mockPool)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acceso no autorizado' });
  });

  it('should allow Conductor access to Conductor-only endpoints', async () => {
    const req = mockReq({ method: 'POST', path: '/inspecciones' });
    req.user = { userId: 'user-10', rol: Rol.CONDUCTOR };
    const res = mockRes();
    const next = mockNext();

    await authorize([Rol.CONDUCTOR], mockPool)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should allow Equipo_Mantenimiento access to maintenance endpoints', async () => {
    const req = mockReq({ method: 'POST', path: '/tickets/123/cerrar' });
    req.user = { userId: 'user-11', rol: Rol.EQUIPO_MANTENIMIENTO };
    const res = mockRes();
    const next = mockNext();

    await authorize([Rol.EQUIPO_MANTENIMIENTO], mockPool)(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should deny Administrador access to Conductor-only endpoints', async () => {
    const req = mockReq({ method: 'POST', path: '/inspecciones' });
    req.user = { userId: 'user-12', rol: Rol.ADMINISTRADOR };
    const res = mockRes();
    const next = mockNext();

    await authorize([Rol.CONDUCTOR], mockPool)(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockPoolQuery).toHaveBeenCalledTimes(1);
  });

  it('should support multiple allowed roles', async () => {
    const req = mockReq({ method: 'POST', path: '/auth/logout' });
    req.user = { userId: 'user-13', rol: Rol.EQUIPO_MANTENIMIENTO };
    const res = mockRes();
    const next = mockNext();

    await authorize(
      [Rol.CONDUCTOR, Rol.ADMINISTRADOR, Rol.EQUIPO_MANTENIMIENTO],
      mockPool,
    )(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
