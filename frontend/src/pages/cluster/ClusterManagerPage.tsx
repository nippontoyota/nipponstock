import { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { differenceInHours } from 'date-fns';

// ── Types ─────────────────────────────────────────────────────────────────────
interface MTDSummary {
  mtdBlocked: number;
  mtdCash: number;
  mtdFinance: number;
  mtdReleased: number;
}

interface FinanceSummary {
  totalBlockings: number;
  untouched: number;
  inHouse: number;
  loginPending: number;
  loggedApprovalPending: number;
  loggedDocsPending: number;
  approved: number;
  disbursed: number;
}

interface StockRow    { branch: string; stockStatus: string;   count: number; }
interface PayRow      { branch: string; paymentStatus: string; count: number; }
interface AgeRow      { branch: string; ageBucket: string;     count: number; }
interface PurchaseRow { branch: string; purchaseMode: string;  count: number; }
interface StatusRow   { branch: string; financeStatus: string; count: number; }
interface FPAgeRow    { branch: string; dayBucket: string;     count: number; }
interface StockAgeRow { model: string;  ageBucket: string;    count: number; }

interface HeatmapYearBreakdown {
  chassisYear: number;
  open: number;
  total: number;
  level: 'green' | 'yellow' | 'red';
  hasPhysical: boolean;
}
interface HeatmapCell {
  model: string; suffix: string; colour: string;
  open: number; total: number; level: 'green' | 'yellow' | 'red';
  hasPhysical: boolean; chassisYears: number[];
  yearBreakdown: HeatmapYearBreakdown[];
}

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
  fullPaymentAt: string | null;
  expectedBillingDate: string | null;
  vehicle: { model: string; suffix: string; colour: string; chassisYear: number; chassisNumber: string; stockStatus: string | null; stockyardLocation: string };
  branch: { name: string; branchCode: string | null };
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

// ── Column definitions ────────────────────────────────────────────────────────
const STOCK_COLS   = ['BND', 'MDDP', 'CTDMS', 'Unknown'];
const AGE_COLS     = ['0–7 days', '8–15 days', '16–30 days', '31+ days'];
const PURCHASE_COLS = ['In House', 'Out House', 'Cash', 'Leasing', 'No Idea', 'Not Set', 'Not Updated'];
const FP_AGE_COLS   = ['0', '1', '2', '3', '4', '5', '6', '7', '8+'];
const STOCK_AGE_COLS = ['<30d', '30-50d', '51-70d', '71-100d', '101-150d', '150+d'];
const FINANCE_STATUS_COLS = [
  'Login Pending', 'Logged Approval Pending', 'Logged Document Pending',
  'Approved', 'Agreement Done', 'Disbursed', 'Rejected',
];

// ── Pivot builder ─────────────────────────────────────────────────────────────
function buildPivot<T extends { branch: string }>(
  rows: T[],
  keyFn: (r: T) => string,
  cols: string[],
) {
  const branches = Array.from(new Set(rows.map((r) => r.branch))).sort();
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
  for (const col of cols) if (!colTotals.has(col)) colTotals.set(col, 0);

  const grand = Array.from(rowTotals.values()).reduce((a, b) => a + b, 0);
  return { branches, lookup, colTotals, rowTotals, grand };
}

// ── Model-based pivot (for stock ageing tables) ───────────────────────────────
function buildModelPivot(rows: StockAgeRow[], cols: string[]) {
  const models = Array.from(new Set(rows.map((r) => r.model))).sort();
  const lookup = new Map<string, number>();
  const colTotals = new Map<string, number>();
  const rowTotals = new Map<string, number>();
  for (const r of rows) {
    lookup.set(`${r.model}\x01${r.ageBucket}`, r.count);
    colTotals.set(r.ageBucket, (colTotals.get(r.ageBucket) ?? 0) + r.count);
    rowTotals.set(r.model, (rowTotals.get(r.model) ?? 0) + r.count);
  }
  const grand = Array.from(rowTotals.values()).reduce((a, b) => a + b, 0);
  return { models, lookup, colTotals, rowTotals, grand };
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const thCls     = 'px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-zinc-400 text-center whitespace-nowrap';
const tdCls     = 'px-3 py-2 text-xs text-center tabular-nums';
const tdBranchCls = 'px-3 py-2 text-xs font-headline font-bold text-on-surface tracking-tight text-left whitespace-nowrap';
const tdTotCls  = 'px-3 py-2 text-xs font-bold text-center tabular-nums text-primary';
const thTotCls  = 'px-3 py-2 text-[9px] font-label font-black uppercase tracking-widest text-primary text-center';

function cell(v: number | undefined) {
  if (!v) return <span className="text-zinc-600">—</span>;
  return <span>{v}</span>;
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

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHead({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="material-symbols-outlined text-primary text-base">{icon}</span>
      <h2 className="font-headline font-bold text-sm uppercase tracking-widest text-on-surface">{title}</h2>
    </div>
  );
}

function statusColour(s: string): string {
  if (s === 'Disbursed')              return 'text-green-400';
  if (s === 'Approved')               return 'text-primary';
  if (s === 'Agreement Done')         return 'text-teal-400';
  if (s === 'Rejected')               return 'text-red-400';
  if (s === 'Login Pending')          return 'text-yellow-400';
  if (s.startsWith('Logged'))         return 'text-orange-400';
  return 'text-zinc-400';
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ClusterManagerPage() {
  const { user } = useAuth();
  const cluster = user?.clusterNumber;

  const [mtd, setMtd]             = useState<MTDSummary | null>(null);
  const [stockData, setStockData] = useState<StockRow[]>([]);
  const [payData, setPayData]     = useState<PayRow[]>([]);
  const [ageData, setAgeData]     = useState<AgeRow[]>([]);
  const [finSummary, setFinSummary] = useState<FinanceSummary | null>(null);
  const [purchaseData, setPurchaseData] = useState<PurchaseRow[]>([]);
  const [statusData, setStatusData]     = useState<StatusRow[]>([]);
  const [fpAgeData, setFpAgeData]             = useState<FPAgeRow[]>([]);
  const [stockAgeData, setStockAgeData]       = useState<StockAgeRow[]>([]);
  const [blockingStockAgeData, setBlockingStockAgeData] = useState<StockAgeRow[]>([]);
  const [heatmapCells, setHeatmapCells] = useState<HeatmapCell[]>([]);
  const [loading, setLoading]       = useState(true);
  const [downloading, setDownloading] = useState(false);

  const downloadHeatmap = () => {
    if (heatmapCells.length === 0) return;
    const availabilityLabel = (level: 'green' | 'yellow' | 'red') =>
      level === 'green' ? 'High (>5)' : level === 'yellow' ? 'Medium (>2–5)' : 'Critical (≤2)';
    const rows = heatmapCells.flatMap((c) =>
      c.yearBreakdown.map((y) => ({
        Model: c.model,
        Suffix: c.suffix,
        Colour: c.colour,
        'Chassis Year': y.chassisYear,
        Availability: availabilityLabel(y.level),
        'Physical Status': y.hasPhysical ? 'Yes' : 'No',
      })),
    );
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock Heatmap');
    XLSX.writeFile(wb, `heatmap_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadExcel = async () => {
    setDownloading(true);
    try {
      const { data } = await api.get<RawBlocking[]>('/cluster-manager/all-blockings');
      const rows = data.map((b) => {
        const daysLeft = b.expiryAt
          ? Math.max(0, Math.floor(differenceInHours(new Date(b.expiryAt), new Date()) / 24))
          : '';
        return {
          'Branch':               b.branch.name,
          'Branch Code':          b.branch.branchCode ?? '',
          'Sales Manager':        b.user.fullName,
          'Customer':             b.customerName ?? '',
          'Chassis Year':         b.vehicle.chassisYear,
          'Model':                b.vehicle.model,
          'Suffix':               b.vehicle.suffix,
          'Colour':               b.vehicle.colour,
          'Chassis No':           b.vehicle.chassisNumber,
          'Stock Status':         b.vehicle.stockStatus ?? '',
          'Stockyard Location':   b.vehicle.stockyardLocation ?? '',
          'Order ID':             b.orderId ?? '',
          'Consultant':           b.consultantName ?? '',
          'Team Leader':          b.teamLeaderName ?? '',
          'Payment Status':       b.paymentStatus ?? '',
          'Blocked Date':         b.hardBlockAt ? new Date(b.hardBlockAt).toLocaleDateString('en-GB') : '',
          'Days Left':            daysLeft,
          'Expiry':               b.expiryAt ? new Date(b.expiryAt).toLocaleDateString('en-GB') : (b.fullPaymentAt ? 'No Expiry (Full Paid)' : ''),
          'Full Payment Date':    b.fullPaymentAt ? new Date(b.fullPaymentAt).toLocaleDateString('en-GB') : '',
          'Days Since Full Pymt': b.fullPaymentAt ? Math.floor((Date.now() - new Date(b.fullPaymentAt).getTime()) / 86_400_000) : '',
          'Expected Billing':     b.expectedBillingDate ? new Date(b.expectedBillingDate).toLocaleDateString('en-GB') : '',
          'FO Purchase Mode':     b.financeRecord?.purchaseMode ?? '',
          'FO Bank Name':         b.financeRecord?.bankName ?? '',
          'FO Loan Amount':       b.financeRecord?.loanAmount ?? '',
          'FO Finance Status':    b.financeRecord?.financeStatus ?? '',
          'FO Exp. Disbursement': b.financeRecord?.expectedDisbursementDate
            ? new Date(b.financeRecord.expectedDisbursementDate).toLocaleDateString('en-GB')
            : '',
          'FO Remarks':           b.financeRecord?.otherRemarks ?? '',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      // Auto column widths
      const colWidths = Object.keys(rows[0] ?? {}).map((k) => ({
        wch: Math.max(k.length, ...rows.map((r) => String(r[k as keyof typeof r] ?? '').length)) + 2,
      }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Cluster ${cluster} Blockings`);
      XLSX.writeFile(wb, `cluster${cluster}_blockings_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      // silent — toast would need import
    } finally {
      setDownloading(false);
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [m, s, p, a, fs, fp, fst, fpa, sa, bsa, hm] = await Promise.all([
      api.get('/cluster-manager/summary'),
      api.get('/cluster-manager/branch-stock'),
      api.get('/cluster-manager/branch-payment'),
      api.get('/cluster-manager/branch-ageing'),
      api.get('/cluster-manager/finance-summary'),
      api.get('/cluster-manager/finance-branch-purchase'),
      api.get('/cluster-manager/finance-branch-status'),
      api.get('/cluster-manager/full-payment-ageing'),
      api.get('/cluster-manager/stock-ageing'),
      api.get('/cluster-manager/blocking-stock-ageing'),
      api.get('/stock/heatmap'),
    ]);
    setMtd(m.data);
    setStockData(s.data);
    setPayData(p.data);
    setAgeData(a.data);
    setFinSummary(fs.data);
    setPurchaseData(fp.data);
    setStatusData(fst.data);
    setFpAgeData(fpa.data);
    setStockAgeData(sa.data);
    setBlockingStockAgeData(bsa.data);
    setHeatmapCells(hm.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Build pivot data
  const activeStockCols   = STOCK_COLS.filter((c) => stockData.some((r) => r.stockStatus === c));
  const activePayCols     = Array.from(new Set(payData.map((r) => r.paymentStatus))).sort();
  const activeAgeCols     = AGE_COLS.filter((c) => ageData.some((r) => r.ageBucket === c));
  const activePurchaseCols = PURCHASE_COLS.filter((c) => purchaseData.some((r) => r.purchaseMode === c));
  const activeStatusCols  = FINANCE_STATUS_COLS.filter((c) => statusData.some((r) => r.financeStatus === c));

  const stockPivot    = buildPivot(stockData,    (r) => r.stockStatus,   activeStockCols);
  const payPivot      = buildPivot(payData,      (r) => r.paymentStatus, activePayCols);
  const agePivot      = buildPivot(ageData,      (r) => r.ageBucket,     activeAgeCols);
  const purchasePivot = buildPivot(purchaseData, (r) => r.purchaseMode,  activePurchaseCols);
  const statusPivot   = buildPivot(statusData,   (r) => r.financeStatus, activeStatusCols);
  const fpAgePivot    = buildPivot(fpAgeData,    (r) => r.dayBucket,     FP_AGE_COLS);

  const activeStockAgeCols         = STOCK_AGE_COLS.filter((c) => stockAgeData.some((r) => r.ageBucket === c));
  const activeBlockingStockAgeCols = STOCK_AGE_COLS.filter((c) => blockingStockAgeData.some((r) => r.ageBucket === c));
  const stockAgePivot         = buildModelPivot(stockAgeData,        activeStockAgeCols);
  const blockingStockAgePivot = buildModelPivot(blockingStockAgeData, activeBlockingStockAgeCols);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Page title ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">
            Cluster {cluster} Dashboard
          </h1>
          <p className="text-on-surface-variant font-body text-sm">
            Month-to-date performance and finance overview for your cluster branches.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadHeatmap}
            disabled={heatmapCells.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container text-xs font-bold uppercase tracking-widest font-headline transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">grid_on</span>
            Heatmap Excel
          </button>
          <button
            onClick={downloadExcel}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container text-xs font-bold uppercase tracking-widest font-headline transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            {downloading ? 'Downloading…' : 'Download Excel'}
          </button>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 text-xs font-label uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* ── MTD KPI Row ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHead title="MTD Blocking Summary" icon="bar_chart_4_bars" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="Cars Blocked MTD"    value={mtd?.mtdBlocked}  color="#6750A4" icon="directions_car" />
          <KPI label="Cash Blockings MTD"  value={mtd?.mtdCash}     color="#3B82F6" icon="payments" />
          <KPI label="Finance Blockings MTD" value={mtd?.mtdFinance} color="#F59E0B" icon="account_balance" />
          <KPI label="Released to Pool MTD" value={mtd?.mtdReleased} color="#10B981" icon="rotate_left" />
        </div>
      </section>

      {/* ── Table 1: Branch × Stock Status ──────────────────────────────────── */}
      <section>
        <SectionHead title="Branch × Stock Status (Active Hard Blocks)" icon="table_chart" />
        <div className="bg-surface-container-low rounded-xl overflow-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                <th className={`${thCls} text-left`}>Branch</th>
                {activeStockCols.map((c) => <th key={c} className={thCls}>{c}</th>)}
                <th className={thTotCls}>Total</th>
              </tr>
            </thead>
            <tbody>
              {stockPivot.branches.map((br, i) => (
                <tr key={br} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)', background: i % 2 === 0 ? 'transparent' : 'rgba(67,70,86,0.03)' }}>
                  <td className={tdBranchCls}>{br}</td>
                  {activeStockCols.map((c) => (
                    <td key={c} className={tdCls}>{cell(stockPivot.lookup.get(`${br}\x01${c}`))}</td>
                  ))}
                  <td className={tdTotCls}>{stockPivot.rowTotals.get(br) ?? 0}</td>
                </tr>
              ))}
              {stockPivot.branches.length === 0 && (
                <tr><td colSpan={activeStockCols.length + 2} className="px-4 py-8 text-center text-on-surface-variant text-sm">No active hard blockings</td></tr>
              )}
              {stockPivot.branches.length > 0 && (
                <tr className="bg-surface-container">
                  <td className={`${tdBranchCls} text-primary`}>Total</td>
                  {activeStockCols.map((c) => <td key={c} className={tdTotCls}>{cell(stockPivot.colTotals.get(c))}</td>)}
                  <td className={`${tdTotCls} text-primary`}>{stockPivot.grand}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Table 2: Branch × Payment Status ────────────────────────────────── */}
      <section>
        <SectionHead title="Branch × Payment Status (Active Hard Blocks)" icon="receipt_long" />
        <div className="bg-surface-container-low rounded-xl overflow-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                <th className={`${thCls} text-left`}>Branch</th>
                {activePayCols.map((c) => <th key={c} className={thCls}>{c}</th>)}
                <th className={thTotCls}>Total</th>
              </tr>
            </thead>
            <tbody>
              {payPivot.branches.map((br, i) => (
                <tr key={br} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)', background: i % 2 === 0 ? 'transparent' : 'rgba(67,70,86,0.03)' }}>
                  <td className={tdBranchCls}>{br}</td>
                  {activePayCols.map((c) => (
                    <td key={c} className={tdCls}>{cell(payPivot.lookup.get(`${br}\x01${c}`))}</td>
                  ))}
                  <td className={tdTotCls}>{payPivot.rowTotals.get(br) ?? 0}</td>
                </tr>
              ))}
              {payPivot.branches.length === 0 && (
                <tr><td colSpan={activePayCols.length + 2} className="px-4 py-8 text-center text-on-surface-variant text-sm">No data</td></tr>
              )}
              {payPivot.branches.length > 0 && (
                <tr className="bg-surface-container">
                  <td className={`${tdBranchCls} text-primary`}>Total</td>
                  {activePayCols.map((c) => <td key={c} className={tdTotCls}>{cell(payPivot.colTotals.get(c))}</td>)}
                  <td className={`${tdTotCls} text-primary`}>{payPivot.grand}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Table 3: Branch × Ageing ─────────────────────────────────────────── */}
      <section>
        <SectionHead title="Branch × Blocking Ageing (Active Hard Blocks)" icon="schedule" />
        <div className="bg-surface-container-low rounded-xl overflow-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                <th className={`${thCls} text-left`}>Branch</th>
                {activeAgeCols.map((c) => <th key={c} className={thCls}>{c}</th>)}
                <th className={thTotCls}>Total</th>
              </tr>
            </thead>
            <tbody>
              {agePivot.branches.map((br, i) => (
                <tr key={br} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)', background: i % 2 === 0 ? 'transparent' : 'rgba(67,70,86,0.03)' }}>
                  <td className={tdBranchCls}>{br}</td>
                  {activeAgeCols.map((c) => (
                    <td key={c} className={tdCls}>{cell(agePivot.lookup.get(`${br}\x01${c}`))}</td>
                  ))}
                  <td className={tdTotCls}>{agePivot.rowTotals.get(br) ?? 0}</td>
                </tr>
              ))}
              {agePivot.branches.length === 0 && (
                <tr><td colSpan={activeAgeCols.length + 2} className="px-4 py-8 text-center text-on-surface-variant text-sm">No data</td></tr>
              )}
              {agePivot.branches.length > 0 && (
                <tr className="bg-surface-container">
                  <td className={`${tdBranchCls} text-primary`}>Total</td>
                  {activeAgeCols.map((c) => <td key={c} className={tdTotCls}>{cell(agePivot.colTotals.get(c))}</td>)}
                  <td className={`${tdTotCls} text-primary`}>{agePivot.grand}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Divider ─────────────────────────────────────────────────────────── */}
      <div className="border-t border-zinc-800/40 pt-2">
        <p className="text-[10px] font-label uppercase tracking-widest text-zinc-500">Finance Overview</p>
      </div>

      {/* ── Finance KPI Row ──────────────────────────────────────────────────── */}
      <section>
        <SectionHead title="Finance KPIs (Cluster Branches)" icon="account_balance" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="Total Hard Blockings"     value={finSummary?.totalBlockings}      color="#6750A4" icon="directions_car" />
          <KPI label="Not Updated by FO"        value={finSummary?.untouched}           color="#EF4444" icon="hourglass_empty" />
          <KPI label="In House Finance"         value={finSummary?.inHouse}             color="#3B82F6" icon="account_balance" />
          <KPI label="Login Pending"            value={finSummary?.loginPending}        color="#F59E0B" icon="pending" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <KPI label="Logged / Approval Pending" value={finSummary?.loggedApprovalPending} color="#F97316" icon="approval" />
          <KPI label="Logged / Docs Pending"     value={finSummary?.loggedDocsPending}     color="#EAB308" icon="description" />
          <KPI label="Approved"                  value={finSummary?.approved}               color="#8B5CF6" icon="verified" />
          <KPI label="Disbursed"                 value={finSummary?.disbursed}              color="#10B981" icon="payments" />
        </div>
      </section>

      {/* ── Finance Table 1: Branch × Purchase Mode ──────────────────────────── */}
      <section>
        <SectionHead title="Branch × Purchase Mode" icon="storefront" />
        <div className="bg-surface-container-low rounded-xl overflow-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                <th className={`${thCls} text-left`}>Branch</th>
                {activePurchaseCols.map((c) => <th key={c} className={thCls}>{c}</th>)}
                <th className={thTotCls}>Total</th>
              </tr>
            </thead>
            <tbody>
              {purchasePivot.branches.map((br, i) => (
                <tr key={br} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)', background: i % 2 === 0 ? 'transparent' : 'rgba(67,70,86,0.03)' }}>
                  <td className={tdBranchCls}>{br}</td>
                  {activePurchaseCols.map((c) => (
                    <td key={c} className={tdCls}>{cell(purchasePivot.lookup.get(`${br}\x01${c}`))}</td>
                  ))}
                  <td className={tdTotCls}>{purchasePivot.rowTotals.get(br) ?? 0}</td>
                </tr>
              ))}
              {purchasePivot.branches.length === 0 && (
                <tr><td colSpan={activePurchaseCols.length + 2} className="px-4 py-8 text-center text-on-surface-variant text-sm">No data</td></tr>
              )}
              {purchasePivot.branches.length > 0 && (
                <tr className="bg-surface-container">
                  <td className={`${tdBranchCls} text-primary`}>Total</td>
                  {activePurchaseCols.map((c) => <td key={c} className={tdTotCls}>{cell(purchasePivot.colTotals.get(c))}</td>)}
                  <td className={`${tdTotCls} text-primary`}>{purchasePivot.grand}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Finance Table 2: Branch × Finance Status ─────────────────────────── */}
      <section>
        <SectionHead title="Branch × Finance Status" icon="timeline" />
        <div className="bg-surface-container-low rounded-xl overflow-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                <th className={`${thCls} text-left`}>Branch</th>
                {activeStatusCols.map((c) => (
                  <th key={c} className={`${thCls} ${statusColour(c)}`}>{c}</th>
                ))}
                <th className={thTotCls}>Total</th>
              </tr>
            </thead>
            <tbody>
              {statusPivot.branches.map((br, i) => (
                <tr key={br} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)', background: i % 2 === 0 ? 'transparent' : 'rgba(67,70,86,0.03)' }}>
                  <td className={tdBranchCls}>{br}</td>
                  {activeStatusCols.map((c) => (
                    <td key={c} className={`${tdCls} ${statusColour(c)}`}>{cell(statusPivot.lookup.get(`${br}\x01${c}`))}</td>
                  ))}
                  <td className={tdTotCls}>{statusPivot.rowTotals.get(br) ?? 0}</td>
                </tr>
              ))}
              {statusPivot.branches.length === 0 && (
                <tr><td colSpan={activeStatusCols.length + 2} className="px-4 py-8 text-center text-on-surface-variant text-sm">No data</td></tr>
              )}
              {statusPivot.branches.length > 0 && (
                <tr className="bg-surface-container">
                  <td className={`${tdBranchCls} text-primary`}>Total</td>
                  {activeStatusCols.map((c) => <td key={c} className={`${tdTotCls} ${statusColour(c)}`}>{cell(statusPivot.colTotals.get(c))}</td>)}
                  <td className={`${tdTotCls} text-primary`}>{statusPivot.grand}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Full Payment Ageing ───────────────────────────────────────────────── */}
      <section>
        <SectionHead title="Days Since Full Payment — BND / CTDMS Physical Stock" icon="payments" />
        <div className="bg-surface-container-low rounded-xl overflow-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                <th className={`${thCls} text-left`}>Branch</th>
                {FP_AGE_COLS.map((c) => (
                  <th key={c} className={`${thCls} ${Number(c) >= 5 || c === '8+' ? 'text-red-400' : Number(c) >= 3 ? 'text-orange-400' : 'text-green-400'}`}>{c}</th>
                ))}
                <th className={thTotCls}>Total</th>
              </tr>
            </thead>
            <tbody>
              {fpAgePivot.branches.map((br, i) => (
                <tr key={br} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)', background: i % 2 === 0 ? 'transparent' : 'rgba(67,70,86,0.03)' }}>
                  <td className={tdBranchCls}>{br}</td>
                  {FP_AGE_COLS.map((c) => {
                    const v = fpAgePivot.lookup.get(`${br}\x01${c}`);
                    const colClass = Number(c) >= 5 || c === '8+' ? 'text-red-400' : Number(c) >= 3 ? 'text-orange-400' : 'text-green-400';
                    return <td key={c} className={`${tdCls} ${v ? colClass : ''}`}>{cell(v)}</td>;
                  })}
                  <td className={tdTotCls}>{fpAgePivot.rowTotals.get(br) ?? 0}</td>
                </tr>
              ))}
              {fpAgePivot.branches.length === 0 && (
                <tr><td colSpan={FP_AGE_COLS.length + 2} className="px-4 py-8 text-center text-on-surface-variant text-sm">No data</td></tr>
              )}
              {fpAgePivot.branches.length > 0 && (
                <tr className="bg-surface-container">
                  <td className={`${tdBranchCls} text-primary`}>Total</td>
                  {FP_AGE_COLS.map((c) => {
                    const colClass = Number(c) >= 5 || c === '8+' ? 'text-red-400' : Number(c) >= 3 ? 'text-orange-400' : 'text-green-400';
                    return <td key={c} className={`${tdTotCls} ${colClass}`}>{cell(fpAgePivot.colTotals.get(c))}</td>;
                  })}
                  <td className={`${tdTotCls} text-primary`}>{fpAgePivot.grand}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Ageing Stock: Physical BND/CTDMS (all stock) ─────────────────────── */}
      <section>
        <SectionHead title="Ageing Stock — Physical BND/CTDMS (OPEN + BLOCKED, by Assignment Date)" icon="inventory_2" />
        <div className="bg-surface-container-low rounded-xl overflow-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                <th className={`${thCls} text-left`}>Model</th>
                {STOCK_AGE_COLS.map((c) => (
                  <th key={c} className={`${thCls} ${c === '150+d' ? 'text-red-400' : c === '101-150d' ? 'text-orange-400' : c === '71-100d' ? 'text-yellow-400' : 'text-green-400'}`}>{c}</th>
                ))}
                <th className={thTotCls}>Total</th>
              </tr>
            </thead>
            <tbody>
              {stockAgePivot.models.map((m, i) => (
                <tr key={m} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)', background: i % 2 === 0 ? 'transparent' : 'rgba(67,70,86,0.03)' }}>
                  <td className={tdBranchCls}>{m}</td>
                  {STOCK_AGE_COLS.map((c) => {
                    const v = stockAgePivot.lookup.get(`${m}\x01${c}`);
                    const col = c === '150+d' ? 'text-red-400' : c === '101-150d' ? 'text-orange-400' : c === '71-100d' ? 'text-yellow-400' : '';
                    return <td key={c} className={`${tdCls} ${v ? col : ''}`}>{cell(v)}</td>;
                  })}
                  <td className={tdTotCls}>{stockAgePivot.rowTotals.get(m) ?? 0}</td>
                </tr>
              ))}
              {stockAgePivot.models.length === 0 && (
                <tr><td colSpan={STOCK_AGE_COLS.length + 2} className="px-4 py-8 text-center text-on-surface-variant text-sm">No data</td></tr>
              )}
              {stockAgePivot.models.length > 0 && (
                <tr className="bg-surface-container">
                  <td className={`${tdBranchCls} text-primary`}>Total</td>
                  {STOCK_AGE_COLS.map((c) => {
                    const col = c === '150+d' ? 'text-red-400' : c === '101-150d' ? 'text-orange-400' : c === '71-100d' ? 'text-yellow-400' : '';
                    return <td key={c} className={`${tdTotCls} ${col}`}>{cell(stockAgePivot.colTotals.get(c))}</td>;
                  })}
                  <td className={`${tdTotCls} text-primary`}>{stockAgePivot.grand}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Active Blockings Ageing: cluster branches only ───────────────────── */}
      <section>
        <SectionHead title="Active Blockings Ageing — BND/CTDMS (Cluster Branches, by Vehicle Assignment Date)" icon="lock_clock" />
        <div className="bg-surface-container-low rounded-xl overflow-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                <th className={`${thCls} text-left`}>Model</th>
                {STOCK_AGE_COLS.map((c) => (
                  <th key={c} className={`${thCls} ${c === '150+d' ? 'text-red-400' : c === '101-150d' ? 'text-orange-400' : c === '71-100d' ? 'text-yellow-400' : 'text-green-400'}`}>{c}</th>
                ))}
                <th className={thTotCls}>Total</th>
              </tr>
            </thead>
            <tbody>
              {blockingStockAgePivot.models.map((m, i) => (
                <tr key={m} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)', background: i % 2 === 0 ? 'transparent' : 'rgba(67,70,86,0.03)' }}>
                  <td className={tdBranchCls}>{m}</td>
                  {STOCK_AGE_COLS.map((c) => {
                    const v = blockingStockAgePivot.lookup.get(`${m}\x01${c}`);
                    const col = c === '150+d' ? 'text-red-400' : c === '101-150d' ? 'text-orange-400' : c === '71-100d' ? 'text-yellow-400' : '';
                    return <td key={c} className={`${tdCls} ${v ? col : ''}`}>{cell(v)}</td>;
                  })}
                  <td className={tdTotCls}>{blockingStockAgePivot.rowTotals.get(m) ?? 0}</td>
                </tr>
              ))}
              {blockingStockAgePivot.models.length === 0 && (
                <tr><td colSpan={STOCK_AGE_COLS.length + 2} className="px-4 py-8 text-center text-on-surface-variant text-sm">No data</td></tr>
              )}
              {blockingStockAgePivot.models.length > 0 && (
                <tr className="bg-surface-container">
                  <td className={`${tdBranchCls} text-primary`}>Total</td>
                  {STOCK_AGE_COLS.map((c) => {
                    const col = c === '150+d' ? 'text-red-400' : c === '101-150d' ? 'text-orange-400' : c === '71-100d' ? 'text-yellow-400' : '';
                    return <td key={c} className={`${tdTotCls} ${col}`}>{cell(blockingStockAgePivot.colTotals.get(c))}</td>;
                  })}
                  <td className={`${tdTotCls} text-primary`}>{blockingStockAgePivot.grand}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
