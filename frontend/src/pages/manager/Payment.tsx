import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { CheckCircle, Clock, Calendar, Check, DollarSign } from 'lucide-react';

type Tab = 'pending' | 'completed';

interface AttendanceRecord {
  id: string;
  date: string;
  wage_for_day: number;
  payment_status: 'pending' | 'paid';
  check_in_time: string;
  check_out_time: string;
  workers: {
    id: string;
    name: string;
    phone: string;
  };
}

export default function Payment() {
  const [tab, setTab] = useState<Tab>('pending');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [customWages, setCustomWages] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('attendance')
      .select('id, date, wage_for_day, payment_status, check_in_time, check_out_time, workers(id, name, phone)')
      .eq('payment_status', tab === 'completed' ? 'paid' : 'pending')
      .not('check_out_time', 'is', null) // Only show records that have been clocked out
      .order('date', { ascending: tab === 'pending' }); // Ascending for pending, maybe descending for completed? Let's use ascending for both for consistency, or asc for pending, desc for completed.

    setRecords((data as unknown) as AttendanceRecord[]);
    setLoading(false);
  };

  const markAsPaid = async (id: string) => {
    setUpdating(id);
    const record = records.find(r => r.id === id);
    const wageInput = customWages[id];
    const finalWage = wageInput !== undefined ? parseFloat(wageInput) : (record?.wage_for_day || 0);

    await supabase.from('attendance').update({
      payment_status: 'paid',
      wage_for_day: finalWage
    }).eq('id', id);

    setUpdating(null);
    fetchData(); // Refresh the list
  };

  const markAllPaidForDate = async (_date: string, recordsForDate: AttendanceRecord[]) => {
    setUpdating(`all-${_date}`);
    const promises = recordsForDate.map(r => {
      const wageInput = customWages[r.id];
      const finalWage = wageInput !== undefined ? parseFloat(wageInput) : (r.wage_for_day || 0);
      return supabase.from('attendance').update({ payment_status: 'paid', wage_for_day: finalWage }).eq('id', r.id);
    });
    await Promise.all(promises);
    setUpdating(null);
    fetchData();
  };

  // Group records by date
  const groupedRecords: Record<string, AttendanceRecord[]> = {};
  records.forEach(r => {
    if (!groupedRecords[r.date]) groupedRecords[r.date] = [];
    groupedRecords[r.date].push(r);
  });

  // Sort dates (Ascending for pending, Descending for completed)
  const sortedDates = Object.keys(groupedRecords).sort((a, b) => {
    return tab === 'pending' ? a.localeCompare(b) : b.localeCompare(a);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h2 style={{ margin: 0, fontWeight: 700 }}>Payroll & Payments</h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Manage pending wages and payment history</p>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────── */}
      <div className="tabs-container" style={{ marginBottom: '1.25rem' }}>
        <div className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center' }}>
          <Clock size={16} /> Pending Payroll
        </div>
        <div className={`tab ${tab === 'completed' ? 'active' : ''}`} onClick={() => setTab('completed')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center' }}>
          <CheckCircle size={16} /> Completed Payments
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '2rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
            <p>Loading...</p>
          </div>
        ) : sortedDates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--color-bg-secondary)', borderRadius: '1rem', border: '1px dashed var(--color-border)' }}>
            <DollarSign size={40} style={{ margin: '0 auto 1rem', color: 'var(--color-text-muted)', opacity: 0.5 }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>No {tab} payments found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {sortedDates.map(date => {
              const dayRecords = groupedRecords[date];
              const totalAmount = dayRecords.reduce((sum, r) => {
                const wageInput = customWages[r.id];
                const finalWage = wageInput !== undefined ? parseFloat(wageInput) || 0 : (r.wage_for_day || 0);
                return sum + finalWage;
              }, 0);

              return (
                <div key={date} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  {/* Date Header */}
                  <div style={{
                    background: 'var(--color-bg-tertiary)', padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--color-brand-primary)', padding: '0.5rem', borderRadius: '0.5rem' }}>
                        <Calendar size={20} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{format(new Date(date), 'EEEE, MMM do, yyyy')}</h3>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{dayRecords.length} worker{dayRecords.length > 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>TOTAL DUE</p>
                        <p style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: tab === 'pending' ? 'var(--color-warning)' : 'var(--color-success)' }}>
                          ₹{totalAmount}
                        </p>
                      </div>
                      {tab === 'pending' && (
                        <button
                          className="btn btn-outline"
                          style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                          onClick={() => markAllPaidForDate(date, dayRecords)}
                          disabled={updating === `all-${date}`}
                        >
                          <Check size={14} /> {updating === `all-${date}` ? '...' : 'Pay All'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Worker Rows */}
                  <div>
                    {dayRecords.map((r, idx) => {
                      let hoursDisplay = '';
                      if (r.check_in_time && r.check_out_time) {
                        const h = (new Date(r.check_out_time).getTime() - new Date(r.check_in_time).getTime()) / 3600000;
                        const fullHours = Math.floor(h);
                        const mins = Math.floor((h - fullHours) * 60);
                        hoursDisplay = `${fullHours}h ${mins}m`;
                      }

                      return (
                      <div key={r.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '1rem 1.25rem', borderBottom: idx < dayRecords.length - 1 ? '1px solid var(--color-border)' : 'none'
                      }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text-primary)' }}>{r.workers?.name}</p>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {r.workers?.phone}
                            {hoursDisplay && <span style={{ color: 'var(--color-brand-primary)', fontWeight: 600, background: 'rgba(59, 130, 246, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem' }}>{hoursDisplay}</span>}
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          {tab === 'pending' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>₹</span>
                              <input
                                type="number"
                                className="input-field"
                                style={{ width: '80px', padding: '0.4rem', margin: 0, fontSize: '0.9rem' }}
                                placeholder="0"
                                value={customWages[r.id] !== undefined ? customWages[r.id] : (r.wage_for_day === null ? '' : r.wage_for_day)}
                                onChange={(e) => setCustomWages(prev => ({ ...prev, [r.id]: e.target.value }))}
                              />
                            </div>
                          ) : (
                            <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>₹{r.wage_for_day || 0}</span>
                          )}

                          {tab === 'pending' ? (
                            <button
                              className="btn btn-primary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: '#10b981', boxShadow: 'none' }}
                              onClick={() => markAsPaid(r.id)}
                              disabled={updating === r.id}
                            >
                              {updating === r.id ? '...' : 'Mark Paid'}
                            </button>
                          ) : (
                            <span style={{ color: 'var(--color-success)', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <CheckCircle size={12} /> Paid
                            </span>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
