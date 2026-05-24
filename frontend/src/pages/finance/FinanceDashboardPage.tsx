import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { format, differenceInDays } from 'date-fns';
import api from '../../api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FinanceRecord {
  id: string;
  purchaseMode: string | null;
  bankName: string | null;
  loanAmount: number | null;
  financeStatus: string | null;
  expectedDisbursementDate: string | null;
  otherRemarks: string | null;
}

interface Blocking {
  id: string;
  orderId: string | null;
  customerName: string | null;
  consultantName: string | null;
  paymentMode: string | null;
  hardBlockAt: string | null;
  expiryAt: string | null;
  vehicle: {
    model: string;
    suffix: string;
    colour: string;
    chassisYear: number;
    chassisNumber: string;
    stockStatus: string | null;
  };
  user: { fullName: string };
  financeRecord: FinanceRecord | null;
}

interface Summary { mtdCount: number; untouchedCount: number; }

// ── Constants ─────────────────────────────────────────────────────────────────
const PURCHASE_MODES = ['Cash', 'Direct', 'In House', 'No Idea'] as const;
const FINANCE_STATUSES = [
  'Approved',
  'Disbursed',
  'Logged, Approval Pending',
  'Logged, Documents Pending',
  'Login Pending',
  'Rejected',
] as const;

