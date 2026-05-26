import { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
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

interface RawBlocking {
  id: string;
  customerName: string | null;
  orderId: string | null;
  consultantName: string | null;
  teamLeaderName: string | null;
  paymentMode: string | null;
  paymentStatus: string | null;
  hardBlockAt: string | null;
  expiryAt: string | null;
  expectedBillingDate: string | null;
  vehicle: { model: string; suffix: string; colour: string; chassisYear: number; chassisNumber: string; stockStatus: string | null; stockyardLocation: string };
  branch: { name: string };
  user: { fullName: string };
  financeRecord: {
    purchaseMode: string | null;
    bankName: string | null;
    loanAmount: number | null;
    financeStatus: string | null;
    expectedDisbursementDate: string | null;
    otherRemarks: string | null;
  } | null;
}

// ── Pivot helpers ─────────────────────────────────────────────────────────────
const PURCHASE_COLS = ['In House', 'Out House', 'Cash', 'Leasing', 'No Idea', 'Not Set', 'Not Updated'];
const STATUS_COLS   = [
  'Login Pending',
  'Logged Approval Pending',
  'Logged Document Pending',
  'Approved',
  'Agreement Done',
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
  if (s === 'Full Payment Received')      return 'text-green-300';
  if (s === 'Disbursed')                  return 'text-green-400';
  if (s === 'Approved')                   return 'text-primary';
  if (s === 'Agreement Done')             return 'text-teal-400';
  if (s === 'Rejected')                   return 'text-red-400';
  if (s === 'Login Pending')              return 'text-yellow-400';
  if (s.startsWith('Logged'))             return 'text-orange-400';
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
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [purchase, setPurchase]       = useState<PurchaseRow[]>([]);
  const [status, setStatus]           = useState<StatusRow[]>([]);
  const [rawBlockings, setRawBlockings] = useState<RawBlocking[]>([]);
  const [loading, setLoading]         = useState(true);

  const fetchAll = useCallback(async () => {
    const [s, p, st, rb] = await Promise.all([
      api.get('/finance-head/summary'),
      api.get('/finance-head/branch-purchase'),
      api.get('/finance-head/branch-status'),
      api.get('/finance-head/all-blockings'),
    ]);
    setSummary(s.data);
    setPurchase(p.data);
    setStatus(st.data);
    setRawBlockings(rb.data);
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

  const downloadExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1 — KPI Summary
    if (summary) {
      const kpiRows = [
        ['Metric', 'Count'],
        ['Total Blockings',          summary.totalBlockings],
        ['Untouched',                summary.untouched],
        ['In House',                 summary.inHouse],
        ['Login Pending',            summary.loginPending],
        ['Logged, Approval Pending', summary.loggedApprovalPending],
        ['Logged, Documents Pending',summary.loggedDocsPending],
        ['Approved',                 summary.approved],
        ['Disbursed',                summary.disbursed],
      ];
      const wsKPI = XLSX.utils.aoa_to_sheet(kpiRows);
      wsKPI['!cols'] = [{ wch: 30 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, wsKPI, 'KPI Summary');
    }

    // Sheet 2 — Branch × Purchase Mode
    const purchaseHeader = ['Branch', ...activePurchaseCols, 'Total'];
    const purchaseData = purchasePivot.branches.map(branch => [
      branch,
      ...activePurchaseCols.map(c => purchasePivot.lookup.get(`${branch}\x01${c}`) ?? 0),
      purchasePivot.rowTotals.get(branch) ?? 0,
    ]);
    const purchaseTotals = [
      'Total',
      ...activePurchaseCols.map(c => purchasePivot.colTotals.get(c) ?? 0),
      purchasePivot.grand,
    ];
    const wsPurchase = XLSX.utils.aoa_to_sheet([purchaseHeader, ...purchaseData, purchaseTotals]);
    wsPurchase['!cols'] = [{ wch: 20 }, ...activePurchaseCols.map(() => ({ wch: 12 })), { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsPurchase, 'Branch vs Purchase Mode');

    // Sheet 3 — Branch × Finance Status
    const statusHeader = ['Branch', ...activeStatusCols, 'Total'];
    const statusData = statusPivot.branches.map(branch => [
      branch,
      ...activeStatusCols.map(c => statusPivot.lookup.get(`${branch}\x01${c}`) ?? 0),
      statusPivot.rowTotals.get(branch) ?? 0,
    ]);
    const statusTotals = [
      'Total',
      ...activeStatusCols.map(c => statusPivot.colTotals.get(c) ?? 0),
      statusPivot.grand,
    ];
    const wsStatus = XLSX.utils.aoa_to_sheet([statusHeader, ...statusData, statusTotals]);
    wsStatus['!cols'] = [{ wch: 20 }, ...activeStatusCols.map(() => ({ wch: 26 })), { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsStatus, 'Branch vs Finance Status');

    // Sheet 4 — Raw All Blockings with FO Inputs
    const rawHeader = [
      'Branch', 'Customer Name', 'Order ID', 'Chassis Year', 'Model', 'Suffix', 'Colour',
      'Chassis No.', 'Stock Status', 'Stockyard Location',
      'Sales Manager', 'Consultant', 'Team Leader',
      'Payment Mode', 'Payment Status', 'Hard Blocked On', 'Expiry Date', 'Expected Billing',
      'FO Purchase Mode', 'FO Bank Name', 'FO Loan Amount', 'FO Finance Status',
      'FO Expected Disbursement', 'FO Remarks',
    ];
    const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB') : '';
    const rawData = rawBlockings.map(b => [
      b.branch.name,
      b.customerName ?? '',
      b.orderId ?? '',
      b.vehicle.chassisYear,
      b.vehicle.model,
      b.vehicle.suffix,
      b.vehicle.colour,
      b.vehicle.chassisNumber,
      b.vehicle.stockStatus ?? '',
      b.vehicle.stockyardLocation ?? '',
      b.user.fullName,
      b.consultantName ?? '',
      b.teamLeaderName ?? '',
      b.paymentMode ?? '',
      b.paymentStatus ?? '',
      fmt(b.hardBlockAt),
      fmt(b.expiryAt),
      fmt(b.expectedBillingDate),
      b.financeRecord?.purchaseMode ?? '',
      b.financeRecord?.bankName ?? '',
      b.financeRecord?.loanAmount ?? '',
      b.financeRecord?.financeStatus ?? '',
      fmt(b.financeRecord?.expectedDisbursementDate ?? null),
      b.financeRecord?.otherRemarks ?? '',
    ]);
    const wsRaw = XLSX.utils.aoa_to_sheet([rawHeader, ...rawData]);
    wsRaw['!cols'] = rawHeader.map((h) =>
      ({ wch: Math.max(h.length, 14) })
    );
    XLSX.utils.book_append_sheet(wb, wsRaw, 'All Blockings (Raw)');

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `finance_overview_${date}.xlsx`);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Finance Overview</h1>
          <p className="text-on-surface-variant font-body text-sm">Live finance analytics across all branches.</p>
        </div>
        {!loading && (
          <button
            onClick={downloadExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container text-xs font-bold uppercase tracking-widest font-headline transition-colors self-start sm:self-auto"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Download Excel
          </button>
        )}
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
