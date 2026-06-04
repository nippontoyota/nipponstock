import { useEffect, useState, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, CartesianGrid, LabelList,
} from 'recharts';
import api from '../../api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Summary {
  physicalStock: number; mddpStock: number; totalBlockings: number;
  cashBlockings: number; financeBlockings: number; approvedFinance: number;
  fullPaymentCollected: number;
}

// ── Model code → display name ─────────────────────────────────────────────────
const MODEL_MAP: Record<string, string> = {
  A15: 'TOYOTA RUMION',
  A32: 'TOYOTA URBAN CRUISE REBELLA',
  CMR: 'NEW CAMRY',
  D22: 'URBAN CRUISER HYRYDER',
  D24: 'TOYOTA GLANZA',
  D27: 'URBAN CRUISER TAISOR',
  FRN: 'FORTUNER',
  HLX: 'HILUX',
  IMV: 'INNOVA',
  INN: 'INNOVA HYCROSS',
  LCR: 'LAND CRUISER',
  VEL: 'VELLFIRE',
};
const modelName = (code: string) => MODEL_MAP[code] ?? code;
function mapModelKey(data: R2[], key: string): R2[] {
  return data.map((r) => ({ ...r, [key]: modelName(String(r[key])) }));
}
interface FinSummary {
  totalBlockings: number; untouched: number; inHouse: number;
  loginPending: number; loggedApprovalPending: number; loggedDocsPending: number;
  approved: number; disbursed: number;
}
interface DateRow       { date: string; count: number; }
interface BankRow       { bankName: string; count: number; }
interface ReleaseData   { total: number; branches: { branch: string; count: number }[]; reasons: { reason: string; count: number; pct: number }[]; }

// generic pivot row shapes
type R2 = { [k: string]: string | number };

// ── Pivot builder ─────────────────────────────────────────────────────────────
function buildPivot<T extends R2>(rows: T[], rowKey: keyof T, colKey: keyof T, cols: string[]) {
  const branches = Array.from(new Set(rows.map((r) => String(r[rowKey])))).sort();
  const lookup = new Map<string, number>();
  const colTotals = new Map<string, number>();
  const rowTotals = new Map<string, number>();
  for (const r of rows) {
    const bk = String(r[rowKey]); const ck = String(r[colKey]); const cnt = Number(r['count']);
    lookup.set(`${bk}\x01${ck}`, cnt);
    colTotals.set(ck, (colTotals.get(ck) ?? 0) + cnt);
    rowTotals.set(bk, (rowTotals.get(bk) ?? 0) + cnt);
  }
  for (const c of cols) if (!colTotals.has(c)) colTotals.set(c, 0);
  const grand = Array.from(rowTotals.values()).reduce((a, b) => a + b, 0);
  return { branches, lookup, colTotals, rowTotals, grand };
}

// ── Shared table styles ───────────────────────────────────────────────────────
const thCls      = 'px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-zinc-400 text-center whitespace-nowrap';
const tdCls      = 'px-3 py-2 text-xs text-center tabular-nums';
const tdBrCls    = 'px-3 py-2 text-xs font-headline font-bold text-on-surface tracking-tight text-left whitespace-nowrap';
const tdTotCls   = 'px-3 py-2 text-xs font-bold text-center tabular-nums text-primary';
const thTotCls   = 'px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-primary text-center';

function cell(v: number | undefined) {
  if (!v) return <span className="text-zinc-600">—</span>;
  return <span>{v}</span>;
}

// ── Column sets ───────────────────────────────────────────────────────────────
const STOCK_COLS    = ['BND', 'CTDMS', 'MDDP', 'Unknown', 'Not Set'];
const AGE_COLS      = ['0–7 days', '8–15 days', '16–30 days', '31+ days'];
const PURCHASE_COLS = ['In House', 'Out House', 'Cash', 'Leasing', 'No Idea', 'Not Set', 'Not Updated'];
const FIN_STATUS_COLS = ['Login Pending','Logged Approval Pending','Logged Document Pending','Approved','Agreement Done','Disbursed','Rejected'];
const PAY_STATUS_COLS = ['Down Payment Received','Only Booking Received','Part Payment Received','Full Payment Received','Ready for Disbursement','Not Updated'];
const FP_AGE_COLS   = ['0', '1', '2', '3', '4', '5', '6', '7', '8+'];