const emptyForm = {
  purchaseMode: '' as string,
  bankName: '',
  loanAmount: '' as string | number,
  financeStatus: '' as string,
  expectedDisbursementDate: '',
  otherRemarks: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function ageDays(hardBlockAt: string | null): number {
  if (!hardBlockAt) return 0;
  return differenceInDays(new Date(), new Date(hardBlockAt));
}

function statusColor(s: string | null): string {
  if (!s) return 'bg-zinc-800 text-zinc-400';
  if (s === 'Disbursed') return 'bg-green-900/40 text-green-400';
  if (s === 'Approved') return 'bg-primary/10 text-primary';
  if (s === 'Rejected') return 'bg-red-900/40 text-red-400';
  return 'bg-secondary-container/20 text-secondary';
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FinanceDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [blockings, setBlockings] = useState<Blocking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Blocking | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'untouched' | 'touched'>('all');
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [s, b] = await Promise.all([
        api.get('/finance/summary'),
        api.get('/finance/blockings'),
      ]);
      setSummary(s.data);
      setBlockings(b.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openRecord = (b: Blocking) => {
    setSelected(b);
    const r = b.financeRecord;
    setForm({
      purchaseMode: r?.purchaseMode ?? '',
      bankName: r?.bankName ?? '',
      loanAmount: r?.loanAmount ?? '',
      financeStatus: r?.financeStatus ?? '',
      expectedDisbursementDate: r?.expectedDisbursementDate
        ? r.expectedDisbursementDate.slice(0, 10)
        : '',
      otherRemarks: r?.otherRemarks ?? '',
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/finance/blockings/${selected.id}/record`, {
        purchaseMode: form.purchaseMode || null,
        bankName: form.bankName || null,
        loanAmount: form.loanAmount !== '' ? Number(form.loanAmount) : null,
        financeStatus: form.financeStatus || null,
        expectedDisbursementDate: form.expectedDisbursementDate
          ? new Date(form.expectedDisbursementDate).toISOString()
          : null,
        otherRemarks: form.otherRemarks || null,
      });
      toast.success('Finance record saved');
      setSelected(null);
      fetchAll();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Filter + search ──────────────────────────────────────────────────────
  const displayed = blockings
    .filter((b) => {
      if (filter === 'untouched') return !b.financeRecord;
      if (filter === 'touched') return !!b.financeRecord;
      return true;
    })
    .filter((b) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        b.customerName?.toLowerCase().includes(q) ||
        b.orderId?.toLowerCase().includes(q) ||
        b.vehicle.chassisNumber.toLowerCase().includes(q) ||
        b.vehicle.model.toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Finance Dashboard</h1>
        <p className="text-on-surface-variant font-body text-sm">Track and update finance details for all active blockings in your branch.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface-container-low rounded-xl p-6 relative overflow-hidden" style={{ borderLeft: '3px solid #b8c3ff' }}>
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">MTD Blocking Cases</p>
          <p className="font-headline text-4xl font-extrabold text-on-surface">{summary?.mtdCount ?? '—'}</p>
          <p className="text-xs text-on-surface-variant font-body mt-1">Hard blockings this calendar month</p>
          <div className="absolute right-4 bottom-4 opacity-10">
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#b8c3ff' }}>calendar_month</span>
          </div>
        </div>
        <div className="bg-surface-container-low rounded-xl p-6 relative overflow-hidden" style={{ borderLeft: '3px solid #d71a18' }}>
          <p className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Untouched Finance Cases</p>
          <p className="font-headline text-4xl font-extrabold text-tertiary">{summary?.untouchedCount ?? '—'}</p>
          <p className="text-xs text-on-surface-variant font-body mt-1">Active blockings with no finance update yet</p>
          <div className="absolute right-4 bottom-4 opacity-10">
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#d71a18' }}>pending_actions</span>
          </div>
        </div>
      </div>

      {/* Filter + Search bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
          <input
            className="input pl-10 w-full"
            placeholder="Search customer, chassis, model…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="bg-surface-container-low p-1 rounded-lg flex gap-1">
          {(['all', 'untouched', 'touched'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-label font-black uppercase tracking-widest transition-colors ${
                filter === f
                  ? 'bg-surface-container-high text-primary'
                  : 'text-zinc-500 hover:text-on-surface'
              }`}
            >
              {f === 'all' ? `All (${blockings.length})` : f === 'untouched' ? `Untouched (${blockings.filter(b => !b.financeRecord).length})` : `Updated (${blockings.filter(b => !!b.financeRecord).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface-container-low rounded-xl animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-surface-container-low rounded-xl p-16 text-center text-on-surface-variant font-body">
          No blockings found.
        </div>
      ) : (
        <div className="bg-surface-container-low rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead className="bg-surface-container">
                <tr>
                  {['Customer', 'Vehicle', 'Order ID', 'Consultant', 'Blocked', 'Age', 'Purchase Mode', 'Finance Status', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((b, i) => {
                  const age = ageDays(b.hardBlockAt);
                  const touched = !!b.financeRecord;
                  return (
                    <tr
                      key={b.id}
                      className="hover:bg-surface-container transition-colors cursor-pointer"
                      style={{ borderBottom: '1px solid rgba(67,70,86,0.08)', background: i % 2 === 1 ? 'rgba(67,70,86,0.02)' : undefined }}
                      onClick={() => openRecord(b)}
                    >
                      <td className="px-4 py-3 font-headline font-bold text-on-surface tracking-tight">{b.customerName ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-headline font-bold text-on-surface text-xs">{b.vehicle.chassisYear} {b.vehicle.model}</div>
                        <div className="text-[10px] text-on-surface-variant font-mono">{b.vehicle.chassisNumber}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-primary/80">{b.orderId ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{b.consultantName ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">
                        {b.hardBlockAt ? format(new Date(b.hardBlockAt), 'dd/MM/yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge text-[10px] ${age >= 30 ? 'bg-red-900/30 text-red-400' : age >= 14 ? 'bg-orange-900/30 text-orange-400' : 'bg-surface-container-high text-on-surface-variant'}`}>
                          {age}d
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">{b.financeRecord?.purchaseMode ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge text-[10px] ${statusColor(b.financeRecord?.financeStatus ?? null)}`}>
                          {b.financeRecord?.financeStatus ?? (touched ? '—' : 'Not Updated')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-[10px] font-label font-black uppercase tracking-widest text-primary hover:text-on-surface transition-colors">
                          {touched ? 'Edit' : 'Update'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit / Create finance record modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex justify-between items-start p-6 pb-4" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
              <div>
                <h2 className="font-headline text-lg font-bold tracking-tighter text-on-surface uppercase">
                  Finance Details
                </h2>
                <p className="font-label text-xs text-on-surface-variant mt-0.5">
                  {selected.vehicle.chassisYear} {selected.vehicle.model} · {selected.customerName ?? '—'} · #{selected.orderId ?? '—'}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-on-surface-variant hover:text-on-surface transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              {/* Purchase Mode */}
              <div>
                <label className="label">Purchase Mode</label>
                <div className="relative">
                  <select
                    className="input appearance-none pr-8"
                    value={form.purchaseMode}
                    onChange={(e) => setForm((f) => ({ ...f, purchaseMode: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {PURCHASE_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                </div>
              </div>

              {/* Bank Name */}
              <div>
                <label className="label">Bank Name</label>
                <input
                  className="input"
                  placeholder="e.g. SBI, HDFC, Federal Bank…"
                  value={form.bankName}
                  onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                />
              </div>

              {/* Loan Amount */}
              <div>
                <label className="label">Loan Amount (₹)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="e.g. 850000"
                  value={form.loanAmount}
                  onChange={(e) => setForm((f) => ({ ...f, loanAmount: e.target.value }))}
                />
              </div>

              {/* Finance Status */}
              <div>
                <label className="label">Status</label>
                <div className="relative">
                  <select
                    className="input appearance-none pr-8"
                    value={form.financeStatus}
                    onChange={(e) => setForm((f) => ({ ...f, financeStatus: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {FINANCE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                </div>
              </div>

              {/* Expected Disbursement Date */}
              <div>
                <label className="label">Expected Disbursement Date</label>
                <input
                  className="input"
                  type="date"
                  value={form.expectedDisbursementDate}
                  onChange={(e) => setForm((f) => ({ ...f, expectedDisbursementDate: e.target.value }))}
                />
              </div>

              {/* Other Remarks */}
              <div>
                <label className="label">Other Remarks</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Any additional notes…"
                  value={form.otherRemarks}
                  onChange={(e) => setForm((f) => ({ ...f, otherRemarks: e.target.value }))}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => setSelected(null)} className="btn-secondary flex-1 text-xs">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 disabled:opacity-40">
                {saving ? 'Saving…' : 'Save Finance Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
