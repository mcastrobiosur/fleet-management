import { Pool } from 'pg';
import { FiltroPeriodo, IndicadoresFlota, EstadoUnidad } from '@biosur/shared';

export class BIService {
  constructor(private pool: Pool) {}

  async calcularIndicadores(filtros: FiltroPeriodo): Promise<IndicadoresFlota> {
    const [porcentaje, tiempoPromedio, frecuencia] = await Promise.all([
      this.calcularPorcentajeOperativas(),
      this.calcularTiempoPromedioReparacion(filtros),
      this.calcularFrecuenciaFallas(filtros),
    ]);

    return {
      porcentajeUnidadesOperativas: porcentaje,
      tiempoPromedioReparacion: tiempoPromedio,
      frecuenciaFallasPorUnidad: frecuencia,
      periodo: filtros,
    };
  }

  async exportarCSV(filtros: FiltroPeriodo): Promise<Buffer> {
    const indicadores = await this.calcularIndicadores(filtros);

    const lines: string[] = [];

    // Header section
    lines.push('Indicador,Valor');
    lines.push(
      `Porcentaje Unidades Operativas,${indicadores.porcentajeUnidadesOperativas}`,
    );
    lines.push(
      `Tiempo Promedio Reparacion (horas),${indicadores.tiempoPromedioReparacion}`,
    );
    lines.push(
      `Periodo Desde,${indicadores.periodo.desde.toISOString()}`,
    );
    lines.push(
      `Periodo Hasta,${indicadores.periodo.hasta.toISOString()}`,
    );

    // Frequency section
    lines.push('');
    lines.push('Unidad ID,Frecuencia Fallas');
    const entries = Object.entries(indicadores.frecuenciaFallasPorUnidad);
    for (const [unidadId, count] of entries) {
      lines.push(`${unidadId},${count}`);
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  // --- Private calculation methods ---

  private async calcularPorcentajeOperativas(): Promise<number> {
    const result = await this.pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE estado = $1) AS operativas,
         COUNT(*) AS total
       FROM unidad`,
      [EstadoUnidad.OPERATIVA],
    );

    const { operativas, total } = result.rows[0];
    const totalNum = Number(total);
    if (totalNum === 0) return 0;

    return (Number(operativas) / totalNum) * 100;
  }

  private async calcularTiempoPromedioReparacion(
    filtros: FiltroPeriodo,
  ): Promise<number> {
    const result = await this.pool.query(
      `SELECT
         AVG(EXTRACT(EPOCH FROM (actualizado_en - creado_en)) / 3600) AS promedio_horas
       FROM ticket
       WHERE estado = 'cerrado'
         AND creado_en >= $1
         AND creado_en <= $2`,
      [filtros.desde, filtros.hasta],
    );

    const promedio = result.rows[0].promedio_horas;
    return promedio !== null ? Number(promedio) : 0;
  }

  private async calcularFrecuenciaFallas(
    filtros: FiltroPeriodo,
  ): Promise<Record<string, number>> {
    const result = await this.pool.query(
      `SELECT unidad_id, COUNT(*) AS cantidad
       FROM reporte_falla
       WHERE creado_en >= $1
         AND creado_en <= $2
       GROUP BY unidad_id`,
      [filtros.desde, filtros.hasta],
    );

    const frecuencia: Record<string, number> = {};
    for (const row of result.rows) {
      frecuencia[row.unidad_id as string] = Number(row.cantidad);
    }
    return frecuencia;
  }
}
