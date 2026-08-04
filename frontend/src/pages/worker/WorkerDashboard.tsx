import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { MapPin, CheckCircle, Clock, LogOut, WifiOff, User, Sun, Moon, History, ChevronUp, Send } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function WorkerDashboard() {
  const { worker, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [attendanceRecord, setAttendanceRecord] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [locationError, setLocationError] = useState<string>('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [buttonLocked, setButtonLocked] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); syncOfflineQueue(); };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);

    if (worker) {
      checkTodayAttendance();
      fetchAssignments();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [worker]);

  const checkTodayAttendance = async () => {
    if (!worker) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data } = await supabase.from('attendance').select('*').eq('worker_id', worker.id).eq('date', today).maybeSingle();
      setAttendanceRecord(data);
    } catch { console.log('Attendance fetch failed (possibly offline)'); }
  };

  const fetchAssignments = async () => {
    if (!worker) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      const { data } = await supabase
        .from('work_assignments')
        .select('*, work_orders(*, work_types(*))')
        .eq('worker_id', worker.id)
        .eq('work_orders.date', today)
        .order('created_at', { ascending: false });
      setAssignments((data ?? []).filter((a: any) => a.work_orders !== null));
    } catch { console.log('Assignments fetch failed'); }
  };

  const syncOfflineQueue = async () => {
    const queueStr = localStorage.getItem('offlineCheckins');
    if (!queueStr) return;
    const queue = JSON.parse(queueStr);
    if (!queue.length) return;
    setLocationStatus('Syncing offline records…');
    const stillFailed: any[] = [];
    for (const record of queue) {
      try {
        if (record.type === 'check_in') {
          await supabase.from('attendance').insert([{ worker_id: record.worker_id, date: record.date, check_in_time: record.time }]);
        } else {
          await supabase.from('attendance').update({ check_out_time: record.time }).eq('worker_id', record.worker_id).eq('date', record.date);
        }
      } catch { stillFailed.push(record); }
    }
    localStorage.setItem('offlineCheckins', JSON.stringify(stillFailed));
    setLocationStatus('');
    checkTodayAttendance();
  };

  const queueOfflineAction = (action: any) => {
    const queue = JSON.parse(localStorage.getItem('offlineCheckins') || '[]');
    queue.push(action);
    localStorage.setItem('offlineCheckins', JSON.stringify(queue));
    setLocationStatus('Queued — will sync when online.');
    if (action.type === 'check_in') setAttendanceRecord({ id: 'temp', check_in_time: action.time });
    else setAttendanceRecord((prev: any) => ({ ...prev, check_out_time: action.time }));
  };

  const handleAction = async () => {
    if (!worker) return;
    setLoadingAction(true);
    setButtonLocked(true);
    setLocationError('');
    setLocationStatus('');
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    try {
      if (!attendanceRecord || attendanceRecord.id === 'temp') {
        setLocationStatus('Recording check-in…');
        if (isOffline) { queueOfflineAction({ type: 'check_in', worker_id: worker.id, date: today, time: now }); return; }

        const { data, error } = await supabase.from('attendance').insert([{
          worker_id: worker.id, date: today, check_in_time: now, status: 'on_site'
        }]).select().single();

        if (error) {
          if (error.message.includes('Failed to fetch')) queueOfflineAction({ type: 'check_in', worker_id: worker.id, date: today, time: now });
          else setLocationError('Check-in failed. Please try again.');
        } else if (data) {
          setAttendanceRecord(data);
          setLocationStatus('');
        }
      } else if (!attendanceRecord.check_out_time) {
        setLocationStatus('Recording check-out…');
        if (isOffline) { queueOfflineAction({ type: 'check_out', worker_id: worker.id, date: today, time: now }); return; }
        const { data, error } = await supabase.from('attendance').update({ check_out_time: now }).eq('worker_id', worker.id).eq('date', today).select().single();
        if (error) {
          if (error.message.includes('Failed to fetch')) queueOfflineAction({ type: 'check_out', worker_id: worker.id, date: today, time: now });
          else setLocationError('Check-out failed. Please try again.');
        } else if (data) { setAttendanceRecord(data); setLocationStatus(''); }
      }
    } finally {
      setLoadingAction(false);
      setTimeout(() => setButtonLocked(false), 3000);
    }
  };

  // Assignment actions
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

  const isCheckedIn = attendanceRecord && !attendanceRecord.check_out_time;
  const isFinished  = !!attendanceRecord?.check_out_time;

  const [elapsedTime, setElapsedTime] = useState('');

  useEffect(() => {
    if (isCheckedIn && attendanceRecord?.check_in_time) {
      const updateTimer = () => {
        const start = new Date(attendanceRecord.check_in_time).getTime();
        const diff = Math.max(0, Date.now() - start);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff / (1000 * 60)) % 60);
        setElapsedTime(`${hours}h ${mins}m`);
      };
      updateTimer();
      // Update timer every minute
      const intId = setInterval(updateTimer, 60000);
      return () => clearInterval(intId);
    }
  }, [isCheckedIn, attendanceRecord]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-primary)' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 1.25rem', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
        <div>
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{format(new Date(), 'EEEE, MMM do')}</p>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Hi, {worker?.name} 👋</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button onClick={toggleTheme} aria-label="Toggle theme" style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '50%', width: '2.25rem', height: '2.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button id="user-menu-btn" onClick={() => setUserMenuOpen(v => !v)} style={{ background: 'linear-gradient(135deg,var(--color-brand-primary),#6366f1)', border: 'none', borderRadius: '50%', width: '2.25rem', height: '2.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', boxShadow: '0 2px 8px rgba(59,130,246,0.4)' }}>
              <User size={16} />
            </button>
            {userMenuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: '0.5rem', minWidth: '160px', boxShadow: 'var(--shadow-lg)', zIndex: 100, animation: 'fadeIn 0.15s ease' }}>
                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', marginBottom: '0.25rem' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem' }}>{worker?.name}</p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{worker?.phone}</p>
                </div>
                <Link to="/history" onClick={() => setUserMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--border-radius-sm)', color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
                  <History size={14} /> History
                </Link>
                <button id="logout-btn" onClick={() => { logout(); setUserMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 0.75rem', borderRadius: 'var(--border-radius-sm)', background: 'none', border: 'none', color: 'var(--color-danger)', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <LogOut size={14} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Offline Banner ──────────────────────────────────────────── */}
      {isOffline && (
        <div style={{ background: 'rgba(239,68,68,0.15)', borderBottom: '1px solid var(--color-danger)', color: 'var(--color-danger)', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
          <WifiOff size={15} /> Offline — changes will sync when connection returns
        </div>
      )}

      <main style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* ── Clock In/Out ─────────────────────────────────────────── */}
        {isFinished ? (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{ width: '7rem', height: '7rem', borderRadius: '50%', background: 'var(--color-success-dim)', border: '2px solid var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <CheckCircle size={48} color="var(--color-success)" />
            </div>
            <h2 style={{ color: 'var(--color-text-primary)' }}>Shift Complete!</h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              {format(new Date(attendanceRecord.check_in_time), 'h:mm a')} – {format(new Date(attendanceRecord.check_out_time), 'h:mm a')}
            </p>
            {attendanceRecord.wage_for_day != null && (
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)' }}>₹{attendanceRecord.wage_for_day}</p>
            )}
          </div>
        ) : (
          <>
            <button
              className={`btn-giant ${isCheckedIn ? 'check-out' : 'check-in'} ${loadingAction ? 'animate-pulse-slow' : ''}`}
              onClick={handleAction}
              disabled={loadingAction || buttonLocked}
            >
              {loadingAction ? <MapPin size={40} /> : isCheckedIn ? <LogOut size={40} /> : <CheckCircle size={40} />}
              <span style={{ fontSize: '1rem', marginTop: '0.5rem' }}>
                {loadingAction ? 'Please wait…' : isCheckedIn ? 'Clock Out' : 'Clock In'}
              </span>
              {isCheckedIn && attendanceRecord?.check_in_time && (
                <span style={{ fontSize: '0.85rem', opacity: 0.9, fontWeight: 600 }}>{elapsedTime} elapsed</span>
              )}
            </button>

            {locationStatus && <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: 'var(--color-text-secondary)', textAlign: 'center', maxWidth: '280px' }}>{locationStatus}</p>}
            {locationError && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--border-radius-md)', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)', fontSize: '0.875rem', textAlign: 'center', maxWidth: '300px' }}>
                {locationError}
                <button onClick={() => { setLocationError(''); }} style={{ display: 'block', margin: '0.4rem auto 0', background: 'none', border: 'none', color: 'var(--color-brand-primary)', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>Dismiss</button>
              </div>
            )}
          </>
        )}

        {/* ── Work Assignments ─────────────────────────────────────── */}
        <div style={{ width: '100%', maxWidth: '480px', marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Clock size={14} /> Today's Assigned Work
          </h3>

          {assignments.length === 0 ? (
            <div style={{ background: 'var(--color-bg-secondary)', border: '1px dashed var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>No work assigned for today yet.</p>
            </div>
          ) : (
            assignments.map(a => <AssignmentCard key={a.id} assignment={a} onUpdate={updateDoneQty} onSubmit={submitForReview} />)
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
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pct = a.assigned_quantity > 0 ? Math.round((a.done_quantity / a.assigned_quantity) * 100) : 0;

  const statusColors: Record<string, string> = {
    pending: '#f59e0b', in_progress: '#3b82f6', under_review: '#8b5cf6', completed: '#10b981'
  };
  const sc = statusColors[a.status] ?? '#94a3b8';

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(a.id, a.done_quantity, a.assigned_quantity, parseInt(doneInput) || 0);
    setSaving(false);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await onSubmit(a.id);
    setSubmitting(false);
  };

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
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{a.done_quantity}/{a.assigned_quantity}</span>
      </div>

      {/* Input + buttons */}
      {(a.status === 'pending' || a.status === 'in_progress') && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: 'var(--border-radius-md)', padding: '0.35rem 0.75rem' }}>
            <button
              onClick={() => setDoneInput(String(Math.max(0, parseInt(doneInput || '0') - 1)))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '1.1rem', padding: 0, lineHeight: 1 }}
            >−</button>
            <input
              type="number"
              value={doneInput}
              onChange={e => setDoneInput(e.target.value)}
              min={0}
              max={a.assigned_quantity}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--color-text-primary)', fontWeight: 700, fontSize: '0.95rem', textAlign: 'center', width: '3rem' }}
            />
            <button
              onClick={() => setDoneInput(String(Math.min(a.assigned_quantity, parseInt(doneInput || '0') + 1)))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '1.1rem', padding: 0, lineHeight: 1 }}
            >+</button>
          </div>
          <button className="btn btn-outline" onClick={handleSave} disabled={saving || doneInput === String(a.done_quantity)} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}>
            {saving ? '…' : 'Save'}
          </button>
          {parseInt(doneInput) >= a.assigned_quantity && a.done_quantity >= a.assigned_quantity && (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: '#8b5cf6', boxShadow: '0 4px 12px rgba(139,92,246,0.4)' }}>
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
