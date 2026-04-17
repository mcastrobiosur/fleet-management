import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, StatusBadge, EcoMetricChip, Input } from '../components';
import { apiFetch } from '../api/client';
import { useWebSocket, type WSMessage } from '../hooks/useWebSocket';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Unidad {
  id: string;
  marca: string;
  modelo: string;
  patente: string;
  anio: number;
  estado: 'disponible' | 'bloqueada' | 'en_mantenimiento' | 'operativa';
  imagen?: string;
  ultimaInspeccion?: string;
  kilometraje?: number;
}

interface InspeccionReciente {
  id: string;
  unidadPatente: string;
  resultado: 'passed' | 'failed';
  descripcion: string;
  semaforo?: 'critico' | 'preventivo' | 'informativo';
  tiempoRelativo: string;
}

interface EstadoFlota {
  unidades: Unidad[];
}

interface AlertaCritica {
  id: string;
  message: string;
  unidadPatente: string;
  timestamp: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Map unit estado → StatusBadge status */
function estadoToBadge(estado: Unidad['estado']): {
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

/** Map semáforo level → Tailwind color classes */
function semaforoColor(semaforo?: string): { bg: string; text: string } {
  switch (semaforo) {
    case 'critico':
      return { bg: 'bg-error/10', text: 'text-error' };
    case 'preventivo':
      return { bg: 'bg-primary/10', text: 'text-primary' };
    case 'informativo':
      return { bg: 'bg-secondary/10', text: 'text-secondary' };
    default:
      return { bg: 'bg-secondary/10', text: 'text-secondary' };
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FleetOverview() {
  const navigate = useNavigate();
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [search, setSearch] = useState('');
  const [alertas, setAlertas] = useState<AlertaCritica[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  type ModalMode = 'create' | 'edit' | null;
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editTarget, setEditTarget] = useState<Unidad | null>(null);
  const [formData, setFormData] = useState({ marca: '', modelo: '', patente: '', anio: '' });
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Unidad | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setFormData({ marca: '', modelo: '', patente: '', anio: '' });
    setFormError('');
    setEditTarget(null);
    setModalMode('create');
  };

  const openEdit = (u: Unidad, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormData({ marca: u.marca, modelo: u.modelo, patente: u.patente, anio: String(u.anio) });
    setFormError('');
    setEditTarget(u);
    setModalMode('edit');
  };

  const closeModal = () => { setModalMode(null); setEditTarget(null); };

  const handleSave = async () => {
    const { marca, modelo, patente, anio } = formData;
    if (!marca.trim() || !modelo.trim() || !patente.trim() || !anio) {
      setFormError('Todos los campos son requeridos.');
      return;
    }
    if (isNaN(Number(anio)) || Number(anio) < 1900 || Number(anio) > new Date().getFullYear() + 1) {
      setFormError('Año inválido.');
      return;
    }
    setFormSaving(true);
    setFormError('');
    try {
      const body = { marca: marca.trim(), modelo: modelo.trim(), patente: patente.trim().toUpperCase(), anio: Number(anio) };
      if (modalMode === 'create') {
        const created = await apiFetch<Unidad>('/unidades', { method: 'POST', body: JSON.stringify(body) });
        setUnidades((prev) => [...prev, created]);
      } else if (editTarget) {
        const updated = await apiFetch<Unidad>(`/unidades/${editTarget.id}`, { method: 'PUT', body: JSON.stringify(body) });
        setUnidades((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
      }
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setFormSaving(false);
    }
  };

  const openDelete = (u: Unidad, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget(u);
    setDeleteError('');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await apiFetch(`/unidades/${deleteTarget.id}`, { method: 'DELETE' });
      setUnidades((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar.');
    } finally {
      setDeleting(false);
    }
  };

  /* ---- Fetch fleet state ---- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await apiFetch<Unidad[]>('/dashboard/estado-flota');
        if (!cancelled) setUnidades(Array.isArray(data) ? data : []);
      } catch {
        // Silently handle — user sees empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* ---- WebSocket: real-time critical alerts (≤30s) ---- */
  const handleWSMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'alerta_critica') {
      const payload = msg.payload as Record<string, unknown>;
      const alerta: AlertaCritica = {
        id: crypto.randomUUID(),
        message: String(payload.message ?? 'Falla crítica detectada'),
        unidadPatente: String(payload.unidadPatente ?? ''),
        timestamp: Date.now(),
      };
      setAlertas((prev) => [alerta, ...prev].slice(0, 5));

      // Auto-dismiss after 10s
      setTimeout(() => {
        setAlertas((prev) => prev.filter((a) => a.id !== alerta.id));
      }, 10_000);
    }
  }, []);

  useWebSocket(handleWSMessage);

  /* ---- Filtered units ---- */
  const unidadesFiltradas = useMemo(() => {
    if (!search.trim()) return unidades;
    const q = search.toLowerCase();
    return unidades.filter(
      (u) =>
        u.patente.toLowerCase().includes(q) ||
        u.marca.toLowerCase().includes(q) ||
        u.modelo.toLowerCase().includes(q),
    );
  }, [unidades, search]);

  const indicadores = useMemo(() => {
    const total = unidades.length;
    const operativas = unidades.filter((u) => u.estado === 'operativa').length;
    const atencion = unidades.filter((u) => u.estado === 'bloqueada' || u.estado === 'en_mantenimiento').length;
    const porcentajeSalud = total > 0 ? Math.round((operativas / total) * 100) : 0;
    return { totalUnidades: total, operativas, atencion, porcentajeSalud };
  }, [unidades]);

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-on-surface-variant font-headline">Cargando flota…</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* ── Real-time critical alert toasts ── */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 w-80">
        <AnimatePresence>
          {alertas.map((alerta) => (
            <motion.div
              key={alerta.id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="px-4 py-3 rounded-xl shadow-ambient bg-error/10 text-error text-sm font-medium border border-error/20 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">warning</span>
                <div className="flex-1">
                  <p className="font-bold text-xs uppercase tracking-wider">{alerta.unidadPatente}</p>
                  <p>{alerta.message}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Header + Search ── */}
      <section className="mb-12">
        <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
          <div className="w-full md:max-w-2xl">
            <h2 className="font-headline text-3xl font-extrabold tracking-tight text-brand-dark mb-2">
              Fleet Overview
            </h2>
            <p className="text-on-surface-variant font-medium mb-6">
              Gestión sustentable de flota y monitoreo de cumplimiento.
            </p>
            {/* Search bar: bg surface-container-high, focus border-primary */}
            <Input
              icon="search"
              placeholder="Buscar por patente, marca o modelo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto items-center">
            <EcoMetricChip icon="eco">
              {indicadores.operativas}/{indicadores.totalUnidades} Operativas
            </EcoMetricChip>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Nueva Unidad
            </button>
          </div>
        </div>
      </section>

      {/* ── Bento Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {/* ── Unit Cards ── */}
        {unidadesFiltradas.map((unidad, i) => {
          const badge = estadoToBadge(unidad.estado);
          return (
            <Card
              key={unidad.id}
              className="overflow-hidden flex flex-col group cursor-pointer"
              transition={{ duration: 0.3, delay: i * 0.05 }}
              onClick={() => navigate(`/unidades/${unidad.id}/hoja-vida`)}
            >
              {/* Vehicle image */}
              <div className="relative h-48 overflow-hidden bg-surface-container-high">
                {unidad.imagen ? (
                  <img
                    src={unidad.imagen}
                    alt={`${unidad.marca} ${unidad.modelo}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-5xl text-outline/40">
                      directions_car
                    </span>
                  </div>
                )}
                {/* Status badge overlay */}
                <div className="absolute top-4 right-4">
                  <StatusBadge status={badge.status} label={badge.label} />
                </div>
              </div>

              {/* Card body */}
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="font-label text-[10px] font-bold text-primary tracking-widest uppercase">
                      ID: {unidad.patente}
                    </span>
                    <h3 className="font-headline text-xl font-extrabold text-brand-dark">
                      {unidad.marca} {unidad.modelo}
                    </h3>
                  </div>
                  <div className="bg-surface-container-highest p-2 rounded-lg">
                    <span className="material-symbols-outlined text-primary">
                      local_shipping
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Última Inspección</span>
                    <span className="font-semibold text-on-surface">
                      {unidad.ultimaInspeccion ?? '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Kilometraje</span>
                    <span className="font-semibold text-on-surface">
                      {unidad.kilometraje != null
                        ? `${unidad.kilometraje.toLocaleString()} km`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Año</span>
                    <span className="font-semibold text-on-surface">{unidad.anio}</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-auto pt-2 border-t border-outline/10">
                  <button
                    onClick={(e) => openEdit(unidad, e)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-primary hover:bg-primary/8 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Editar
                  </button>
                  <button
                    onClick={(e) => openDelete(unidad, e)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-error hover:bg-error/8 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    Eliminar
                  </button>
                </div>
              </div>
            </Card>
          );
        })}

        {/* ── Eco-Fleet Score Card (spans 2 cols on lg) ── */}
        <Card
          flat
          className="lg:col-span-2 !bg-brand-dark !border-0 p-8 flex flex-col md:flex-row gap-8 items-center justify-between text-white overflow-hidden relative"
        >
          <div className="relative z-10 flex-1">
            <div className="inline-block px-3 py-1 bg-white/10 rounded-lg text-[10px] font-bold tracking-[0.2em] uppercase mb-4">
              Eco-Fleet Score
            </div>
            <h2 className="font-headline text-5xl font-black mb-4 tracking-tighter">
              {indicadores.porcentajeSalud}% Fleet Health
            </h2>
            <p className="text-stone-300 max-w-md">
              Estándares ambientales Biosur cumplidos.{' '}
              {indicadores.atencion > 0
                ? `${indicadores.atencion} vehículos requieren atención.`
                : 'Toda la flota en cumplimiento.'}
            </p>
            <div className="flex gap-4 mt-8">
              <div className="flex flex-col">
                <span className="text-3xl font-black font-headline">
                  {String(indicadores.operativas).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-secondary font-bold">
                  Operativas
                </span>
              </div>
              <div className="w-px h-10 bg-white/20 self-center" />
              <div className="flex flex-col">
                <span className="text-3xl font-black font-headline">
                  {String(indicadores.atencion).padStart(2, '0')}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-primary font-bold">
                  Atención
                </span>
              </div>
            </div>
          </div>

          {/* Circular health indicator */}
          <div className="relative w-full md:w-64 h-48 bg-white/5 rounded-xl backdrop-blur-md flex items-center justify-center border border-white/10">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border-8 border-white/10 border-t-secondary flex items-center justify-center">
                <span className="font-headline text-2xl font-bold">
                  {indicadores.porcentajeSalud}%
                </span>
              </div>
            </div>
          </div>

          {/* Decorative glow */}
          <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
        </Card>

        {/* ── Recent Inspections Panel ── */}
        <Card className="p-6 flex flex-col">
          <h3 className="font-headline text-lg font-bold text-brand-dark mb-6">
            Recent Inspections
          </h3>
          <div className="space-y-6 flex-1">
            {([] as InspeccionReciente[]).map((insp) => {
              const color = semaforoColor(insp.semaforo);
              const icon = insp.resultado === 'failed' ? 'warning' : 'check_circle';
              return (
                <div key={insp.id} className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg ${color.bg} flex items-center justify-center`}
                  >
                    <span className={`material-symbols-outlined ${color.text}`}>
                      {icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-on-surface truncate">
                      {insp.unidadPatente}{' '}
                      {insp.resultado === 'failed' ? 'Falla' : 'Aprobada'}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {insp.descripcion}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-outline uppercase whitespace-nowrap">
                    {insp.tiempoRelativo}
                  </span>
                </div>
              );
            })}

            {true && (
              <p className="text-sm text-on-surface-variant text-center py-8">
                Sin inspecciones recientes.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* ── Floating Action Button ── */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate('/calendario')}
        className="fixed right-6 bottom-24 z-40 w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center"
        aria-label="Ver calendario de inspecciones"
      >
        <span className="material-symbols-outlined">calendar_month</span>
      </motion.button>

      {/* ── Create / Edit Modal ── */}
      <AnimatePresence>
        {modalMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-surface rounded-2xl shadow-2xl w-full max-w-md p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-headline text-2xl font-bold text-brand-dark mb-6">
                {modalMode === 'create' ? 'Nueva Unidad' : 'Editar Unidad'}
              </h2>
              <div className="space-y-4">
                {(['marca', 'modelo', 'patente', 'anio'] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      {field === 'anio' ? 'Año' : field.charAt(0).toUpperCase() + field.slice(1)}
                    </label>
                    <input
                      type={field === 'anio' ? 'number' : 'text'}
                      value={formData[field]}
                      onChange={(e) => setFormData((p) => ({ ...p, [field]: e.target.value }))}
                      placeholder={field === 'patente' ? 'ABCD12' : field === 'anio' ? '2020' : ''}
                      className="w-full bg-surface-container-highest rounded-xl px-4 py-3 text-on-surface text-sm border-0 focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                ))}
                {formError && (
                  <p className="text-error text-sm font-medium">{formError}</p>
                )}
              </div>
              <div className="flex gap-3 mt-8">
                <button
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={formSaving}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {formSaving ? 'Guardando…' : modalMode === 'create' ? 'Crear' : 'Guardar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="bg-surface rounded-2xl shadow-2xl w-full max-w-sm p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-error">delete</span>
              </div>
              <h2 className="font-headline text-xl font-bold text-brand-dark mb-2">
                ¿Eliminar unidad?
              </h2>
              <p className="text-sm text-on-surface-variant mb-2">
                <strong>{deleteTarget.marca} {deleteTarget.modelo}</strong> — {deleteTarget.patente}
              </p>
              <p className="text-xs text-on-surface-variant mb-6">
                Esta acción es irreversible. No se puede eliminar si tiene inspecciones, tickets u otras referencias asociadas.
              </p>
              {deleteError && (
                <p className="text-error text-sm font-medium mb-4">{deleteError}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container-high transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-error text-white hover:bg-error/90 transition-colors disabled:opacity-60"
                >
                  {deleting ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
