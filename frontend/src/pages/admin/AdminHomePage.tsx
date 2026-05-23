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

// ── Pivot table data types ────────────────────────────────────────────────────
interface PhysRow { model: string; stockStatus: string; chassisYear: number; count: number; }
interface PaymentRow { model: string; paymentStatus: string; count: number; }
interface AgeingRow { branch: string; bucket: string; count: number; }

interface DashboardReports {
  physicalStock: PhysRow[];
  blockingByStock: PhysRow[];
  blockingByPayment: PaymentRow[];
  ageing: AgeingRow[];
}

// ── Pivot helpers ─────────────────────────────────────────────────────────────
function buildStockPivot(rows: PhysRow[]) {
  const models = Array.from(new Set(rows.map((r) => r.model))).sort();
  // columns: sorted by chassisYear desc, then stockStatus
  const colSet = new Map<string, { label: string; statusYear: string }>();
  for (const r of rows) {
    const key = `${r.chassisYear}||${r.stockStatus}`;
    if (!colSet.has(key)) colSet.set(key, { label: `${r.chassisYear} ${r.stockStatus}`, statusYear: key });
  }
  const cols = Array.from(colSet.values()).sort((a, b) => {
    const [ayear, ast] = a.statusYear.split('||');
    const [byear, bst] = b.statusYear.split('||');
    if (ayear !== byear) return parseInt(byear) - parseInt(ayear); // newer year first
    return ast.localeCompare(bst);
  });

  const lookup = new Map<string, number>();
  for (const r of rows) lookup.set(`${r.model}||${r.chassisYear}||${r.stockStatus}`, r.count);

  const totals = new Map<string, number>(); // col key → total
  for (const r of rows) {
    const key = `${r.chassisYear}||${r.stockStatus}`;
    totals.set(key, (totals.get(key) ?? 0) + r.count);
  }
  const rowTotals = new Map<string, number>();
  for (const r of rows) rowTotals.set(r.model, (rowTotals.get(r.model) ?? 0) + r.count);

  return { models, cols, lookup, totals, rowTotals };
}

function buildPaymentPivot(rows: PaymentRow[]) {
  const models = Array.from(new Set(rows.map((r) => r.model))).sort();
  const statuses = Array.from(new Set(rows.map((r) => r.paymentStatus))).sort();
  const lookup = new Map<string, number>();
  for (const r of rows) lookup.set(`${r.model}||${r.paymentStatus}`, r.count);
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(r.paymentStatus, (totals.get(r.paymentStatus) ?? 0) + r.count);
  const rowTotals = new Map<string, number>();
  for (const r of rows) rowTotals.set(r.model, (rowTotals.get(r.model) ?? 0) + r.count);
  return { models, statuses, lookup, totals, rowTotals };
}

const AGE_BUCKETS = ['1-7', '8-14', '15-29', '30-39', '40+'];

function buildAgeingPivot(rows: AgeingRow[]) {
  const branches = Array.from(new Set(rows.map((r) => r.branch))).sort();
  const lookup = new Map<string, number>();
  for (const r of rows) lookup.set(`${r.branch}||${r.bucket}`, r.count);
  const totals = new Map<string, number>(); // bucket → total
  for (const r of rows) totals.set(r.bucket, (totals.get(r.bucket) ?? 0) + r.count);
  const rowTotals = new Map<string, number>();
  for (const r of rows) rowTotals.set(r.branch, (rowTotals.get(r.branch) ?? 0) + r.count);
  return { branches, lookup, totals, rowTotals };
}

// ── Shared table styles ───────────────────────────────────────────────────────
const thCls = 'px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-zinc-400 whitespace-nowrap text-center';
const tdCls = 'px-3 py-2 text-xs text-center tabular-nums';
const tdModelCls = 'px-3 py-2 text-xs font-headline font-bold text-on-surface tracking-tight text-left whitespace-nowrap';
const tdTotalCls = 'px-3 py-2 text-xs font-bold text-center tabular-nums text-primary';
const thTotalCls = 'px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-primary text-center';

