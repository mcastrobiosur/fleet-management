import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../components';
import { apiFetch } from '../api/client';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface InspeccionCalendario {
  id: string;
  unidadId: string;
  unidadPatente: string;
  conductorNombre: string;
  timestampLocal: string;
  estado: 'realizada' | 'pendiente';
}

interface UnidadOption {
  id: string;
  patente: string;
  marca: string;
  modelo: string;
}

/* ------------------------------------------------------------------ */
/*  Date helpers                                                       */
/* ------------------------------------------------------------------ */

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday-based start day (0=Mon … 6=Sun) */
function getStartDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function isToday(year: number, month: number, day: number): boolean {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Calendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [unidadId, setUnidadId] = useState<string>('');
  const [unidades, setUnidades] = useState<UnidadOption[]>([]);
  const [inspecciones, setInspecciones] = useState<InspeccionCalendario[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  /* ---- Load units for filter dropdown ---- */
  useEffect(() => {
    let cancelled = false;
    async function loadUnidades() {
      try {
        const data = await apiFetch<{ unidades: UnidadOption[] }>('/dashboard/estado-flota');
        if (!cancelled && data.unidades) {
          setUnidades(data.unidades.map((u) => ({
            id: u.id,
            patente: u.patente,
            marca: u.marca,
            modelo: u.modelo,
          })));
        }
      } catch {
        /* silently handle */
      }
    }
    loadUnidades();
    return () => { cancelled = true; };
  }, []);

  /* ---- Fetch inspections for current month + unit filter ---- */
  useEffect(() => {
    let cancelled = false;
    async function loadInspecciones() {
      setLoading(true);
      try {
        const desde = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const daysInMonth = getDaysInMonth(year, month);
        const hasta = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        let path = `/inspecciones?desde=${desde}&hasta=${hasta}`;
        if (unidadId) path += `&unidadId=${unidadId}`;

        const data = await apiFetch<InspeccionCalendario[]>(path);
        if (!cancelled) setInspecciones(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setInspecciones([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadInspecciones();
    return () => { cancelled = true; };
  }, [year, month, unidadId]);

  /* ---- Group inspections by date key ---- */
  const inspeccionesPorDia = useMemo(() => {
    const map = new Map<string, InspeccionCalendario[]>();
    for (const insp of inspecciones) {
      const date = new Date(insp.timestampLocal);
      const key = formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
      const list = map.get(key) ?? [];
      list.push(insp);
      map.set(key, list);
    }
    return map;
  }, [inspecciones]);

  /* ---- Calendar grid data ---- */
  const daysInMonth = getDaysInMonth(year, month);
  const startDay = getStartDayOfMonth(year, month);

  /* ---- Navigation ---- */
  const goToPrevMonth = useCallback(() => {
    setSelectedDay(null);
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const goToNextMonth = useCallback(() => {
    setSelectedDay(null);
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const goToToday = useCallback(() => {
    const today = new Date();
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDay(formatDateKey(today.getFullYear(), today.getMonth(), today.getDate()));
  }, []);

  /* ---- Selected day inspections ---- */
  const selectedInspecciones = selectedDay ? (inspeccionesPorDia.get(selectedDay) ?? []) : [];

  return (
    <div>
      {/* ── Header ── */}
      <section className="mb-8">
        <h2 className="font-headline text-3xl font-extrabold tracking-tight text-brand-dark mb-2">
          Calendario de Inspecciones
        </h2>
        <p className="text-on-surface-variant font-medium">
          Inspecciones realizadas y pendientes por unidad y fecha.
        </p>
      </section>

      {/* ── Filters ── */}
      <section className="flex flex-col sm:flex-row gap-4 mb-8">
        {/* Unit filter */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="unit-filter"
            className="font-label text-xs uppercase tracking-wider text-on-surface-variant font-bold"
          >
            Unidad
          </label>
          <div className="relative">
            <select
              id="unit-filter"
              value={unidadId}
              onChange={(e) => { setUnidadId(e.target.value); setSelectedDay(null); }}
              className="appearance-none w-full sm:w-64 bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-lg py-3 pl-4 pr-10 text-on-surface font-body transition-all duration-200"
            >
              <option value="">Todas las unidades</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.patente} — {u.marca} {u.modelo}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline text-sm">expand_more</span>
            </div>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-end gap-2 ml-auto">
          <button
            onClick={goToToday}
            className="px-4 py-3 rounded-lg bg-surface-container-highest text-on-surface text-sm font-semibold hover:bg-surface-container-high transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={goToPrevMonth}
            className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center hover:bg-surface-container-high transition-colors"
            aria-label="Mes anterior"
          >
            <span className="material-symbols-outlined text-on-surface">chevron_left</span>
          </button>
          <span className="font-headline text-lg font-bold text-brand-dark min-w-[180px] text-center py-2">
            {MESES[month]} {year}
          </span>
          <button
            onClick={goToNextMonth}
            className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center hover:bg-surface-container-high transition-colors"
            aria-label="Mes siguiente"
          >
            <span className="material-symbols-outlined text-on-surface">chevron_right</span>
          </button>
        </div>
      </section>

      {/* ── Calendar Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card flat className="lg:col-span-2 p-6 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <p className="text-on-surface-variant font-headline text-sm">Cargando inspecciones…</p>
            </div>
          )}

          {!loading && (
            <div>
              {/* Day-of-week headers */}
              <div className="grid grid-cols-7 mb-2">
                {DIAS_SEMANA.map((dia) => (
                  <div
                    key={dia}
                    className="text-center font-label text-[10px] font-bold uppercase tracking-widest text-on-surface-variant py-2"
                  >
                    {dia}
                  </div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {/* Empty cells before first day */}
                {Array.from({ length: startDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square p-1" />
                ))}

                {/* Actual days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateKey = formatDateKey(year, month, day);
                  const dayInspecciones = inspeccionesPorDia.get(dateKey) ?? [];
                  const realizadas = dayInspecciones.filter((ins) => ins.estado === 'realizada').length;
                  const pendientes = dayInspecciones.filter((ins) => ins.estado === 'pendiente').length;
                  const hasInspecciones = dayInspecciones.length > 0;
                  const isTodayCell = isToday(year, month, day);
                  const isSelected = selectedDay === dateKey;

                  return (
                    <motion.button
                      key={day}
                      onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`
                        aspect-square p-1 m-0.5 rounded-lg flex flex-col items-center justify-center gap-0.5
                        transition-colors duration-200 relative
                        ${isSelected
                          ? 'bg-primary text-on-primary'
                          : isTodayCell
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-surface-container-high text-on-surface'
                        }
                      `}
                      aria-label={`${day} de ${MESES[month]}, ${realizadas} realizadas, ${pendientes} pendientes`}
                    >
                      <span className={`text-sm font-semibold ${isSelected ? 'text-on-primary' : ''}`}>
                        {day}
                      </span>

                      {/* Inspection indicators */}
                      {hasInspecciones && (
                        <div className="flex gap-0.5">
                          {realizadas > 0 && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-on-primary/70' : 'bg-secondary'
                              }`}
                              title={`${realizadas} realizada(s)`}
                            />
                          )}
                          {pendientes > 0 && (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-on-primary/70' : 'bg-primary'
                              }`}
                              title={`${pendientes} pendiente(s)`}
                            />
                          )}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-6 mt-6 pt-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-secondary" />
                  <span className="text-xs text-on-surface-variant font-medium">Realizada</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                  <span className="text-xs text-on-surface-variant font-medium">Pendiente</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary/20" />
                  <span className="text-xs text-on-surface-variant font-medium">Hoy</span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* ── Day Detail Panel ── */}
        <Card flat className="p-6">
          <AnimatePresence mode="wait">
            {selectedDay ? (
              <motion.div
                key={selectedDay}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <h3 className="font-headline text-lg font-bold text-brand-dark mb-1">
                  {(() => {
                    const [y, m, d] = selectedDay.split('-').map(Number);
                    return `${d} de ${MESES[m - 1]}, ${y}`;
                  })()}
                </h3>
                <p className="text-xs text-on-surface-variant font-label uppercase tracking-wider mb-6">
                  {selectedInspecciones.length} inspección{selectedInspecciones.length !== 1 ? 'es' : ''}
                </p>

                {selectedInspecciones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-outline/40 mb-3">
                      event_available
                    </span>
                    <p className="text-sm text-on-surface-variant">
                      Sin inspecciones para este día.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedInspecciones.map((insp) => (
                      <div
                        key={insp.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-highest/50 transition-colors hover:bg-surface-container-highest"
                      >
                        <div
                          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            insp.estado === 'realizada'
                              ? 'bg-secondary/10'
                              : 'bg-primary/10'
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-base ${
                              insp.estado === 'realizada'
                                ? 'text-secondary'
                                : 'text-primary'
                            }`}
                          >
                            {insp.estado === 'realizada' ? 'check_circle' : 'schedule'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-on-surface truncate">
                            {insp.unidadPatente}
                          </p>
                          <p className="text-xs text-on-surface-variant truncate">
                            {insp.conductorNombre}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            insp.estado === 'realizada'
                              ? 'bg-secondary/10 text-secondary'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {insp.estado === 'realizada' ? 'Realizada' : 'Pendiente'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
                  calendar_month
                </span>
                <p className="text-sm text-on-surface-variant font-medium">
                  Selecciona un día para ver las inspecciones.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </div>
    </div>
  );
}
