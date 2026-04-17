import { Pool } from 'pg';
import {
  Unidad,
  Inspeccion,
  ReporteFalla,
  Ticket,
  EventoBloqueo,
  HojaVida,
  EventoHojaVida,
  FiltroHojaVida,
  EstadoUnidad,
  NivelRiesgo,
  EstadoTicket,
  TipoBloqueo,
} from '@biosur/shared';
import { ValidationError } from './inspeccion.service';

export class HojaVidaService {
  constructor(private pool: Pool) {}

  async obtener(unidadId: string, filtros?: FiltroHojaVida): Promise<HojaVida> {
    // Fetch unit master data
    const unidadResult = await this.pool.query(
      `SELECT id, marca, modelo, patente, anio, estado, creado_en
       FROM unidad WHERE id = $1`,
      [unidadId],
    );

    if (unidadResult.rows.length === 0) {
      throw new ValidationError('Unidad no encontrada', 404);
    }

    const unidad = this.mapUnidadRow(unidadResult.rows[0]);

    // Fetch all related data in parallel with filters applied
    const [inspecciones, reportesFalla, tickets, eventosBloqueDesbloqueo] =
      await Promise.all([
        this.obtenerInspecciones(unidadId, filtros),
        this.obtenerReportesFalla(unidadId, filtros),
        this.obtenerTickets(unidadId, filtros),
        this.obtenerEventosBloqueo(unidadId, filtros),
      ]);

    return {
      unidad,
      inspecciones,
      reportesFalla,
      tickets,
      eventosBloqueDesbloqueo,
    };
  }

