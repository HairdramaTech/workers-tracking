import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { Clock, LogOut, User, Sun, Moon, Send, CheckCircle, ChevronUp, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export default function WorkerDashboard() {
  const { worker, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const fetchAssignments = async () => {
    if (!worker) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('work_assignments')
      .select('*, work_orders(*, work_types(*))')
      .eq('worker_id', worker.id)
      .order('created_at', { ascending: false });
    // Show today's open tasks + any not-yet-completed older ones
    setAssignments(
      (data ?? []).filter((a: any) => a.work_orders !== null && a.work_orders.date === today)
    );
    setLoading(false);
  };

  useEffect(() => { fetchAssignments(); }, [worker]);

  const updateDoneQty = async (id: string, _current: number, assigned: number, newVal: number) => {
    const clamped = Math.min(Math.max(0, newVal), assigned);
    const newStatus = clamped === 0 ? 'pending' : 'in_progress';
    await supabase.from('work_assignments').update({ done_quantity: clamped, status: newStatus }).eq('id', id);
    fetchAssignments();
  };

  const submitForReview = async (id: string) => {
    await supabase.from('work_assignments').update({ status: 'under_review', submitted_at: new Date().toISOString() }).eq('id', id);
    fetchAssignments();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-primary)' }}>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.875rem 1.25rem', background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, zIndex: 30,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            {format(new Date(), 'EEEE, MMM do')}
          </p>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Hi, {worker?.name} 👋</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button onClick={() => fetchAssignments()} aria-label="Refresh" style={{
            background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
            borderRadius: '50%', width: '2.25rem', height: '2.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--color-text-secondary)',
          }}>
            <RefreshCw size={15} />
          </button>
          <button onClick={toggleTheme} aria-label="Toggle theme" style={{
            background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
            borderRadius: '50%', width: '2.25rem', height: '2.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--color-text-secondary)',
          }}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {/* User menu */}
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button id="user-menu-btn" onClick={() => setUserMenuOpen(v => !v)} style={{
              background: 'linear-gradient(135deg,var(--color-brand-primary),#6366f1)',
              border: 'none', borderRadius: '50%', width: '2.25rem', height: '2.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white', boxShadow: '0 2px 8px rgba(59,130,246,0.4)',
            }}>
              <User size={16} />
            </button>
            {userMenuOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-md)', padding: '0.5rem', minWidth: '160px',
                boxShadow: 'var(--shadow-lg)', zIndex: 100, animation: 'fadeIn 0.15s ease',
              }}>
                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', marginBottom: '0.25rem' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem' }}>{worker?.name}</p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{worker?.phone}</p>
                </div>
                <button id="logout-btn" onClick={() => { logout(); setUserMenuOpen(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                  padding: '0.5rem 0.75rem', borderRadius: 'var(--border-radius-sm)',
                  background: 'none', border: 'none', color: 'var(--color-danger)',
                  fontSize: '0.875rem', cursor: 'pointer',
                }}>
                  <LogOut size={14} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '480px' }}>
          <h3 style={{
            fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--color-text-muted)',
            marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
          }}>
            <Clock size={14} /> Today's Assigned Work
          </h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ marginBottom: '0.5rem', color: 'var(--color-brand-primary)' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>Loading…</p>
            </div>
          ) : assignments.length === 0 ? (
            <div style={{
              background: 'var(--color-bg-secondary)', border: '1px dashed var(--color-border)',
              borderRadius: '0.75rem', padding: '2.5rem 1.5rem', textAlign: 'center',
            }}>
              <Clock size={36} style={{ marginBottom: '0.75rem', color: 'var(--color-text-muted)', opacity: 0.5 }} />
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-primary)' }}>No tasks assigned yet</p>
              <p style={{ margin: '0.3rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Check back later or contact your manager.
              </p>
            </div>
          ) : (
            assignments.map(a => (
              <AssignmentCard key={a.id} assignment={a} onUpdate={updateDoneQty} onSubmit={submitForReview} />
            ))
          )}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}

// ─── Assignment Card ──────────────────────────────────────────────────────────
function AssignmentCard({ assignment: a, onUpdate, onSubmit }: {
  assignment: any;
  onUpdate: (id: string, current: number, assigned: number, newVal: number) => void;
  onSubmit: (id: string) => void;
}) {
  const [doneInput, setDoneInput] = useState(String(a.done_quantity));
  const [saving, setSaving]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pct = a.assigned_quantity > 0 ? Math.round((a.done_quantity / a.assigned_quantity) * 100) : 0;

  const statusColors: Record<string, string> = {
    pending: '#f59e0b', in_progress: '#3b82f6', under_review: '#8b5cf6', completed: '#10b981',
  };
  const sc = statusColors[a.status] ?? '#94a3b8';

  return (
    <div className="card" style={{ marginBottom: '0.875rem', padding: '1rem' }}>
      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
            {a.work_orders?.work_types?.name ?? '—'}
          </p>
          {a.work_orders?.sku && (
            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--color-brand-primary)', background: 'rgba(59,130,246,0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', marginTop: '0.25rem', display: 'inline-block' }}>
              {a.work_orders.sku}
            </span>
          )}
        </div>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: sc, background: `${sc}20`, padding: '0.15rem 0.6rem', borderRadius: '100px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
          {a.status.replace('_', ' ')}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ flex: 1, height: '6px', background: 'var(--color-border)', borderRadius: '100px' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: sc, borderRadius: '100px', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {a.done_quantity}/{a.assigned_quantity}
        </span>
      </div>

      {/* Input + buttons */}
      {(a.status === 'pending' || a.status === 'in_progress') && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: '0.35rem 0.75rem' }}>
            <button onClick={() => setDoneInput(String(Math.max(0, parseInt(doneInput || '0') - 1)))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '1.1rem', padding: 0, lineHeight: 1 }}>−</button>
            <input type="number" value={doneInput} onChange={e => setDoneInput(e.target.value)}
              min={0} max={a.assigned_quantity}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '0.95rem', textAlign: 'center', width: '3rem' }} />
            <button onClick={() => setDoneInput(String(Math.min(a.assigned_quantity, parseInt(doneInput || '0') + 1)))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '1.1rem', padding: 0, lineHeight: 1 }}>+</button>
          </div>
          <button className="btn btn-outline" onClick={async () => { setSaving(true); await onUpdate(a.id, a.done_quantity, a.assigned_quantity, parseInt(doneInput) || 0); setSaving(false); }}
            disabled={saving || doneInput === String(a.done_quantity)}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
            {saving ? '…' : 'Save'}
          </button>
          {parseInt(doneInput) >= a.assigned_quantity && a.done_quantity >= a.assigned_quantity && (
            <button className="btn btn-primary" onClick={async () => { setSubmitting(true); await onSubmit(a.id); setSubmitting(false); }}
              disabled={submitting}
              style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: '#8b5cf6', boxShadow: '0 4px 12px rgba(139,92,246,0.4)' }}>
              <Send size={14} /> {submitting ? '…' : 'Submit'}
            </button>
          )}
        </div>
      )}

      {a.status === 'under_review' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(139,92,246,0.1)', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#8b5cf6' }}>
          <ChevronUp size={14} /> Submitted — waiting for manager approval
        </div>
      )}
      {a.status === 'completed' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(16,185,129,0.1)', borderRadius: '0.5rem', fontSize: '0.8rem', color: '#10b981' }}>
          <CheckCircle size={14} /> Approved & Completed!
        </div>
      )}
    </div>
  );
}
