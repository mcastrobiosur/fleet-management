import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button, StatusBadge } from '../components';
import { apiFetch } from '../api/client';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type NivelRiesgo = 'critico' | 'preventivo' | 'informativo';
type EstadoTicket = 'abierto' | 'en_progreso' | 'cerrado';

interface TicketListItem {
  id: string;
  reporteFallaId: string;
  unidadId: string;
  unidadPatente: string;
  estado: EstadoTicket;
  semaforoRiesgo: NivelRiesgo;
  asignadoA: string | null;
  asignadoNombre: string | null;
  trabajoRealizado: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

interface HistorialTransicion {
  id: string;
  estadoAnterior: EstadoTicket;
  estadoNuevo: EstadoTicket;
  usuarioId: string;
  usuarioNombre: string;
  descripcion: string;
  creadoEn: string;
}

interface TicketDetalle extends TicketListItem {
  descripcionFalla: string;
  codigoVerificacionId: number;
  codigoVerificacionNombre: string;
  historial: HistorialTransicion[];
}

interface UnidadOption {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
}

interface EquipoMantenimientoUser {
  id: string;
  nombre: string;
  email: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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

function estadoLabel(estado: EstadoTicket): string {
  switch (estado) {
    case 'abierto':
      return 'Abierto';
    case 'en_progreso':
      return 'En Progreso';
    case 'cerrado':
      return 'Cerrado';
  }
}

function estadoColor(estado: EstadoTicket): { bg: string; text: string } {
  switch (estado) {
    case 'abierto':
      return { bg: 'bg-error/10', text: 'text-error' };
    case 'en_progreso':
      return { bg: 'bg-primary/10', text: 'text-primary' };
    case 'cerrado':
      return { bg: 'bg-secondary/10', text: 'text-secondary' };
  }
}

function semaforoIcon(nivel: NivelRiesgo): string {
  switch (nivel) {
    case 'critico':
      return 'error';
    case 'preventivo':
      return 'warning';
    case 'informativo':
      return 'info';
  }
}

function semaforoColor(nivel: NivelRiesgo): { bg: string; text: string } {
  switch (nivel) {
    case 'critico':
      return { bg: 'bg-error/10', text: 'text-error' };
    case 'preventivo':
      return { bg: 'bg-primary/10', text: 'text-primary' };
    case 'informativo':
      return { bg: 'bg-secondary/10', text: 'text-secondary' };
  }
}

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Tickets() {
  /* ---- State ---- */
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [unidades, setUnidades] = useState<UnidadOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filtroEstado, setFiltroEstado] = useState<EstadoTicket | ''>('');
  const [filtroSemaforo, setFiltroSemaforo] = useState<NivelRiesgo | ''>('');
  const [filtroUnidad, setFiltroUnidad] = useState('');

  // Detail panel
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetalle, setTicketDetalle] = useState<TicketDetalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  // Assignment modal
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [asignarTicketId, setAsignarTicketId] = useState<string | null>(null);
  const [equipoMantenimiento, setEquipoMantenimiento] = useState<EquipoMantenimientoUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [asignando, setAsignando] = useState(false);
  const [asignarError, setAsignarError] = useState('');

  /* ---- Fetch tickets ---- */
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      let path = '/tickets?';
      const params: string[] = [];
      if (filtroUnidad) params.push(`unidadId=${filtroUnidad}`);
      if (filtroEstado) params.push(`estado=${filtroEstado}`);
      if (filtroSemaforo) params.push(`semaforo=${filtroSemaforo}`);
      path += params.join('&');

