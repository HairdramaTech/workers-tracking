import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search } from 'lucide-react';
import { format } from 'date-fns';

export default function ManagerWorkers() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [selectedWorker, setSelectedWorker] = useState<any>(null);
  const [workerHistory, setWorkerHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    const { data } = await supabase.from('workers').select('*').order('name');
    if (data) setWorkers(data);
    setLoading(false);
  };

  const fetchWorkerHistory = async (workerId: string) => {
    setHistoryLoading(true);
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('worker_id', workerId)
      .order('date', { ascending: false });
    
    if (data) setWorkerHistory(data);
    setHistoryLoading(false);
  };

  const filteredWorkers = workers.filter(w => 
    w.name.toLowerCase().includes(search.toLowerCase()) || 
    w.phone.includes(search)
  );

  const handleSelectWorker = (worker: any) => {
    setSelectedWorker(worker);
    fetchWorkerHistory(worker.id);
  };

  if (loading) return <div className="p-6 text-center">Loading workers...</div>;

  return (
    <div>
      <h2 className="mb-4">Workers Directory</h2>

      {selectedWorker ? (
        <div className="card">
          <button 
            className="btn btn-outline btn-sm mb-4" 
            onClick={() => setSelectedWorker(null)}
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
          >
            &larr; Back to List
          </button>
          
          <h3 className="text-xl mb-1">{selectedWorker.name}</h3>
          <p className="text-secondary text-sm mb-6">{selectedWorker.phone}</p>
          
          <h4 className="font-bold mb-4 border-b pb-2" style={{ borderColor: 'var(--color-border)' }}>Attendance History</h4>
          
          {historyLoading ? (
            <p className="text-sm">Loading history...</p>
          ) : workerHistory.length === 0 ? (
            <p className="text-sm text-secondary">No history found for this worker.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {workerHistory.map(record => (
                <div key={record.id} className="flex justify-between items-center p-3 rounded" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
                  <div>
                    <p className="font-bold m-0">{format(new Date(record.date), 'MMM do, yyyy')}</p>
                    <p className="text-xs m-0 mt-1 flex items-center gap-1 text-secondary">
                      <span className={`status-dot ${record.status === 'on_site' ? 'status-green' : 'status-amber'}`} style={{ width: '8px', height: '8px' }}></span>
                      {record.status === 'on_site' ? 'On Site' : 'Flagged'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold m-0" style={{ color: 'var(--color-success)' }}>
                      ₹{record.wage_for_day || 0}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="input-group relative mb-6">
            <div className="absolute left-3 top-3 text-secondary">
              <Search size={20} />
            </div>
            <input 
              type="text" 
              className="input-field pl-10" 
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3">
            {filteredWorkers.length === 0 ? (
              <p className="text-secondary text-center py-4">No workers found.</p>
            ) : (
              filteredWorkers.map(worker => (
                <div 
                  key={worker.id} 
                  className="card p-4 cursor-pointer hover:border-[var(--color-brand-primary)] transition-colors"
                  onClick={() => handleSelectWorker(worker)}
                >
                  <h3 className="font-bold text-lg m-0">{worker.name}</h3>
                  <p className="text-sm text-secondary m-0 mt-1">{worker.phone}</p>
                  <p className="text-xs text-secondary m-0 mt-2">Joined: {format(new Date(worker.created_at), 'MMM yyyy')}</p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
