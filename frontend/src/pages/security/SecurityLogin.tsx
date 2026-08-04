import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSecurityAuth } from '../../context/SecurityContext';
import { useTheme } from '../../context/ThemeContext';
import { Lock, AlertCircle, Shield, Moon, Sun } from 'lucide-react';

export default function SecurityLogin() {
  const { login } = useSecurityAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.ok) {
      navigate('/security');
    } else {
      setError(result.error ?? 'Invalid credentials.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg-primary)', padding: '1.5rem', position: 'relative',
    }}>
      {/* Theme toggle top-right */}
      <button onClick={toggleTheme} aria-label="Toggle theme" style={{
        position: 'absolute', top: '1.25rem', right: '1.25rem',
        background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
        borderRadius: '50%', width: '2.25rem', height: '2.25rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--color-text-secondary)',
      }}>
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '4rem', height: '4rem', borderRadius: '1rem', margin: '0 auto 1rem',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(16,185,129,0.35)',
          }}>
            <Shield size={28} color="white" />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>Security Portal</h1>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            Gate Entry Management
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '2rem' }}>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input
                className="input-field"
                type="email"
                placeholder="security@admin.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                autoFocus
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                <input
                  className="input-field"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  style={{ paddingLeft: '2.25rem' }}
                  required
                />
              </div>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' }}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
