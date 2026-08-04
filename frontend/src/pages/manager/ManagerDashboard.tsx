import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function ManagerDashboard() {
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingTimeout, setLoadingTimeout] = useState(false);

  // States for inline editing tasks
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editQty, setEditQty] = useState('');
  
  // States for inline editing wage
  const [editingWageId, setEditingWageId] = useState<string | null>(null);
  const [editWage, setEditWage] = useState('');
  
  // State for quick assign when no task exists
  const [assigningWorkerId, setAssigningWorkerId] = useState<string | null>(null);
  const [newDesc, setNewDesc] = useState('');
  const [newQty, setNewQty] = useState('');
  
  const [defaultWage, setDefaultWage] = useState(500);

  useEffect(() => {
    fetchLiveDashboard();
    
    const timeout = setTimeout(() => {
      if (loading) setLoadingTimeout(true);
    }, 5000);

    const today = new Date().toISOString().split('T')[0];
    const channel = supabase
      .channel('public:attendance')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'attendance',
        filter: `date=eq.${today}`
      }, () => {
        fetchLiveDashboard();
      })
      .subscribe();

    return () => {
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLiveDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: settings } = await supabase.from('worksite_settings').select('default_daily_wage').limit(1).single();
      if (settings) setDefaultWage(settings.default_daily_wage);

      const { data: attendanceData, error: attError } = await supabase
        .from('attendance')
        .select('*, workers(name, phone)')
        .eq('date', today)
        .order('check_in_time', { ascending: false });
        
      if (attError) throw attError;

      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('date', today);
      
      if (attendanceData) {
        const merged = attendanceData.map(record => {
          const task = tasksData?.find(t => t.worker_id === record.worker_id);
          return { ...record, task };
        });
        setAttendanceRecords(merged);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
      setLoadingTimeout(false);
    }
  };

  const handleUpdateProgress = async (taskId: string, currentDone: number) => {
    const nextDone = (Number(currentDone) || 0) + 1;
    await supabase.from('tasks').update({ quantity_done: nextDone }).eq('id', taskId);
    fetchLiveDashboard();
  };

  const handleReviewFlagged = async (attendanceId: string) => {
    await supabase.from('attendance').update({ status: 'on_site' }).eq('id', attendanceId);
    fetchLiveDashboard();
  };
  
  const handleManualCheckout = async (attendanceId: string) => {
    const defaultCheckout = new Date();
    defaultCheckout.setHours(18, 0, 0, 0); // Default to 6 PM
    const now = new Date();
    const checkoutTime = now < defaultCheckout ? now : defaultCheckout;
    
    await supabase.from('attendance').update({ check_out_time: checkoutTime.toISOString() }).eq('id', attendanceId);
    fetchLiveDashboard();
  };

  const saveTaskEdit = async (taskId: string) => {
    await supabase.from('tasks').update({ 
      description: editDesc, 
      quantity_target: editQty ? parseFloat(editQty) : null 
    }).eq('id', taskId);
    setEditingTaskId(null);
    fetchLiveDashboard();
  };

  const saveNewTask = async (workerId: string) => {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('tasks').insert([{
      worker_id: workerId,
      date: today,
      description: newDesc,
      quantity_target: newQty ? parseFloat(newQty) : null,
      quantity_done: 0
    }]);
    setAssigningWorkerId(null);
    setNewDesc('');
    setNewQty('');
    fetchLiveDashboard();
  };

  const saveWageEdit = async (attendanceId: string, wageValue: number) => {
    await supabase.from('attendance').update({ wage_for_day: wageValue }).eq('id', attendanceId);
    setEditingWageId(null);
    fetchLiveDashboard();
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh]">
        <RefreshCw className="animate-spin mb-4" style={{ color: 'var(--color-brand-primary)' }} size={32} />
        <p>Loading live dashboard...</p>
        {loadingTimeout && (
          <button onClick={fetchLiveDashboard} className="btn btn-outline mt-4">
            Taking longer than usual — retry?
          </button>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center text-center">
        <AlertCircle size={48} className="mb-4" style={{ color: 'var(--color-danger)' }} />
        <h3 className="mb-2">Error Loading Dashboard</h3>
        <p className="text-secondary mb-4">{error}</p>
        <button onClick={fetchLiveDashboard} className="btn btn-primary">Retry</button>
      </div>
    );
  }

  const now = new Date();
  const isPastCutoff = now.getHours() >= 20; // 8 PM cutoff

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="m-0">Live Check-ins</h2>
        <button onClick={fetchLiveDashboard} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem' }}>
          <RefreshCw size={16} />
        </button>
      </div>
      
      <div className="flex-col gap-4 flex">
        {attendanceRecords.length === 0 ? (
          <div className="text-center py-12 card bg-transparent border-dashed">
            <p className="text-secondary m-0">No one's checked in yet today.</p>
          </div>
        ) : (
          attendanceRecords.map(record => {
            const needsManualCheckout = isPastCutoff && !record.check_out_time;
            
            return (
              <div key={record.id} className="card p-4 relative overflow-hidden">
                {needsManualCheckout && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-bl">
                    Forgot to check out
                  </div>
                )}
                <div className="flex justify-between items-start mb-2 mt-2">
                  <div>
                    <h3 className="font-bold flex items-center gap-2 m-0" style={{ fontSize: '1.125rem' }}>
                      <span className={`status-dot ${record.status === 'on_site' ? 'status-green' : 'status-amber'}`}></span>
                      {record.workers?.name}
                    </h3>
                    <p className="text-sm text-secondary m-0 mt-1">
                      In: {format(new Date(record.check_in_time), 'h:mm a')} 
                      {record.check_out_time ? ` | Out: ${format(new Date(record.check_out_time), 'h:mm a')}` : ' | Working'}
                    </p>
                    {record.status === 'flagged' && record.distance_from_site && (
                      <p className="text-xs text-secondary mt-1 m-0">Distance: {Math.round(record.distance_from_site)}m</p>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-2 items-end">
                    {record.status === 'flagged' && (
                      <button 
                        onClick={() => handleReviewFlagged(record.id)}
                        className="btn btn-outline" 
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}
                      >
                        Review (Override)
                      </button>
                    )}
                    
                    {needsManualCheckout && (
                       <button 
                         onClick={() => handleManualCheckout(record.id)}
                         className="btn btn-primary" 
                         style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', backgroundColor: 'var(--color-danger)' }}
                       >
                         Check out now
                       </button>
                    )}

                    {/* Wage Editor */}
                    <div className="mt-1 flex flex-col items-end">
                      {editingWageId === record.id ? (
                        <div className="flex flex-col gap-1 items-end bg-gray-800/50 p-2 rounded">
                          <div className="flex gap-1">
                            <input 
                              type="number" 
                              className="input-field py-1 px-2 text-sm w-20" 
                              value={editWage} 
                              onChange={e => setEditWage(e.target.value)} 
                              placeholder="₹"
                              autoFocus
                            />
                            <button onClick={() => saveWageEdit(record.id, parseFloat(editWage))} className="btn btn-primary py-1 px-2 text-xs">Save</button>
                            <button onClick={() => setEditingWageId(null)} className="btn btn-outline py-1 px-2 text-xs">X</button>
                          </div>
                          <div className="flex gap-1 mt-1">
                            <button onClick={() => saveWageEdit(record.id, defaultWage)} className="btn btn-outline py-1 px-2 text-xs border-transparent hover:bg-gray-700">Full</button>
                            <button onClick={() => saveWageEdit(record.id, defaultWage / 2)} className="btn btn-outline py-1 px-2 text-xs border-transparent hover:bg-gray-700">Half</button>
                          </div>
                        </div>
                      ) : (
                        <p 
                          className="font-bold text-sm m-0 cursor-pointer border-b border-dashed border-transparent hover:border-gray-400" 
                          style={{ color: 'var(--color-success)' }}
                          onClick={() => {
                            setEditingWageId(record.id);
                            setEditWage(record.wage_for_day?.toString() || '');
                          }}
                        >
                          Wage: ₹{record.wage_for_day || 0}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  {record.task ? (
                    editingTaskId === record.task.id ? (
                      <div className="flex flex-col gap-2">
                        <input 
                          type="text" 
                          className="input-field py-1 px-2 text-sm" 
                          value={editDesc} 
                          onChange={e => setEditDesc(e.target.value)} 
                          placeholder="Task description"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            className="input-field py-1 px-2 text-sm flex-1" 
                            value={editQty} 
                            onChange={e => setEditQty(e.target.value)} 
                            placeholder="Target Qty (optional)"
                          />
                          <button onClick={() => saveTaskEdit(record.task.id)} className="btn btn-primary py-1 px-3 text-sm">Save</button>
                          <button onClick={() => setEditingTaskId(null)} className="btn btn-outline py-1 px-3 text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center group">
                        <div 
                          className="cursor-pointer flex-1" 
                          onClick={() => {
                            setEditingTaskId(record.task.id);
                            setEditDesc(record.task.description || '');
                            setEditQty(record.task.quantity_target?.toString() || '');
                          }}
                        >
                          <p className="font-semibold text-sm m-0 border-b border-dashed border-transparent group-hover:border-gray-400 inline-block">
                            {record.task.description || 'No description'}
                          </p>
                          {record.task.quantity_target && (
                            <p className="text-xs text-secondary m-0 mt-1">
                              Progress: {record.task.quantity_done || 0} / {record.task.quantity_target}
                            </p>
                          )}
                        </div>
                        {record.task.quantity_target && (
                          <button 
                            onClick={() => handleUpdateProgress(record.task.id, record.task.quantity_done)}
                            className="btn btn-primary ml-4" 
                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
                          >
                            +1
                          </button>
                        )}
                      </div>
                    )
                  ) : (
                    assigningWorkerId === record.worker_id ? (
                      <div className="flex flex-col gap-2">
                        <input 
                          type="text" 
                          className="input-field py-1 px-2 text-sm" 
                          value={newDesc} 
                          onChange={e => setNewDesc(e.target.value)} 
                          placeholder="Task description"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            className="input-field py-1 px-2 text-sm flex-1" 
                            value={newQty} 
                            onChange={e => setNewQty(e.target.value)} 
                            placeholder="Target Qty (optional)"
                          />
                          <button onClick={() => saveNewTask(record.worker_id)} className="btn btn-primary py-1 px-3 text-sm">Assign</button>
                          <button onClick={() => setAssigningWorkerId(null)} className="btn btn-outline py-1 px-3 text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setAssigningWorkerId(record.worker_id)} 
                        className="btn btn-outline w-full text-secondary" 
                        style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem', borderStyle: 'dashed' }}
                      >
                        + Assign Task
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
