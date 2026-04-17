/**
 * BI — Módulo de Business Intelligence y exportación CSV.
 *
 * Indicadores: porcentaje de unidades operativas, tiempo promedio de reparación,
 * frecuencia de fallas por unidad.
 * Selector de período, exportación CSV, gráficos con estilo editorial Biosur.
 *
 * Requerimientos: 9.4, 9.5
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, EcoMetricChip } from '../components';
import { apiFetch } from '../api/client';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FrecuenciaFalla {
  unidadId: string;
  patente: string;
  totalFallas: number;
}

interface IndicadoresBI {
  porcentajeUnidadesOperativas: number;
  tiempoPromedioReparacion: number; // horas
  frecuenciaFallasPorUnidad: FrecuenciaFalla[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Default date range: last 30 days */
function defaultDesde(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function defaultHasta(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatHoras(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toFixed(1)} h`;
}

/* ------------------------------------------------------------------ */
/*  CSV download helper                                                */
/* ------------------------------------------------------------------ */

async function downloadCSV(desde: string, hasta: string): Promise<void> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/dashboard/bi/exportar?desde=${desde}&hasta=${hasta}`, {
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? 'Error al exportar CSV');
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `biosur-bi-${desde}-a-${hasta}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Bar chart (pure CSS/SVG)                                           */
/* ------------------------------------------------------------------ */

function FallasBarChart({ data }: { data: FrecuenciaFalla[] }) {
  const maxFallas = useMemo(
    () => Math.max(1, ...data.map((d) => d.totalFallas)),
    [data],
  );

  if (data.length === 0) {
    return (
      <p className="text-on-surface-variant text-sm py-8 text-center">
        Sin datos de fallas para el período seleccionado.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item, i) => {
        const pct = (item.totalFallas / maxFallas) * 100;
        return (
          <motion.div
            key={item.unidadId}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className="flex items-center gap-3"
          >
            {/* Label */}
            <span className="font-label text-xs font-bold tracking-wide uppercase text-on-surface-variant w-24 shrink-0 truncate">
              {item.patente}
            </span>

            {/* Bar */}
            <div className="flex-1 h-7 bg-surface-container-highest rounded-lg overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: i * 0.04 + 0.15, duration: 0.5, ease: 'easeOut' }}
                className="h-full rounded-lg bg-primary/80"
              />
            </div>

            {/* Value */}
            <span className="font-headline text-sm font-bold text-on-surface w-10 text-right tabular-nums">
              {item.totalFallas}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI Card                                                           */
/* ------------------------------------------------------------------ */

function KPICard({
  icon,
  label,
  value,
  unit,
  accent = 'primary',
}: {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  accent?: 'primary' | 'secondary' | 'error';
}) {
  const accentMap = {
    primary: 'text-primary bg-primary/10',
    secondary: 'text-secondary bg-secondary/10',
    error: 'text-error bg-error/10',
  };
  const [iconColor, iconBg] = accentMap[accent].split(' ');

  return (
    <Card className="p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          className={`material-symbols-outlined text-xl p-2 rounded-lg ${iconBg} ${iconColor}`}
        >
          {icon}
        </span>
        <span className="font-label text-xs font-bold tracking-wide uppercase text-on-surface-variant">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
          {value}
        </span>
        {unit && (
          <span className="font-label text-xs font-bold text-on-surface-variant tracking-wide">
            {unit}
          </span>
        )}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function BI() {
  const [desde, setDesde] = useState(defaultDesde);
  const [hasta, setHasta] = useState(defaultHasta);
  const [data, setData] = useState<IndicadoresBI | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  /* ---- Fetch indicators ---- */
  const fetchIndicadores = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiFetch<IndicadoresBI>(
        `/dashboard/bi?desde=${desde}&hasta=${hasta}`,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar indicadores');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    fetchIndicadores();
  }, [fetchIndicadores]);

  /* ---- Export CSV ---- */
  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCSV(desde, hasta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al exportar CSV');
    } finally {
      setExporting(false);
    }
  };

  /* ---- Sorted fallas for chart ---- */
  const sortedFallas = useMemo((): FrecuenciaFalla[] => {
    if (!data) return [];
    const freq = data.frecuenciaFallasPorUnidad;
    // Backend returns Record<string, number>, convert to array
    if (Array.isArray(freq)) return freq.sort((a, b) => b.totalFallas - a.totalFallas);
    return Object.entries(freq)
      .map(([unidadId, totalFallas]) => ({
        unidadId,
        patente: unidadId,
        totalFallas: Number(totalFallas),
      }))
      .sort((a, b) => b.totalFallas - a.totalFallas);
  }, [data]);

  /* ---- Loading state ---- */
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-on-surface-variant font-headline">Cargando indicadores…</p>
      </div>
    );
  }

  /* ---- Error state (no data) ---- */
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <span className="material-symbols-outlined text-5xl text-error/40 mb-4">error</span>
        <p className="text-on-surface-variant font-medium mb-4">{error}</p>
        <Button variant="tertiary" onClick={fetchIndicadores}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-brand-dark mb-1">
            Indicadores BI
          </h2>
          <p className="text-on-surface-variant text-sm">
            Métricas de rendimiento de flota para el período seleccionado.
          </p>
        </div>

        <EcoMetricChip icon="analytics">Business Intelligence</EcoMetricChip>
      </div>

      {/* ── Period selector + Export ── */}
      <Card className="p-5 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 flex-wrap">
          {/* Desde */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="bi-desde"
              className="font-label text-xs font-bold tracking-wide uppercase text-on-surface-variant"
            >
              Desde
            </label>
            <input
              id="bi-desde"
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="bg-surface-container-highest text-on-surface rounded-lg px-3 py-2 text-sm font-body border-b-2 border-transparent focus:border-primary outline-none transition-colors"
            />
          </div>

          {/* Hasta */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="bi-hasta"
              className="font-label text-xs font-bold tracking-wide uppercase text-on-surface-variant"
            >
              Hasta
            </label>
            <input
              id="bi-hasta"
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="bg-surface-container-highest text-on-surface rounded-lg px-3 py-2 text-sm font-body border-b-2 border-transparent focus:border-primary outline-none transition-colors"
            />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Export CSV */}
          <Button
            variant="secondary"
            icon="download"
            iconPosition="left"
            onClick={handleExport}
            disabled={exporting || !data}
          >
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </Button>
        </div>
      </Card>

      {/* ── Inline error banner ── */}
      <AnimatePresence>
        {error && data && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-error/10 text-error rounded-xl px-5 py-3 mb-6 text-sm font-medium"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {data && (
        <>
          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <KPICard
              icon="directions_bus"
              label="Unidades operativas"
              value={`${data.porcentajeUnidadesOperativas.toFixed(1)}%`}
              accent="secondary"
            />
            <KPICard
              icon="schedule"
              label="Tiempo prom. reparación"
              value={formatHoras(data.tiempoPromedioReparacion)}
              accent="primary"
            />
            <KPICard
              icon="report_problem"
              label="Total fallas registradas"
              value={String(
                sortedFallas.reduce(
                  (sum, f) => sum + f.totalFallas,
                  0,
                ),
              )}
              accent="error"
            />
          </div>

          {/* ── Fallas por unidad chart ── */}
          <Card className="p-6">
            <h3 className="font-headline text-lg font-bold text-on-surface mb-1">
              Frecuencia de fallas por unidad
            </h3>
            <p className="text-on-surface-variant text-xs mb-5">
              Ordenado de mayor a menor cantidad de fallas en el período.
            </p>
            <FallasBarChart data={sortedFallas} />
          </Card>
        </>
      )}
    </div>
  );
}
