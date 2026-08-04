import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { format, subDays } from 'date-fns';
import { FileDown, Calendar as CalendarIcon } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ManagerReports() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  
  // Date range state
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    generateReport();
  }, []);

  const generateReport = async () => {
    setLoading(true);
    
    // Fetch all attendance records in the range joined with workers
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*, workers(name, phone)')
      .gte('date', startDate)
      .lte('date', endDate);

    if (attendanceData) {
      // Group by worker
      const grouped: Record<string, any> = {};
      
      attendanceData.forEach(record => {
        const wId = record.worker_id;
        if (!grouped[wId]) {
          grouped[wId] = {
            id: wId,
            name: record.workers?.name || 'Unknown',
            phone: record.workers?.phone || 'Unknown',
            daysWorked: 0,
            totalWage: 0
          };
        }
        
        grouped[wId].daysWorked += 1;
        grouped[wId].totalWage += (record.wage_for_day || 0);
      });
      
      // Convert to array and sort by name
      const results = Object.values(grouped).sort((a: any, b: any) => a.name.localeCompare(b.name));
      setReportData(results);
    }
    
    setLoading(false);
  };

  const exportToExcel = () => {
    if (reportData.length === 0) return;
    
    const exportFormatted = [
      { 'Worker Name': `Report Range: ${startDate} to ${endDate}`, 'Phone': '', 'Days Worked': '', 'Total Wage (₹)': '' },
      { 'Worker Name': '', 'Phone': '', 'Days Worked': '', 'Total Wage (₹)': '' }, // empty row
      ...reportData.map(row => ({
        'Worker Name': row.name,
        'Phone': row.phone,
        'Days Worked': row.daysWorked,
        'Total Wage (₹)': row.totalWage
      }))
    ];

    const worksheet = XLSX.utils.json_to_sheet(exportFormatted);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Wage Report");
    
    // Generate file
    XLSX.writeFile(workbook, `Wage_Report_${startDate}_to_${endDate}.xlsx`);
  };

  return (
    <div>
      <h2 className="mb-4">Reports</h2>

      <div className="card mb-6">
        <h3 className="mb-4 text-sm font-bold uppercase text-secondary flex items-center gap-2">
          <CalendarIcon size={16} /> Date Range
        </h3>
        
        <div className="flex gap-4 mb-4">
          <div className="input-group flex-1 m-0">
            <label className="input-label">Start Date</label>
            <input 
              type="date" 
              className="input-field" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
            />
          </div>
          <div className="input-group flex-1 m-0">
            <label className="input-label">End Date</label>
            <input 
              type="date" 
              className="input-field" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)} 
            />
          </div>
        </div>
        
        <button 
          onClick={generateReport}
          className="btn btn-primary w-full" 
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {reportData.length > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 className="m-0">Summary</h3>
            <button 
              onClick={exportToExcel}
              className="btn btn-outline" 
              style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
            >
              <FileDown size={16} /> Export Excel
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ width: '100%' }}>
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <th className="p-2 font-semibold">Worker</th>
                  <th className="p-2 font-semibold">Days</th>
                  <th className="p-2 font-semibold text-right">Total Wage</th>
                </tr>
              </thead>
              <tbody>
                {reportData.map(row => (
                  <tr key={row.id} className="border-b border-dashed" style={{ borderColor: 'var(--color-border-light)' }}>
                    <td className="p-2">
                      <p className="font-bold m-0">{row.name}</p>
                      <p className="text-xs text-secondary m-0">{row.phone}</p>
                    </td>
                    <td className="p-2">{row.daysWorked}</td>
                    <td className="p-2 text-right font-bold text-green-500" style={{ color: 'var(--color-success)' }}>
                      ₹{row.totalWage}
                    </td>
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="bg-gray-800/50">
                  <td className="p-2 font-bold text-right" colSpan={2}>Grand Total:</td>
                  <td className="p-2 text-right font-bold" style={{ color: 'var(--color-success)' }}>
                    ₹{reportData.reduce((acc, row) => acc + row.totalWage, 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