// ── Chart colours ─────────────────────────────────────────────────────────────
const STOCK_COLORS: Record<string, string> = { BND: '#6750A4', CTDMS: '#F59E0B', MDDP: '#10B981', Unknown: '#6b7280' };
const CHART_BLUE = '#3B82F6';

function statusColour(s: string): string {
  if (s === 'Disbursed')      return 'text-green-400';
  if (s === 'Approved')       return 'text-primary';
  if (s === 'Agreement Done') return 'text-teal-400';
  if (s === 'Rejected')       return 'text-red-400';
  if (s === 'Login Pending')  return 'text-yellow-400';
  if (s.startsWith('Logged')) return 'text-orange-400';
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

function SectionHead({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-2">
      <span className="material-symbols-outlined text-amber-400 text-base">{icon}</span>
      <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface">{title}</h2>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="border-t border-zinc-800/40 pt-3 mt-2">
      <p className="text-[10px] font-label uppercase tracking-widest text-zinc-500">{label}</p>
    </div>
  );
}

// ── Pivot table component ─────────────────────────────────────────────────────
function PivotTable({ rowLabel, data, rowKey, colKey, activeCols, colorFn }: {
  rowLabel: string;
  data: R2[];
  rowKey: string;
  colKey: string;
  activeCols: string[];
  colorFn?: (c: string) => string;
}) {
  const pivot = buildPivot(data, rowKey, colKey, activeCols);
  return (
    <div className="bg-surface-container-low rounded-xl overflow-auto">
      <table className="w-full text-sm font-body">
        <thead className="bg-surface-container">
          <tr>
            <th className={`${thCls} text-left`}>{rowLabel}</th>
            {activeCols.map((c) => <th key={c} className={`${thCls} ${colorFn?.(c) ?? ''}`}>{c}</th>)}
            <th className={thTotCls}>Total</th>
          </tr>
        </thead>
        <tbody>
          {pivot.branches.map((br, i) => (
            <tr key={br} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)', background: i % 2 === 0 ? 'transparent' : 'rgba(67,70,86,0.03)' }}>
              <td className={tdBrCls}>{br}</td>
              {activeCols.map((c) => <td key={c} className={`${tdCls} ${colorFn?.(c) ?? ''}`}>{cell(pivot.lookup.get(`${br}\x01${c}`))}</td>)}
              <td className={tdTotCls}>{pivot.rowTotals.get(br) ?? 0}</td>
            </tr>
          ))}
          {pivot.branches.length === 0 && (
            <tr><td colSpan={activeCols.length + 2} className="px-4 py-8 text-center text-on-surface-variant text-sm">No data</td></tr>
          )}
          {pivot.branches.length > 0 && (
            <tr className="bg-surface-container">
              <td className={`${tdBrCls} text-primary`}>Total</td>
              {activeCols.map((c) => <td key={c} className={tdTotCls}>{cell(pivot.colTotals.get(c))}</td>)}
              <td className={`${tdTotCls} text-primary`}>{pivot.grand}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CEOPage() {
  const [summary, setSummary]           = useState<Summary | null>(null);
  const [stockVsYear, setStockVsYear]   = useState<R2[]>([]);
  const [modelPhysical, setModelPhysical] = useState<R2[]>([]);
  const [modelBlockStock, setModelBlockStock] = useState<R2[]>([]);
  const [modelBlockPay, setModelBlockPay] = useState<R2[]>([]);
  const [branchAgeing, setBranchAgeing] = useState<R2[]>([]);
  const [branchModel, setBranchModel]   = useState<R2[]>([]);
  const [branchStockChart, setBranchStockChart] = useState<R2[]>([]);
  const [byDate, setByDate]             = useState<DateRow[]>([]);
  const [billing, setBilling]           = useState<DateRow[]>([]);
  const [release, setRelease]           = useState<ReleaseData | null>(null);
  const [finSummary, setFinSummary]     = useState<FinSummary | null>(null);
  const [finPurchase, setFinPurchase]   = useState<R2[]>([]);
  const [finStatus, setFinStatus]       = useState<R2[]>([]);
  const [banks, setBanks]               = useState<BankRow[]>([]);
  const [modelPurchase, setModelPurchase]   = useState<R2[]>([]);
  const [modelFinStatus, setModelFinStatus] = useState<R2[]>([]);
  const [fpAge, setFpAge]                   = useState<R2[]>([]);
  const [loading, setLoading]               = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [s, sy, mp, mbs, mbp, ba, bm, bsc, bd, bp, ra, fs, fp, fst, fbank, mpur, mfst, fpa] = await Promise.all([
      api.get('/ceo/summary'),
      api.get('/ceo/stock-vs-year'),
      api.get('/ceo/model-physical-stock'),
      api.get('/ceo/model-blocking-stock'),
      api.get('/ceo/model-blocking-payment'),
      api.get('/ceo/branch-blocking-ageing'),
      api.get('/ceo/branch-model-blocking'),
      api.get('/ceo/branch-stock-blocking'),
      api.get('/ceo/blockings-by-date'),
      api.get('/ceo/billing-pipeline'),
      api.get('/ceo/release-analysis'),
      api.get('/ceo/finance-summary'),
      api.get('/ceo/finance-branch-purchase'),
      api.get('/ceo/finance-branch-status'),
      api.get('/ceo/finance-bank'),
      api.get('/ceo/model-purchase'),
      api.get('/ceo/model-finance-status'),
      api.get('/ceo/full-payment-ageing'),
    ]);
    setSummary(s.data); setStockVsYear(sy.data);
    setModelPhysical(mapModelKey(mp.data, 'model'));
    setModelBlockStock(mapModelKey(mbs.data, 'model'));
    setModelBlockPay(mapModelKey(mbp.data, 'model'));
    setBranchAgeing(ba.data);
    setBranchModel(mapModelKey(bm.data, 'model'));
    setBranchStockChart(bsc.data); setByDate(bd.data);
    setBilling(bp.data); setRelease(ra.data); setFinSummary(fs.data);
    setFinPurchase(fp.data); setFinStatus(fst.data); setBanks(fbank.data);
    setModelPurchase(mapModelKey(mpur.data, 'model'));
    setModelFinStatus(mapModelKey(mfst.data, 'model'));
    setFpAge(fpa.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Derived active cols (only show cols with data)
  const activeStockYearCols  = Array.from(new Set(stockVsYear.map((r) => String(r['chassisYear'])))).sort();
  const activePhysicalCols   = STOCK_COLS.filter((c) => modelPhysical.some((r) => r['stockStatus'] === c));
  const activeBlockStockCols = STOCK_COLS.filter((c) => modelBlockStock.some((r) => r['stockStatus'] === c));
  const activeBlockPayCols   = PAY_STATUS_COLS.filter((c) => modelBlockPay.some((r) => r['paymentStatus'] === c));
  const activeAgeCols        = AGE_COLS.filter((c) => branchAgeing.some((r) => r['ageBucket'] === c));
  const activeModelCols      = Array.from(new Set(branchModel.map((r) => String(r['model'])))).sort();
  const activePurchaseCols   = PURCHASE_COLS.filter((c) => finPurchase.some((r) => r['purchaseMode'] === c));
  const activeFinStatusCols  = FIN_STATUS_COLS.filter((c) => finStatus.some((r) => r['financeStatus'] === c));
  const activeModelPurchaseCols = PURCHASE_COLS.filter((c) => modelPurchase.some((r) => r['purchaseMode'] === c));
  const activeModelFinStatusCols = FIN_STATUS_COLS.filter((c) => modelFinStatus.some((r) => r['financeStatus'] === c));
  const activeFpAgeCols          = FP_AGE_COLS.filter((c) => fpAge.some((r) => r['dayBucket'] === c));

  // Transform branch-stock data for stacked bar chart (with totals for labels)
  const barBranches = Array.from(new Set(branchStockChart.map((r) => String(r['branch'])))).sort();
  const stockBarsData = barBranches.map((br) => {
    const entry: Record<string, string | number> = { branch: br, _phantom: 0 };
    let total = 0;
    for (const r of branchStockChart) {
      if (String(r['branch']) === br) {
        const cnt = Number(r['count']);
        entry[String(r['stockStatus'])] = cnt;
        total += cnt;
      }
    }
    entry['_total'] = total;
    return entry;
  });
  const activeBarStockCols = Array.from(new Set(branchStockChart.map((r) => String(r['stockStatus']))));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-amber-400 text-4xl">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">CEO Dashboard</h1>
          <p className="text-on-surface-variant font-body text-sm">Complete business overview across all branches.</p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-2 text-xs font-label uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors">
          <span className="material-symbols-outlined text-base">refresh</span>Refresh
        </button>
      </div>

      {/* ── Summary KPIs ───────────────────────────────────────────────────── */}
      <section>
        <SectionHead title="Business Overview" icon="dashboard" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="Physical Stock (BND+CTDMS)" value={summary?.physicalStock}      color="#6750A4" icon="warehouse" />
          <KPI label="MDDP Stock"                 value={summary?.mddpStock}          color="#10B981" icon="inventory_2" />
          <KPI label="Total Active Blockings"     value={summary?.totalBlockings}     color="#3B82F6" icon="directions_car" />
          <KPI label="Cash Blockings"             value={summary?.cashBlockings}      color="#F59E0B" icon="payments" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
          <KPI label="Finance Blockings (by FO)"  value={summary?.financeBlockings}   color="#8B5CF6" icon="account_balance" />
          <KPI label="Approved Finance Cases"     value={summary?.approvedFinance}    color="#14B8A6" icon="verified" />
          <KPI label="Full Payment Collected"     value={summary?.fullPaymentCollected} color="#10B981" icon="check_circle" />
        </div>
      </section>

      {/* ── STOCK SECTION ─────────────────────────────────────────────────── */}
      <Divider label="Stock Analysis" />

      {/* Table 1: Stock Status × Chassis Year */}
      <section>
        <SectionHead title="Table 1 — Stock Status × Chassis Year (All Non-Delivered)" icon="table_chart" />
        <PivotTable rowLabel="Stock Status" data={stockVsYear} rowKey="stockStatus" colKey="chassisYear" activeCols={activeStockYearCols} />
      </section>

      {/* Table 2: Model wise Physical Stock */}
      <section>
        <SectionHead title="Table 2 — Model wise Physical Stock (BND + CTDMS, Non-Delivered)" icon="directions_car" />
        <PivotTable rowLabel="Model" data={modelPhysical} rowKey="model" colKey="stockStatus" activeCols={activePhysicalCols} />
      </section>

      {/* ── BLOCKING ANALYSIS ─────────────────────────────────────────────── */}
      <Divider label="Blocking Analysis" />

      {/* Table 3: Model × Blocking Stock Status */}
      <section>
        <SectionHead title="Table 3 — Model wise Blockings × Stock Status (Active Hard Blocks)" icon="lock" />
        <PivotTable rowLabel="Model" data={modelBlockStock} rowKey="model" colKey="stockStatus" activeCols={activeBlockStockCols} />
      </section>

      {/* Table 4: Model × Payment Status */}
      <section>
        <SectionHead title="Table 4 — Model wise Blockings × Payment Status" icon="receipt_long" />
        <PivotTable rowLabel="Model" data={modelBlockPay} rowKey="model" colKey="paymentStatus" activeCols={activeBlockPayCols} />
      </section>

      {/* Table 5: Branch × Ageing */}
      <section>
        <SectionHead title="Table 5 — Blocked Vehicles Ageing (Days from Block Date)" icon="schedule" />
        <PivotTable rowLabel="Branch" data={branchAgeing} rowKey="branch" colKey="ageBucket" activeCols={activeAgeCols} />
      </section>

      {/* Table 6: Branch × Model */}
      <section>
        <SectionHead title="Table 6 — Branch wise Model wise Blockings" icon="grid_view" />
        <PivotTable rowLabel="Branch" data={branchModel} rowKey="branch" colKey="model" activeCols={activeModelCols} />
      </section>

      {/* ── CHARTS ────────────────────────────────────────────────────────── */}
      <Divider label="Timeline & Analytics" />

      {/* Bar Chart: Blockings by Branch × Stock Status */}
      <section>
        <SectionHead title="Blockings by Branch — Stock Status Bifurcation" icon="bar_chart" />
        <div className="bg-surface-container-low rounded-xl p-6">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={stockBarsData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(67,70,86,0.2)" />
              <XAxis dataKey="branch" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-35} textAnchor="end" interval={0} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(67,70,86,0.4)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {activeBarStockCols.map((ss) => (
                <Bar key={ss} dataKey={ss} stackId="a" fill={STOCK_COLORS[ss] ?? '#6b7280'} radius={[0, 0, 0, 0]}>
                  <LabelList dataKey={ss} position="center" style={{ fontSize: 9, fill: '#fff', fontWeight: 'bold' }} formatter={(v: number) => (v > 0 ? v : '')} />
                </Bar>
              ))}
              {/* Phantom bar — carries total label on top of stack */}
              <Bar dataKey="_phantom" stackId="a" fill="transparent" stroke="none" legendType="none">
                <LabelList dataKey="_total" position="top" style={{ fontSize: 11, fill: '#e4e4e7', fontWeight: 'bold' }} formatter={(v: number) => (v > 0 ? v : '')} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Line Chart: Bookings by Date */}
      <section>
        <SectionHead title="Blockings by Date — Last 60 Days" icon="timeline" />
        <div className="bg-surface-container-low rounded-xl p-6">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byDate} margin={{ top: 4, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(67,70,86,0.2)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(d) => d.slice(5)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(67,70,86,0.4)', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="count" stroke={CHART_BLUE} strokeWidth={2} dot={{ r: 3, fill: CHART_BLUE }} name="Blockings" label={{ position: 'top', fontSize: 9, fill: '#9ca3af' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Column Chart: Expected Billing Pipeline */}
      <section>
        <SectionHead title="Expected Billing Pipeline" icon="event" />
        <div className="bg-surface-container-low rounded-xl p-6">
          {billing.length === 0 ? (
            <p className="text-center text-on-surface-variant text-sm py-12">No billing dates set on active blockings</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={billing} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(67,70,86,0.2)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-35} textAnchor="end" interval={0} tickFormatter={(d) => d.slice(5)} />
                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(67,70,86,0.4)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#8B5CF6" name="Vehicles" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── RELEASE ANALYSIS ─────────────────────────────────────────────── */}
      <Divider label="Release to Pool Analysis (Last 180 Days)" />

      <section>
        <SectionHead title={`Release to Pool — ${release?.total ?? 0} Total Releases`} icon="lock_open" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top branches */}
          <div className="bg-surface-container-low rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-surface-container">
              <p className="text-[10px] font-label uppercase tracking-widest text-zinc-400">Top Branches by Releases</p>
            </div>
            <table className="w-full text-sm font-body">
              <thead className="bg-surface-container/50">
                <tr>
                  <th className={`${thCls} text-left`}>Branch</th>
                  <th className={thCls}>Releases</th>
                  <th className={thCls}>% of Total</th>
                </tr>
              </thead>
              <tbody>
                {(release?.branches ?? []).map((b, i) => (
                  <tr key={b.branch} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }}>
                    <td className={tdBrCls}>{b.branch}</td>
                    <td className={tdCls}>{b.count}</td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-700/50">
                          <div className="h-1.5 rounded-full bg-tertiary" style={{ width: `${Math.round((b.count / (release?.total ?? 1)) * 100)}%` }} />
                        </div>
                        <span className="text-zinc-400 text-[10px] w-8 text-right">{Math.round((b.count / (release?.total ?? 1)) * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!release?.branches.length && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-on-surface-variant text-sm">No release data</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Top reasons */}
          <div className="bg-surface-container-low rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-surface-container">
              <p className="text-[10px] font-label uppercase tracking-widest text-zinc-400">Top Release Reasons</p>
            </div>
            <table className="w-full text-sm font-body">
              <thead className="bg-surface-container/50">
                <tr>
                  <th className={`${thCls} text-left`}>Reason</th>
                  <th className={thCls}>Count</th>
                  <th className={thCls}>%</th>
                </tr>
              </thead>
              <tbody>
                {(release?.reasons ?? []).slice(0, 5).map((r) => (
                  <tr key={r.reason} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }}>
                    <td className={tdBrCls}>{r.reason}</td>
                    <td className={tdCls}>{r.count}</td>
                    <td className={tdCls}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-700/50">
                          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${r.pct}%` }} />
                        </div>
                        <span className="text-zinc-400 text-[10px] w-8 text-right">{r.pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {!release?.reasons.length && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-on-surface-variant text-sm">No release data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FINANCE SECTION ───────────────────────────────────────────────── */}
      <Divider label="Finance Overview" />

      {/* Finance KPIs */}
      <section>
        <SectionHead title="Finance KPIs" icon="account_balance" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="Total Hard Blockings"        value={finSummary?.totalBlockings}         color="#6750A4" icon="directions_car" />
          <KPI label="Not Updated by FO"           value={finSummary?.untouched}              color="#EF4444" icon="hourglass_empty" />
          <KPI label="In House Finance"            value={finSummary?.inHouse}                color="#3B82F6" icon="account_balance" />
          <KPI label="Login Pending"               value={finSummary?.loginPending}           color="#F59E0B" icon="pending" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <KPI label="Logged / Approval Pending"   value={finSummary?.loggedApprovalPending}  color="#F97316" icon="approval" />
          <KPI label="Logged / Docs Pending"       value={finSummary?.loggedDocsPending}      color="#EAB308" icon="description" />
          <KPI label="Approved"                    value={finSummary?.approved}               color="#8B5CF6" icon="verified" />
          <KPI label="Disbursed"                   value={finSummary?.disbursed}              color="#10B981" icon="payments" />
        </div>
      </section>

      {/* Finance Branch × Purchase Mode */}
      <section>
        <SectionHead title="Branch × Purchase Mode" icon="storefront" />
        <PivotTable rowLabel="Branch" data={finPurchase} rowKey="branch" colKey="purchaseMode" activeCols={activePurchaseCols} />
      </section>

      {/* Finance Branch × Finance Status */}
      <section>
        <SectionHead title="Branch × Finance Status" icon="timeline" />
        <PivotTable rowLabel="Branch" data={finStatus} rowKey="branch" colKey="financeStatus" activeCols={activeFinStatusCols} colorFn={statusColour} />
      </section>

      {/* Model × Purchase Mode */}
      <section>
        <SectionHead title="Model × Purchase Mode" icon="directions_car" />
        <PivotTable rowLabel="Model" data={modelPurchase} rowKey="model" colKey="purchaseMode" activeCols={activeModelPurchaseCols} />
      </section>

      {/* Model × Finance Status (In House only) */}
      <section>
        <SectionHead title="Model × Finance Status (In House Cases)" icon="account_tree" />
        <PivotTable rowLabel="Model" data={modelFinStatus} rowKey="model" colKey="financeStatus" activeCols={activeModelFinStatusCols} colorFn={statusColour} />
      </section>

      {/* Full Payment Ageing */}
      <section>
        <SectionHead title="Days Since Full Payment — BND / CTDMS Physical Stock" icon="payments" />
        <PivotTable
          rowLabel="Branch"
          data={fpAge}
          rowKey="branch"
          colKey="dayBucket"
          activeCols={activeFpAgeCols}
          colorFn={(c) => (Number(c) >= 5 || c === '8+') ? 'text-red-400' : Number(c) >= 3 ? 'text-orange-400' : 'text-green-400'}
        />
      </section>

      {/* Bank × Count */}
      <section>
        <SectionHead title="Bank wise Finance Cases" icon="domain" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Table */}
          <div className="bg-surface-container-low rounded-xl overflow-hidden">
            <table className="w-full text-sm font-body">
              <thead className="bg-surface-container">
                <tr>
                  <th className={`${thCls} text-left`}>Bank Name</th>
                  <th className={thCls}>Cases</th>
                  <th className={thCls}>% Share</th>
                </tr>
              </thead>
              <tbody>
                {banks.slice(0, 5).map((b, i) => {
                  const total = banks.reduce((s, x) => s + x.count, 0);
                  const pct = total ? Math.round((b.count / total) * 100) : 0;
                  return (
                    <tr key={b.bankName} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)', background: i % 2 === 0 ? 'transparent' : 'rgba(67,70,86,0.03)' }}>
                      <td className={tdBrCls}>{b.bankName}</td>
                      <td className={tdCls}>{b.count}</td>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-zinc-700/50">
                            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-zinc-400 text-[10px] w-8 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!banks.length && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-on-surface-variant text-sm">No bank data</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bar chart for banks */}
          <div className="bg-surface-container-low rounded-xl p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={banks.slice(0, 5)} layout="vertical" margin={{ top: 4, right: 16, left: 60, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(67,70,86,0.2)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis type="category" dataKey="bankName" tick={{ fontSize: 10, fill: '#9ca3af' }} width={55} />
                <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid rgba(67,70,86,0.4)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="#6750A4" name="Cases" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

    </div>
  );
}
