// Tipos de autenticación — Sistema de Gestión de Flota Biosur

import { Rol } from './enums';
import { Unidad } from './entities';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserProfile {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
}

export interface AuthResponse {
  accessToken: string;       // JWT, expira en 1h
  refreshToken: string;      // Expira en 7d
  user: UserProfile;
  unidadAsignada?: Unidad;   // Solo para rol Conductor
}

export interface TokenPayload {
  userId: string;
  rol: Rol;
  unidadId?: string;
}
