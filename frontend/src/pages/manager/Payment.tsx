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

  useEffect(() => {
    fetchData();
  }, [tab]);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('attendance')
      .select('id, date, wage_for_day, payment_status, workers(id, name, phone)')
      .eq('payment_status', tab)
      .not('check_out_time', 'is', null) // Only show records that have been clocked out
      .order('date', { ascending: tab === 'pending' }); // Ascending for pending, maybe descending for completed? Let's use ascending for both for consistency, or asc for pending, desc for completed.
    
    setRecords((data as unknown) as AttendanceRecord[]);
    setLoading(false);
  };

  const markAsPaid = async (id: string) => {
    setUpdating(id);
    await supabase.from('attendance').update({ payment_status: 'paid' }).eq('id', id);
    setUpdating(null);
    fetchData(); // Refresh the list
  };

  const markAllPaidForDate = async (_date: string, recordsForDate: AttendanceRecord[]) => {
    const ids = recordsForDate.map(r => r.id);
    await supabase.from('attendance').update({ payment_status: 'paid' }).in('id', ids);
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
              const totalAmount = dayRecords.reduce((sum, r) => sum + (r.wage_for_day || 0), 0);
              
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
                        >
                          <Check size={14} /> Pay All
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Worker Rows */}
                  <div>
                    {dayRecords.map((r, idx) => (
                      <div key={r.id} style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                        padding: '1rem 1.25rem', borderBottom: idx < dayRecords.length - 1 ? '1px solid var(--color-border)' : 'none'
                      }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text-primary)' }}>{r.workers?.name}</p>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{r.workers?.phone}</p>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>₹{r.wage_for_day || 0}</span>
                          
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
                    ))}
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
