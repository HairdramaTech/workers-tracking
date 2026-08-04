import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';

export default function ManagerSettings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Form State
  const [lat, setLat] = useState<number | string>('');
  const [lng, setLng] = useState<number | string>('');
  const [radius, setRadius] = useState<number | string>('');
  const [wage, setWage] = useState<number | string>('');

  const workerAppUrl = `${window.location.origin}/worker/login`;

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('worksite_settings').select('*').limit(1).single();
    if (data) {
      setSettings(data);
      setLat(data.site_lat);
      setLng(data.site_lng);
      setRadius(data.radius_meters);
      setWage(data.default_daily_wage);
    }
    setLoading(false);
  };

  const updateLocationToCurrent = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      }, (err) => {
        alert("Could not fetch location. Please ensure location permissions are granted.");
      });
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage('');

    const payload = {
      site_lat: parseFloat(String(lat)),
      site_lng: parseFloat(String(lng)),
      radius_meters: parseInt(String(radius)),
      default_daily_wage: parseFloat(String(wage))
    };

    let result;
    if (settings?.id) {
      result = await supabase.from('worksite_settings').update(payload).eq('id', settings.id).select().single();
    } else {
      result = await supabase.from('worksite_settings').insert([payload]).select().single();
    }

    if (result.error) {
      setSaveMessage('Error saving settings.');
    } else {
      setSettings(result.data);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    }
    setSaving(false);
  };

  if (loading) return <div className="text-center p-4">Loading...</div>;

  return (
    <div className="max-w-md mx-auto">
      <h2 className="mb-6">Worksite Settings</h2>

      <div className="card mb-6 flex flex-col items-center text-center">
        <h3 className="mb-4">Worksite QR Code</h3>
        <p className="text-sm text-secondary mb-6">Workers can scan this to check in on their own phones.</p>
        
        <div className="bg-white p-4 rounded-lg inline-block mb-4">
          <QRCodeSVG value={workerAppUrl} size={200} />
        </div>
        
        <p className="text-xs text-secondary mt-2 break-all">{workerAppUrl}</p>
      </div>

      <div className="card">
        <h3 className="mb-4">Configuration</h3>
        
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="input-group flex-1 m-0">
              <label className="input-label">Latitude</label>
              <input type="number" step="any" className="input-field" value={lat} onChange={e => setLat(e.target.value)} required />
            </div>
            <div className="input-group flex-1 m-0">
              <label className="input-label">Longitude</label>
              <input type="number" step="any" className="input-field" value={lng} onChange={e => setLng(e.target.value)} required />
            </div>
          </div>
          
          <button type="button" onClick={updateLocationToCurrent} className="btn btn-outline" style={{ padding: '0.5rem', fontSize: '0.875rem' }}>
            Use My Current Location
          </button>

          <div className="input-group m-0 mt-4">
            <label className="input-label">Acceptable Check-in Radius (meters)</label>
            <input type="number" className="input-field" value={radius} onChange={e => setRadius(e.target.value)} required />
          </div>

          <div className="input-group m-0">
            <label className="input-label">Default Daily Wage (₹)</label>
            <input type="number" className="input-field" value={wage} onChange={e => setWage(e.target.value)} required />
          </div>

          {saveMessage && (
             <p className={`text-sm ${saveMessage.includes('Error') ? 'text-red-500' : 'text-green-500'}`} style={{ color: saveMessage.includes('Error') ? 'var(--color-danger)' : 'var(--color-success)' }}>
               {saveMessage}
             </p>
          )}

          <button type="submit" className="btn btn-primary mt-2" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
