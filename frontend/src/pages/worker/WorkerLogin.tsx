import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Smartphone, Moon, Sun, AlertCircle } from 'lucide-react';

export default function WorkerLogin() {
  const { login, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\d{10}$/.test(phone)) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    const result = await login(phone);
    if (!result.ok) setError(result.error ?? 'Login failed.');
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      backgroundColor: 'var(--color-bg-primary)', transition: 'background-color 0.3s ease',
    }}>
      {/* Top bar */}
      <header style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1.5rem' }}>
        <button onClick={toggleTheme} aria-label="Toggle theme" style={{
          background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
          borderRadius: '50%', width: '2.5rem', height: '2.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--color-text-secondary)',
        }}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Main */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '1rem 1.5rem 3rem',
      }}>
        {/* Icon */}
        <div style={{
          width: '5rem', height: '5rem', borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--color-brand-primary), #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '1.25rem', boxShadow: 'var(--shadow-glow)',
        }}>
          <Smartphone size={36} color="white" />
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--color-text-primary)' }}>
          Worker Portal
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem', textAlign: 'center', fontSize: '0.95rem' }}>
          Enter your phone number to view your assigned tasks.
        </p>

        {/* Card */}
        <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
          <form onSubmit={handleSubmit} noValidate>
            <div className="input-group">
              <label htmlFor="phone-input" className="input-label">Phone Number</label>
              <input
                id="phone-input"
                type="tel"
                className="input-field"
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                disabled={isLoading}
                maxLength={10}
                inputMode="numeric"
                autoComplete="tel"
                autoFocus
                style={{ fontSize: '1.2rem', letterSpacing: '0.1em', textAlign: 'center', fontWeight: 700 }}
              />
              <span style={{
                fontSize: '0.75rem', textAlign: 'right',
                color: phone.length === 10 ? 'var(--color-success)' : 'var(--color-text-muted)',
              }}>
                {phone.length}/10
              </span>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 0.875rem', borderRadius: 'var(--border-radius-md)',
                background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)', fontSize: '0.875rem', marginBottom: '1rem',
              }}>
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <button
              id="login-btn"
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || phone.length !== 10}
              style={{ width: '100%', marginTop: '0.5rem', fontSize: '1.05rem', padding: '0.875rem' }}
            >
              {isLoading ? 'Checking…' : 'View My Tasks →'}
            </button>
          </form>
        </div>

        <p style={{ marginTop: '1.5rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
          Your phone must be registered by a manager or security before you can log in.
        </p>
      </main>
    </div>
  );
}
