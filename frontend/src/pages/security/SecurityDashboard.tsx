import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { format, parseISO } from 'date-fns';
import {
  Plus, LogOut, Moon, Sun, User, Clock, Clock3,
  ChevronLeft, ChevronRight, Edit2, Trash2, X, Check,
  Shield, Search, AlertCircle,
} from 'lucide-react';
import { useSecurityAuth } from '../../context/SecurityContext';
import { useTheme } from '../../context/ThemeContext';

type Tab = 'gate' | 'history';

interface Worker { id: string; name: string; phone: string; }
interface AttendanceRecord {
  id: string;
  worker_id: string;
  date: string;
  check_in_time: string;
  check_out_time: string | null;
  workers: Worker | null;
}

export default function SecurityDashboard() {
  const { logout } = useSecurityAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('gate');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Gate Entry ──────────────────────────────────────────────────────────────
  const [todayRecords, setTodayRecords]   = useState<AttendanceRecord[]>([]);
  const [gateLoading,  setGateLoading]    = useState(true);
  const [showAddForm,  setShowAddForm]    = useState(false);
  const [newName,      setNewName]        = useState('');
  const [newPhone,     setNewPhone]       = useState('');
  const [addLoading,   setAddLoading]     = useState(false);
  const [addError,     setAddError]       = useState('');

  // ── History ─────────────────────────────────────────────────────────────────
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [totalCount,     setTotalCount]     = useState(0);
  const [page,           setPage]           = useState(1);
  const [perPage,        setPerPage]        = useState<number | 'all'>(25);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setSearchDebounced(searchQuery); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Edit state ──────────────────────────────────────────────────────────────
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editCheckIn, setEditCheckIn] = useState('');
  const [editCheckOut, setEditCheckOut] = useState('');
  const [editError,   setEditError]   = useState('');

  const today = new Date().toISOString().split('T')[0];

  // ── Close menu on outside click ─────────────────────────────────────────────
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // ── Redirect to login if not authed (wait for session hydration first) ────────
  const { isLoggedIn, sessionChecked } = useSecurityAuth();
  useEffect(() => {
    if (sessionChecked && !isLoggedIn) navigate('/security/login', { replace: true });
  }, [isLoggedIn, sessionChecked, navigate]);

  // ── Fetch today's gate entries (only workers still clocked IN) ───────────────
  const fetchToday = useCallback(async () => {
    setGateLoading(true);
    const { data } = await supabase
      .from('attendance')
      .select('*, workers(id, name, phone)')
      .eq('date', today)
      .is('check_out_time', null)       // only active/clocked-in workers
      .order('check_in_time', { ascending: true });
    setTodayRecords((data ?? []) as AttendanceRecord[]);
    setGateLoading(false);
  }, [today]);

  // ── Fetch history ────────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);

    // If there's a search term, find matching worker IDs first
    let workerFilter: string[] | null = null;
    if (searchDebounced) {
      const { data: wData } = await supabase
        .from('workers')
        .select('id')
        .or(`name.ilike.%${searchDebounced}%,phone.ilike.%${searchDebounced}%`);
      workerFilter = (wData ?? []).map((w: any) => w.id);
      if (workerFilter.length === 0) {
        setHistoryRecords([]);
        setTotalCount(0);
        setHistoryLoading(false);
        return;
      }
    }

    let query = supabase
      .from('attendance')
      .select('*, workers(id, name, phone)', { count: 'exact' })
      .not('check_out_time', 'is', null)  // all records that have been clocked out (any date)
      .order('check_in_time', { ascending: false });

    if (workerFilter) query = query.in('worker_id', workerFilter);

    if (perPage !== 'all') {
      const from = (page - 1) * (perPage as number);
      const to = from + (perPage as number) - 1;
      query = query.range(from, to);
    }

    const { data, count } = await query;
    setHistoryRecords((data ?? []) as AttendanceRecord[]);
    setTotalCount(count ?? 0);
    setHistoryLoading(false);
  }, [today, page, perPage, searchDebounced]);

  useEffect(() => { fetchToday(); }, [fetchToday]);
  useEffect(() => { if (tab === 'history') fetchHistory(); }, [tab, fetchHistory]);

  // ── Clock out ────────────────────────────────────────────────────────────────
  const handleClockOut = async (id: string) => {
    const record = todayRecords.find(r => r.id === id);
    if (!record) return;

    const checkOut = new Date();
    const checkIn = new Date(record.check_in_time);
    const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

    let wage: number | null = null;
    if (hours >= 8) {
      const overtime = Math.floor(hours - 8);
      wage = 500 + (overtime * 100);
    }

    await supabase.from('attendance').update({ 
      check_out_time: checkOut.toISOString(),
      wage_for_day: wage
    }).eq('id', id);
    
    fetchToday();
  };

  // ── Add worker & clock in ────────────────────────────────────────────────────
  const handleAddWorker = async () => {
    if (!newName.trim() || !newPhone.trim()) { setAddError('Name and phone are required.'); return; }
    if (!/^\d{10}$/.test(newPhone.trim())) { setAddError('Phone number must be exactly 10 digits.'); return; }
    setAddLoading(true); setAddError('');

    // Find or create worker
    let workerId: string;
    const { data: existing } = await supabase.from('workers').select('id').eq('phone', newPhone.trim()).single();
    if (existing) {
      workerId = existing.id;
    } else {
      const { data: created, error: cErr } = await supabase.from('workers').insert([{ name: newName.trim(), phone: newPhone.trim() }]).select('id').single();
      if (cErr || !created) { setAddError(cErr?.message ?? 'Failed to create worker.'); setAddLoading(false); return; }
      workerId = created.id;
    }

    // Already clocked in today?
    const { data: alreadyIn } = await supabase.from('attendance').select('id').eq('worker_id', workerId).eq('date', today).single();
    if (alreadyIn) { setAddError('This worker is already clocked in today.'); setAddLoading(false); return; }

    const { error: iErr } = await supabase.from('attendance').insert([{
      worker_id: workerId, date: today, check_in_time: new Date().toISOString(), status: 'on_site',
    }]);
    if (iErr) { setAddError(iErr.message); setAddLoading(false); return; }

    setNewName(''); setNewPhone(''); setShowAddForm(false);
    setAddLoading(false);
    fetchToday();
  };

  // ── Save edit ────────────────────────────────────────────────────────────────
  const handleEditSave = async (id: string) => {
    setEditError('');
    if (!editCheckIn) { setEditError('Clock-in time is required.'); return; }
    if (editCheckOut && new Date(editCheckOut) <= new Date(editCheckIn)) {
      setEditError('Clock-out must be after clock-in.'); return;
    }

    const checkIn = new Date(editCheckIn);
    const checkOut = editCheckOut ? new Date(editCheckOut) : null;
    
    let wage: number | null = null;
    if (checkOut) {
      const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      if (hours >= 8) {
        const overtime = Math.floor(hours - 8);
        wage = 500 + (overtime * 100);
      }
    }

    const updateData: any = {
      check_in_time: checkIn.toISOString(),
      check_out_time: checkOut ? checkOut.toISOString() : null,
    };
    if (checkOut) {
      updateData.wage_for_day = wage;
    }

    await supabase.from('attendance').update(updateData).eq('id', id);
    setEditingId(null);
    fetchHistory();
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this attendance record? This cannot be undone.')) return;
    await supabase.from('attendance').delete().eq('id', id);
    setTotalCount(c => c - 1);
    setHistoryRecords(prev => prev.filter(r => r.id !== id));
  };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const formatDuration = (checkIn: string, checkOut: string | null) => {
    if (!checkOut) return '—';
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  const totalPages = perPage === 'all' ? 1 : Math.ceil(totalCount / (perPage as number));

  const paginationPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, '…', totalPages];
    if (page >= totalPages - 3) return [1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '…', page - 1, page, page + 1, '…', totalPages];
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-primary)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.875rem 1.5rem', background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, zIndex: 50,
        gap: '1rem', flexWrap: 'wrap',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #10b981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
          }}>
            <Shield size={16} color="white" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>Security</p>
            <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>Gate Portal</p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--color-bg-primary)', borderRadius: 8, padding: '0.25rem', order: 3, width: '100%', maxWidth: 280 }}>
          {(['gate', 'history'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '0.45rem 0.75rem', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: '0.82rem', transition: 'all 0.15s',
              background: tab === t ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent',
              color: tab === t ? 'white' : 'var(--color-text-muted)',
              boxShadow: tab === t ? '0 2px 8px rgba(16,185,129,0.3)' : 'none',
            }}>
              {t === 'gate' ? '🚪 Gate Entry' : '📋 History'}
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          <button onClick={toggleTheme} style={{
            background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
            borderRadius: '50%', width: '2.25rem', height: '2.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--color-text-secondary)',
          }}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button onClick={() => setUserMenuOpen(v => !v)} style={{
              background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none',
              borderRadius: '50%', width: '2.25rem', height: '2.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'white', boxShadow: '0 2px 8px rgba(16,185,129,0.4)',
            }}>
              <User size={16} />
            </button>
            {userMenuOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                borderRadius: 10, padding: '0.5rem', minWidth: '168px',
                boxShadow: 'var(--shadow-lg)', zIndex: 100,
              }}>
                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-border)', marginBottom: '0.25rem' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem' }}>Security Guard</p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Gate Portal</p>
                </div>
                <button onClick={() => { logout(); setUserMenuOpen(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
                  padding: '0.5rem 0.75rem', borderRadius: 6, background: 'none', border: 'none',
                  color: 'var(--color-danger)', fontSize: '0.875rem', cursor: 'pointer',
                }}>
                  <LogOut size={14} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, padding: '1.5rem', width: '100%', maxWidth: '1280px', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* GATE ENTRY TAB                                                        */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {tab === 'gate' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Today's Gate Entry</h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                  {format(new Date(), 'EEEE, MMMM do yyyy')} · {todayRecords.length} entries
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => { setShowAddForm(true); setAddError(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 12px rgba(16,185,129,0.35)' }}>
                <Plus size={16} /> Add Worker
              </button>
            </div>

            {gateLoading ? (
              <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
                <div className="spinner" />
              </div>
            ) : todayRecords.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '5rem 2rem',
                background: 'var(--color-bg-secondary)', borderRadius: 16,
                border: '1px dashed var(--color-border)',
              }}>
                <Clock3 size={44} style={{ marginBottom: '0.875rem', color: 'var(--color-text-muted)', opacity: 0.5 }} />
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>No entries yet today</p>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Click "Add Worker" to record the first entry.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 640 }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-primary)', borderBottom: '2px solid var(--color-border)' }}>
                      {['#', 'Worker', 'Phone', 'Clock In', 'Clock Out', 'Duration', 'Status', 'Action'].map(h => (
                        <th key={h} style={{
                          padding: '0.75rem 1rem', textAlign: 'left',
                          fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase',
                          letterSpacing: '0.07em', color: 'var(--color-text-muted)', whiteSpace: 'nowrap',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {todayRecords.map((rec, idx) => {
                      const isIn = !rec.check_out_time;
                      return (
                        <tr key={rec.id} style={{
                          borderBottom: '1px solid var(--color-border)',
                          background: isIn ? 'rgba(16,185,129,0.04)' : 'transparent',
                          transition: 'background 0.15s',
                        }}>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.82rem' }}>{idx + 1}</td>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span style={{
                                width: '1.75rem', height: '1.75rem', borderRadius: '50%', flexShrink: 0,
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.6rem', fontWeight: 800, color: 'white',
                              }}>
                                {(rec.workers?.name ?? '?').slice(0, 2).toUpperCase()}
                              </span>
                              {rec.workers?.name ?? '—'}
                            </div>
                          </td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{rec.workers?.phone ?? '—'}</td>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--color-text-primary)' }}>
                            {format(new Date(rec.check_in_time), 'h:mm a')}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', fontWeight: 600, whiteSpace: 'nowrap', color: rec.check_out_time ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                            {rec.check_out_time ? format(new Date(rec.check_out_time), 'h:mm a') : '—'}
                          </td>
                          <td style={{ padding: '0.875rem 1rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                            {formatDuration(rec.check_in_time, rec.check_out_time)}
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            <span style={{
                              padding: '0.2rem 0.65rem', borderRadius: 100,
                              fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.06em',
                              background: isIn ? 'rgba(16,185,129,0.15)' : 'rgba(100,116,139,0.12)',
                              color: isIn ? '#10b981' : 'var(--color-text-muted)',
                            }}>
                              {isIn ? '● IN' : '✓ OUT'}
                            </span>
                          </td>
                          <td style={{ padding: '0.875rem 1rem' }}>
                            {isIn ? (
                              <button onClick={() => handleClockOut(rec.id)} style={{
                                padding: '0.35rem 0.875rem', borderRadius: 6, cursor: 'pointer',
                                border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)',
                                color: 'var(--color-danger)', fontSize: '0.78rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap',
                              }}>
                                <LogOut size={13} /> Clock Out
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>✓ Done</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {/* HISTORY TAB                                                           */}
        {/* ═══════════════════════════════════════════════════════════════════════ */}
        {tab === 'history' && (
          <>
            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Attendance History</h2>
                {!historyLoading && <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{totalCount} records</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                {/* Search */}
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                  <input
                    className="input-field"
                    placeholder="Search worker…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '2.25rem', width: 200, fontSize: '0.85rem', padding: '0.5rem 0.75rem 0.5rem 2.25rem' }}
                  />
                </div>
                {/* Per page */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Per page:</span>
                  <select
                    className="input-field"
                    value={perPage}
                    onChange={e => { setPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value)); setPage(1); }}
                    style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value="all">All</option>
                  </select>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: '4rem' }}>
                <div className="spinner" />
              </div>
            ) : historyRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--color-bg-secondary)', borderRadius: 16, border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)' }}>
                <p style={{ margin: 0, fontWeight: 600 }}>No records found{searchDebounced ? ` for "${searchDebounced}"` : ''}.</p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', marginBottom: '1rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-primary)', borderBottom: '2px solid var(--color-border)' }}>
                        {['Date', 'Worker', 'Phone', 'Clock In', 'Clock Out', 'Duration', 'Actions'].map(h => (
                          <th key={h} style={{
                            padding: '0.75rem 1rem', textAlign: 'left',
                            fontWeight: 800, fontSize: '0.68rem', textTransform: 'uppercase',
                            letterSpacing: '0.07em', color: 'var(--color-text-muted)', whiteSpace: 'nowrap',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historyRecords.map(rec => {
                        const isEditing = editingId === rec.id;
                        return (
                          <tr key={rec.id} style={{ borderBottom: '1px solid var(--color-border)', background: isEditing ? 'rgba(59,130,246,0.04)' : 'transparent' }}>
                            <td style={{ padding: '0.875rem 1rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', fontWeight: 600, fontSize: '0.82rem' }}>
                              {format(parseISO(rec.date), 'MMM d, yyyy')}
                            </td>
                            <td style={{ padding: '0.875rem 1rem', fontWeight: 700 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{
                                  width: '1.6rem', height: '1.6rem', borderRadius: '50%', flexShrink: 0,
                                  background: 'linear-gradient(135deg, #10b981, #059669)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '0.55rem', fontWeight: 800, color: 'white',
                                }}>
                                  {(rec.workers?.name ?? '?').slice(0, 2).toUpperCase()}
                                </span>
                                {rec.workers?.name ?? '—'}
                              </div>
                            </td>
                            <td style={{ padding: '0.875rem 1rem', color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: '0.82rem' }}>{rec.workers?.phone ?? '—'}</td>

                            {isEditing ? (
                              <>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  <input type="datetime-local" className="input-field"
                                    value={editCheckIn} onChange={e => setEditCheckIn(e.target.value)}
                                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', minWidth: 170 }} />
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                  <input type="datetime-local" className="input-field"
                                    value={editCheckOut} onChange={e => setEditCheckOut(e.target.value)}
                                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.5rem', minWidth: 170 }} />
                                </td>
                                <td style={{ padding: '0.875rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</td>
                              </>
                            ) : (
                              <>
                                <td style={{ padding: '0.875rem 1rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                  {format(new Date(rec.check_in_time), 'h:mm a')}
                                </td>
                                <td style={{ padding: '0.875rem 1rem', fontWeight: 600, whiteSpace: 'nowrap', color: rec.check_out_time ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                                  {rec.check_out_time ? format(new Date(rec.check_out_time), 'h:mm a') : '—'}
                                </td>
                                <td style={{ padding: '0.875rem 1rem', fontSize: '0.82rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                  {formatDuration(rec.check_in_time, rec.check_out_time)}
                                </td>
                              </>
                            )}

                            <td style={{ padding: '0.875rem 1rem' }}>
                              {isEditing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                  {editError && (
                                    <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <AlertCircle size={11} /> {editError}
                                    </p>
                                  )}
                                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    <button onClick={() => handleEditSave(rec.id)} style={{ padding: '0.3rem 0.65rem', borderRadius: 6, border: '1px solid #10b981', background: 'rgba(16,185,129,0.1)', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', fontWeight: 700 }}>
                                      <Check size={13} /> Save
                                    </button>
                                    <button onClick={() => { setEditingId(null); setEditError(''); }} style={{ padding: '0.3rem 0.65rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem' }}>
                                      <X size={13} /> Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: '0.35rem' }}>
                                  <button onClick={() => {
                                    setEditingId(rec.id); setEditError('');
                                    setEditCheckIn(new Date(rec.check_in_time).toISOString().slice(0, 16));
                                    setEditCheckOut(rec.check_out_time ? new Date(rec.check_out_time).toISOString().slice(0, 16) : '');
                                  }} style={{ padding: '0.3rem 0.65rem', borderRadius: 6, border: '1px solid var(--color-border)', background: 'none', color: 'var(--color-brand-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', fontWeight: 600 }}>
                                    <Edit2 size={13} /> Edit
                                  </button>
                                  <button onClick={() => handleDelete(rec.id)} style={{ padding: '0.3rem 0.65rem', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.07)', color: 'var(--color-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.78rem', fontWeight: 600 }}>
                                    <Trash2 size={13} /> Delete
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Pagination ─────────────────────────────────────────────── */}
                {perPage !== 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      Showing <strong>{((page - 1) * (perPage as number)) + 1}</strong>–<strong>{Math.min(page * (perPage as number), totalCount)}</strong> of <strong>{totalCount}</strong>
                    </p>
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <button onClick={() => setPage(1)} disabled={page === 1} className="btn btn-outline" style={{ padding: '0.4rem 0.55rem', fontSize: '0.78rem' }}>«</button>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-outline" style={{ padding: '0.4rem 0.55rem', fontSize: '0.78rem' }}>
                          <ChevronLeft size={14} />
                        </button>
                        {paginationPages().map((p, i) =>
                          p === '…' ? (
                            <span key={`ellipsis-${i}`} style={{ padding: '0.4rem 0.3rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>…</span>
                          ) : (
                            <button key={p} onClick={() => setPage(p as number)} style={{
                              padding: '0.4rem 0.65rem', borderRadius: 6, border: '1px solid',
                              borderColor: page === p ? 'var(--color-brand-primary)' : 'var(--color-border)',
                              background: page === p ? 'var(--color-brand-primary)' : 'transparent',
                              color: page === p ? 'white' : 'var(--color-text-primary)',
                              cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
                            }}>{p}</button>
                          )
                        )}
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-outline" style={{ padding: '0.4rem 0.55rem', fontSize: '0.78rem' }}>
                          <ChevronRight size={14} />
                        </button>
                        <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="btn btn-outline" style={{ padding: '0.4rem 0.55rem', fontSize: '0.78rem' }}>»</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* ── Add Worker Modal ─────────────────────────────────────────────────────── */}
      {showAddForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 200, padding: '1rem',
        }}>
          <div style={{
            background: 'var(--color-bg-secondary)', borderRadius: 16,
            padding: '1.75rem', width: '100%', maxWidth: '440px',
            boxShadow: 'var(--shadow-xl)', border: '1px solid var(--color-border)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Clock size={20} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Add Worker Entry</h3>
              </div>
              <button onClick={() => { setShowAddForm(false); setAddError(''); setNewName(''); setNewPhone(''); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0.25rem' }}>
                <X size={20} />
              </button>
            </div>

            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input className="input-field" placeholder="e.g. Ramesh Kumar" value={newName} onChange={e => { setNewName(e.target.value); setAddError(''); }} autoFocus />
            </div>
            <div className="input-group">
              <label className="input-label">Phone Number</label>
              <input className="input-field" type="tel" placeholder="e.g. 9876543210" value={newPhone}
                onChange={e => { 
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setNewPhone(val); 
                  setAddError(''); 
                }}
                onKeyDown={e => e.key === 'Enter' && handleAddWorker()} />
            </div>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              If this phone number already exists, the existing worker profile will be used.
            </p>

            {addError && (
              <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={14} /> {addError}
              </p>
            )}

            <button className="btn btn-primary" style={{
              width: '100%', justifyContent: 'center', gap: '0.5rem',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              boxShadow: '0 4px 12px rgba(16,185,129,0.35)',
            }} onClick={handleAddWorker} disabled={addLoading}>
              <Clock size={16} /> {addLoading ? 'Clocking In…' : 'Clock In Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