  async registrarEvento(unidadId: string, evento: EventoHojaVida): Promise<void> {
    // Verify the unit exists
    const unidadResult = await this.pool.query(
      `SELECT id FROM unidad WHERE id = $1`,
      [unidadId],
    );

    if (unidadResult.rows.length === 0) {
      throw new ValidationError('Unidad no encontrada', 404);
    }

    await this.pool.query(
      `INSERT INTO log_auditoria (usuario_id, accion, recurso, codigo_http, detalles)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'system',
        `hoja_vida:${evento.tipo}`,
        `unidad:${unidadId}`,
        200,
        JSON.stringify({
          tipo: evento.tipo,
          referenciaId: evento.referenciaId,
          descripcion: evento.descripcion,
        }),
      ],
    );
  }

  // --- Private query methods ---

  private async obtenerInspecciones(
    unidadId: string,
    filtros?: FiltroHojaVida,
  ): Promise<(Inspeccion & {
    conductorNombre: string;
    totalOptimos: number;
    totalCriticos: number;
    totalPreventivos: number;
    totalInformativos: number;
  })[]> {
    const conditions: string[] = ['i.unidad_id = $1'];
    const params: unknown[] = [unidadId];
    let paramIdx = 2;

    if (filtros?.fechaDesde) {
      conditions.push(`i.creado_en >= $${paramIdx}`);
      params.push(filtros.fechaDesde);
      paramIdx++;
    }
    if (filtros?.fechaHasta) {
      conditions.push(`i.creado_en <= $${paramIdx}`);
      params.push(filtros.fechaHasta);
      paramIdx++;
    }

    const result = await this.pool.query(
      `SELECT i.id, i.conductor_id, i.unidad_id, i.timestamp_local,
              i.timestamp_servidor, i.creado_offline, i.creado_en,
              u.nombre AS conductor_nombre,
              COUNT(di.id) FILTER (WHERE di.valor = 0)::int                                          AS total_optimos,
              COUNT(di.id) FILTER (WHERE di.valor > 0 AND cv.nivel_riesgo = 'critico')::int          AS total_criticos,
              COUNT(di.id) FILTER (WHERE di.valor > 0 AND cv.nivel_riesgo = 'preventivo')::int       AS total_preventivos,
              COUNT(di.id) FILTER (WHERE di.valor > 0 AND cv.nivel_riesgo = 'informativo')::int      AS total_informativos
       FROM inspeccion i
       LEFT JOIN usuario u ON u.id = i.conductor_id
       LEFT JOIN detalle_inspeccion di ON di.inspeccion_id = i.id
       LEFT JOIN codigo_verificacion cv ON cv.id = di.codigo_verificacion_id
       WHERE ${conditions.join(' AND ')}
       GROUP BY i.id, u.nombre
       ORDER BY i.creado_en DESC`,
      params,
    );

    return result.rows.map((row) => ({
      ...this.mapInspeccionRow(row),
      conductorNombre: (row.conductor_nombre as string) ?? 'Desconocido',
      totalOptimos: (row.total_optimos as number) ?? 0,
      totalCriticos: (row.total_criticos as number) ?? 0,
      totalPreventivos: (row.total_preventivos as number) ?? 0,
      totalInformativos: (row.total_informativos as number) ?? 0,
    }));
  }

  private async obtenerReportesFalla(
    unidadId: string,
    filtros?: FiltroHojaVida,
  ): Promise<ReporteFalla[]> {
    const conditions: string[] = ['unidad_id = $1'];
    const params: unknown[] = [unidadId];
    let paramIdx = 2;

    if (filtros?.fechaDesde) {
      conditions.push(`creado_en >= $${paramIdx}`);
      params.push(filtros.fechaDesde);
      paramIdx++;
    }

    if (filtros?.fechaHasta) {
      conditions.push(`creado_en <= $${paramIdx}`);
      params.push(filtros.fechaHasta);
      paramIdx++;
    }

    if (filtros?.tipoFalla !== undefined) {
      conditions.push(`codigo_verificacion_id = $${paramIdx}`);
      params.push(filtros.tipoFalla);
      paramIdx++;
    }

    const result = await this.pool.query(
      `SELECT id, inspeccion_id, unidad_id, codigo_verificacion_id, valor,
              descripcion, semaforo_riesgo, creado_en
       FROM reporte_falla
       WHERE ${conditions.join(' AND ')}
       ORDER BY creado_en DESC`,
      params,
    );

    return result.rows.map(this.mapReporteFallaRow);
  }

  private async obtenerTickets(
    unidadId: string,
    filtros?: FiltroHojaVida,
  ): Promise<Ticket[]> {
    const conditions: string[] = ['unidad_id = $1'];
    const params: unknown[] = [unidadId];
    let paramIdx = 2;

    if (filtros?.fechaDesde) {
      conditions.push(`creado_en >= $${paramIdx}`);
      params.push(filtros.fechaDesde);
      paramIdx++;
    }

    if (filtros?.fechaHasta) {
      conditions.push(`creado_en <= $${paramIdx}`);
      params.push(filtros.fechaHasta);
      paramIdx++;
    }

    if (filtros?.estadoTicket) {
      conditions.push(`estado = $${paramIdx}`);
      params.push(filtros.estadoTicket);
      paramIdx++;
    }

    const result = await this.pool.query(
      `SELECT id, reporte_falla_id, unidad_id, estado, semaforo_riesgo,
              asignado_a, trabajo_realizado, validacion_reparacion,
              creado_en, actualizado_en
       FROM ticket
       WHERE ${conditions.join(' AND ')}
       ORDER BY creado_en DESC`,
      params,
    );

    return result.rows.map(this.mapTicketRow);
  }

  private async obtenerEventosBloqueo(
    unidadId: string,
    filtros?: FiltroHojaVida,
  ): Promise<EventoBloqueo[]> {
    const { whereClause, params } = this.buildWhereClause(
      'unidad_id',
      unidadId,
      filtros,
    );

    const result = await this.pool.query(
      `SELECT id, unidad_id, tipo, usuario_id, razon, creado_en
       FROM evento_bloqueo
       ${whereClause}
       ORDER BY creado_en DESC`,
      params,
    );

    return result.rows.map(this.mapEventoBloqueoRow);
  }

  // --- Filter builder ---

  private buildWhereClause(
    idColumn: string,
    idValue: string,
    filtros?: FiltroHojaVida,
  ): { whereClause: string; params: unknown[] } {
    const conditions: string[] = [`${idColumn} = $1`];
    const params: unknown[] = [idValue];
    let paramIdx = 2;

    if (filtros?.fechaDesde) {
      conditions.push(`creado_en >= $${paramIdx}`);
      params.push(filtros.fechaDesde);
      paramIdx++;
    }

    if (filtros?.fechaHasta) {
      conditions.push(`creado_en <= $${paramIdx}`);
      params.push(filtros.fechaHasta);
      paramIdx++;
    }

    return {
      whereClause: `WHERE ${conditions.join(' AND ')}`,
      params,
    };
  }

  // --- Row mappers ---

  private mapUnidadRow(row: Record<string, unknown>): Unidad {
    return {
      id: row.id as string,
      marca: row.marca as string,
      modelo: row.modelo as string,
      patente: row.patente as string,
      anio: row.anio as number,
      estado: row.estado as EstadoUnidad,
      creadoEn: row.creado_en as Date,
    };
  }

  private mapInspeccionRow(row: Record<string, unknown>): Inspeccion {
    return {
      id: row.id as string,
      conductorId: row.conductor_id as string,
      unidadId: row.unidad_id as string,
      timestampLocal: row.timestamp_local as Date,
      timestampServidor: row.timestamp_servidor as Date,
      creadoOffline: row.creado_offline as boolean,
      creadoEn: row.creado_en as Date,
    };
  }

  private mapReporteFallaRow(row: Record<string, unknown>): ReporteFalla {
    return {
      id: row.id as string,
      inspeccionId: row.inspeccion_id as string,
      unidadId: row.unidad_id as string,
      codigoVerificacionId: row.codigo_verificacion_id as number,
      valor: row.valor as number,
      descripcion: row.descripcion as string,
      semaforoRiesgo: row.semaforo_riesgo as NivelRiesgo,
      creadoEn: row.creado_en as Date,
    };
  }

  private mapTicketRow(row: Record<string, unknown>): Ticket {
    return {
      id: row.id as string,
      reporteFallaId: row.reporte_falla_id as string,
      unidadId: row.unidad_id as string,
      estado: row.estado as EstadoTicket,
      semaforoRiesgo: row.semaforo_riesgo as NivelRiesgo,
      asignadoA: (row.asignado_a as string) ?? null,
      trabajoRealizado: (row.trabajo_realizado as string) ?? null,
      validacionReparacion: (row.validacion_reparacion as string) ?? null,
      creadoEn: row.creado_en as Date,
      actualizadoEn: row.actualizado_en as Date,
    };
  }

  private mapEventoBloqueoRow(row: Record<string, unknown>): EventoBloqueo {
    return {
      id: row.id as string,
      unidadId: row.unidad_id as string,
      tipo: row.tipo as TipoBloqueo,
      usuarioId: row.usuario_id as string,
      razon: row.razon as string,
      creadoEn: row.creado_en as Date,
    };
  }
}
