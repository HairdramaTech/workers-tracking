import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { CheckCircle, Moon, Sun } from 'lucide-react';

export default function WorkerLogin() {
  const { login, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\d{10}$/.test(phone)) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }

    // Try login first; if the phone exists the name is ignored (they're already registered).
    // If not found, pass the name to register them instantly.
    const success = await login(phone, name.trim());
    if (!success) {
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg-primary)',
        transition: 'background-color 0.3s ease',
      }}
    >
      {/* ── Top bar ───────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '1rem 1.5rem',
        }}
      >
        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: '50%',
            width: '2.5rem',
            height: '2.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            transition: 'all 0.2s',
          }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* ── Main content ──────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem 1.5rem 3rem',
        }}
      >
        {/* Logo */}
        <div
          style={{
            width: '5rem',
            height: '5rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-brand-primary), #6366f1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
            boxShadow: 'var(--shadow-glow)',
          }}
        >
          <CheckCircle size={36} color="white" />
        </div>

        <h1
          style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            marginBottom: '0.25rem',
            color: 'var(--color-text-primary)',
          }}
        >
          Clock In
        </h1>
        <p
          style={{
            color: 'var(--color-text-secondary)',
            marginBottom: '2rem',
            textAlign: 'center',
            fontSize: '0.95rem',
          }}
        >
          Enter your details to start your shift.
        </p>

        {/* ── Card ── */}
        <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
          <form onSubmit={handleSubmit} noValidate>

            {/* Name */}
            <div className="input-group">
              <label htmlFor="name-input" className="input-label">Full Name</label>
              <input
                id="name-input"
                type="text"
                className="input-field"
                placeholder="e.g. Ramesh Patel"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                disabled={isLoading}
                autoFocus
                autoComplete="name"
              />
            </div>

            {/* Phone */}
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
              />
              <span
                style={{
                  fontSize: '0.75rem',
                  color: phone.length === 10 ? 'var(--color-success)' : 'var(--color-text-muted)',
                  alignSelf: 'flex-end',
                  transition: 'color 0.2s',
                }}
              >
                {phone.length}/10
              </span>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  padding: '0.6rem 0.875rem',
                  borderRadius: 'var(--border-radius-md)',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid var(--color-danger)',
                  color: 'var(--color-danger)',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                }}
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="clock-in-btn"
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !phone || !name.trim()}
              style={{ width: '100%', marginTop: '0.5rem', fontSize: '1.05rem', padding: '0.875rem' }}
            >
              {isLoading ? 'Please wait…' : '🕐  Clock In'}
            </button>
          </form>
        </div>

        <p
          style={{
            marginTop: '1.5rem',
            fontSize: '0.78rem',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
          }}
        >
          Returning? Just enter your registered phone — your name is already saved.
        </p>
      </main>
    </div>
  );
}
