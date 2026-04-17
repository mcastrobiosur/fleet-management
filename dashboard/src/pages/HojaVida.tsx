import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, StatusBadge } from '../components';
import { apiFetch } from '../api/client';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type NivelRiesgo = 'critico' | 'preventivo' | 'informativo';
type EstadoTicket = 'abierto' | 'en_progreso' | 'cerrado';
type EstadoUnidad = 'disponible' | 'bloqueada' | 'en_mantenimiento' | 'operativa';

interface UnidadMaestra {
  id: string;
  marca: string;
  modelo: string;
  patente: string;
  anio: number;
  estado: EstadoUnidad;
}

interface InspeccionHV {
  id: string;
  conductorNombre: string;
  timestampLocal: string;
  creadoEn: string;
  totalOptimos: number;
  totalCriticos: number;
  totalPreventivos: number;
  totalInformativos: number;
}

interface ReporteFallaHV {
  id: string;
  codigoVerificacionId: number;
  codigoVerificacionNombre: string;
  descripcion: string;
  semaforoRiesgo: NivelRiesgo;
  creadoEn: string;
}

interface TicketHV {
  id: string;
  estado: EstadoTicket;
  semaforoRiesgo: NivelRiesgo;
  asignadoNombre: string | null;
  trabajoRealizado: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

interface EventoBloqueoHV {
  id: string;
  tipo: 'bloqueo' | 'desbloqueo';
  usuarioNombre: string;
  razon: string;
  creadoEn: string;
}

interface HojaVidaData {
  unidad: UnidadMaestra;
  inspecciones: InspeccionHV[];
  reportesFalla: ReporteFallaHV[];
  tickets: TicketHV[];
  eventosBloqueDesbloqueo: EventoBloqueoHV[];
}

/** Unified timeline entry for chronological display */
interface TimelineEntry {
  id: string;
  tipo: 'inspeccion' | 'reporte_falla' | 'ticket' | 'evento_bloqueo';
  fecha: string;
  data: InspeccionHV | ReporteFallaHV | TicketHV | EventoBloqueoHV;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatFechaHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function estadoUnidadBadge(estado: EstadoUnidad): {
  status: 'due-now' | 'compliant' | 'pending';
  label: string;
} {
  switch (estado) {
    case 'bloqueada':
      return { status: 'due-now', label: 'Bloqueada' };
    case 'en_mantenimiento':
      return { status: 'pending', label: 'Mantenimiento' };
    case 'operativa':
      return { status: 'compliant', label: 'Operativa' };
    case 'disponible':
    default:
      return { status: 'compliant', label: 'Disponible' };
  }
}

function semaforoBadge(nivel: NivelRiesgo): {
  status: 'due-now' | 'compliant' | 'pending';
  label: string;
} {
  switch (nivel) {
    case 'critico':
      return { status: 'due-now', label: 'Crítico' };
    case 'preventivo':
      return { status: 'pending', label: 'Preventivo' };
    case 'informativo':
      return { status: 'compliant', label: 'Informativo' };
  }
}

function estadoTicketLabel(estado: EstadoTicket): string {
  switch (estado) {
    case 'abierto':
      return 'Abierto';
    case 'en_progreso':
      return 'En Progreso';
    case 'cerrado':
      return 'Cerrado';
  }
}

function estadoTicketColor(estado: EstadoTicket): { bg: string; text: string } {
  switch (estado) {
    case 'abierto':
      return { bg: 'bg-error/10', text: 'text-error' };
    case 'en_progreso':
      return { bg: 'bg-primary/10', text: 'text-primary' };
    case 'cerrado':
      return { bg: 'bg-secondary/10', text: 'text-secondary' };
  }
}

function timelineIcon(tipo: TimelineEntry['tipo']): { icon: string; bg: string; text: string } {
  switch (tipo) {
    case 'inspeccion':
      return { icon: 'checklist', bg: 'bg-secondary/10', text: 'text-secondary' };
    case 'reporte_falla':
      return { icon: 'report_problem', bg: 'bg-primary/10', text: 'text-primary' };
    case 'ticket':
      return { icon: 'confirmation_number', bg: 'bg-brand-dark/10', text: 'text-brand-dark' };
    case 'evento_bloqueo':
      return { icon: 'lock', bg: 'bg-error/10', text: 'text-error' };
  }
}

function timelineLabel(tipo: TimelineEntry['tipo']): string {
  switch (tipo) {
    case 'inspeccion':
      return 'Inspección';
    case 'reporte_falla':
      return 'Reporte de Falla';
    case 'ticket':
      return 'Ticket';
    case 'evento_bloqueo':
      return 'Evento de Bloqueo';
  }
}

/** Build a unified timeline from all data sources, sorted most recent first */
function buildTimeline(data: HojaVidaData): TimelineEntry[] {
  const entries: TimelineEntry[] = [];

  for (const insp of data.inspecciones) {
    entries.push({
      id: `insp-${insp.id}`,
      tipo: 'inspeccion',
      fecha: insp.creadoEn,
      data: insp,
    });
  }

  for (const rf of data.reportesFalla) {
    entries.push({
      id: `rf-${rf.id}`,
      tipo: 'reporte_falla',
      fecha: rf.creadoEn,
      data: rf,
    });
  }

  for (const t of data.tickets) {
    entries.push({
      id: `ticket-${t.id}`,
      tipo: 'ticket',
      fecha: t.creadoEn,
      data: t,
    });
  }

  for (const ev of data.eventosBloqueDesbloqueo) {
    entries.push({
      id: `ev-${ev.id}`,
      tipo: 'evento_bloqueo',
      fecha: ev.creadoEn,
      data: ev,
    });
  }

  // Sort chronologically: most recent first (Req 8.2)
  entries.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return entries;
}


/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HojaVida() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<HojaVidaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [filtroTipoFalla, setFiltroTipoFalla] = useState('');
  const [filtroEstadoTicket, setFiltroEstadoTicket] = useState<EstadoTicket | ''>('');

