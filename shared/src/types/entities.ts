// Entidades del modelo de datos — Sistema de Gestión de Flota Biosur

import {
  Rol,
  EstadoUnidad,
  NivelRiesgo,
  EstadoTicket,
  TipoBloqueo,
  FormatoFoto,
} from './enums';

export interface Usuario {
  id: string;
  email: string;
  passwordHash: string;
  rol: Rol;
  nombre: string;
  activo: boolean;
  creadoEn: Date;
}

export interface Unidad {
  id: string;
  marca: string;
  modelo: string;
  patente: string;
  anio: number;
  estado: EstadoUnidad;
  creadoEn: Date;
}

export interface AsignacionConductor {
  id: string;
  conductorId: string;
  unidadId: string;
  fechaJornada: Date;
  creadoEn: Date;
}

export interface CodigoVerificacion {
  id: number; // 1-39
  nombre: string;
  descripcion: string;
  nivelRiesgo: NivelRiesgo;
}

export interface Inspeccion {
  id: string;
  conductorId: string;
  unidadId: string;
  timestampLocal: Date;
  timestampServidor: Date;
  creadoOffline: boolean;
  creadoEn: Date;
}

export interface DetalleInspeccion {
  id: string;
  inspeccionId: string;
  codigoVerificacionId: number;
  valor: number; // 0 = Óptimo, 1-39 = Falla
}

export interface ReporteFalla {
  id: string;
  inspeccionId: string;
  unidadId: string;
  codigoVerificacionId: number;
  valor: number;
  descripcion: string;
  semaforoRiesgo: NivelRiesgo;
  creadoEn: Date;
}

export interface Fotografia {
  id: string;
  reporteFallaId: string;
  urlStorage: string;
  formato: FormatoFoto;
  tamanoBytes: number;
  creadoEn: Date;
}

export interface Ticket {
  id: string;
  reporteFallaId: string;
  unidadId: string;
  estado: EstadoTicket;
  semaforoRiesgo: NivelRiesgo;
  asignadoA: string | null;
  trabajoRealizado: string | null;
  validacionReparacion: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface HistorialTicket {
  id: string;
  ticketId: string;
  estadoAnterior: EstadoTicket;
  estadoNuevo: EstadoTicket;
  usuarioId: string;
  descripcion: string;
  creadoEn: Date;
}

export interface EventoBloqueo {
  id: string;
  unidadId: string;
  tipo: TipoBloqueo;
  usuarioId: string;
  razon: string;
  creadoEn: Date;
}

export interface LogAuditoria {
  id: string;
  usuarioId: string;
  accion: string;
  recurso: string;
  codigoHttp: number;
  detalles: Record<string, unknown>;
  creadoEn: Date;
}

export interface LogSyncConflicto {
  id: string;
  conductorId: string;
  tipoOperacion: string;
  datosLocales: unknown;
  datosServidor: unknown;
  razon: string;
  resuelto: boolean;
  creadoEn: Date;
}
