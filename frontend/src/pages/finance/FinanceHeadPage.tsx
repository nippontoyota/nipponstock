import { useEffect, useState, useCallback } from 'react';
import api from '../../api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Summary {
  totalBlockings: number;
  untouched: number;
  inHouse: number;
  loginPending: number;
  loggedApprovalPending: number;
  loggedDocsPending: number;
  approved: number;
  disbursed: number;
}

interface PurchaseRow { branch: string; purchaseMode: string; count: number; }
interface StatusRow   { branch: string; financeStatus: string; count: number; }

// ── Pivot helpers ─────────────────────────────────────────────────────────────
const PURCHASE_COLS = ['Cash', 'Direct', 'In House', 'No Idea', 'Not Set', 'Not Updated'];
const STATUS_COLS   = [
  'Login Pending',
  'Logged, Approval Pending',
  'Logged, Documents Pending',
  'Approved',
  'Disbursed',
  'Rejected',
];

function buildPivot<T extends { branch: string }>(
  rows: T[],
  keyFn: (r: T) => string,
  cols: string[],
): { branches: string[]; lookup: Map<string, number>; colTotals: Map<string, number>; rowTotals: Map<string, number>; grand: number } {
  const branches = Array.from(new Set(rows.map(r => r.branch))).sort();
  const lookup = new Map<string, number>();
  const colTotals = new Map<string, number>();
  const rowTotals = new Map<string, number>();

  for (const r of rows) {
    const col = keyFn(r);
    const count = (r as unknown as { count: number }).count;
    lookup.set(`${r.branch}\x01${col}`, count);
    colTotals.set(col, (colTotals.get(col) ?? 0) + count);
    rowTotals.set(r.branch, (rowTotals.get(r.branch) ?? 0) + count);
  }

  // Ensure all defined cols appear (even if 0)
  for (const col of cols) if (!colTotals.has(col)) colTotals.set(col, 0);

  const grand = Array.from(rowTotals.values()).reduce((a, b) => a + b, 0);
  return { branches, lookup, colTotals, rowTotals, grand };
}

// ── Shared table styles ───────────────────────────────────────────────────────
const thCls  = 'px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-zinc-400 text-center whitespace-nowrap';
const tdCls  = 'px-3 py-2 text-xs text-center tabular-nums';
const tdBranchCls = 'px-3 py-2 text-xs font-headline font-bold text-on-surface tracking-tight text-left whitespace-nowrap';
const tdTotCls = 'px-3 py-2 text-xs font-bold text-center tabular-nums text-primary';
const thTotCls = 'px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-primary text-center';

function cell(v: number | undefined) {
  if (!v) return <span className="text-zinc-600">—</span>;
  return <span>{v}</span>;
}

// ── Status colour ─────────────────────────────────────────────────────────────
function statusColour(s: string): string {
  if (s === 'Disbursed')                  return 'text-green-400';
  if (s === 'Approved')                   return 'text-primary';
  if (s === 'Rejected')                   return 'text-red-400';
  if (s === 'Login Pending')              return 'text-yellow-400';
  if (s.startsWith('Logged'))            return 'text-orange-400';
  return 'text-zinc-400';
}

