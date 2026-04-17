import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import FleetOverview from './pages/FleetOverview';
import Calendar from './pages/Calendar';
import Tickets from './pages/Tickets';
import HojaVida from './pages/HojaVida';
import BI from './pages/BI';
import Asignaciones from './pages/Asignaciones';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <p className="text-on-surface-variant">Cargando…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<FleetOverview />} />
        <Route path="calendario" element={<Calendar />} />
        <Route path="tickets" element={<Tickets />} />
        <Route path="unidades/:id/hoja-vida" element={<HojaVida />} />
        <Route path="bi" element={<BI />} />
        <Route path="asignaciones" element={<Asignaciones />} />
      </Route>

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
