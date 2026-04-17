import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket, type WSMessage } from '../hooks/useWebSocket';
import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface Notification {
  id: string;
  message: string;
  type: string;
  timestamp: number;
}

const NAV_ITEMS = [
  { to: '/', label: 'Flota', icon: 'directions_car' },
  { to: '/asignaciones', label: 'Asignaciones', icon: 'assignment_ind' },
  { to: '/calendario', label: 'Calendario', icon: 'calendar_month' },
  { to: '/tickets', label: 'Tickets', icon: 'confirmation_number' },
  { to: '/bi', label: 'BI', icon: 'analytics' },
] as const;

/**
 * Main dashboard layout with TopAppBar, sidebar navigation,
 * and real-time WebSocket notifications.
 *
 * Design System "Elemental Purity":
 * - TopAppBar: bg brand-light, text primary
 * - No-Line rule: surface color shifts instead of borders
 * - Ambient shadows for floating elements
 */
export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const handleWSMessage = useCallback((msg: WSMessage) => {
    if (msg.type === 'alerta_critica' || msg.type === 'ticket_update') {
      const notif: Notification = {
        id: crypto.randomUUID(),
        message: String((msg.payload as Record<string, unknown>)?.message ?? 'Nueva notificación'),
        type: msg.type,
        timestamp: Date.now(),
      };
      setNotifications((prev) => [notif, ...prev].slice(0, 10));

      // Auto-dismiss after 8s
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      }, 8000);
    }
  }, []);

  useWebSocket(handleWSMessage);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* TopAppBar */}
      <header className="fixed top-0 z-40 w-full bg-brand-light flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="font-headline font-bold text-xl tracking-tight text-primary">
            Biosur Eco
          </h1>
        </div>

        <nav className="hidden md:flex gap-6">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `font-headline text-sm font-semibold transition-colors ${
                  isActive ? 'text-primary' : 'text-on-surface-variant hover:text-primary'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <span className="text-sm text-on-surface-variant hidden sm:inline">
            {user?.nombre}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-on-surface-variant hover:text-primary transition-colors font-headline"
          >
            Salir
          </button>
          <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center text-primary font-headline font-bold text-sm">
            {user?.nombre?.charAt(0).toUpperCase() ?? 'U'}
          </div>
        </div>
      </header>

      {/* Real-time notification toasts */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 w-80">
        <AnimatePresence>
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={`px-4 py-3 rounded-lg shadow-ambient text-sm font-medium ${
                notif.type === 'alerta_critica'
                  ? 'bg-error/10 text-error'
                  : 'bg-surface-container-low text-on-surface'
              }`}
            >
              {notif.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 pt-24 pb-28">
        <Outlet />
      </main>

      {/* BottomNavBar (mobile) */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-brand-light/70 backdrop-blur-md md:hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center transition-all active:translate-y-0.5 ${
                isActive
                  ? 'text-primary bg-primary/10 rounded-2xl px-4 py-1'
                  : 'text-on-surface-variant'
              }`
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="font-label text-[10px] uppercase tracking-wider font-bold mt-1">
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
