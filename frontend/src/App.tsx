import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import WorkerLayout from './layouts/WorkerLayout';
import ManagerLayout from './layouts/ManagerLayout';

// Worker Pages
import WorkerLogin from './pages/worker/WorkerLogin';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import WorkerHistory from './pages/worker/WorkerHistory';

// Manager Pages
import TodayWork from './pages/manager/TodayWork';
import Payment from './pages/manager/Payment';
import ManagerDashboardTab from './pages/manager/ManagerDashboardTab';
import ManagerLogin from './pages/manager/ManagerLogin';
import ManagerSettings from './pages/manager/ManagerSettings';

// Contexts
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* ── Worker (root) ─────────────────────────────────── */}
            <Route path="/" element={<WorkerLayout />}>
              <Route index element={<WorkerLogin />} />
              <Route path="dashboard" element={<WorkerDashboard />} />
              <Route path="history" element={<WorkerHistory />} />
            </Route>

            {/* Legacy redirects */}
            <Route path="/worker"           element={<Navigate to="/"          replace />} />
            <Route path="/worker/login"     element={<Navigate to="/"          replace />} />
            <Route path="/worker/dashboard" element={<Navigate to="/dashboard" replace />} />
            <Route path="/worker/history"   element={<Navigate to="/history"   replace />} />

            {/* ── Manager ───────────────────────────────────────── */}
            <Route path="/manager" element={<ManagerLayout />}>
              <Route index        element={<TodayWork />} />
              <Route path="login"     element={<ManagerLogin />} />
              <Route path="payment"   element={<Payment />} />
              <Route path="dashboard" element={<ManagerDashboardTab />} />
              <Route path="settings"  element={<ManagerSettings />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
