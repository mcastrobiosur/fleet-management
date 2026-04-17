import { Pool } from 'pg';
import {
  Ticket,
  CierreTicketDTO,
  NivelRiesgo,
  EstadoTicket,
} from '@biosur/shared';
import { ValidationError } from './inspeccion.service';

export class TransitionError extends Error {
  public estadoActual: string;
  public estadoSolicitado: string;

  constructor(estadoActual: string, estadoSolicitado: string) {
    super('Transición no permitida');
    this.name = 'TransitionError';
    this.estadoActual = estadoActual;
    this.estadoSolicitado = estadoSolicitado;
  }
}

export class TicketService {
  constructor(private pool: Pool) {}

  async crear(reporteFallaId: string): Promise<Ticket | null> {
    // Look up the reporte_falla to get unidadId and semaforoRiesgo
    const reporteResult = await this.pool.query(
      'SELECT unidad_id, semaforo_riesgo FROM reporte_falla WHERE id = $1',
      [reporteFallaId],
    );

    if (reporteResult.rows.length === 0) {
      throw new ValidationError('Reporte de falla no encontrado', 422);
    }

    const { unidad_id: unidadId, semaforo_riesgo: semaforoRiesgo } =
      reporteResult.rows[0];

    // Only create tickets for Crítico or Preventivo
    if (semaforoRiesgo === NivelRiesgo.INFORMATIVO) {
      return null;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const ticketResult = await client.query(
        `INSERT INTO ticket (reporte_falla_id, unidad_id, estado, semaforo_riesgo)
         VALUES ($1, $2, $3, $4)
         RETURNING id, reporte_falla_id, unidad_id, estado, semaforo_riesgo,
                   asignado_a, trabajo_realizado, validacion_reparacion,
                   creado_en, actualizado_en`,
        [reporteFallaId, unidadId, EstadoTicket.ABIERTO, semaforoRiesgo],
      );

      const ticket = this.mapTicketRow(ticketResult.rows[0]);

      // Record creation in historial_ticket
      await client.query(
        `INSERT INTO historial_ticket (ticket_id, estado_anterior, estado_nuevo, usuario_id, descripcion)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticket.id,
          EstadoTicket.ABIERTO,
          EstadoTicket.ABIERTO,
          'system',
          `Ticket creado automáticamente para reporte de falla ${reporteFallaId}`,
        ],
      );

      await client.query('COMMIT');
      return ticket;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async asignar(
    ticketId: string,
    equipoMantenimientoId: string,
  ): Promise<Ticket> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the ticket row for update
      const currentResult = await client.query(
        `SELECT id, estado FROM ticket WHERE id = $1 FOR UPDATE`,
        [ticketId],
      );

      if (currentResult.rows.length === 0) {
        throw new ValidationError('Ticket no encontrado', 422);
      }

      const estadoActual = currentResult.rows[0].estado as EstadoTicket;

      if (estadoActual !== EstadoTicket.ABIERTO) {
        throw new TransitionError(estadoActual, EstadoTicket.EN_PROGRESO);
      }

      const updateResult = await client.query(
        `UPDATE ticket
         SET estado = $1, asignado_a = $2, actualizado_en = NOW()
         WHERE id = $3
         RETURNING id, reporte_falla_id, unidad_id, estado, semaforo_riesgo,
                   asignado_a, trabajo_realizado, validacion_reparacion,
                   creado_en, actualizado_en`,
        [EstadoTicket.EN_PROGRESO, equipoMantenimientoId, ticketId],
      );

      const ticket = this.mapTicketRow(updateResult.rows[0]);

      // Record transition in historial_ticket
      await client.query(
        `INSERT INTO historial_ticket (ticket_id, estado_anterior, estado_nuevo, usuario_id, descripcion)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          EstadoTicket.ABIERTO,
          EstadoTicket.EN_PROGRESO,
          equipoMantenimientoId,
          `Ticket asignado a ${equipoMantenimientoId}`,
        ],
      );

      await client.query('COMMIT');
      return ticket;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async cerrar(ticketId: string, cierre: CierreTicketDTO): Promise<Ticket> {
    // Validate trabajoRealizado is not empty
    if (!cierre.trabajoRealizado || cierre.trabajoRealizado.trim() === '') {
      throw new ValidationError(
        'Debe registrar el trabajo realizado antes de cerrar',
        422,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const currentResult = await client.query(
        `SELECT id, estado FROM ticket WHERE id = $1 FOR UPDATE`,
        [ticketId],
      );

      if (currentResult.rows.length === 0) {
        throw new ValidationError('Ticket no encontrado', 422);
      }

      const estadoActual = currentResult.rows[0].estado as EstadoTicket;

      if (estadoActual !== EstadoTicket.EN_PROGRESO) {
        throw new TransitionError(estadoActual, EstadoTicket.CERRADO);
      }

      const updateResult = await client.query(
        `UPDATE ticket
         SET estado = $1, trabajo_realizado = $2, validacion_reparacion = $3, actualizado_en = NOW()
         WHERE id = $4
         RETURNING id, reporte_falla_id, unidad_id, estado, semaforo_riesgo,
                   asignado_a, trabajo_realizado, validacion_reparacion,
                   creado_en, actualizado_en`,
        [
          EstadoTicket.CERRADO,
          cierre.trabajoRealizado,
          cierre.validacionReparacion,
          ticketId,
        ],
      );

      const ticket = this.mapTicketRow(updateResult.rows[0]);

      // Record transition in historial_ticket
      await client.query(
        `INSERT INTO historial_ticket (ticket_id, estado_anterior, estado_nuevo, usuario_id, descripcion)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ticketId,
          EstadoTicket.EN_PROGRESO,
          EstadoTicket.CERRADO,
          cierre.userId,
          cierre.trabajoRealizado,
        ],
      );

      await client.query('COMMIT');
      return ticket;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async obtenerTodos(): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(
      `SELECT t.id, t.reporte_falla_id, t.unidad_id, t.estado, t.semaforo_riesgo,
              t.asignado_a, t.trabajo_realizado, t.validacion_reparacion,
              t.creado_en, t.actualizado_en,
              u.patente AS unidad_patente,
              usr.nombre AS asignado_nombre
       FROM ticket t
       JOIN unidad u ON u.id = t.unidad_id
       LEFT JOIN usuario usr ON usr.id = t.asignado_a
       ORDER BY t.creado_en DESC`,
    );
    return result.rows.map(this.mapTicketRowExtended);
  }

  async obtenerPorUnidad(unidadId: string): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(
      `SELECT t.id, t.reporte_falla_id, t.unidad_id, t.estado, t.semaforo_riesgo,
              t.asignado_a, t.trabajo_realizado, t.validacion_reparacion,
              t.creado_en, t.actualizado_en,
              u.patente AS unidad_patente,
              usr.nombre AS asignado_nombre
       FROM ticket t
       JOIN unidad u ON u.id = t.unidad_id
       LEFT JOIN usuario usr ON usr.id = t.asignado_a
       WHERE t.unidad_id = $1
       ORDER BY t.creado_en DESC`,
      [unidadId],
    );
    return result.rows.map(this.mapTicketRowExtended);
  }

  async obtenerPorAsignado(userId: string): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(
      `SELECT t.id, t.reporte_falla_id, t.unidad_id, t.estado, t.semaforo_riesgo,
              t.asignado_a, t.trabajo_realizado, t.validacion_reparacion,
              t.creado_en, t.actualizado_en,
              u.patente AS unidad_patente,
              usr.nombre AS asignado_nombre
       FROM ticket t
       JOIN unidad u ON u.id = t.unidad_id
       LEFT JOIN usuario usr ON usr.id = t.asignado_a
       WHERE t.asignado_a = $1
       ORDER BY t.creado_en DESC`,
      [userId],
    );
    return result.rows.map(this.mapTicketRowExtended);
  }

  // --- Private helpers ---

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

  private mapTicketRowExtended(row: Record<string, unknown>): Record<string, unknown> {
    return {
      id: row.id,
      reporteFallaId: row.reporte_falla_id,
      unidadId: row.unidad_id,
      unidadPatente: row.unidad_patente,
      estado: row.estado,
      semaforoRiesgo: row.semaforo_riesgo,
      asignadoA: row.asignado_a ?? null,
      asignadoNombre: row.asignado_nombre ?? null,
      trabajoRealizado: row.trabajo_realizado ?? null,
      creadoEn: row.creado_en,
      actualizadoEn: row.actualizado_en,
    };
  }
}
