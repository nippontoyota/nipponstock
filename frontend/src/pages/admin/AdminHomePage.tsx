import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';

interface Summary { total: number; open: number; softBlocked: number; hardBlocked: number; delivered: number; expired: number; }

interface KPIProps { label: string; value: number; icon: string; color: string; }

function KPI({ label, value, icon, color }: KPIProps) {
  return (
    <div className="bg-surface-container-low rounded-xl p-6 relative overflow-hidden group" style={{ borderLeft: `3px solid ${color}` }}>
      <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{label}</p>
      <p className="font-headline text-4xl font-extrabold text-on-surface">{value}</p>
      <div className="absolute right-4 bottom-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color }}>{icon}</span>
      </div>
    </div>
  );
}

const quickLinks = [
  { to: '/admin/blockings', icon: 'lock_clock', label: 'All Blockings', desc: 'View and manage every blocking across all branches' },
  { to: '/admin/stock', icon: 'inventory_2', label: 'Stock Management', desc: 'Import, export and view current stock' },
  { to: '/admin/analytics', icon: 'assessment', label: 'Analytics', desc: 'Branch and model performance breakdowns' },
  { to: '/admin/config', icon: 'tune', label: 'Configuration', desc: 'Set blocking durations per model' },
];

export default function AdminHomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => { api.get('/analytics/summary').then(({ data }) => setSummary(data)); }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Admin Dashboard</h1>
        <p className="text-on-surface-variant font-body text-sm">Full visibility across all 12 branches and stock.</p>
      </div>

      {/* KPIs */}
      {summary ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPI label="Total Stock" value={summary.total} icon="garage" color="#b8c3ff" />
          <KPI label="Open" value={summary.open} icon="check_circle" color="#4ade80" />
          <KPI label="Soft Blocked" value={summary.softBlocked} icon="timer" color="#bcc7de" />
          <KPI label="Hard Blocked" value={summary.hardBlocked} icon="lock" color="#fb923c" />
          <KPI label="Delivered" value={summary.delivered} icon="task_alt" color="#34d399" />
          <KPI label="Expired" value={summary.expired} icon="warning" color="#d71a18" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-surface-container-low rounded-xl p-6 animate-pulse h-24" />
          ))}
        </div>
      )}

      {/* Quick links */}
      <div>
        <h2 className="text-[10px] font-label uppercase tracking-[0.3em] text-primary mb-4">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="bg-surface-container-low rounded-xl p-6 hover:bg-surface-container transition-colors group relative overflow-hidden"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined">{item.icon}</span>
              </div>
              <p className="font-headline font-bold text-on-surface tracking-tight uppercase text-sm mb-1">{item.label}</p>
              <p className="text-xs text-on-surface-variant font-body leading-relaxed">{item.desc}</p>
              <div className="absolute right-4 bottom-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined text-primary text-sm">arrow_forward</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
