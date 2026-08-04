import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, X, ChevronDown, Check, AlertCircle, RefreshCw, Search, Briefcase, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = 'pending' | 'in_progress' | 'under_review' | 'completed';
type WorkOrderStatus = 'open' | 'completed';

interface WorkType { id: string; name: string; }
interface Worker   { id: string; name: string; phone: string; }
interface WorkOrder {
  id: string;
  sku: string | null;
  total_quantity: number;
  date: string;
  status: WorkOrderStatus;
  work_types: WorkType | null;
}
interface Assignment {
  id: string;
  work_order_id: string;
  worker_id: string;
  assigned_quantity: number;
  done_quantity: number;
  status: Status;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  work_orders: WorkOrder | null;
  workers: Pick<Worker, 'id' | 'name' | 'phone'> | null;
}

const COLUMNS: { key: Status; label: string; color: string; bg: string }[] = [
  { key: 'pending',      label: 'Pending',      color: '#f59e0b', bg: 'rgba(245,158,11,0.07)'  },
  { key: 'in_progress',  label: 'In Progress',  color: '#3b82f6', bg: 'rgba(59,130,246,0.07)'  },
  { key: 'under_review', label: 'Under Review', color: '#8b5cf6', bg: 'rgba(139,92,246,0.07)'  },
  { key: 'completed',    label: 'Completed',    color: '#10b981', bg: 'rgba(16,185,129,0.07)'  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function TodayWork() {
  const [assignments,  setAssignments]  = useState<Assignment[]>([]);
  const [workOrders,   setWorkOrders]   = useState<WorkOrder[]>([]);
  const [workTypes,    setWorkTypes]    = useState<WorkType[]>([]);
  const [workers,      setWorkers]      = useState<Worker[]>([]);
  const [activeWorkerIds, setActiveWorkerIds] = useState<string[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [search,       setSearch]       = useState('');
  const [selected,     setSelected]     = useState<Assignment | null>(null);
  const [mobileTab,    setMobileTab]    = useState<Status>('pending');

  // Modals
  const [showAddType,  setShowAddType]  = useState(false);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [showAssign,   setShowAssign]   = useState<{ id: string; total_qty: number; already_assigned: number } | null>(null);

  // Add work type
  const [newTypeName,  setNewTypeName]  = useState('');
  const [savingType,   setSavingType]   = useState(false);

  // Add work order
  const [orderType,    setOrderType]    = useState('');
  const [orderSku,     setOrderSku]     = useState('');
  const [orderQty,     setOrderQty]     = useState('');
  const [savingOrder,  setSavingOrder]  = useState(false);

  // Assign — multi-worker rows
  interface AssignRow { id: number; worker_id: string; qty: string; }
  const [assignRows,   setAssignRows]   = useState<AssignRow[]>([{ id: Date.now(), worker_id: '', qty: '' }]);
  const [savingAssign, setSavingAssign] = useState(false);
  const [assignError,  setAssignError]  = useState('');

  const addAssignRow = () =>
    setAssignRows(prev => [...prev, { id: Date.now(), worker_id: '', qty: '' }]);

  const removeAssignRow = (id: number) =>
    setAssignRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);

  const updateAssignRow = (id: number, field: 'worker_id' | 'qty', value: string) =>
    setAssignRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const today = new Date().toISOString().split('T')[0];
      const [
        { data: aData, error: aErr },
        { data: wtData },
        { data: wData },
        { data: woData },
        { data: attData }
      ] = await Promise.all([
        supabase.from('work_assignments').select('*, work_orders(*, work_types(*)), workers(id,name,phone)').order('created_at', { ascending: false }),
        supabase.from('work_types').select('*').order('name'),
        supabase.from('workers').select('id,name,phone').order('name'),
        supabase.from('work_orders').select('*, work_types(*)').eq('date', today).order('created_at', { ascending: false }),
        supabase.from('attendance').select('worker_id').eq('date', today).is('check_out_time', null)
      ]);

      if (aErr) throw aErr;
      
      // Only show today's orders/assignments
      const todayAssignments = (aData ?? []).filter((a: any) => a.work_orders?.date === today);
      setAssignments(todayAssignments);
      setWorkTypes(wtData ?? []);
      setWorkers(wData ?? []);
      setWorkOrders((woData ?? []) as WorkOrder[]);
      setActiveWorkerIds((attData ?? []).map(a => a.worker_id));
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const filteredAssignments = assignments.filter(a => {
    const q = search.toLowerCase();
    return !q || a.work_orders?.work_types?.name?.toLowerCase().includes(q)
      || a.workers?.name?.toLowerCase().includes(q)
      || (a.work_orders?.sku ?? '').toLowerCase().includes(q);
  });
  
  const byStatus = (s: Status) => filteredAssignments.filter(a => a.status === s);
  const underReview = byStatus('under_review');
  const openWorkOrders = workOrders.filter(wo => wo.status === 'open');

  // Computed helper for total assigned quantity for a work order
  const getAssignedQty = (woId: string) => {
    return assignments.filter(a => a.work_order_id === woId).reduce((sum, a) => sum + a.assigned_quantity, 0);
  };

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveWorkType = async () => {
    if (!newTypeName.trim()) return;
    setSavingType(true);
    await supabase.from('work_types').insert([{ name: newTypeName.trim() }]);
    setNewTypeName(''); setShowAddType(false); setSavingType(false);
    fetchAll();
  };

  const saveWorkOrder = async (assignNow: boolean) => {
    if (!orderType || !orderQty) return;
    setSavingOrder(true);
    const { data } = await supabase.from('work_orders').insert([{
      work_type_id: orderType, sku: orderSku.trim() || null,
      total_quantity: parseInt(orderQty), date: new Date().toISOString().split('T')[0],
      status: 'open'
    }]).select().single();
    
    setSavingOrder(false); setOrderType(''); setOrderSku(''); setOrderQty(''); setShowAddOrder(false);
    if (data && assignNow) {
      setShowAssign({ id: data.id, total_qty: data.total_quantity, already_assigned: 0 });
    }
    fetchAll();
  };

  const saveAssignment = async (assignData: { id: string; total_qty: number; already_assigned: number }) => {
    setAssignError('');
    const valid = assignRows.filter(r => r.worker_id && r.qty && parseInt(r.qty) > 0);
    if (valid.length === 0) { setAssignError('Add at least one worker with a quantity.'); return; }

    // Check duplicate workers in the same submission
    const ids = valid.map(r => r.worker_id);
    if (new Set(ids).size !== ids.length) { setAssignError('A worker appears more than once — remove the duplicate row.'); return; }

    // Validate total quantity
    const totalAssigning = valid.reduce((s, r) => s + parseInt(r.qty), 0);
    if (assignData.already_assigned + totalAssigning > assignData.total_qty) {
      const available = assignData.total_qty - assignData.already_assigned;
      setAssignError(`Cannot exceed total order quantity. Available: ${available} units.`);
      return;
    }

    setSavingAssign(true);
    const rows = valid.map(r => ({
      work_order_id: assignData.id,
      worker_id: r.worker_id,
      assigned_quantity: parseInt(r.qty),
      done_quantity: 0,
      status: 'pending',
    }));
    const { error } = await supabase.from('work_assignments').upsert(rows, { onConflict: 'work_order_id,worker_id' });
    if (error) setAssignError(error.message);
    else {
      setAssignRows([{ id: Date.now(), worker_id: '', qty: '' }]);
      setShowAssign(null);
    }
    setSavingAssign(false);
    fetchAll();
  };

  const approveAssignment = async (id: string) => {
    await supabase.from('work_assignments').update({ status: 'completed', approved_at: new Date().toISOString() }).eq('id', id);
    setSelected(null); fetchAll();
  };

  const rejectAssignment = async (id: string) => {
    await supabase.from('work_assignments').update({ status: 'in_progress', submitted_at: null }).eq('id', id);
    setSelected(null); fetchAll();
  };

  const saveQty = async (id: string, qty: number, assigned: number) => {
    const clamped = Math.min(Math.max(0, qty), assigned);
    const newStatus = clamped === assigned ? 'under_review' : clamped === 0 ? 'pending' : 'in_progress';
    await supabase.from('work_assignments').update({ done_quantity: clamped, status: newStatus }).eq('id', id);
    setSelected(prev => prev ? { ...prev, done_quantity: clamped, status: newStatus as Status } : prev);
    fetchAll();
  };

  const deleteAssignment = async (id: string) => {
    await supabase.from('work_assignments').delete().eq('id', id);
    setSelected(null); fetchAll();
  };

  const completeWorkOrder = async (id: string) => {
    await supabase.from('work_orders').update({ status: 'completed' }).eq('id', id);
    fetchAll();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
      <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--color-brand-primary)' }} />
      <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>Loading today's work…</p>
    </div>
  );

  if (error) return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <AlertCircle size={40} style={{ color: 'var(--color-danger)', margin: '0 auto 1rem' }} />
      <p style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>{error}</p>
      <button className="btn btn-primary" onClick={fetchAll}>Retry</button>
    </div>
  );

  const clockedInWorkers = workers.filter(w => activeWorkerIds.includes(w.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Task Management</h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {format(new Date(), 'EEEE, MMM do, yyyy')}
            </p>
          </div>
          {/* Desktop buttons only */}
          <div className="desktop-actions" style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline" onClick={() => setShowAddType(true)} style={{ fontSize: '0.8rem', padding: '0.45rem 0.875rem' }}>
              <Plus size={15} /> Add Work Type
            </button>
            <button className="btn btn-primary" onClick={() => setShowAddOrder(true)} style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}>
              <Plus size={15} /> Add Work
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem' }} className="stats-grid">
        {[
          { label: 'Total',       count: filteredAssignments.length,   color: 'var(--color-brand-primary)' },
          { label: 'Pending',     count: byStatus('pending').length,   color: '#f59e0b' },
          { label: 'In Progress', count: byStatus('in_progress').length, color: '#3b82f6' },
          { label: 'Review',      count: underReview.length,           color: '#8b5cf6' },
          { label: 'Completed',   count: byStatus('completed').length, color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '0.625rem 0.875rem', borderLeft: `3px solid ${s.color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: s.color }}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* ── Added Work (Open Orders) ──────────────────────────────── */}
      {openWorkOrders.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem', color: 'var(--color-text-primary)' }}>Added Work</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {openWorkOrders.map(wo => {
              const assigned = getAssignedQty(wo.id);
              const remaining = wo.total_quantity - assigned;
              const isFullyAssigned = remaining <= 0;
              return (
                <div key={wo.id} style={{ 
                  background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', 
                  padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' 
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>{wo.work_types?.name}</p>
                      {wo.sku && (
                        <span style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--color-brand-primary)', background: 'rgba(59,130,246,0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                          {wo.sku}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                      Total: <strong>{wo.total_quantity}</strong> • Assigned: <strong>{assigned}</strong> • Remaining: <strong style={{ color: isFullyAssigned ? 'var(--color-success)' : 'inherit' }}>{remaining}</strong>
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => setShowAssign({ id: wo.id, total_qty: wo.total_quantity, already_assigned: assigned })}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                      disabled={isFullyAssigned}
                    >
                      <Briefcase size={14} /> Assign to Workers
                    </button>
                    <button 
                      className="btn btn-outline" 
                      onClick={() => completeWorkOrder(wo.id)}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem', borderColor: 'var(--color-success)', color: 'var(--color-success)' }}
                    >
                      <Check size={14} /> Mark Completed
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Search ────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
        <input className="input-field" style={{ paddingLeft: '2.25rem', fontSize: '0.875rem', paddingTop: '0.6rem', paddingBottom: '0.6rem' }}
          placeholder="Search by work type, worker or SKU…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── Review banner ─────────────────────────────────────────── */}
      {underReview.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid var(--color-warning)', borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.625rem', fontWeight: 700, color: 'var(--color-warning)', fontSize: '0.8rem' }}>
            ⚠️ Awaiting Review ({underReview.length})
          </p>
          {underReview.map(a => (
            <div key={a.id} style={{ background: 'var(--color-bg-secondary)', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem' }}>{a.work_orders?.work_types?.name}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{a.workers?.name}{a.work_orders?.sku && ` · ${a.work_orders.sku}`}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-primary" onClick={() => approveAssignment(a.id)}
                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.775rem', background: '#10b981' }}>
                    ✓ Approve
                  </button>
                  <button className="btn btn-outline" onClick={() => rejectAssignment(a.id)}
                    style={{ padding: '0.3rem 0.75rem', fontSize: '0.775rem', color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
                    ✕ Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Mobile: Status tabs ────────────────────────────────────── */}
      <div className="mobile-status-tabs" style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', marginBottom: '0.875rem', paddingBottom: '4px' }}>
        {COLUMNS.map(col => {
          const count = byStatus(col.key).length;
          const active = mobileTab === col.key;
          return (
            <button key={col.key} onClick={() => setMobileTab(col.key)}
              style={{
                flexShrink: 0, padding: '0.35rem 0.75rem', borderRadius: '100px', fontSize: '0.75rem', fontWeight: active ? 700 : 500,
                border: `1px solid ${active ? col.color : 'var(--color-border)'}`,
                background: active ? `${col.color}20` : 'transparent',
                color: active ? col.color : 'var(--color-text-secondary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}>
              {col.label}
              <span style={{ background: active ? col.color : 'var(--color-border)', color: active ? 'white' : 'var(--color-text-muted)', borderRadius: '100px', padding: '0 0.35rem', fontSize: '0.65rem', fontWeight: 700 }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Mobile cards ──────────────────────────────────────────── */}
      <div className="mobile-cards" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', flex: 1 }}>
        {byStatus(mobileTab).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            No {COLUMNS.find(c => c.key === mobileTab)?.label} tasks today
          </div>
        ) : (
          byStatus(mobileTab).map(a => (
            <KanbanCard key={a.id} assignment={a} colColor={COLUMNS.find(c => c.key === a.status)!.color}
              onClick={() => setSelected(a)} isSelected={selected?.id === a.id} />
          ))
        )}
      </div>

      {/* ── Desktop: 4-column kanban ──────────────────────────────── */}
      <div className="desktop-kanban" style={{ display: 'flex', gap: '0.875rem', flex: 1, overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {COLUMNS.map(col => {
          const cards = byStatus(col.key);
          return (
            <div key={col.key} style={{
              minWidth: '220px', flex: '1 1 220px',
              background: col.bg, border: `1px solid ${col.color}25`, borderRadius: '0.875rem',
              padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.625rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <p style={{ margin: 0, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em', color: col.color, textTransform: 'uppercase' }}>{col.label}</p>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, background: col.color, color: 'white', borderRadius: '100px', padding: '0.1rem 0.45rem' }}>{cards.length}</span>
              </div>
              {cards.length === 0
                ? <p style={{ margin: '0.75rem 0', textAlign: 'center', fontSize: '0.775rem', color: 'var(--color-text-muted)' }}>No tasks</p>
                : cards.map(a => (
                  <KanbanCard key={a.id} assignment={a} colColor={col.color}
                    onClick={() => setSelected(a)} isSelected={selected?.id === a.id} />
                ))
              }
            </div>
          );
        })}
      </div>

      {/* ── Detail panel ─────────────────────────────────────────── */}
      {selected && (
        <DetailPanel
          assignment={selected} onClose={() => setSelected(null)}
          onApprove={approveAssignment} onReject={rejectAssignment}
          onSaveQty={saveQty}
          onDelete={deleteAssignment}
          onAssignMore={() => {
            const alreadyAssigned = assignments.filter(a => a.work_order_id === selected.work_order_id).reduce((s, a) => s + a.assigned_quantity, 0);
            setShowAssign({ id: selected.work_order_id, total_qty: selected.work_orders?.total_quantity ?? 0, already_assigned: alreadyAssigned });
            setSelected(null);
          }}
        />
      )}

      {/* ── Mobile FAB ───────────────────────────────────────────── */}
      <div className="mobile-fab" style={{ position: 'fixed', bottom: '4.5rem', right: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', zIndex: 40 }}>
        <button className="btn btn-outline" onClick={() => setShowAddType(true)}
          title="Add Work Type"
          style={{ width: '3rem', height: '3rem', borderRadius: '50%', padding: 0, background: 'var(--color-bg-secondary)', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={16} />
        </button>
        <button className="btn btn-primary" onClick={() => setShowAddOrder(true)}
          title="Add Work"
          style={{ width: '3.5rem', height: '3.5rem', borderRadius: '50%', padding: 0, boxShadow: '0 6px 20px rgba(59,130,246,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={22} />
        </button>
      </div>

      {/* ── Modals ────────────────────────────────────────────────── */}
      {showAddType && (
        <Modal title="Add Work Type" onClose={() => setShowAddType(false)}>
          <div className="input-group">
            <label className="input-label">Type Name</label>
            <input className="input-field" placeholder="e.g. Box Packing, Stitching…"
              value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveWorkType()} autoFocus />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveWorkType} disabled={savingType || !newTypeName.trim()}>
            {savingType ? 'Saving…' : 'Save Work Type'}
          </button>
        </Modal>
      )}

      {showAddOrder && (
        <Modal title="Add Work Order" onClose={() => setShowAddOrder(false)}>
          <div className="input-group">
            <label className="input-label">Work Type</label>
            <SelectField value={orderType} onChange={setOrderType} placeholder="Select type…">
              {workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name}</option>)}
            </SelectField>
          </div>
          <div className="input-group">
            <label className="input-label">SKU <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <input className="input-field" placeholder="e.g. BND-0381" value={orderSku} onChange={e => setOrderSku(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Total Quantity</label>
            <input className="input-field" type="number" min={1} placeholder="e.g. 1000" value={orderQty} onChange={e => setOrderQty(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => saveWorkOrder(false)} disabled={savingOrder || !orderType || !orderQty}>
              {savingOrder ? 'Saving…' : 'Save & Assign Later'}
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => saveWorkOrder(true)} disabled={savingOrder || !orderType || !orderQty}>
              {savingOrder ? 'Saving…' : 'Save & Assign Now'}
            </button>
          </div>
        </Modal>
      )}

      {showAssign && (
        <Modal title="Assign Work to Workers" onClose={() => { setShowAssign(null); setAssignRows([{ id: Date.now(), worker_id: '', qty: '' }]); setAssignError(''); }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 36px', gap: '0.5rem', marginBottom: '0.5rem', padding: '0 0.25rem' }}>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Worker (Clocked In)</p>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', textAlign: 'center' }}>Qty</p>
            <span />
          </div>

          {/* Worker rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {assignRows.map((row, idx) => {
              const selectedWorker = workers.find(w => w.id === row.worker_id);
              return (
                <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 36px', gap: '0.5rem', alignItems: 'center' }}>

                  {/* Worker — shows as name pill once selected, dropdown while picking */}
                  {selectedWorker ? (
                    <button
                      onClick={() => updateAssignRow(row.id, 'worker_id', '')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                        borderRadius: '0.5rem', padding: '0.5rem 0.75rem', cursor: 'pointer',
                        textAlign: 'left', width: '100%',
                      }}
                      title="Click to change worker"
                    >
                      <span style={{
                        width: '1.75rem', height: '1.75rem', borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, var(--color-brand-primary), #6366f1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.65rem', fontWeight: 700, color: 'white',
                      }}>
                        {selectedWorker.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div style={{ overflow: 'hidden' }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {selectedWorker.name}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {selectedWorker.phone}
                        </p>
                      </div>
                    </button>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <select
                        className="input-field"
                        value={row.worker_id}
                        onChange={e => updateAssignRow(row.id, 'worker_id', e.target.value)}
                        style={{ appearance: 'none', paddingRight: '2rem', fontSize: '0.8rem' }}
                        autoFocus={idx === 0}
                      >
                        <option value="">Select worker…</option>
                        {clockedInWorkers.length === 0 && <option value="" disabled>No workers are currently clocked in</option>}
                        {clockedInWorkers
                          .filter(w => !assignRows.some(r => r.id !== row.id && r.worker_id === w.id))
                          .map(w => <option key={w.id} value={w.id}>{w.name} · {w.phone}</option>)
                        }
                      </select>
                      <ChevronDown size={13} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-muted)' }} />
                    </div>
                  )}

                  {/* Quantity input */}
                  <input
                    className="input-field"
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={row.qty}
                    onChange={e => updateAssignRow(row.id, 'qty', e.target.value)}
                    style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', padding: '0.5rem 0.4rem' }}
                  />

                  {/* Remove row */}
                  <button
                    onClick={() => removeAssignRow(row.id)}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid var(--color-border)', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: assignRows.length === 1 ? 'var(--color-border)' : 'var(--color-danger)', flexShrink: 0 }}
                    disabled={assignRows.length === 1}
                    title="Remove row"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add another worker row */}
          <button
            className="btn btn-outline"
            onClick={addAssignRow}
            disabled={assignRows.length >= clockedInWorkers.length}
            style={{ width: '100%', fontSize: '0.8rem', marginBottom: '0.875rem', borderStyle: 'dashed' }}
          >
            <Plus size={14} /> Add Another Worker
          </button>

          {/* Summary */}
          {assignRows.some(r => r.worker_id && r.qty) && (
            <div style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', marginBottom: '0.875rem', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              {assignRows.filter(r => r.worker_id && r.qty).map(r => {
                const w = workers.find(wk => wk.id === r.worker_id);
                return w ? (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{w.name}</span>
                    <span style={{ color: 'var(--color-brand-primary)', fontWeight: 700 }}>{r.qty} units</span>
                  </div>
                ) : null;
              })}
              <div style={{ borderTop: '1px dashed var(--color-border)', marginTop: '0.3rem', paddingTop: '0.3rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Total assigning now</span>
                <span style={{ color: 'var(--color-success)' }}>
                  {assignRows.filter(r => r.qty).reduce((s, r) => s + (parseInt(r.qty) || 0), 0)} units
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.2rem', fontSize: '0.75rem' }}>
                <span>Available remaining</span>
                <span style={{ color: (showAssign.total_qty - showAssign.already_assigned - assignRows.filter(r => r.qty).reduce((s, r) => s + (parseInt(r.qty) || 0), 0)) < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                  {showAssign.total_qty - showAssign.already_assigned - assignRows.filter(r => r.qty).reduce((s, r) => s + (parseInt(r.qty) || 0), 0)} / {showAssign.total_qty - showAssign.already_assigned} units
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {assignError && (
            <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertCircle size={14} /> {assignError}
            </p>
          )}

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => saveAssignment(showAssign)}
            disabled={savingAssign || !assignRows.some(r => r.worker_id && r.qty)}
          >
            {savingAssign ? 'Assigning…' : `Assign to ${assignRows.filter(r => r.worker_id && r.qty).length} Worker${assignRows.filter(r => r.worker_id && r.qty).length !== 1 ? 's' : ''}`}
          </button>
        </Modal>
      )}

      <style>{`
        @media (min-width: 769px) {
          .mobile-status-tabs { display: none !important; }
          .mobile-cards        { display: none !important; }
          .mobile-fab          { display: none !important; }
          .stats-grid          { grid-template-columns: repeat(5, 1fr) !important; }
        }
        @media (max-width: 768px) {
          .desktop-kanban  { display: none !important; }
          .stats-grid      { grid-template-columns: repeat(2, 1fr) !important; }
        }
        .kanban-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn  { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }
      `}</style>
    </div>
  );
}

// ─── Kanban Card ─────────────────────────────────────────────────────────────
function KanbanCard({ assignment: a, colColor, onClick, isSelected }: {
  assignment: Assignment; colColor: string; onClick: () => void; isSelected: boolean;
}) {
  const pct = a.assigned_quantity > 0 ? Math.round((a.done_quantity / a.assigned_quantity) * 100) : 0;
  return (
    <div onClick={onClick} className="kanban-card" style={{
      background: 'var(--color-bg-secondary)', border: `1px solid ${isSelected ? colColor : 'var(--color-border)'}`,
      borderRadius: '0.75rem', padding: '0.75rem', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
      boxShadow: isSelected ? `0 0 0 2px ${colColor}40` : 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text-primary)', lineHeight: 1.3, paddingRight: '0.5rem' }}>
          {a.work_orders?.work_types?.name ?? '—'}
        </p>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colColor, flexShrink: 0, marginTop: 3 }} />
      </div>
      <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>{a.workers?.name}</p>
      {a.work_orders?.sku && (
        <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: 'var(--color-brand-primary)', background: 'rgba(59,130,246,0.1)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>
          {a.work_orders.sku}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
        <div style={{ flex: 1, height: '4px', background: 'var(--color-border)', borderRadius: '100px' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: colColor, borderRadius: '100px', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          {a.done_quantity}/{a.assigned_quantity}
        </span>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ assignment: a, onClose, onApprove, onReject, onAssignMore, onSaveQty, onDelete }: {
  assignment: Assignment; onClose: () => void;
  onApprove: (id: string) => void;
  onReject:  (id: string) => void;
  onAssignMore: () => void;
  onSaveQty: (id: string, qty: number, assigned: number) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const [qtyInput, setQtyInput]       = useState(String(a.done_quantity));
  const [savingQty, setSavingQty]     = useState(false);
  const [confirmDel, setConfirmDel]   = useState(false);

  // Sync if parent updates the assignment (e.g. after save)
  useEffect(() => { setQtyInput(String(a.done_quantity)); }, [a.done_quantity]);

  const pct = a.assigned_quantity > 0 ? Math.round((a.done_quantity / a.assigned_quantity) * 100) : 0;
  const statusColor: Record<Status, string> = { pending:'#f59e0b', in_progress:'#3b82f6', under_review:'#8b5cf6', completed:'#10b981' };
  const sc = statusColor[a.status];

  const handleSave = async () => {
    setSavingQty(true);
    await onSaveQty(a.id, parseInt(qtyInput) || 0, a.assigned_quantity);
    setSavingQty(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 49 }} className="panel-backdrop" />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(340px, 100vw)',
        background: 'var(--color-bg-secondary)', borderLeft: '1px solid var(--color-border)',
        zIndex: 50, overflowY: 'auto', padding: '1.25rem',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.2)', animation: 'slideIn 0.2s ease',
      }}>

        {/* ── Top bar: label + edit/delete/close ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <p style={{ margin: 0, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Task Detail</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {/* Edit — opens inline qty editor (already always visible below) */}
            <button
              title="Edit quantity"
              onClick={() => { const el = document.getElementById('qty-input-panel'); el?.focus(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0.3rem', display: 'flex', borderRadius: '0.35rem' }}
            >
              <Edit2 size={15} />
            </button>
            {/* Delete */}
            {confirmDel ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button onClick={() => onDelete(a.id)} style={{ background: 'var(--color-danger)', color: 'white', border: 'none', borderRadius: '0.35rem', padding: '0.2rem 0.5rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Confirm</button>
                <button onClick={() => setConfirmDel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0.2rem', display: 'flex' }}><X size={14} /></button>
              </div>
            ) : (
              <button
                title="Delete assignment"
                onClick={() => setConfirmDel(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0.3rem', display: 'flex', borderRadius: '0.35rem' }}
              >
                <Trash2 size={15} />
              </button>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '0.3rem', display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Title + status badges ── */}
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: 'var(--color-text-primary)', fontWeight: 700 }}>
          {a.work_orders?.work_types?.name}
        </h3>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {a.work_orders?.sku && (
            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--color-brand-primary)', background: 'rgba(59,130,246,0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
              {a.work_orders.sku}
            </span>
          )}
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: sc, background: `${sc}20`, padding: '0.15rem 0.5rem', borderRadius: '100px', textTransform: 'capitalize' }}>
            {a.status.replace('_', ' ')}
          </span>
        </div>

        {/* ── Info rows ── */}
        {([
          ['ASSIGNED TO', a.workers?.name],
          ['WORK TYPE',   a.work_orders?.work_types?.name],
          ['DATE',        a.work_orders?.date ? format(new Date(a.work_orders.date), 'MMM do, yyyy') : '—'],
          ['TOTAL ORDER', `${a.work_orders?.total_quantity ?? '—'} units`],
          ['ASSIGNED',    `${a.assigned_quantity} units`],
          ['ACTUAL DONE', `${a.done_quantity} units`],
        ] as [string, string | undefined][]).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 700, fontSize: '0.68rem', letterSpacing: '0.06em' }}>{label}</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{value}</span>
          </div>
        ))}

        {/* ── Progress bar ── */}
        <div style={{ margin: '1rem 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <p style={{ margin: 0, fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: '0.06em' }}>PROGRESS</p>
            <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: sc }}>{pct}%</p>
          </div>
          <div style={{ height: '8px', background: 'var(--color-border)', borderRadius: '100px' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: sc, borderRadius: '100px', transition: 'width 0.5s' }} />
          </div>
        </div>

        {/* ── Log Completed Quantity (inspired by reference UI) ── */}
        {a.status !== 'completed' && (
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ margin: '0 0 0.625rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
              LOG COMPLETED QUANTITY
            </p>
            <input
              id="qty-input-panel"
              type="number"
              min={0}
              max={a.assigned_quantity}
              value={qtyInput}
              onChange={e => setQtyInput(e.target.value)}
              style={{
                width: '100%', padding: '0.7rem 0.875rem',
                background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)',
                borderRadius: '0.625rem', color: 'var(--color-text-primary)',
                fontSize: '1rem', fontWeight: 600, outline: 'none', boxSizing: 'border-box',
                marginBottom: '0.625rem',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--color-brand-primary)')}
              onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
            />
            <button
              className="btn btn-primary"
              style={{
                width: '100%', justifyContent: 'center',
                background: 'linear-gradient(135deg, var(--color-brand-primary), #6366f1)',
                boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
                fontSize: '0.9rem', padding: '0.7rem',
                opacity: savingQty || qtyInput === String(a.done_quantity) ? 0.6 : 1,
              }}
              onClick={handleSave}
              disabled={savingQty || qtyInput === String(a.done_quantity)}
            >
              {savingQty ? 'Saving…' : 'Save Quantity'}
            </button>
          </div>
        )}

        {/* ── Actions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          <button className="btn btn-outline" style={{ fontSize: '0.875rem' }} onClick={onAssignMore}>
            + Assign Another Worker
          </button>
          {a.status === 'under_review' && (
            <>
              <button className="btn btn-primary" style={{ background: '#10b981', justifyContent: 'center' }} onClick={() => onApprove(a.id)}>
                <Check size={16} /> Approve & Complete
              </button>
              <button className="btn btn-outline" style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }} onClick={() => onReject(a.id)}>
                ✕ Send Back
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--color-bg-secondary)', width: '100%', maxWidth: '480px',
        borderRadius: '1.25rem 1.25rem 0 0', padding: '1.25rem', border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-lg)', animation: 'slideUp 0.25s ease',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Drag handle */}
        <div style={{ width: '2.5rem', height: '4px', background: 'var(--color-border)', borderRadius: '100px', margin: '0 auto 1.25rem' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--color-text-primary)' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '0.25rem', display: 'flex' }}><X size={18} /></button>
        </div>
        {children}
      </div>
      <style>{`@keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }`}</style>
    </div>
  );
}

function SelectField({ value, onChange, placeholder, children }: { value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <select className="input-field" value={value} onChange={e => onChange(e.target.value)}
        style={{ appearance: 'none', paddingRight: '2.5rem' }}>
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown size={15} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-muted)' }} />
    </div>
  );
}
