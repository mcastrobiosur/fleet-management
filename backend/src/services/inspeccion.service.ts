import { Pool, PoolClient } from 'pg';
import {
  CrearInspeccionDTO,
  Inspeccion,
  DetalleInspeccion,
  FiltroFecha,
} from '@biosur/shared';

const TOTAL_CODIGOS = 39;
const VALOR_MIN = 0;
const VALOR_MAX = 39;

export class ValidationError extends Error {
  public camposPendientes?: number[];

  constructor(
    message: string,
    public statusCode: number = 422,
    camposPendientes?: number[],
  ) {
    super(message);
    this.name = 'ValidationError';
    this.camposPendientes = camposPendientes;
  }
}

export class InspeccionService {
  constructor(private pool: Pool) {}

  async crear(data: CrearInspeccionDTO): Promise<Inspeccion> {
    this.validarCodigos(data);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const inspeccionResult = await client.query(
        `INSERT INTO inspeccion (conductor_id, unidad_id, timestamp_local, creado_offline)
         VALUES ($1, $2, $3, $4)
         RETURNING id, conductor_id, unidad_id, timestamp_local, timestamp_servidor, creado_offline, creado_en`,
        [data.conductorId, data.unidadId, data.timestampLocal, data.creadoOffline],
      );

      const inspeccion = this.mapInspeccionRow(inspeccionResult.rows[0]);

      await this.insertarDetalles(client, inspeccion.id, data.codigos);

      await client.query('COMMIT');
      return inspeccion;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async obtenerPorUnidad(
    unidadId: string,
    filtros?: FiltroFecha,
  ): Promise<Inspeccion[]> {
    const { whereClause, params } = this.buildFiltroQuery(
      'unidad_id',
      unidadId,
      filtros,
    );

    const result = await this.pool.query(
      `SELECT id, conductor_id, unidad_id, timestamp_local, timestamp_servidor, creado_offline, creado_en
       FROM inspeccion
       ${whereClause}
       ORDER BY creado_en DESC`,
      params,
    );

    return result.rows.map(this.mapInspeccionRow);
  }

  async obtenerPorConductor(
    conductorId: string,
    filtros?: FiltroFecha,
  ): Promise<Inspeccion[]> {
    const { whereClause, params } = this.buildFiltroQuery(
      'conductor_id',
      conductorId,
      filtros,
    );

    const result = await this.pool.query(
      `SELECT id, conductor_id, unidad_id, timestamp_local, timestamp_servidor, creado_offline, creado_en
       FROM inspeccion
       ${whereClause}
       ORDER BY creado_en DESC`,
      params,
    );

    return result.rows.map(this.mapInspeccionRow);
  }

  async obtenerDetalle(
    inspeccionId: string,
  ): Promise<{ inspeccion: Inspeccion; detalles: DetalleInspeccion[] } | null> {
    const inspeccionResult = await this.pool.query(
      `SELECT id, conductor_id, unidad_id, timestamp_local, timestamp_servidor, creado_offline, creado_en
       FROM inspeccion WHERE id = $1`,
      [inspeccionId],
    );

    if (inspeccionResult.rows.length === 0) return null;

    const detallesResult = await this.pool.query(
      `SELECT di.id, di.inspeccion_id, di.codigo_verificacion_id, di.valor,
              cv.nombre AS codigo_nombre, cv.nivel_riesgo,
              rf.id AS reporte_falla_id,
              t.id AS ticket_id
       FROM detalle_inspeccion di
       JOIN codigo_verificacion cv ON cv.id = di.codigo_verificacion_id
       LEFT JOIN reporte_falla rf
              ON rf.inspeccion_id = di.inspeccion_id
             AND rf.codigo_verificacion_id = di.codigo_verificacion_id
       LEFT JOIN ticket t ON t.reporte_falla_id = rf.id
       WHERE di.inspeccion_id = $1
       ORDER BY di.codigo_verificacion_id ASC`,
      [inspeccionId],
    );

    return {
      inspeccion: this.mapInspeccionRow(inspeccionResult.rows[0]),
      detalles: detallesResult.rows.map((row) => ({
        id: row.id as string,
        inspeccionId: row.inspeccion_id as string,
        codigoVerificacionId: row.codigo_verificacion_id as number,
        valor: row.valor as number,
        codigoNombre: row.codigo_nombre as string,
        nivelRiesgo: row.nivel_riesgo as string,
        ticketId: (row.ticket_id as string) ?? null,
      })),
    };
  }

  async crearTicketDesdeDetalle(
    inspeccionId: string,
    codigoVerificacionId: number,
    descripcion: string,
  ): Promise<{ ticketId: string; estado: string; semaforoRiesgo: string } | { error: string; status: number; ticketId?: string }> {
    const inspeccionResult = await this.pool.query(
      'SELECT unidad_id FROM inspeccion WHERE id = $1',
      [inspeccionId],
    );
    if (inspeccionResult.rows.length === 0) {
      return { error: 'Inspección no encontrada', status: 404 };
    }
    const unidadId = inspeccionResult.rows[0].unidad_id as string;

    const codigoResult = await this.pool.query(
      'SELECT nivel_riesgo FROM codigo_verificacion WHERE id = $1',
      [codigoVerificacionId],
    );
    if (codigoResult.rows.length === 0) {
      return { error: 'Código de verificación no encontrado', status: 400 };
    }
    const nivelRiesgo = codigoResult.rows[0].nivel_riesgo as string;

    if (nivelRiesgo !== 'critico' && nivelRiesgo !== 'preventivo') {
      return { error: 'Solo se pueden crear tickets para fallas críticas o preventivas', status: 422 };
    }

    const dupResult = await this.pool.query(
      `SELECT t.id FROM ticket t
       JOIN reporte_falla rf ON rf.id = t.reporte_falla_id
       WHERE rf.inspeccion_id = $1 AND rf.codigo_verificacion_id = $2`,
      [inspeccionId, codigoVerificacionId],
    );
    if (dupResult.rows.length > 0) {
      return { error: 'Ya existe un ticket para este código', status: 409, ticketId: dupResult.rows[0].id as string };
    }

    const detalleResult = await this.pool.query(
      'SELECT valor FROM detalle_inspeccion WHERE inspeccion_id = $1 AND codigo_verificacion_id = $2',
      [inspeccionId, codigoVerificacionId],
    );
    const valor = (detalleResult.rows[0]?.valor as number) ?? codigoVerificacionId;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const reporteResult = await client.query(
        `INSERT INTO reporte_falla (inspeccion_id, unidad_id, codigo_verificacion_id, valor, descripcion, semaforo_riesgo)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [inspeccionId, unidadId, codigoVerificacionId, valor, descripcion || '', nivelRiesgo],
      );
      const ticketResult = await client.query(
        `INSERT INTO ticket (reporte_falla_id, unidad_id, estado, semaforo_riesgo)
         VALUES ($1, $2, 'abierto', $3) RETURNING id, estado, semaforo_riesgo`,
        [reporteResult.rows[0].id, unidadId, nivelRiesgo],
      );
      await client.query('COMMIT');
      return {
        ticketId: ticketResult.rows[0].id as string,
        estado: ticketResult.rows[0].estado as string,
        semaforoRiesgo: ticketResult.rows[0].semaforo_riesgo as string,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --- Private helpers ---

  private validarCodigos(data: CrearInspeccionDTO): void {
    const { codigos } = data;

    if (!codigos || codigos.length !== TOTAL_CODIGOS) {
      const codigosPresentes = new Set((codigos || []).map((c) => c.codigoId));
      const pendientes: number[] = [];
      for (let i = 1; i <= TOTAL_CODIGOS; i++) {
        if (!codigosPresentes.has(i)) {
          pendientes.push(i);
        }
      }
      throw new ValidationError(
        'Inspección incompleta',
        422,
        pendientes.length > 0 ? pendientes : undefined,
      );
    }

    // Check for duplicate codigoIds
    const ids = codigos.map((c) => c.codigoId);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== TOTAL_CODIGOS) {
      throw new ValidationError('Inspección incompleta', 422);
    }

    // Validate each code
    for (const codigo of codigos) {
      if (codigo.codigoId < 1 || codigo.codigoId > TOTAL_CODIGOS) {
        throw new ValidationError(
          `Código de verificación inválido: ${codigo.codigoId}`,
          422,
        );
      }
      if (codigo.valor < VALOR_MIN || codigo.valor > VALOR_MAX) {
        throw new ValidationError(
          `Valor inválido`,
          422,
        );
      }
    }
  }

  private async insertarDetalles(
    client: PoolClient,
    inspeccionId: string,
    codigos: CrearInspeccionDTO['codigos'],
  ): Promise<void> {
    const values: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    for (const codigo of codigos) {
      values.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2})`);
      params.push(inspeccionId, codigo.codigoId, codigo.valor);
      paramIdx += 3;
    }

    await client.query(
      `INSERT INTO detalle_inspeccion (inspeccion_id, codigo_verificacion_id, valor)
       VALUES ${values.join(', ')}`,
      params,
    );
  }

  private buildFiltroQuery(
    idColumn: string,
    idValue: string,
    filtros?: FiltroFecha,
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
}
