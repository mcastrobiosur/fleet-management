// DTOs — Data Transfer Objects para el sistema de gestión de flota Biosur

import { FormatoFoto } from './enums';

export interface CodigoVerificacionEntry {
  codigoId: number;  // 1-39
  valor: number;     // 0 = Óptimo, 1-39 = Falla
}

export interface CrearInspeccionDTO {
  conductorId: string;
  unidadId: string;
  codigos: CodigoVerificacionEntry[]; // Exactamente 39 entradas
  creadoOffline: boolean;
  timestampLocal: Date;
}

export interface FotografiaInput {
  archivo: Buffer;
  formato: FormatoFoto;
  tamanoBytes: number; // Máximo 10 MB (10_485_760 bytes)
}

export interface CrearReporteFallaDTO {
  inspeccionId: string;
  codigoVerificacionId: number;
  valor: number; // 1-39
  descripcion: string;
  fotografias: FotografiaInput[]; // Mínimo 1
}

export interface CierreTicketDTO {
  trabajoRealizado: string;
  validacionReparacion: string;
  userId: string;
}

export type EventoTicket = 'creado' | 'asignado' | 'cerrado';
