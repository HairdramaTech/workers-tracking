import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, CheckCircle, Clock, AlertCircle, TrendingUp } from 'lucide-react';

export default function ManagerDashboardTab() {
  const [stats, setStats] = useState({ workers: 0, checkedIn: 0, pending: 0, completed: 0, underReview: 0 });
  const [recentWorkers, setRecentWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    Promise.all([
      supabase.from('workers').select('id', { count: 'exact', head: true }),
      supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today),
      supabase.from('work_assignments').select('status').eq('work_orders.date', today),
      supabase.from('attendance').select('*, workers(name,phone)').eq('date', today).order('check_in_time', { ascending: false }).limit(5),
    ]).then(([w, att, wa, recent]) => {
      const assignments = (wa.data ?? []);
      setStats({
        workers: w.count ?? 0,
        checkedIn: att.count ?? 0,
        pending: assignments.filter((a: any) => a.status === 'pending').length,
        completed: assignments.filter((a: any) => a.status === 'completed').length,
        underReview: assignments.filter((a: any) => a.status === 'under_review').length,
      });
      setRecentWorkers(recent.data ?? []);
      setLoading(false);
    });
  }, []);

  const statCards = [
    { label: 'Total Workers', value: stats.workers, icon: <Users size={20} />, color: '#3b82f6' },
    { label: 'Checked In Today', value: stats.checkedIn, icon: <CheckCircle size={20} />, color: '#10b981' },
    { label: 'Work Under Review', value: stats.underReview, icon: <AlertCircle size={20} />, color: '#8b5cf6' },
    { label: 'Work Completed Today', value: stats.completed, icon: <TrendingUp size={20} />, color: '#f59e0b' },
  ];

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontWeight: 700 }}>Dashboard</h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
          Overview for {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {statCards.map(s => (
          <div key={s.label} className="card" style={{ borderLeft: `4px solid ${s.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>{s.label}</p>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
            <p style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: s.color }}>{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent check-ins */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} /> Today's Check-ins
        </h3>
        {recentWorkers.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No check-ins yet today.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentWorkers.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--color-bg-primary)', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: r.status === 'on_site' ? '#10b981' : '#f59e0b', boxShadow: `0 0 6px ${r.status === 'on_site' ? '#10b981' : '#f59e0b'}` }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '0.875rem' }}>{r.workers?.name}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{r.workers?.phone}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                    In: {r.check_in_time ? new Date(r.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </p>
                  <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-success)', fontSize: '0.875rem' }}>₹{r.wage_for_day ?? 0}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
