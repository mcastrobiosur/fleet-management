import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import Redis from 'ioredis';
import {
  LoginRequest,
  AuthResponse,
  TokenPayload,
  Rol,
  Unidad,
} from '@biosur/shared';

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';
const ACCESS_TOKEN_EXPIRY_SECONDS = 3600;
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 3600;
const BLACKLIST_PREFIX = 'bl:';

export class AuthService {
  constructor(
    private pool: Pool,
    private redis: Redis,
    private jwtSecret: string = process.env.JWT_SECRET || 'biosur-secret-key',
  ) {}

  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const { email, password } = credentials;

    const userResult = await this.pool.query(
      'SELECT id, email, password_hash, rol, nombre, activo FROM usuario WHERE email = $1',
      [email],
    );

    if (userResult.rows.length === 0) {
      throw new AuthError('Credenciales inválidas', 401);
    }

    const user = userResult.rows[0];

    if (!user.activo) {
      throw new AuthError('Credenciales inválidas', 401);
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      throw new AuthError('Credenciales inválidas', 401);
    }

    const payload: TokenPayload = {
      userId: user.id,
      rol: user.rol as Rol,
    };

    // For Conductor role, look up assigned unit for today
    let unidadAsignada: Unidad | undefined;
    if (user.rol === Rol.CONDUCTOR) {
      const asignacionResult = await this.pool.query(
        `SELECT u.id, u.marca, u.modelo, u.patente, u.anio, u.estado, u.creado_en
         FROM asignacion_conductor ac
         JOIN unidad u ON u.id = ac.unidad_id
         WHERE ac.conductor_id = $1 AND ac.fecha_jornada = CURRENT_DATE
         LIMIT 1`,
        [user.id],
      );

      if (asignacionResult.rows.length > 0) {
        const row = asignacionResult.rows[0];
        unidadAsignada = {
          id: row.id,
          marca: row.marca,
          modelo: row.modelo,
          patente: row.patente,
          anio: row.anio,
          estado: row.estado,
          creadoEn: row.creado_en,
        };
        payload.unidadId = row.id;
      }
    }

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: REFRESH_TOKEN_EXPIRY },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol as Rol,
      },
      ...(unidadAsignada ? { unidadAsignada } : {}),
    };
  }

  async logout(token: string): Promise<void> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as jwt.JwtPayload;
      const ttl = decoded.exp
        ? decoded.exp - Math.floor(Date.now() / 1000)
        : ACCESS_TOKEN_EXPIRY_SECONDS;

      if (ttl > 0) {
        await this.redis.set(
          `${BLACKLIST_PREFIX}${token}`,
          '1',
          'EX',
          ttl,
        );
      }
    } catch {
      // Token already invalid/expired — nothing to blacklist
    }
  }

  async refreshToken(refreshTokenStr: string): Promise<AuthResponse> {
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(refreshTokenStr, this.jwtSecret) as jwt.JwtPayload;
    } catch {
      throw new AuthError('Token inválido', 401);
    }

    if (decoded.type !== 'refresh') {
      throw new AuthError('Token inválido', 401);
    }

    // Check if refresh token is blacklisted
    const isBlacklisted = await this.redis.get(
      `${BLACKLIST_PREFIX}${refreshTokenStr}`,
    );
    if (isBlacklisted) {
      throw new AuthError('Sesión expirada', 401);
    }

    const userResult = await this.pool.query(
      'SELECT id, email, password_hash, rol, nombre, activo FROM usuario WHERE id = $1',
      [decoded.userId],
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].activo) {
      throw new AuthError('Token inválido', 401);
    }

    const user = userResult.rows[0];

    // Blacklist the old refresh token
    const oldTtl = decoded.exp
      ? decoded.exp - Math.floor(Date.now() / 1000)
      : REFRESH_TOKEN_EXPIRY_SECONDS;
    if (oldTtl > 0) {
      await this.redis.set(
        `${BLACKLIST_PREFIX}${refreshTokenStr}`,
        '1',
        'EX',
        oldTtl,
      );
    }

    const payload: TokenPayload = {
      userId: user.id,
      rol: user.rol as Rol,
    };

    let unidadAsignada: Unidad | undefined;
    if (user.rol === Rol.CONDUCTOR) {
      const asignacionResult = await this.pool.query(
        `SELECT u.id, u.marca, u.modelo, u.patente, u.anio, u.estado, u.creado_en
         FROM asignacion_conductor ac
         JOIN unidad u ON u.id = ac.unidad_id
         WHERE ac.conductor_id = $1 AND ac.fecha_jornada = CURRENT_DATE
         LIMIT 1`,
        [user.id],
      );

      if (asignacionResult.rows.length > 0) {
        const row = asignacionResult.rows[0];
        unidadAsignada = {
          id: row.id,
          marca: row.marca,
          modelo: row.modelo,
          patente: row.patente,
          anio: row.anio,
          estado: row.estado,
          creadoEn: row.creado_en,
        };
        payload.unidadId = row.id;
      }
    }

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const newRefreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: REFRESH_TOKEN_EXPIRY },
    );

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol as Rol,
      },
      ...(unidadAsignada ? { unidadAsignada } : {}),
    };
  }

  async validateToken(token: string): Promise<TokenPayload> {
    // Check blacklist first
    const isBlacklisted = await this.redis.get(`${BLACKLIST_PREFIX}${token}`);
    if (isBlacklisted) {
      throw new AuthError('Token inválido', 401);
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as TokenPayload & jwt.JwtPayload;
      return {
        userId: decoded.userId,
        rol: decoded.rol,
        ...(decoded.unidadId ? { unidadId: decoded.unidadId } : {}),
      };
    } catch {
      throw new AuthError('Token inválido', 401);
    }
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
