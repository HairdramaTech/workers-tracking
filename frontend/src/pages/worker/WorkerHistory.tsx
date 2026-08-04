import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';

export default function WorkerHistory() {
  const { worker } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (worker) {
      fetchHistory();
    }
  }, [worker]);

  const fetchHistory = async () => {
    if (!worker) return;
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('worker_id', worker.id)
      .order('date', { ascending: false });
    
    if (data) setHistory(data);
    setLoading(false);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <header className="p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
        <Calendar size={24} style={{ color: 'var(--color-brand-primary)' }} />
        <h2 className="text-lg font-bold m-0" style={{ marginBottom: 0 }}>Work History</h2>
      </header>

      <main className="flex-1 p-4" style={{ overflowY: 'auto' }}>
        {loading ? (
          <div className="text-center mt-8">Loading...</div>
        ) : history.length === 0 ? (
          <div className="text-center mt-8 text-secondary">No history found.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {history.map((record) => (
              <div key={record.id} className="card p-4 flex justify-between items-center" style={{ padding: '1rem' }}>
                <div>
                  <p className="font-bold m-0">{format(new Date(record.date), 'MMM do, yyyy')}</p>
                  <p className="text-sm m-0 mt-1 flex items-center gap-2" style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                    <span className={`status-dot ${record.status === 'on_site' ? 'status-green' : 'status-amber'}`}></span>
                    {record.status === 'on_site' ? 'On Site' : 'Flagged (Distance)'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg m-0" style={{ color: 'var(--color-success)' }}>
                    ₹{record.wage_for_day || 0}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="flex border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}>
        <Link to="/dashboard" className="flex-1 text-center py-4" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}>
          <span>Today</span>
        </Link>
        <div className="flex-1 text-center py-4 border-b-2" style={{ borderColor: 'var(--color-brand-primary)', color: 'var(--color-brand-primary)' }}>
          <span className="font-bold">History</span>
        </div>
      </nav>
    </div>
  );
}
