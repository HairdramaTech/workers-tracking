import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function WorkerLayout() {
  const { worker, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="app-container flex items-center justify-center" style={{ minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ marginTop: '1rem', color: 'var(--color-text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  const isLoginPage = location.pathname === '/';

  // Protect dashboard/history — if not logged in, go back to login
  if (!worker && !isLoginPage) {
    return <Navigate to="/" replace />;
  }

  // If already logged in and on the login page, go to dashboard
  if (worker && isLoginPage) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="app-container">
      <Outlet />
    </div>
  );
}
