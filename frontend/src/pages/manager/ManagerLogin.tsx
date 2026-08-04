import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowRight, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ManagerLogin() {
  const [email, setEmail]       = useState('manager@admin.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [notConfirmed, setNotConfirmed] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNotConfirmed(false);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      if (signInError.message.toLowerCase().includes('not confirmed') || signInError.message.toLowerCase().includes('email') ) {
        setNotConfirmed(true);
      } else {
        setError(signInError.message);
      }
    } else {
      navigate('/manager');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      background: 'var(--color-bg-primary)',
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '3.5rem', height: '3.5rem', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-brand-primary), #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
            boxShadow: 'var(--shadow-glow)',
          }}>
            <Lock size={20} color="white" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>Manager Access</h1>
          <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Sign in to manage the worksite
          </p>
        </div>

        {/* Email not confirmed helper */}
        {notConfirmed && (
          <div style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid var(--color-warning)',
            borderRadius: '0.75rem',
            padding: '1rem 1.25rem',
            marginBottom: '1.25rem',
          }}>
            <p style={{ margin: '0 0 0.75rem', fontWeight: 700, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
              <AlertCircle size={16} /> Email not confirmed — one-time fix needed
            </p>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Run this SQL in your <strong style={{ color: 'var(--color-text-primary)' }}>Supabase Dashboard → SQL Editor</strong>:
            </p>
            <code style={{
              display: 'block',
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              fontSize: '0.78rem',
              color: '#10b981',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              marginBottom: '0.5rem',
            }}>
              {`UPDATE auth.users\nSET email_confirmed_at = now()\nWHERE email = 'manager@admin.com';`}
            </code>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              After running, come back and try logging in again.
            </p>
          </div>
        )}

        {/* Form card */}
        <div className="card">
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="manager@admin.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); setNotConfirmed(false); }}
                disabled={loading}
                required
                autoFocus
              />
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); setNotConfirmed(false); }}
                disabled={loading}
                required
              />
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-danger)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                <AlertCircle size={15} /> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !email || !password}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {loading ? 'Signing in…' : 'Sign In'} {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          Workers use the QR code to clock in — no login needed.
        </p>
      </div>
    </div>
  );
}