      const data = await apiFetch<TicketListItem[]>(path);
      setTickets(Array.isArray(data) ? data : []);
    } catch {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [filtroUnidad, filtroEstado, filtroSemaforo]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  /* ---- Fetch units for filter ---- */
  useEffect(() => {
    let cancelled = false;
    async function loadUnidades() {
      try {
        const data = await apiFetch<{ unidades: UnidadOption[] }>('/dashboard/estado-flota');
        if (!cancelled && data.unidades) {
          setUnidades(
            data.unidades.map((u) => ({
              id: u.id,
              patente: u.patente,
              marca: u.marca,
              modelo: u.modelo,
            })),
          );
        }
      } catch {
        /* silently handle */
      }
    }
    loadUnidades();
    return () => { cancelled = true; };
  }, []);

  /* ---- Fetch ticket detail ---- */
  useEffect(() => {
    if (!selectedTicketId) {
      setTicketDetalle(null);
      return;
    }
    let cancelled = false;
    async function loadDetalle() {
      setLoadingDetalle(true);
      try {
        const data = await apiFetch<TicketDetalle>(`/tickets/${selectedTicketId}`);
        if (!cancelled) setTicketDetalle(data);
      } catch {
        if (!cancelled) setTicketDetalle(null);
      } finally {
        if (!cancelled) setLoadingDetalle(false);
      }
    }
    loadDetalle();
    return () => { cancelled = true; };
  }, [selectedTicketId]);

  /* ---- Filtered tickets (client-side fallback) ---- */
  const ticketsFiltrados = useMemo(() => {
    return tickets;
  }, [tickets]);

  /* ---- Assignment handlers ---- */
  const openAsignarModal = useCallback(async (ticketId: string) => {
    setAsignarTicketId(ticketId);
    setSelectedUserId('');
    setAsignarError('');
    setShowAsignarModal(true);

    try {
      const users = await apiFetch<EquipoMantenimientoUser[]>(
        '/usuarios?rol=equipo_mantenimiento',
      );
      setEquipoMantenimiento(Array.isArray(users) ? users : []);
    } catch {
      setEquipoMantenimiento([]);
    }
  }, []);

  const handleAsignar = useCallback(async () => {
    if (!asignarTicketId || !selectedUserId) return;
    setAsignando(true);
    setAsignarError('');
    try {
      await apiFetch(`/tickets/${asignarTicketId}/asignar`, {
        method: 'POST',
        body: JSON.stringify({ equipoMantenimientoId: selectedUserId }),
      });
      setShowAsignarModal(false);
      setAsignarTicketId(null);
      // Refresh list and detail
      fetchTickets();
      if (selectedTicketId === asignarTicketId) {
        setSelectedTicketId(asignarTicketId); // re-trigger detail fetch
      }
    } catch (err) {
      setAsignarError(
        err instanceof Error ? err.message : 'Error al asignar ticket',
      );
    } finally {
      setAsignando(false);
    }
  }, [asignarTicketId, selectedUserId, fetchTickets, selectedTicketId]);

  const closeAsignarModal = useCallback(() => {
    setShowAsignarModal(false);
    setAsignarTicketId(null);
    setAsignarError('');
  }, []);

  /* ---- Counts for summary chips ---- */
  const counts = useMemo(() => {
    const abiertos = tickets.filter((t) => t.estado === 'abierto').length;
    const enProgreso = tickets.filter((t) => t.estado === 'en_progreso').length;
    const cerrados = tickets.filter((t) => t.estado === 'cerrado').length;
    return { abiertos, enProgreso, cerrados, total: tickets.length };
  }, [tickets]);

  /* ---- Loading state ---- */
  if (loading && tickets.length === 0) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-on-surface-variant font-headline">Cargando tickets…</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* ── Header ── */}
      <section className="mb-8">
        <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
          <div>
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-brand-dark mb-2">
              Gestión de Tickets
            </h2>
            <p className="text-on-surface-variant font-medium">
              Seguimiento de tickets de reparación, asignación y resolución.
            </p>
          </div>
          {/* Summary chips */}
          <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-error/10 text-error font-label text-xs font-bold tracking-wide">
              <span className="material-symbols-outlined text-sm">error</span>
              {counts.abiertos} Abiertos
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-label text-xs font-bold tracking-wide">
              <span className="material-symbols-outlined text-sm">pending</span>
              {counts.enProgreso} En Progreso
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/10 text-secondary font-label text-xs font-bold tracking-wide">
              <span className="material-symbols-outlined text-sm">check_circle</span>
              {counts.cerrados} Cerrados
            </span>
          </div>
        </div>
      </section>

      {/* ── Filters ── */}
      <section className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Estado filter */}
        <FilterSelect
          id="filter-estado"
          label="Estado"
          value={filtroEstado}
          onChange={(v) => { setFiltroEstado(v as EstadoTicket | ''); setSelectedTicketId(null); }}
          options={[
            { value: '', label: 'Todos' },
            { value: 'abierto', label: 'Abierto' },
            { value: 'en_progreso', label: 'En Progreso' },
            { value: 'cerrado', label: 'Cerrado' },
          ]}
        />

        {/* Semáforo filter */}
        <FilterSelect
          id="filter-semaforo"
          label="Semáforo"
          value={filtroSemaforo}
          onChange={(v) => { setFiltroSemaforo(v as NivelRiesgo | ''); setSelectedTicketId(null); }}
          options={[
            { value: '', label: 'Todos' },
            { value: 'critico', label: 'Crítico' },
            { value: 'preventivo', label: 'Preventivo' },
            { value: 'informativo', label: 'Informativo' },
          ]}
        />

        {/* Unidad filter */}
        <FilterSelect
          id="filter-unidad"
          label="Unidad"
          value={filtroUnidad}
          onChange={(v) => { setFiltroUnidad(v); setSelectedTicketId(null); }}
          options={[
            { value: '', label: 'Todas las unidades' },
            ...unidades.map((u) => ({
              value: u.id,
              label: `${u.patente} — ${u.marca} ${u.modelo}`,
            })),
          ]}
        />
      </section>

      {/* ── Main Content: Ticket List + Detail Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Ticket List ── */}
        <div className="lg:col-span-2 space-y-4">
          {ticketsFiltrados.length === 0 && !loading && (
            <Card flat className="p-12 flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-5xl text-outline/30 mb-4">
                confirmation_number
              </span>
              <p className="text-on-surface-variant font-medium">
                No se encontraron tickets con los filtros seleccionados.
              </p>
            </Card>
          )}

          <AnimatePresence>
            {ticketsFiltrados.map((ticket, i) => {
              const semaforo = semaforoBadge(ticket.semaforoRiesgo);
              const estColor = estadoColor(ticket.estado);
              const isSelected = selectedTicketId === ticket.id;

              return (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedTicketId(isSelected ? null : ticket.id)
                    }
                    className={`
                      w-full text-left rounded-xl p-5 transition-all duration-300 border border-outline/5
                      ${isSelected
                        ? 'bg-surface-container-high shadow-lg'
                        : 'bg-surface-container-low hover:bg-surface-container-high'
                      }
                    `}
                    aria-label={`Ticket ${ticket.id}, estado ${estadoLabel(ticket.estado)}, semáforo ${ticket.semaforoRiesgo}`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Semáforo icon */}
                      <div
                        className={`w-10 h-10 rounded-lg ${semaforoColor(ticket.semaforoRiesgo).bg} flex items-center justify-center flex-shrink-0 mt-0.5`}
                      >
                        <span
                          className={`material-symbols-outlined ${semaforoColor(ticket.semaforoRiesgo).text}`}
                        >
                          {semaforoIcon(ticket.semaforoRiesgo)}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-headline text-sm font-bold text-brand-dark truncate">
                            Ticket #{ticket.id.slice(0, 8)}
                          </span>
                          <StatusBadge
                            status={semaforo.status}
                            label={semaforo.label}
                          />
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${estColor.bg} ${estColor.text}`}
                          >
                            {estadoLabel(ticket.estado)}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-on-surface-variant mt-2 flex-wrap">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">
                              directions_car
                            </span>
                            {ticket.unidadPatente}
                          </span>
                          {ticket.asignadoNombre && (
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">
                                person
                              </span>
                              {ticket.asignadoNombre}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">
                              calendar_today
                            </span>
                            {formatFecha(ticket.creadoEn)}
                          </span>
                        </div>
                      </div>

                      {/* Assign button for open tickets */}
                      {ticket.estado === 'abierto' && (
                        <Button
                          variant="secondary"
                          className="!px-3 !py-2 text-xs flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAsignarModal(ticket.id);
                          }}
                          icon="assignment_ind"
                          iconPosition="left"
                        >
                          Asignar
                        </Button>
                      )}

                      {/* Chevron */}
                      <span
                        className={`material-symbols-outlined text-outline transition-transform duration-200 flex-shrink-0 ${
                          isSelected ? 'rotate-90' : ''
                        }`}
                      >
                        chevron_right
                      </span>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── Detail Panel ── */}
        <Card flat className="p-6 lg:sticky lg:top-24 lg:self-start">
          <AnimatePresence mode="wait">
            {selectedTicketId && ticketDetalle ? (
              <TicketDetailPanel
                key={ticketDetalle.id}
                detalle={ticketDetalle}
                onAsignar={() => openAsignarModal(ticketDetalle.id)}
              />
            ) : selectedTicketId && loadingDetalle ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <p className="text-on-surface-variant font-headline text-sm">
                  Cargando detalle…
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <span className="material-symbols-outlined text-5xl text-outline/30 mb-4">
                  confirmation_number
                </span>
                <p className="text-sm text-on-surface-variant font-medium">
                  Selecciona un ticket para ver su detalle e historial.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>

      {/* ── Assignment Modal ── */}
      <AnimatePresence>
        {showAsignarModal && (
          <AsignarModal
            equipoMantenimiento={equipoMantenimiento}
            selectedUserId={selectedUserId}
            onSelectUser={setSelectedUserId}
            onConfirm={handleAsignar}
            onClose={closeAsignarModal}
            loading={asignando}
            error={asignarError}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

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

/** Ticket detail panel with transition history */
function TicketDetailPanel({
  detalle,
  onAsignar,
}: {
  detalle: TicketDetalle;
  onAsignar: () => void;
}) {
  const semaforo = semaforoBadge(detalle.semaforoRiesgo);
  const estColor = estadoColor(detalle.estado);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="mb-6">
        <span className="font-label text-[10px] font-bold text-primary tracking-widest uppercase">
          Ticket #{detalle.id.slice(0, 8)}
        </span>
        <h3 className="font-headline text-xl font-extrabold text-brand-dark mt-1">
          {detalle.codigoVerificacionNombre || `Código #${detalle.codigoVerificacionId}`}
        </h3>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <StatusBadge status={semaforo.status} label={semaforo.label} />
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${estColor.bg} ${estColor.text}`}
          >
            {estadoLabel(detalle.estado)}
          </span>
        </div>
      </div>

      {/* Info rows — no dividers, use spacing */}
      <div className="space-y-4 mb-8">
        <DetailRow
          icon="directions_car"
          label="Unidad"
          value={detalle.unidadPatente}
        />
        <DetailRow
          icon="calendar_today"
          label="Creado"
          value={formatFechaHora(detalle.creadoEn)}
        />
        <DetailRow
          icon="update"
          label="Actualizado"
          value={formatFechaHora(detalle.actualizadoEn)}
        />
        {detalle.asignadoNombre && (
          <DetailRow
            icon="person"
            label="Asignado a"
            value={detalle.asignadoNombre}
          />
        )}
        {detalle.descripcionFalla && (
          <DetailRow
            icon="description"
            label="Descripción"
            value={detalle.descripcionFalla}
          />
        )}
        {detalle.trabajoRealizado && (
          <DetailRow
            icon="build"
            label="Trabajo realizado"
            value={detalle.trabajoRealizado}
          />
        )}
      </div>

      {/* Assign button if open */}
      {detalle.estado === 'abierto' && (
        <div className="mb-8">
          <Button
            variant="primary"
            icon="assignment_ind"
            iconPosition="left"
            fullWidth
            onClick={onAsignar}
          >
            Asignar a Equipo de Mantenimiento
          </Button>
        </div>
      )}

      {/* Transition history */}
      <div>
        <h4 className="font-headline text-sm font-bold text-brand-dark mb-4">
          Historial de Transiciones
        </h4>

        {detalle.historial.length === 0 ? (
          <p className="text-xs text-on-surface-variant text-center py-6">
            Sin transiciones registradas.
          </p>
        ) : (
          <div className="space-y-4">
            {detalle.historial.map((h, i) => {
              const toColor = estadoColor(h.estadoNuevo);
              return (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.05 }}
                  className="flex gap-3"
                >
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full ${toColor.bg} border-2 ${toColor.text.replace('text-', 'border-')} flex-shrink-0 mt-1`}
                    />
                    {i < detalle.historial.length - 1 && (
                      <div className="w-0.5 flex-1 bg-surface-container-highest mt-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pb-4 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${estadoColor(h.estadoAnterior).bg} ${estadoColor(h.estadoAnterior).text}`}
                      >
                        {estadoLabel(h.estadoAnterior)}
                      </span>
                      <span className="material-symbols-outlined text-outline text-xs">
                        arrow_forward
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${toColor.bg} ${toColor.text}`}
                      >
                        {estadoLabel(h.estadoNuevo)}
                      </span>
                    </div>
                    {h.descripcion && (
                      <p className="text-xs text-on-surface mt-1 leading-relaxed">
                        {h.descripcion}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-on-surface-variant">
                      <span className="flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">
                          person
                        </span>
                        {h.usuarioNombre}
                      </span>
                      <span>{formatFechaHora(h.creadoEn)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/** Single detail row — icon + label + value, no dividers */
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-on-surface-variant text-sm">
          {icon}
        </span>
      </div>
      <div className="min-w-0">
        <span className="font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block">
          {label}
        </span>
        <span className="text-sm text-on-surface font-medium break-words">
          {value}
        </span>
      </div>
    </div>
  );
}

/** Assignment modal — overlay with user selection */
function AsignarModal({
  equipoMantenimiento,
  selectedUserId,
  onSelectUser,
  onConfirm,
  onClose,
  loading,
  error,
}: {
  equipoMantenimiento: EquipoMantenimientoUser[];
  selectedUserId: string;
  onSelectUser: (id: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  error: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-on-surface/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative bg-surface rounded-xl shadow-ambient w-full max-w-md p-6 border border-outline/5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="asignar-modal-title"
      >
        <h3
          id="asignar-modal-title"
          className="font-headline text-lg font-bold text-brand-dark mb-2"
        >
          Asignar Ticket
        </h3>
        <p className="text-sm text-on-surface-variant mb-6">
          Selecciona un miembro del equipo de mantenimiento para asignar este
          ticket.
        </p>

        {/* User list */}
        {equipoMantenimiento.length === 0 ? (
          <p className="text-sm text-on-surface-variant text-center py-6">
            No hay miembros del equipo de mantenimiento disponibles.
          </p>
        ) : (
          <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
            {equipoMantenimiento.map((user) => {
              const isSelected = selectedUserId === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => onSelectUser(user.id)}
                  className={`
                    w-full text-left p-3 rounded-lg transition-all duration-200 flex items-center gap-3
                    ${isSelected
                      ? 'bg-primary/10 ring-2 ring-primary/30'
                      : 'bg-surface-container-low hover:bg-surface-container-high'
                    }
                  `}
                  aria-pressed={isSelected}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      isSelected
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface-container-highest text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">
                      person
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">
                      {user.nombre}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {user.email}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="material-symbols-outlined text-primary text-base">
                      check_circle
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-xs text-error mb-4 px-1">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={!selectedUserId || loading}
            icon="assignment_ind"
            iconPosition="left"
          >
            {loading ? 'Asignando…' : 'Confirmar Asignación'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
