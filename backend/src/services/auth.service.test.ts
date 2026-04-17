import { AuthService, AuthError } from './auth.service';
import { Rol, EstadoUnidad } from '@biosur/shared';

// --- Mocks ---
const mockQuery = jest.fn();
const mockPool = { query: mockQuery } as any;

const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedis = { get: mockRedisGet, set: mockRedisSet } as any;

const JWT_SECRET = 'test-secret';

// bcrypt mock
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));
import bcrypt from 'bcrypt';
const bcryptCompare = bcrypt.compare as jest.Mock;

// jsonwebtoken — we use the real module for sign/verify consistency
import jwt from 'jsonwebtoken';

// --- Helpers ---
function buildUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'conductor@biosur.cl',
    password_hash: '$2b$10$hashedpassword',
    rol: Rol.CONDUCTOR,
    nombre: 'Juan Pérez',
    activo: true,
    ...overrides,
  };
}

function buildUnidadRow() {
  return {
    id: 'unidad-1',
    marca: 'Mercedes-Benz',
    modelo: 'Sprinter',
    patente: 'AB-1234',
    anio: 2022,
    estado: EstadoUnidad.DISPONIBLE,
    creado_en: new Date('2024-01-01'),
  };
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisGet.mockResolvedValue(null);
    mockRedisSet.mockResolvedValue('OK');
    service = new AuthService(mockPool, mockRedis, JWT_SECRET);
  });

  // =========================================================
  // login
  // =========================================================
  describe('login', () => {
    it('should return tokens and user profile for valid credentials', async () => {
      const user = buildUserRow({ rol: Rol.ADMINISTRADOR });
      mockQuery.mockResolvedValueOnce({ rows: [user] });
      bcryptCompare.mockResolvedValueOnce(true);

      const result = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'conductor@biosur.cl',
        nombre: 'Juan Pérez',
        rol: Rol.ADMINISTRADOR,
      });
      expect(result.unidadAsignada).toBeUndefined();
    });

    it('should include unidadAsignada for Conductor role', async () => {
      const user = buildUserRow({ rol: Rol.CONDUCTOR });
      const unidad = buildUnidadRow();
      mockQuery
        .mockResolvedValueOnce({ rows: [user] })   // user lookup
        .mockResolvedValueOnce({ rows: [unidad] }); // asignacion lookup
      bcryptCompare.mockResolvedValueOnce(true);

      const result = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      expect(result.unidadAsignada).toEqual({
        id: 'unidad-1',
        marca: 'Mercedes-Benz',
        modelo: 'Sprinter',
        patente: 'AB-1234',
        anio: 2022,
        estado: EstadoUnidad.DISPONIBLE,
        creadoEn: new Date('2024-01-01'),
      });

      // Verify the access token contains unidadId
      const decoded = jwt.verify(result.accessToken, JWT_SECRET) as any;
      expect(decoded.unidadId).toBe('unidad-1');
    });

    it('should return no unidadAsignada when Conductor has no assignment today', async () => {
      const user = buildUserRow({ rol: Rol.CONDUCTOR });
      mockQuery
        .mockResolvedValueOnce({ rows: [user] })
        .mockResolvedValueOnce({ rows: [] }); // no assignment
      bcryptCompare.mockResolvedValueOnce(true);

      const result = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      expect(result.unidadAsignada).toBeUndefined();
    });

    it('should throw 401 for non-existent user', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.login({ email: 'nobody@biosur.cl', password: 'x' }),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should throw 401 for inactive user', async () => {
      const user = buildUserRow({ activo: false });
      mockQuery.mockResolvedValueOnce({ rows: [user] });

      await expect(
        service.login({ email: 'conductor@biosur.cl', password: 'x' }),
      ).rejects.toThrow(AuthError);
    });

    it('should throw 401 for wrong password', async () => {
      const user = buildUserRow();
      mockQuery.mockResolvedValueOnce({ rows: [user] });
      bcryptCompare.mockResolvedValueOnce(false);

      await expect(
        service.login({ email: 'conductor@biosur.cl', password: 'wrong' }),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should generate accessToken with 1h expiry', async () => {
      const user = buildUserRow({ rol: Rol.ADMINISTRADOR });
      mockQuery.mockResolvedValueOnce({ rows: [user] });
      bcryptCompare.mockResolvedValueOnce(true);

      const result = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      const decoded = jwt.verify(result.accessToken, JWT_SECRET) as any;
      // exp - iat should be ~3600 seconds
      expect(decoded.exp - decoded.iat).toBe(3600);
    });

    it('should generate refreshToken with 7d expiry', async () => {
      const user = buildUserRow({ rol: Rol.ADMINISTRADOR });
      mockQuery.mockResolvedValueOnce({ rows: [user] });
      bcryptCompare.mockResolvedValueOnce(true);

      const result = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      const decoded = jwt.verify(result.refreshToken, JWT_SECRET) as any;
      expect(decoded.exp - decoded.iat).toBe(7 * 24 * 3600);
      expect(decoded.type).toBe('refresh');
    });
  });

  // =========================================================
  // logout
  // =========================================================
  describe('logout', () => {
    it('should blacklist a valid token in Redis', async () => {
      const user = buildUserRow({ rol: Rol.ADMINISTRADOR });
      mockQuery.mockResolvedValueOnce({ rows: [user] });
      bcryptCompare.mockResolvedValueOnce(true);

      const { accessToken } = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      await service.logout(accessToken);

      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('bl:'),
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('should not throw for an already-expired token', async () => {
      const expiredToken = jwt.sign(
        { userId: 'user-1', rol: Rol.CONDUCTOR },
        JWT_SECRET,
        { expiresIn: '0s' },
      );

      // Wait a tick so the token is expired
      await new Promise((r) => setTimeout(r, 10));
      await expect(service.logout(expiredToken)).resolves.toBeUndefined();
    });
  });

  // =========================================================
  // refreshToken
  // =========================================================
  describe('refreshToken', () => {
    it('should issue new tokens and blacklist old refresh token', async () => {
      // First login to get a refresh token
      const user = buildUserRow({ rol: Rol.ADMINISTRADOR });
      mockQuery.mockResolvedValueOnce({ rows: [user] });
      bcryptCompare.mockResolvedValueOnce(true);
      const loginResult = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      // Now refresh
      mockRedisGet.mockResolvedValueOnce(null); // not blacklisted
      mockQuery.mockResolvedValueOnce({ rows: [user] }); // user lookup

      const result = await service.refreshToken(loginResult.refreshToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.id).toBe('user-1');

      // Old refresh token should be blacklisted
      expect(mockRedisSet).toHaveBeenCalledWith(
        expect.stringContaining('bl:'),
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('should throw 401 for an invalid refresh token', async () => {
      await expect(
        service.refreshToken('invalid-token'),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should throw 401 for a blacklisted refresh token', async () => {
      const user = buildUserRow({ rol: Rol.ADMINISTRADOR });
      mockQuery.mockResolvedValueOnce({ rows: [user] });
      bcryptCompare.mockResolvedValueOnce(true);
      const loginResult = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      mockRedisGet.mockResolvedValueOnce('1'); // blacklisted

      await expect(
        service.refreshToken(loginResult.refreshToken),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should throw 401 when using an access token as refresh token', async () => {
      const user = buildUserRow({ rol: Rol.ADMINISTRADOR });
      mockQuery.mockResolvedValueOnce({ rows: [user] });
      bcryptCompare.mockResolvedValueOnce(true);
      const loginResult = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      mockRedisGet.mockResolvedValueOnce(null);

      await expect(
        service.refreshToken(loginResult.accessToken),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should include unidadAsignada for Conductor on refresh', async () => {
      const user = buildUserRow({ rol: Rol.CONDUCTOR });
      const unidad = buildUnidadRow();
      mockQuery.mockResolvedValueOnce({ rows: [user] });
      mockQuery.mockResolvedValueOnce({ rows: [unidad] });
      bcryptCompare.mockResolvedValueOnce(true);
      const loginResult = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      mockRedisGet.mockResolvedValueOnce(null);
      mockQuery.mockResolvedValueOnce({ rows: [user] });
      mockQuery.mockResolvedValueOnce({ rows: [unidad] });

      const result = await service.refreshToken(loginResult.refreshToken);
      expect(result.unidadAsignada).toBeDefined();
      expect(result.unidadAsignada?.id).toBe('unidad-1');
    });
  });

  // =========================================================
  // validateToken
  // =========================================================
  describe('validateToken', () => {
    it('should return payload for a valid token', async () => {
      const user = buildUserRow({ rol: Rol.ADMINISTRADOR });
      mockQuery.mockResolvedValueOnce({ rows: [user] });
      bcryptCompare.mockResolvedValueOnce(true);
      const { accessToken } = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      mockRedisGet.mockResolvedValueOnce(null);

      const payload = await service.validateToken(accessToken);
      expect(payload.userId).toBe('user-1');
      expect(payload.rol).toBe(Rol.ADMINISTRADOR);
    });

    it('should throw 401 for a blacklisted token', async () => {
      const user = buildUserRow({ rol: Rol.ADMINISTRADOR });
      mockQuery.mockResolvedValueOnce({ rows: [user] });
      bcryptCompare.mockResolvedValueOnce(true);
      const { accessToken } = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      mockRedisGet.mockReset();
      mockRedisGet.mockResolvedValueOnce('1'); // blacklisted

      await expect(
        service.validateToken(accessToken),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should throw 401 for an invalid token', async () => {
      mockRedisGet.mockResolvedValueOnce(null);

      await expect(
        service.validateToken('garbage-token'),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should include unidadId in payload for Conductor tokens', async () => {
      const user = buildUserRow({ rol: Rol.CONDUCTOR });
      const unidad = buildUnidadRow();
      mockQuery
        .mockResolvedValueOnce({ rows: [user] })
        .mockResolvedValueOnce({ rows: [unidad] });
      bcryptCompare.mockResolvedValueOnce(true);

      const { accessToken } = await service.login({
        email: 'conductor@biosur.cl',
        password: 'password123',
      });

      mockRedisGet.mockResolvedValueOnce(null);

      const payload = await service.validateToken(accessToken);
      expect(payload.unidadId).toBe('unidad-1');
    });
  });
});