function cellVal(v: number | undefined) {
  if (!v) return <span className="text-zinc-600">—</span>;
  return <span>{v}</span>;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StockPivotTable({ title, rows, loading }: { title: string; rows: PhysRow[]; loading: boolean }) {
  if (loading) return <div className="h-40 bg-surface-container-low rounded-xl animate-pulse" />;
  if (!rows.length) return (
    <div className="bg-surface-container-low rounded-xl p-6">
      <p className="text-[10px] font-label uppercase tracking-widest text-primary mb-3">{title}</p>
      <p className="text-xs text-on-surface-variant">No data</p>
    </div>
  );

  const { models, cols, lookup, totals, rowTotals } = buildStockPivot(rows);
  const grandTotal = Array.from(rowTotals.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden">
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
        <p className="text-[10px] font-label uppercase tracking-widest text-primary">{title}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead className="bg-surface-container">
            <tr>
              <th className={`${thCls} text-left`}>Model</th>
              {cols.map((c) => <th key={c.statusYear} className={thCls}>{c.label}</th>)}
              <th className={thTotalCls}>Total</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model, i) => (
              <tr key={model} style={{ borderBottom: '1px solid rgba(67,70,86,0.06)', background: i % 2 === 1 ? 'rgba(67,70,86,0.03)' : undefined }}>
                <td className={tdModelCls}>{model}</td>
                {cols.map((c) => {
                  const [year, st] = c.statusYear.split('||');
                  const v = lookup.get(`${model}||${year}||${st}`);
                  return <td key={c.statusYear} className={tdCls}>{cellVal(v)}</td>;
                })}
                <td className={tdTotalCls}>{rowTotals.get(model) ?? 0}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-container">
              <td className="px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-zinc-400">Total</td>
              {cols.map((c) => (
                <td key={c.statusYear} className={tdTotalCls}>{totals.get(c.statusYear) ?? 0}</td>
              ))}
              <td className="px-3 py-2 text-xs font-extrabold text-center text-on-surface">{grandTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function PaymentPivotTable({ rows, loading }: { rows: PaymentRow[]; loading: boolean }) {
  if (loading) return <div className="h-40 bg-surface-container-low rounded-xl animate-pulse" />;
  if (!rows.length) return (
    <div className="bg-surface-container-low rounded-xl p-6">
      <p className="text-[10px] font-label uppercase tracking-widest text-primary mb-3">Blocking Against Payment Status</p>
      <p className="text-xs text-on-surface-variant">No data</p>
    </div>
  );

  const { models, statuses, lookup, totals, rowTotals } = buildPaymentPivot(rows);
  const grandTotal = Array.from(rowTotals.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden">
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
        <p className="text-[10px] font-label uppercase tracking-widest text-primary">Blocking Against Payment Status</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead className="bg-surface-container">
            <tr>
              <th className={`${thCls} text-left`}>Model</th>
              {statuses.map((s) => <th key={s} className={thCls}>{s}</th>)}
              <th className={thTotalCls}>Total</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model, i) => (
              <tr key={model} style={{ borderBottom: '1px solid rgba(67,70,86,0.06)', background: i % 2 === 1 ? 'rgba(67,70,86,0.03)' : undefined }}>
                <td className={tdModelCls}>{model}</td>
                {statuses.map((s) => {
                  const v = lookup.get(`${model}||${s}`);
                  return <td key={s} className={tdCls}>{cellVal(v)}</td>;
                })}
                <td className={tdTotalCls}>{rowTotals.get(model) ?? 0}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-container">
              <td className="px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-zinc-400">Total</td>
              {statuses.map((s) => (
                <td key={s} className={tdTotalCls}>{totals.get(s) ?? 0}</td>
              ))}
              <td className="px-3 py-2 text-xs font-extrabold text-center text-on-surface">{grandTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function AgeingPivotTable({ rows, loading }: { rows: AgeingRow[]; loading: boolean }) {
  if (loading) return <div className="h-40 bg-surface-container-low rounded-xl animate-pulse" />;
  if (!rows.length) return (
    <div className="bg-surface-container-low rounded-xl p-6">
      <p className="text-[10px] font-label uppercase tracking-widest text-primary mb-3">Total Blocked Vehicles Ageing</p>
      <p className="text-xs text-on-surface-variant">No data</p>
    </div>
  );

  const { branches, lookup, totals, rowTotals } = buildAgeingPivot(rows);
  const grandTotal = Array.from(rowTotals.values()).reduce((a, b) => a + b, 0);

  // colour-code age buckets
  const bucketColor = (bucket: string) => {
    if (bucket === '1-7')  return 'text-green-400';
    if (bucket === '8-14') return 'text-yellow-400';
    if (bucket === '15-29') return 'text-orange-400';
    if (bucket === '30-39') return 'text-red-400';
    return 'text-red-600';
  };

  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden">
      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
        <p className="text-[10px] font-label uppercase tracking-widest text-primary">Total Blocked Vehicles Ageing <span className="text-on-surface-variant normal-case font-body">(Days from blocked date)</span></p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead className="bg-surface-container">
            <tr>
              <th className={`${thCls} text-left`}>Branch</th>
              {AGE_BUCKETS.map((b) => (
                <th key={b} className={`${thCls} ${bucketColor(b)}`}>{b} days</th>
              ))}
              <th className={thTotalCls}>Total</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((branch, i) => (
              <tr key={branch} style={{ borderBottom: '1px solid rgba(67,70,86,0.06)', background: i % 2 === 1 ? 'rgba(67,70,86,0.03)' : undefined }}>
                <td className={tdModelCls}>{branch}</td>
                {AGE_BUCKETS.map((b) => {
                  const v = lookup.get(`${branch}||${b}`);
                  return (
                    <td key={b} className={`${tdCls} ${v ? bucketColor(b) : ''} font-bold`}>
                      {cellVal(v)}
                    </td>
                  );
                })}
                <td className={tdTotalCls}>{rowTotals.get(branch) ?? 0}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-container">
              <td className="px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-zinc-400">Total</td>
              {AGE_BUCKETS.map((b) => (
                <td key={b} className={`${tdTotalCls} ${bucketColor(b)}`}>{totals.get(b) ?? 0}</td>
              ))}
              <td className="px-3 py-2 text-xs font-extrabold text-center text-on-surface">{grandTotal}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminHomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [reports, setReports] = useState<DashboardReports | null>(null);
  const [reportsLoading, setReportsLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/summary').then(({ data }) => setSummary(data));
    api.get('/analytics/dashboard-reports')
      .then(({ data }) => setReports(data))
      .finally(() => setReportsLoading(false));
  }, []);

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

      {/* ── Dashboard Reports ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-[10px] font-label uppercase tracking-[0.3em] text-primary mb-4">Reports</h2>
        <div className="space-y-6">
          {/* 1. Physical Stock Status */}
          <StockPivotTable
            title="Physical Stock Status (BND / CTDMS — Non-Delivered)"
            rows={reports?.physicalStock ?? []}
            loading={reportsLoading}
          />

          {/* 2. Blocking Against Stock Status */}
          <StockPivotTable
            title="Blocking Against Stock Status (Active Hard Blockings)"
            rows={reports?.blockingByStock ?? []}
            loading={reportsLoading}
          />

          {/* 3. Blocking Against Payment Status */}
          <PaymentPivotTable
            rows={reports?.blockingByPayment ?? []}
            loading={reportsLoading}
          />

          {/* 4. Ageing */}
          <AgeingPivotTable
            rows={reports?.ageing ?? []}
            loading={reportsLoading}
          />
        </div>
      </div>
    </div>
  );
}
