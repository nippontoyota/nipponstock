import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import api from '../../api';

interface BranchEntry { branch: string; active: number; delivered: number; expired: number; conversionRate: number; }
interface ModelEntry { model: string; active: number; delivered: number; expired: number; conversionRate: number; }
interface DayEntry { date: string; pending: number; expiring: number; }

const chartTheme = {
  backgroundColor: 'transparent',
  color: '#c4c5d9',
};

export default function AnalyticsPage() {
  const [day, setDay] = useState<DayEntry[]>([]);
  const [branch, setBranch] = useState<BranchEntry[]>([]);
  const [model, setModel] = useState<ModelEntry[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/daywise').then(({ data }) => setDay(data)),
      api.get('/analytics/branchwise').then(({ data }) => setBranch(data)),
      api.get('/analytics/modelwise').then(({ data }) => setModel(data)),
    ]);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Analytics</h1>
        <p className="text-on-surface-variant font-body text-sm">Branch performance, model velocity, and expiry telemetry.</p>
      </div>

      {/* Day-wise chart */}
      <div className="bg-surface-container-low rounded-xl p-8">
        <h4 className="text-[10px] font-label font-black text-primary uppercase tracking-[0.3em] mb-6">Day-wise Pending / Expiring Blockings</h4>
        {day.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-on-surface-variant font-label text-xs uppercase tracking-widest">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={day} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#c4c5d9', fontFamily: 'Inter' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#c4c5d9', fontFamily: 'Inter' }} />
              <Tooltip contentStyle={{ backgroundColor: '#201f20', border: '1px solid rgba(67,70,86,0.3)', borderRadius: '8px', color: '#e5e2e3', fontFamily: 'Inter', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              <Bar dataKey="pending" fill="#b8c3ff" name="Pending" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expiring" fill="#d71a18" name="Expiring" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Branch chart + table */}
      <div className="bg-surface-container-low rounded-xl p-8">
        <h4 className="text-[10px] font-label font-black text-primary uppercase tracking-[0.3em] mb-6">Branch-wise Breakdown</h4>
        {branch.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-on-surface-variant font-label text-xs uppercase tracking-widest">No data available</div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={branch} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="branch" tick={{ fontSize: 9, fill: '#c4c5d9', fontFamily: 'Inter' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#c4c5d9', fontFamily: 'Inter' }} />
                <Tooltip contentStyle={{ backgroundColor: '#201f20', border: '1px solid rgba(67,70,86,0.3)', borderRadius: '8px', color: '#e5e2e3', fontFamily: 'Inter', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                <Bar dataKey="active" fill="#b8c3ff" name="Active" radius={[4, 4, 0, 0]} />
                <Bar dataKey="delivered" fill="#34d399" name="Delivered" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expired" fill="#d71a18" name="Expired" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(67,70,86,0.15)' }}>
                    {['Branch', 'Active', 'Delivered', 'Expired', 'Conversion %'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {branch.map((b) => (
                    <tr key={b.branch} className="hover:bg-surface-container transition-colors" style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }}>
                      <td className="px-3 py-2 font-headline font-bold text-on-surface tracking-tight">{b.branch}</td>
                      <td className="px-3 py-2 text-primary">{b.active}</td>
                      <td className="px-3 py-2 text-green-400">{b.delivered}</td>
                      <td className="px-3 py-2 text-tertiary">{b.expired}</td>
                      <td className="px-3 py-2 font-headline font-bold text-on-surface">{b.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Model table */}
      <div className="bg-surface-container-low rounded-xl p-8">
        <h4 className="text-[10px] font-label font-black text-primary uppercase tracking-[0.3em] mb-6">Model-wise Breakdown</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(67,70,86,0.15)' }}>
                {['Model', 'Active', 'Delivered', 'Expired', 'Conversion %'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-on-surface-variant font-label text-xs uppercase tracking-widest">No data available</td></tr>
              ) : model.map((m) => (
                <tr key={m.model} className="hover:bg-surface-container transition-colors" style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }}>
                  <td className="px-3 py-2 font-headline font-bold text-on-surface tracking-tight">{m.model}</td>
                  <td className="px-3 py-2 text-primary">{m.active}</td>
                  <td className="px-3 py-2 text-green-400">{m.delivered}</td>
                  <td className="px-3 py-2 text-tertiary">{m.expired}</td>
                  <td className="px-3 py-2 font-headline font-bold text-on-surface">{m.conversionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