  /* ---- Fetch hoja de vida ---- */
  const fetchHojaVida = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const params: string[] = [];
      if (fechaDesde) params.push(`fechaDesde=${fechaDesde}`);
      if (fechaHasta) params.push(`fechaHasta=${fechaHasta}`);
      if (filtroTipoFalla) params.push(`tipoFalla=${filtroTipoFalla}`);
      if (filtroEstadoTicket) params.push(`estadoTicket=${filtroEstadoTicket}`);

      const query = params.length > 0 ? `?${params.join('&')}` : '';
      const result = await apiFetch<HojaVidaData>(`/unidades/${id}/hoja-vida${query}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la hoja de vida');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, fechaDesde, fechaHasta, filtroTipoFalla, filtroEstadoTicket]);

  useEffect(() => {
    fetchHojaVida();
  }, [fetchHojaVida]);

  /* ---- Build unified timeline ---- */
  const timeline = useMemo(() => {
    if (!data) return [];
    return buildTimeline(data);
  }, [data]);

  /* ---- Unique fault types for filter dropdown ---- */
  const tiposFalla = useMemo(() => {
    if (!data) return [];
    const unique = new Map<number, string>();
    for (const rf of data.reportesFalla) {
      unique.set(rf.codigoVerificacionId, rf.codigoVerificacionNombre || `Código ${rf.codigoVerificacionId}`);
    }
    return Array.from(unique.entries()).sort((a, b) => a[0] - b[0]);
  }, [data]);

  /* ---- Summary counts ---- */
  const counts = useMemo(() => {
    if (!data) return { inspecciones: 0, reportes: 0, tickets: 0, bloqueos: 0 };
    return {
      inspecciones: data.inspecciones.length,
      reportes: data.reportesFalla.length,
      tickets: data.tickets.length,
      bloqueos: data.eventosBloqueDesbloqueo.length,
    };
  }, [data]);

  /* ---- Loading state ---- */
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-on-surface-variant font-headline">Cargando hoja de vida…</p>
      </div>
    );
  }

  /* ---- Error state ---- */
  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <span className="material-symbols-outlined text-5xl text-error/40 mb-4">error</span>
        <p className="text-on-surface-variant font-medium mb-4">{error}</p>
        <Link
          to="/"
          className="text-primary font-bold hover:underline underline-offset-4 font-headline text-sm"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const unidad = data.unidad;
  const badge = estadoUnidadBadge(unidad.estado);

  return (
    <div>
      {/* ── Breadcrumb ── */}
      <nav className="mb-6" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-xs text-on-surface-variant">
          <li>
            <Link to="/" className="hover:text-primary transition-colors">
              Fleet Overview
            </Link>
          </li>
          <li>
            <span className="material-symbols-outlined text-xs">chevron_right</span>
          </li>
          <li className="text-on-surface font-bold">
            Hoja de Vida — {unidad.patente}
          </li>
        </ol>
      </nav>

      {/* ── Hero Section: Editorial Asymmetric Layout ── */}
      {/* Left: large headline. Right: unit master data. */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Left — Headline (asymmetric: takes 5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span className="font-label text-[10px] font-bold text-primary tracking-[0.2em] uppercase block mb-3">
              Hoja de Vida
            </span>
            <h1 className="font-headline text-5xl lg:text-6xl font-black tracking-tighter text-brand-dark leading-none mb-4">
              {unidad.marca}
              <br />
              {unidad.modelo}
            </h1>
            <div className="flex items-center gap-3 mt-4">
              <StatusBadge status={badge.status} label={badge.label} />
            </div>
          </motion.div>
        </div>

        {/* Right — Master data card (takes 7 cols) */}
        <div className="lg:col-span-7">
          <Card flat className="p-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
                <MasterDataField label="Patente" value={unidad.patente} icon="badge" />
                <MasterDataField label="Marca" value={unidad.marca} icon="directions_car" />
                <MasterDataField label="Modelo" value={unidad.modelo} icon="local_shipping" />
                <MasterDataField label="Año" value={String(unidad.anio)} icon="calendar_today" />
              </div>

              {/* Summary chips */}
              <div className="flex flex-wrap gap-3 mt-8 pt-6">
                <SummaryChip icon="checklist" label="Inspecciones" count={counts.inspecciones} color="secondary" />
                <SummaryChip icon="report_problem" label="Reportes" count={counts.reportes} color="primary" />
                <SummaryChip icon="confirmation_number" label="Tickets" count={counts.tickets} color="brand-dark" />
                <SummaryChip icon="lock" label="Bloqueos" count={counts.bloqueos} color="error" />
              </div>
            </motion.div>
          </Card>
        </div>
      </section>

      {/* ── Filters Section ── */}
      <section className="mb-8">
        <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
          {/* Date range: desde */}
          <FilterDateInput
            id="filter-fecha-desde"
            label="Desde"
            value={fechaDesde}
            onChange={setFechaDesde}
          />

          {/* Date range: hasta */}
          <FilterDateInput
            id="filter-fecha-hasta"
            label="Hasta"
            value={fechaHasta}
            onChange={setFechaHasta}
          />

          {/* Tipo de falla */}
          <FilterSelect
            id="filter-tipo-falla"
            label="Tipo de Falla"
            value={filtroTipoFalla}
            onChange={setFiltroTipoFalla}
            options={[
              { value: '', label: 'Todas' },
              ...tiposFalla.map(([code, name]) => ({
                value: String(code),
                label: name,
              })),
            ]}
          />

          {/* Estado de ticket */}
          <FilterSelect
            id="filter-estado-ticket"
            label="Estado Ticket"
            value={filtroEstadoTicket}
            onChange={(v) => setFiltroEstadoTicket(v as EstadoTicket | '')}
            options={[
              { value: '', label: 'Todos' },
              { value: 'abierto', label: 'Abierto' },
              { value: 'en_progreso', label: 'En Progreso' },
              { value: 'cerrado', label: 'Cerrado' },
            ]}
          />
        </div>
      </section>

      {/* ── Timeline ── */}
      <section>
        <h2 className="font-headline text-xl font-bold text-brand-dark mb-6">
          Historial Cronológico
        </h2>

        {timeline.length === 0 ? (
          <Card flat className="p-12 flex flex-col items-center justify-center text-center">
            <span className="material-symbols-outlined text-5xl text-outline/30 mb-4">
              history
            </span>
            <p className="text-on-surface-variant font-medium">
              No se encontraron registros con los filtros seleccionados.
            </p>
          </Card>
        ) : (
          <div className="space-y-1">
            <AnimatePresence>
              {timeline.map((entry, i) => (
                <TimelineItem key={entry.id} entry={entry} index={i} isLast={i === timeline.length - 1} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Master data field with icon, label, and value */
function MasterDataField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center">
        <span className="material-symbols-outlined text-on-surface-variant text-sm">
          {icon}
        </span>
      </div>
      <span className="font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      <span className="text-lg font-bold text-on-surface font-headline">
        {value}
      </span>
    </div>
  );
}

/** Summary chip for counts */
function SummaryChip({
  icon,
  label,
  count,
  color,
}: {
  icon: string;
  label: string;
  count: number;
  color: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-${color}/10 text-${color} font-label text-xs font-bold tracking-wide`}>
      <span className="material-symbols-outlined text-sm">{icon}</span>
      {count} {label}
    </span>
  );
}

