import { Pool } from 'pg';
import {
  CrearReporteFallaDTO,
  FotografiaInput,
  ReporteFalla,
  NivelRiesgo,
  FiltroSemaforo,
  FormatoFoto,
} from '@biosur/shared';
import { ValidationError } from './inspeccion.service';
import { SemaforoRiesgoService } from './semaforo-riesgo.service';
import { StorageService } from './storage.service';

const MAX_FOTO_BYTES = 10_485_760; // 10 MB
const FORMATOS_VALIDOS: Set<string> = new Set([FormatoFoto.JPEG, FormatoFoto.PNG]);

export class ReporteFallaService {
  constructor(
    private pool: Pool,
    private semaforoService: SemaforoRiesgoService,
    private storageService: StorageService,
  ) {}

  async crear(data: CrearReporteFallaDTO): Promise<ReporteFalla> {
    this.validarFotografias(data.fotografias);

    const semaforoRiesgo = await this.semaforoService.clasificar(
      data.codigoVerificacionId,
    );

    // Look up unidadId from the inspeccion
    const inspeccionResult = await this.pool.query(
      'SELECT unidad_id FROM inspeccion WHERE id = $1',
      [data.inspeccionId],
    );
    if (inspeccionResult.rows.length === 0) {
      throw new ValidationError('Inspección no encontrada', 422);
    }
    const unidadId = inspeccionResult.rows[0].unidad_id as string;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert reporte_falla
      const reporteResult = await client.query(
        `INSERT INTO reporte_falla (inspeccion_id, unidad_id, codigo_verificacion_id, valor, descripcion, semaforo_riesgo)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, inspeccion_id, unidad_id, codigo_verificacion_id, valor, descripcion, semaforo_riesgo, creado_en`,
        [
          data.inspeccionId,
          unidadId,
          data.codigoVerificacionId,
          data.valor,
          data.descripcion,
          semaforoRiesgo,
        ],
      );

      const reporte = this.mapReporteRow(reporteResult.rows[0]);

      // Upload photos and insert fotografia records
      for (const foto of data.fotografias) {
        const key = `reportes/${reporte.id}/${crypto.randomUUID()}.${foto.formato}`;
        const contentType = foto.formato === FormatoFoto.JPEG ? 'image/jpeg' : 'image/png';
        const urlStorage = await this.storageService.upload(key, foto.archivo, contentType);

        await client.query(
          `INSERT INTO fotografia (reporte_falla_id, url_storage, formato, tamano_bytes)
           VALUES ($1, $2, $3, $4)`,
          [reporte.id, urlStorage, foto.formato, foto.tamanoBytes],
        );
      }

      // Create ticket for critico/preventivo
      if (
        semaforoRiesgo === NivelRiesgo.CRITICO ||
        semaforoRiesgo === NivelRiesgo.PREVENTIVO
      ) {
        await client.query(
          `INSERT INTO ticket (reporte_falla_id, unidad_id, estado, semaforo_riesgo)
           VALUES ($1, $2, 'abierto', $3)`,
          [reporte.id, unidadId, semaforoRiesgo],
        );
      }

      await client.query('COMMIT');
      return reporte;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async obtenerPorUnidad(
    unidadId: string,
    filtros?: FiltroSemaforo,
  ): Promise<ReporteFalla[]> {
    const conditions: string[] = ['unidad_id = $1'];
    const params: unknown[] = [unidadId];
    let paramIdx = 2;

    if (filtros?.semaforo) {
      conditions.push(`semaforo_riesgo = $${paramIdx}`);
      params.push(filtros.semaforo);
      paramIdx++;
    }

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

    const result = await this.pool.query(
      `SELECT id, inspeccion_id, unidad_id, codigo_verificacion_id, valor, descripcion, semaforo_riesgo, creado_en
       FROM reporte_falla
       WHERE ${conditions.join(' AND ')}
       ORDER BY creado_en DESC`,
      params,
    );

    return result.rows.map(this.mapReporteRow);
  }

  async obtenerPorSemaforo(nivel: NivelRiesgo): Promise<ReporteFalla[]> {
    const result = await this.pool.query(
      `SELECT id, inspeccion_id, unidad_id, codigo_verificacion_id, valor, descripcion, semaforo_riesgo, creado_en
       FROM reporte_falla
       WHERE semaforo_riesgo = $1
       ORDER BY creado_en DESC`,
      [nivel],
    );

    return result.rows.map(this.mapReporteRow);
  }

  // --- Private helpers ---

  private validarFotografias(fotografias: FotografiaInput[]): void {
    if (!fotografias || fotografias.length === 0) {
      throw new ValidationError('Se requiere al menos una fotografía', 422);
    }

    for (const foto of fotografias) {
      if (!FORMATOS_VALIDOS.has(foto.formato)) {
        throw new ValidationError(
          'Formato no soportado. Use JPEG o PNG',
          422,
        );
      }

      if (foto.tamanoBytes > MAX_FOTO_BYTES) {
        throw new ValidationError(
          'La imagen excede el tamaño máximo de 10 MB',
          413,
        );
      }
    }
  }

  private mapReporteRow(row: Record<string, unknown>): ReporteFalla {
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
}