// ── KPI card ──────────────────────────────────────────────────────────────────
function KPI({ label, value, color, icon }: { label: string; value: number | undefined; color: string; icon: string }) {
  return (
    <div className="bg-surface-container-low rounded-xl p-5 relative overflow-hidden" style={{ borderLeft: `3px solid ${color}` }}>
      <p className="font-label text-[9px] uppercase tracking-widest text-on-surface-variant mb-1">{label}</p>
      <p className="font-headline text-3xl font-extrabold text-on-surface">{value ?? '—'}</p>
      <div className="absolute right-3 bottom-3 opacity-10">
        <span className="material-symbols-outlined" style={{ fontSize: '40px', color }}>{icon}</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FinanceHeadPage() {
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [purchase, setPurchase]   = useState<PurchaseRow[]>([]);
  const [status, setStatus]       = useState<StatusRow[]>([]);
  const [loading, setLoading]     = useState(true);

  const fetchAll = useCallback(async () => {
    const [s, p, st] = await Promise.all([
      api.get('/finance-head/summary'),
      api.get('/finance-head/branch-purchase'),
      api.get('/finance-head/branch-status'),
    ]);
    setSummary(s.data);
    setPurchase(p.data);
    setStatus(st.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Active purchase cols (only show columns that have data)
  const activePurchaseCols = PURCHASE_COLS.filter(c =>
    purchase.some(r => r.purchaseMode === c)
  );
  const activeStatusCols = STATUS_COLS.filter(c =>
    status.some(r => r.financeStatus === c)
  );

  const purchasePivot = buildPivot(purchase, r => r.purchaseMode, activePurchaseCols);
  const statusPivot   = buildPivot(status,   r => r.financeStatus, activeStatusCols);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Finance Overview</h1>
        <p className="text-on-surface-variant font-body text-sm">Live finance analytics across all branches.</p>
      </div>

      {/* KPIs */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 bg-surface-container-low rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <KPI label="Total Blockings"          value={summary?.totalBlockings}        color="#b8c3ff" icon="lock" />
          <KPI label="Untouched"                value={summary?.untouched}             color="#d71a18" icon="pending_actions" />
          <KPI label="In House"                 value={summary?.inHouse}               color="#bcc7de" icon="home" />
          <KPI label="Login Pending"            value={summary?.loginPending}          color="#facc15" icon="hourglass_empty" />
          <KPI label="Logged Appr. Pending"     value={summary?.loggedApprovalPending} color="#fb923c" icon="fact_check" />
          <KPI label="Logged Docs Pending"      value={summary?.loggedDocsPending}     color="#fb923c" icon="description" />
          <KPI label="Approved"                 value={summary?.approved}              color="#34d399" icon="verified" />
          <KPI label="Disbursed"                value={summary?.disbursed}             color="#4ade80" icon="payments" />
        </div>
      )}

      {/* Table 1: Branch × Purchase Mode */}
      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
          <p className="text-[10px] font-label uppercase tracking-widest text-primary">Branch vs Purchase Mode</p>
        </div>
        {loading ? <div className="h-40 animate-pulse" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead className="bg-surface-container">
                <tr>
                  <th className={`${thCls} text-left`}>Branch</th>
                  {activePurchaseCols.map(c => <th key={c} className={thCls}>{c}</th>)}
                  <th className={thTotCls}>Total</th>
                </tr>
              </thead>
              <tbody>
                {purchasePivot.branches.map((branch, i) => (
                  <tr key={branch} style={{ borderBottom: '1px solid rgba(67,70,86,0.06)', background: i % 2 === 1 ? 'rgba(67,70,86,0.03)' : undefined }}>
                    <td className={tdBranchCls}>{branch}</td>
                    {activePurchaseCols.map(c => (
                      <td key={c} className={tdCls}>{cell(purchasePivot.lookup.get(`${branch}\x01${c}`))}</td>
                    ))}
                    <td className={tdTotCls}>{purchasePivot.rowTotals.get(branch) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-container">
                  <td className="px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-zinc-400">Total</td>
                  {activePurchaseCols.map(c => (
                    <td key={c} className={tdTotCls}>{purchasePivot.colTotals.get(c) || '—'}</td>
                  ))}
                  <td className="px-3 py-2 text-xs font-extrabold text-center text-on-surface">{purchasePivot.grand}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Table 2: Branch × Finance Status */}
      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
          <p className="text-[10px] font-label uppercase tracking-widest text-primary">Branch vs Finance Status</p>
        </div>
        {loading ? <div className="h-40 animate-pulse" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead className="bg-surface-container">
                <tr>
                  <th className={`${thCls} text-left`}>Branch</th>
                  {activeStatusCols.map(c => (
                    <th key={c} className={`${thCls} ${statusColour(c)}`}>{c}</th>
                  ))}
                  <th className={thTotCls}>Total</th>
                </tr>
              </thead>
              <tbody>
                {statusPivot.branches.map((branch, i) => (
                  <tr key={branch} style={{ borderBottom: '1px solid rgba(67,70,86,0.06)', background: i % 2 === 1 ? 'rgba(67,70,86,0.03)' : undefined }}>
                    <td className={tdBranchCls}>{branch}</td>
                    {activeStatusCols.map(c => (
                      <td key={c} className={`${tdCls} ${statusPivot.lookup.get(`${branch}\x01${c}`) ? statusColour(c) + ' font-bold' : ''}`}>
                        {cell(statusPivot.lookup.get(`${branch}\x01${c}`))}
                      </td>
                    ))}
                    <td className={tdTotCls}>{statusPivot.rowTotals.get(branch) ?? 0}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-container">
                  <td className="px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-zinc-400">Total</td>
                  {activeStatusCols.map(c => (
                    <td key={c} className={`${tdTotCls} ${statusColour(c)}`}>{statusPivot.colTotals.get(c) || '—'}</td>
                  ))}
                  <td className="px-3 py-2 text-xs font-extrabold text-center text-on-surface">{statusPivot.grand}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