/** Reusable filter select following the design system input style */
function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="font-label text-xs uppercase tracking-wider text-on-surface-variant font-bold"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none w-full sm:w-52 bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-lg py-3 pl-4 pr-10 text-on-surface font-body transition-all duration-200"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <span className="material-symbols-outlined text-outline text-sm">
            expand_more
          </span>
        </div>
      </div>
    </div>
  );
}

/** Date input filter following the design system */
function FilterDateInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="font-label text-xs uppercase tracking-wider text-on-surface-variant font-bold"
      >
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full sm:w-48 bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-lg py-3 px-4 text-on-surface font-body transition-all duration-200"
      />
    </div>
  );
}

/** Single timeline entry with vertical connector */
function TimelineItem({
  entry,
  index,
  isLast,
}: {
  entry: TimelineEntry;
  index: number;
  isLast: boolean;
}) {
  const iconConfig = timelineIcon(entry.tipo);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, delay: index * 0.03 }}
      className="flex gap-4"
    >
      {/* Timeline connector */}
      <div className="flex flex-col items-center w-10 flex-shrink-0">
        <div
          className={`w-10 h-10 rounded-lg ${iconConfig.bg} flex items-center justify-center flex-shrink-0`}
        >
          <span className={`material-symbols-outlined text-sm ${iconConfig.text}`}>
            {iconConfig.icon}
          </span>
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-surface-container-highest min-h-[16px]" />
        )}
      </div>

      {/* Content card */}
      <div className="flex-1 pb-6 min-w-0">
        <div className="rounded-xl bg-surface-container-low p-5 border border-outline/5 transition-all duration-300 hover:bg-surface-container-high">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              {timelineLabel(entry.tipo)}
            </span>
            <span className="text-[10px] text-outline">
              {formatFechaHora(entry.fecha)}
            </span>
          </div>

          {/* Type-specific content */}
          {entry.tipo === 'inspeccion' && (
            <InspeccionContent data={entry.data as InspeccionHV} />
          )}
          {entry.tipo === 'reporte_falla' && (
            <ReporteFallaContent data={entry.data as ReporteFallaHV} />
          )}
          {entry.tipo === 'ticket' && (
            <TicketContent data={entry.data as TicketHV} />
          )}
          {entry.tipo === 'evento_bloqueo' && (
            <EventoBloqueoContent data={entry.data as EventoBloqueoHV} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface DetalleInspeccion {
  id: string;
  codigoVerificacionId: number;
  valor: number;
  codigoNombre: string;
  nivelRiesgo: string;
  ticketId: string | null;
}

/** Inspection timeline content with expandable detail */
function InspeccionContent({ data }: { data: InspeccionHV }) {
  const [expanded, setExpanded] = useState(false);
  const [detalles, setDetalles] = useState<DetalleInspeccion[] | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState<number | null>(null);

  const toggleDetalle = async () => {
    if (!expanded && !detalles) {
      setLoadingDetalle(true);
      try {
        const result = await apiFetch<{ detalles: DetalleInspeccion[] }>(`/inspecciones/${data.id}`);
        setDetalles(result.detalles);
      } catch {
        setDetalles([]);
      } finally {
        setLoadingDetalle(false);
      }
    }
    setExpanded((v) => !v);
  };

  const handleCrearTicket = async (codigoVerificacionId: number) => {
    setCreatingTicket(codigoVerificacionId);
    try {
      const result = await apiFetch<{ ticketId: string; estado: string; semaforoRiesgo: string }>(
        `/inspecciones/${data.id}/tickets`,
        { method: 'POST', body: JSON.stringify({ codigoVerificacionId }) },
      );
      setDetalles((prev) =>
        prev
          ? prev.map((d) =>
              d.codigoVerificacionId === codigoVerificacionId
                ? { ...d, ticketId: result.ticketId }
                : d,
            )
          : prev,
      );
    } catch {
      // ticket creation failed silently — button stays visible
    } finally {
      setCreatingTicket(null);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-bold text-on-surface">
            Inspección realizada por{' '}
            <span className="text-primary">{data.conductorNombre || '—'}</span>
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-on-surface-variant flex-wrap">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">schedule</span>
              {formatFecha(data.timestampLocal || data.creadoEn)}
            </span>
            {data.totalOptimos > 0 && (
              <span className="flex items-center gap-1 text-secondary">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                {data.totalOptimos} óptimo{data.totalOptimos !== 1 ? 's' : ''}
              </span>
            )}
            {data.totalCriticos > 0 && (
              <span className="flex items-center gap-1 text-error font-semibold">
                <span className="material-symbols-outlined text-xs">cancel</span>
                {data.totalCriticos} crítico{data.totalCriticos !== 1 ? 's' : ''}
              </span>
            )}
            {data.totalPreventivos > 0 && (
              <span className="flex items-center gap-1 text-primary">
                <span className="material-symbols-outlined text-xs">warning</span>
                {data.totalPreventivos} preventivo{data.totalPreventivos !== 1 ? 's' : ''}
              </span>
            )}
            {data.totalInformativos > 0 && (
              <span className="flex items-center gap-1 text-on-surface-variant">
                <span className="material-symbols-outlined text-xs">info</span>
                {data.totalInformativos} informativo{data.totalInformativos !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={toggleDetalle}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:underline underline-offset-2 flex-shrink-0 mt-0.5"
        >
          {loadingDetalle ? (
            <span className="material-symbols-outlined text-xs animate-spin">refresh</span>
          ) : (
            <span className="material-symbols-outlined text-xs">
              {expanded ? 'expand_less' : 'expand_more'}
            </span>
          )}
          {expanded ? 'Ocultar' : 'Ver detalle'}
        </button>
      </div>

      {expanded && detalles && (
        <div className="mt-4 border-t border-outline/10 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-3">
            39 Códigos de Verificación
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {detalles.map((d) => {
              const isOptimo = d.valor === 0;
              const colorClass = isOptimo
                ? 'bg-secondary/8 text-secondary'
                : d.nivelRiesgo === 'critico'
                  ? 'bg-error/8 text-error'
                  : d.nivelRiesgo === 'preventivo'
                    ? 'bg-primary/8 text-primary'
                    : 'bg-outline/8 text-on-surface-variant';
              const icon = isOptimo
                ? 'check_circle'
                : d.nivelRiesgo === 'critico'
                  ? 'cancel'
                  : 'warning';
              const canCreateTicket =
                !isOptimo &&
                (d.nivelRiesgo === 'critico' || d.nivelRiesgo === 'preventivo');
              return (
                <div key={d.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${colorClass}`}>
                  <span className="material-symbols-outlined text-xs flex-shrink-0">{icon}</span>
                  <span className="font-bold flex-shrink-0">#{d.codigoVerificacionId}</span>
                  <span className="truncate flex-1" title={d.codigoNombre}>{d.codigoNombre}</span>
                  {canCreateTicket && (
                    d.ticketId ? (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide opacity-60 flex-shrink-0">
                        <span className="material-symbols-outlined text-[10px]">confirmation_number</span>
                        Ticket
                      </span>
                    ) : (
                      <button
                        onClick={() => handleCrearTicket(d.codigoVerificacionId)}
                        disabled={creatingTicket === d.codigoVerificacionId}
                        className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide underline underline-offset-2 hover:opacity-80 flex-shrink-0 disabled:opacity-40"
                      >
                        {creatingTicket === d.codigoVerificacionId ? (
                          <span className="material-symbols-outlined text-[10px] animate-spin">refresh</span>
                        ) : (
                          <span className="material-symbols-outlined text-[10px]">add</span>
                        )}
                        Ticket
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** Fault report timeline content */
function ReporteFallaContent({ data }: { data: ReporteFallaHV }) {
  const semaforo = semaforoBadge(data.semaforoRiesgo);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <p className="text-sm font-bold text-on-surface">
          {data.codigoVerificacionNombre || `Código #${data.codigoVerificacionId}`}
        </p>
        <StatusBadge status={semaforo.status} label={semaforo.label} />
      </div>
      {data.descripcion && (
        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
          {data.descripcion}
        </p>
      )}
    </div>
  );
}

/** Ticket timeline content */
function TicketContent({ data }: { data: TicketHV }) {
  const semaforo = semaforoBadge(data.semaforoRiesgo);
  const estColor = estadoTicketColor(data.estado);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <p className="text-sm font-bold text-on-surface">
          Ticket #{data.id.slice(0, 8)}
        </p>
        <StatusBadge status={semaforo.status} label={semaforo.label} />
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${estColor.bg} ${estColor.text}`}
        >
          {estadoTicketLabel(data.estado)}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-on-surface-variant flex-wrap">
        {data.asignadoNombre && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">person</span>
            {data.asignadoNombre}
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">update</span>
          Actualizado {formatFecha(data.actualizadoEn)}
        </span>
      </div>
      {data.trabajoRealizado && (
        <p className="text-xs text-on-surface-variant mt-2 leading-relaxed bg-surface-container-highest rounded-lg p-3">
          <span className="font-bold text-on-surface">Trabajo realizado:</span>{' '}
          {data.trabajoRealizado}
        </p>
      )}
    </div>
  );
}

/** Blocking event timeline content */
function EventoBloqueoContent({ data }: { data: EventoBloqueoHV }) {
  const isBloqueo = data.tipo === 'bloqueo';

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <p className="text-sm font-bold text-on-surface">
          {isBloqueo ? 'Unidad bloqueada' : 'Unidad desbloqueada'}
        </p>
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
            isBloqueo ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'
          }`}
        >
          {isBloqueo ? 'Bloqueo' : 'Desbloqueo'}
        </span>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-on-surface-variant flex-wrap">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">person</span>
          {data.usuarioNombre}
        </span>
      </div>
      {data.razon && (
        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
          {data.razon}
        </p>
      )}
    </div>
  );
}
