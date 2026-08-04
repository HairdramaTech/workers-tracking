import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format, subDays } from 'date-fns';
import { FileDown, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Payment() {
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => { generateReport(); }, []);

  const generateReport = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('attendance')
      .select('*, workers(name, phone)')
      .gte('date', startDate)
      .lte('date', endDate);

    if (data) {
      const grouped: Record<string, any> = {};
      data.forEach(r => {
        if (!grouped[r.worker_id]) {
          grouped[r.worker_id] = { name: r.workers?.name ?? '—', phone: r.workers?.phone ?? '—', daysWorked: 0, totalWage: 0 };
        }
        grouped[r.worker_id].daysWorked++;
        grouped[r.worker_id].totalWage += r.wage_for_day ?? 0;
      });
      setReportData(Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name)));
    }
    setLoading(false);
  };

  const exportExcel = () => {
    const rows = [
      { 'Worker Name': `Report: ${startDate} → ${endDate}`, Phone: '', 'Days Worked': '', 'Total Wage (₹)': '' },
      { 'Worker Name': '', Phone: '', 'Days Worked': '', 'Total Wage (₹)': '' },
      ...reportData.map(r => ({ 'Worker Name': r.name, Phone: r.phone, 'Days Worked': r.daysWorked, 'Total Wage (₹)': r.totalWage })),
    ];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Wages');
    XLSX.writeFile(wb, `wages_${startDate}_to_${endDate}.xlsx`);
  };

  const grandTotal = reportData.reduce((s, r) => s + r.totalWage, 0);

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontWeight: 700 }}>Payment Reports</h2>
        <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>Wage summaries by date range</p>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Calendar size={14} /> Date Range
        </h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div className="input-group" style={{ flex: 1, minWidth: '140px', margin: 0 }}>
            <label className="input-label">From</label>
            <input type="date" className="input-field" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="input-group" style={{ flex: 1, minWidth: '140px', margin: 0 }}>
            <label className="input-label">To</label>
            <input type="date" className="input-field" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={generateReport} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Report'}
        </button>
      </div>

      {reportData.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Summary</h3>
            <button className="btn btn-outline" onClick={exportExcel} style={{ padding: '0.35rem 0.875rem', fontSize: '0.8rem' }}>
              <FileDown size={15} /> Export .xlsx
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Worker', 'Phone', 'Days', 'Total Wage'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.75rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reportData.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px dashed var(--color-border)' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--color-text-secondary)' }}>{r.phone}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{r.daysWorked}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: 'var(--color-success)' }}>₹{r.totalWage}</td>
                  </tr>
                ))}
                <tr style={{ background: 'var(--color-bg-primary)' }}>
                  <td colSpan={3} style={{ padding: '0.75rem', fontWeight: 700, textAlign: 'right' }}>Grand Total:</td>
                  <td style={{ padding: '0.75rem', fontWeight: 800, color: 'var(--color-success)', fontSize: '1rem' }}>₹{grandTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
