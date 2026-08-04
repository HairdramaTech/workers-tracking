import { Outlet, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { ClipboardList, CreditCard, LayoutDashboard, Settings, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const NAV = [
  { to: '/manager',           label: 'Today Work', icon: ClipboardList,   exact: true  },
  { to: '/manager/payment',   label: 'Payment',    icon: CreditCard,      exact: false },
  { to: '/manager/dashboard', label: 'Dashboard',  icon: LayoutDashboard, exact: false },
  { to: '/manager/settings',  label: 'Settings',   icon: Settings,        exact: false },
];

export default function ManagerLayout() {
  const location   = useLocation();
  const navigate   = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/manager/login');
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--color-text-secondary)' }}>Loading…</div>;
  }

  const path = location.pathname;

  // If on login page
  if (path === '/manager/login') {
    if (session) return <Navigate to="/manager" replace />;
    return <Outlet />;
  }

  // Guard all other manager routes
  if (!session) return <Navigate to="/manager/login" replace />;

  const isActive = (to: string, exact: boolean) =>
    exact ? path === to : path.startsWith(to);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-primary)' }}>
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 1.5rem', height: '60px',
        background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky', top: 0, zIndex: 30,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <span style={{ fontWeight: 800, fontSize: '1.1rem', background: 'linear-gradient(135deg, var(--color-brand-primary), #6366f1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            WageTracker
          </span>
          {/* Desktop tabs */}
          <nav style={{ display: 'flex', gap: '0.25rem' }} className="desktop-nav">
            {NAV.map(({ to, label, exact }) => (
              <Link
                key={to}
                to={to}
                style={{
                  padding: '0.4rem 0.875rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: isActive(to, exact) ? 700 : 500,
                  color: isActive(to, exact) ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                  background: isActive(to, exact) ? 'rgba(59,130,246,0.1)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button onClick={toggleTheme} aria-label="Toggle theme" style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '50%', width: '2.25rem', height: '2.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button onClick={handleLogout} title="Logout" style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '50%', width: '2.25rem', height: '2.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-danger)' }}>
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* ── Page content ───────────────────────────────────────────── */}
      <main className="manager-main" style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>
        <Outlet />
      </main>

      {/* ── Mobile bottom nav ──────────────────────────────────────── */}
      <nav className="mobile-nav" style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)', position: 'sticky', bottom: 0, zIndex: 30,
      }}>
        {NAV.map(({ to, label, icon: Icon, exact }) => {
          const active = isActive(to, exact);
          return (
            <Link
              key={to}
              to={to}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
                padding: '0.6rem 0.25rem',
                color: active ? 'var(--color-brand-primary)' : 'var(--color-text-muted)',
                textDecoration: 'none', fontSize: '0.65rem', fontWeight: active ? 700 : 400,
                transition: 'color 0.15s',
              }}
            >
              <Icon size={active ? 22 : 20} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
