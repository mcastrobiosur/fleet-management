import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Button } from '../components';
import { apiFetch } from '../api/client';

interface Asignacion {
  id: string;
  conductor_id: string;
  unidad_id: string;
  fecha_jornada: string;
  conductor_nombre: string;
  conductor_email: string;
  marca: string;
  modelo: string;
  patente: string;
}

interface Conductor {
  id: string;
  nombre: string;
  email: string;
}

interface Unidad {
  id: string;
  marca: string;
  modelo: string;
  patente: string;
  anio: number;
  estado: string;
}

export default function Asignaciones() {
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [selectedConductor, setSelectedConductor] = useState('');
  const [selectedUnidad, setSelectedUnidad] = useState('');
  const [selectedFecha, setSelectedFecha] = useState(fecha);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAsignaciones = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Asignacion[]>(`/asignaciones?fecha=${fecha}`);
      setAsignaciones(Array.isArray(data) ? data : []);
    } catch {
      setAsignaciones([]);
    } finally {
      setLoading(false);
    }
  }, [fecha]);

  useEffect(() => {
    fetchAsignaciones();
  }, [fetchAsignaciones]);

  // Load conductores and unidades for the form
  useEffect(() => {
    async function loadOptions() {
      try {
        const [c, u] = await Promise.all([
          apiFetch<Conductor[]>('/asignaciones/conductores'),
          apiFetch<Unidad[]>('/asignaciones/unidades'),
        ]);
        setConductores(Array.isArray(c) ? c : []);
        setUnidades(Array.isArray(u) ? u : []);
      } catch {
        // silently handle
      }
    }
    loadOptions();
  }, []);

  const handleCreate = async () => {
    if (!selectedConductor || !selectedUnidad || !selectedFecha) {
      setError('Seleccione conductor, unidad y fecha');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiFetch('/asignaciones', {
        method: 'POST',
        body: JSON.stringify({
          conductorId: selectedConductor,
          unidadId: selectedUnidad,
          fechaJornada: selectedFecha,
        }),
      });
      setSuccess('Asignación creada correctamente');
      setShowForm(false);
      setSelectedConductor('');
      setSelectedUnidad('');
      fetchAsignaciones();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear asignación');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta asignación?')) return;
    try {
      await apiFetch(`/asignaciones/${id}`, { method: 'DELETE' });
      fetchAsignaciones();
    } catch {
      setError('Error al eliminar asignación');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="font-headline text-3xl font-extrabold tracking-tight text-brand-dark mb-1">
            Asignaciones
          </h2>
          <p className="text-on-surface-variant text-sm">
            Gestión de asignaciones de conductores a unidades por jornada.
          </p>
        </div>
        <Button
          variant="primary"
          icon="add"
          iconPosition="left"
          onClick={() => { setShowForm(true); setSelectedFecha(fecha); setError(''); setSuccess(''); }}
        >
          Nueva Asignación
        </Button>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-error/10 text-error rounded-xl px-5 py-3 mb-6 text-sm font-medium"
          >
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-secondary/10 text-secondary rounded-xl px-5 py-3 mb-6 text-sm font-medium"
          >
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Date selector */}
      <Card className="p-5 mb-8">
        <div className="flex items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="fecha-asignacion"
              className="font-label text-xs font-bold tracking-wide uppercase text-on-surface-variant"
            >
              Fecha de jornada
            </label>
            <input
              id="fecha-asignacion"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="bg-surface-container-highest text-on-surface rounded-lg px-3 py-2 text-sm font-body border-b-2 border-transparent focus:border-primary outline-none transition-colors"
            />
          </div>
          <span className="text-sm text-on-surface-variant">
            {asignaciones.length} asignación{asignaciones.length !== 1 ? 'es' : ''} para esta fecha
          </span>
        </div>
      </Card>

      {/* Create form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-on-surface/30 backdrop-blur-sm"
              onClick={() => setShowForm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-surface rounded-xl shadow-lg w-full max-w-md p-6 border border-outline/5"
            >
              <h3 className="font-headline text-lg font-bold text-brand-dark mb-6">
                Nueva Asignación
              </h3>

              <div className="space-y-4 mb-6">
                {/* Conductor */}
                <div className="flex flex-col gap-1">
                  <label className="font-label text-xs uppercase tracking-wider text-on-surface-variant font-bold">
                    Conductor
                  </label>
                  <select
                    value={selectedConductor}
                    onChange={(e) => setSelectedConductor(e.target.value)}
                    className="w-full bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-lg py-3 pl-4 pr-10 text-on-surface font-body transition-all"
                  >
                    <option value="">Seleccionar conductor...</option>
                    {conductores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unidad */}
                <div className="flex flex-col gap-1">
                  <label className="font-label text-xs uppercase tracking-wider text-on-surface-variant font-bold">
                    Unidad
                  </label>
                  <select
                    value={selectedUnidad}
                    onChange={(e) => setSelectedUnidad(e.target.value)}
                    className="w-full bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-lg py-3 pl-4 pr-10 text-on-surface font-body transition-all"
                  >
                    <option value="">Seleccionar unidad...</option>
                    {unidades.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.patente} — {u.marca} {u.modelo} ({u.estado})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Fecha */}
                <div className="flex flex-col gap-1">
                  <label className="font-label text-xs uppercase tracking-wider text-on-surface-variant font-bold">
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={selectedFecha}
                    onChange={(e) => setSelectedFecha(e.target.value)}
                    className="w-full bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-lg py-3 px-4 text-on-surface font-body transition-all"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-error mb-4">{error}</p>
              )}

              <div className="flex gap-3 justify-end">
                <Button variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={handleCreate} disabled={saving} icon="save" iconPosition="left">
                  {saving ? 'Guardando...' : 'Crear Asignación'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assignments list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-on-surface-variant font-headline">Cargando asignaciones...</p>
        </div>
      ) : asignaciones.length === 0 ? (
        <Card flat className="p-12 flex flex-col items-center justify-center text-center">
          <span className="material-symbols-outlined text-5xl text-outline/30 mb-4">assignment_ind</span>
          <p className="text-on-surface-variant font-medium">
            No hay asignaciones para esta fecha.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {asignaciones.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-5 rounded-xl bg-surface-container-low border border-outline/5 hover:bg-surface-container-high transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary">person</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface">{a.conductor_nombre}</p>
                <p className="text-xs text-on-surface-variant">{a.conductor_email}</p>
              </div>
              <div className="text-center px-4">
                <span className="material-symbols-outlined text-outline text-sm">arrow_forward</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-on-surface">{a.marca} {a.modelo}</p>
                <p className="text-xs text-on-surface-variant font-label uppercase tracking-wider">{a.patente}</p>
              </div>
              <button
                onClick={() => handleDelete(a.id)}
                className="w-9 h-9 rounded-lg bg-error/10 flex items-center justify-center hover:bg-error/20 transition-colors flex-shrink-0"
                aria-label="Eliminar asignación"
              >
                <span className="material-symbols-outlined text-error text-sm">delete</span>
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
