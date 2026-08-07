import { useEffect, useState, useCallback, useRef } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

interface FemDetail {
  row: number;
  chassisNumber: string;
  status: 'success' | 'not_found' | 'wrong_status' | 'duplicate_chassis' | 'skipped';
  note?: string;
}
interface FemResult { total: number; successful: number; failed: number; details: FemDetail[]; }

interface Blocking {
  id: string; blockType: string; status: string; customerName: string | null; consultantName: string | null;
  paymentMode: string | null; paymentStatus: string | null; orderId: string | null; financierBank: string | null;
  expectedBillingDate: string | null; expiryAt: string | null; fullPaymentAt: string | null; hardBlockAt: string | null; adminNotes: string | null;
  vehicle: { model: string; suffix: string; colour: string; chassisYear: number; chassisNumber: string; stockStatus: string | null };
  user: { fullName: string; loginId: string };
  branch: { name: string };
}

const statusColor: Record<string, string> = {
  ACTIVE: 'bg-primary/10 text-primary',
  EXPIRED: 'bg-tertiary-container/20 text-tertiary',
  DELIVERED: 'bg-green-900/30 text-green-400',
};

export default function AllBlockingsPage() {
  const { user } = useAuth();
  const canExtendExpiry = user?.loginId === 'satish';
  const [blockings, setBlockings] = useState<Blocking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', search: '', chassis: '', blockedFrom: '', blockedTo: '' });
  const [selected, setSelected] = useState<Blocking | null>(null);
  const [editForm, setEditForm] = useState<{ customerName: string; consultantName: string; paymentStatus: string; adminNotes: string }>({ customerName: '', consultantName: '', paymentStatus: '', adminNotes: '' });
  const [extendDate, setExtendDate] = useState('');
  const [retailId, setRetailId] = useState('');
  const [loading, setLoading] = useState(false);
  const femFileRef = useRef<HTMLInputElement>(null);
  const [uploadingFem, setUploadingFem] = useState(false);
  const [femResult, setFemResult] = useState<FemResult | null>(null);
  const [showFemReport, setShowFemReport] = useState(false);
  const limit = 20;

  const buildParams = (overrides: Record<string, string> = {}) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), ...overrides });
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    if (filters.chassis) params.set('chassis', filters.chassis);
    if (filters.blockedFrom) params.set('blockedFrom', filters.blockedFrom);
    if (filters.blockedTo) params.set('blockedTo', filters.blockedTo);
    return params;
  };

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get(`/blocking/all?${buildParams()}`);
    setBlockings(data.blockings);
    setTotal(data.total);
    setLoading(false);
  }, [page, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch(); }, [fetch]);

  const openEdit = (b: Blocking) => {
    setSelected(b);
    setEditForm({ customerName: b.customerName ?? '', consultantName: b.consultantName ?? '', paymentStatus: b.paymentStatus ?? '', adminNotes: b.adminNotes ?? '' });
    setExtendDate('');
    setRetailId('');
  };

  const handleSave = async () => {
    if (!selected) return;
    try { await api.patch(`/blocking/${selected.id}`, editForm); toast.success('Saved'); fetch(); setSelected(null); }
    catch { toast.error('Save failed'); }
  };

  const handleExtend = async () => {
    if (!selected || !extendDate) return;
    try { await api.patch(`/blocking/${selected.id}/extend`, { expiryAt: new Date(extendDate).toISOString() }); toast.success('Expiry extended'); fetch(); setSelected(null); }
    catch { toast.error('Extend failed'); }
  };

  const handleRelease = async (id: string) => {
    if (!confirm('Release this block and return vehicle to open pool?')) return;
    try { await api.patch(`/blocking/${id}/release`); toast.success('Block released'); fetch(); setSelected(null); }
    catch { toast.error('Release failed'); }
  };

  const handleDeliver = async () => {
    if (!selected || !retailId.trim()) { toast.error('Last payment receipt (Retail ID) is required'); return; }
    if (!confirm('Mark this blocking as delivered?')) return;
    try { await api.patch(`/blocking/${selected.id}/deliver`, { retailId: retailId.trim() }); toast.success('Marked as delivered'); fetch(); setSelected(null); }
    catch { toast.error('Failed to mark as delivered'); }
  };

  const handleFemUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFem(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/stock/ctdms-fem', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFemResult(data);
      setShowFemReport(true);
      toast.success(`FEM: ${data.successful} updated, ${data.failed} failed`);
      fetch();
    } catch { toast.error('CTDMS FEM upload failed'); }
    finally { setUploadingFem(false); if (femFileRef.current) femFileRef.current.value = ''; }
  };

  const downloadExcel = async () => {
    const tid = toast.loading('Fetching all records…');
    try {
      // Export all blockings regardless of on-screen filters
      const allParams = new URLSearchParams({ page: '1', limit: '99999' });
      if (filters.search) allParams.set('search', filters.search);
      if (filters.chassis) allParams.set('chassis', filters.chassis);
      if (filters.blockedFrom) allParams.set('blockedFrom', filters.blockedFrom);
      if (filters.blockedTo) allParams.set('blockedTo', filters.blockedTo);
      const { data } = await api.get(`/blocking/all?${allParams}`);
      const all: Blocking[] = data.blockings;
      if (all.length === 0) { toast.dismiss(tid); toast.error('No data to export'); return; }

      const rows = all.map((b) => ({
        Branch: b.branch.name,
        'Sales Manager': b.user.fullName,
        'Login ID': b.user.loginId,
        Model: b.vehicle.model,
        Suffix: b.vehicle.suffix,
        Colour: b.vehicle.colour,
        'Chassis Year': b.vehicle.chassisYear,
        VIN: b.vehicle.chassisNumber,
        'Stock Status': b.vehicle.stockStatus ?? '',
        'Block Type': b.blockType,
        Status: b.status,
        'Order ID': b.orderId ?? '',
        Customer: b.customerName ?? '',
        Consultant: b.consultantName ?? '',
        'Payment Mode': b.paymentMode ?? '',
        'Payment Status': b.paymentStatus ?? '',
        'Financier Bank': b.financierBank ?? '',
        'Date of Blocking': b.hardBlockAt ? format(new Date(b.hardBlockAt), 'dd/MM/yyyy') : '',
        'Expected Billing': b.expectedBillingDate ? format(new Date(b.expectedBillingDate), 'dd/MM/yyyy') : '',
        'Expires At': b.expiryAt ? format(new Date(b.expiryAt), 'dd/MM/yyyy HH:mm') : (b.fullPaymentAt ? 'No Expiry (Full Paid)' : ''),
        'Full Payment Date': b.fullPaymentAt ? format(new Date(b.fullPaymentAt), 'dd/MM/yyyy') : '',
        'Days Since Full Payment': b.fullPaymentAt ? Math.floor((Date.now() - new Date(b.fullPaymentAt).getTime()) / 86_400_000) : '',
        'Admin Notes': b.adminNotes ?? '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Blockings');
      XLSX.writeFile(wb, `blockings_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.dismiss(tid);
      toast.success(`${all.length} records exported`);
    } catch {
      toast.dismiss(tid);
      toast.error('Export failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">All Blockings</h1>
        <p className="text-on-surface-variant font-body text-sm">Monitor and manage every blocking across all branches.</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
          <input
            className="input pl-10 w-60"
            placeholder="Customer / Order ID…"
            value={filters.search}
            onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(1); }}
          />
        </div>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">pin</span>
          <input
            className="input pl-10 w-48"
            placeholder="Chassis Number…"
            value={filters.chassis}
            onChange={(e) => { setFilters((f) => ({ ...f, chassis: e.target.value })); setPage(1); }}
          />
        </div>
        <div className="relative">
          <select className="input appearance-none pr-8 w-40" value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
            <option value="">All Statuses</option>
            <option>ACTIVE</option><option>EXPIRED</option><option>DELIVERED</option>
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-label font-black text-zinc-500 uppercase tracking-wider">Blocked</span>
          <input type="date" className="input text-xs px-3 py-2 w-36" style={{ colorScheme: 'dark' }} value={filters.blockedFrom} onChange={(e) => { setFilters((f) => ({ ...f, blockedFrom: e.target.value })); setPage(1); }} />
          <span className="text-zinc-600 text-xs">to</span>
          <input type="date" className="input text-xs px-3 py-2 w-36" style={{ colorScheme: 'dark' }} value={filters.blockedTo} onChange={(e) => { setFilters((f) => ({ ...f, blockedTo: e.target.value })); setPage(1); }} />
          {(filters.blockedFrom || filters.blockedTo) && (
            <button onClick={() => { setFilters((f) => ({ ...f, blockedFrom: '', blockedTo: '' })); setPage(1); }} className="text-tertiary hover:text-on-surface text-xs font-bold font-label uppercase tracking-wider transition-colors">Clear</button>
          )}
        </div>
        <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{total} results</span>
        <div className="ml-auto flex items-center gap-2">
          {/* CTDMS ↔ FEM upload */}
          <input ref={femFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFemUpload} />
          <button
            onClick={() => femFileRef.current?.click()}
            disabled={uploadingFem}
            className="flex items-center gap-2 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest rounded-lg border transition-colors disabled:opacity-50"
            style={{ borderColor: '#fb923c', color: '#fb923c' }}
          >
            <span className="material-symbols-outlined text-base">swap_horiz</span>
            {uploadingFem ? 'Processing…' : 'CTDMS ↔ FEM'}
          </button>
          {femResult && (
            <button
              onClick={() => setShowFemReport(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-headline font-bold uppercase tracking-widest rounded-lg border transition-colors"
              style={{ borderColor: '#fb923c', color: '#fb923c' }}
            >
              <span className="material-symbols-outlined text-base">summarize</span>
              Report
            </button>
          )}
          <button
            onClick={downloadExcel}
            className="flex items-center gap-2 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-base">table_view</span>
            Download Excel
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                {['Branch', 'Sales Manager', 'Vehicle', 'VIN', 'Stock', 'Customer', 'Type', 'Status', 'Blocked Date', 'Expires', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="py-16 text-center text-on-surface-variant font-label uppercase tracking-widest text-xs">Loading…</td></tr>
              ) : blockings.length === 0 ? (
                <tr><td colSpan={11} className="py-16 text-center text-on-surface-variant font-label uppercase tracking-widest text-xs">No blockings found</td></tr>
              ) : blockings.map((b) => (
                <tr key={b.id} className="hover:bg-surface-container transition-colors" style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }}>
                  <td className="px-4 py-3 font-bold font-headline text-xs tracking-tight text-on-surface">{b.branch.name}</td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs">{b.user.fullName}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-on-surface">{b.vehicle.model} {b.vehicle.suffix}</p>
                    <p className="text-[10px] text-zinc-500">{b.vehicle.colour} · {b.vehicle.chassisYear}</p>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-zinc-400">{b.vehicle.chassisNumber}</td>
                  <td className="px-4 py-3">
                    {b.vehicle.stockStatus ? (
                      <span className={`badge text-[10px] ${b.vehicle.stockStatus === 'BND' ? 'bg-primary/10 text-primary' : b.vehicle.stockStatus === 'CTDMS' ? 'bg-orange-900/30 text-orange-400' : 'bg-green-900/30 text-green-400'}`}>
                        {b.vehicle.stockStatus}
                      </span>
                    ) : <span className="text-zinc-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-on-surface">{b.customerName ?? '—'}</td>
                  <td className="px-4 py-3"><span className="badge bg-surface-container-high text-zinc-400">{b.blockType}</span></td>
                  <td className="px-4 py-3"><span className={`badge ${statusColor[b.status] ?? 'bg-surface-container text-zinc-500'}`}>{b.status}</span></td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">{b.hardBlockAt ? format(new Date(b.hardBlockAt), 'dd/MM/yyyy') : '—'}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">
                    {b.fullPaymentAt
                      ? <span className="text-green-400 font-semibold">{Math.floor((Date.now() - new Date(b.fullPaymentAt).getTime()) / 86_400_000)}d since full pymt</span>
                      : b.expiryAt ? formatDistanceToNow(new Date(b.expiryAt), { addSuffix: true }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {b.status === 'ACTIVE'
                      ? <button onClick={() => openEdit(b)} className="text-primary hover:text-on-primary-container font-label text-xs font-bold uppercase tracking-widest transition-colors">Edit</button>
                      : <span className="font-label text-xs text-zinc-600 uppercase tracking-widest">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > limit && (
          <div className="flex justify-between items-center px-4 py-3 bg-surface-container" style={{ borderTop: '1px solid rgba(67,70,86,0.1)' }}>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-xs px-4 py-2 disabled:opacity-30">Previous</button>
            <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">Page {page} of {Math.ceil(total / limit)}</span>
            <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-xs px-4 py-2 disabled:opacity-30">Next</button>
          </div>
        )}
      </div>

      {/* CTDMS FEM Report Modal */}
      {showFemReport && femResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowFemReport(false)}>
          <div className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(67,70,86,0.12)' }}>
              <div>
                <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-on-surface">CTDMS ↔ FEM Report</h2>
                <p className="text-xs text-on-surface-variant font-label mt-0.5">{femResult.total} rows processed</p>
              </div>
              <button onClick={() => setShowFemReport(false)} className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 p-6 flex-shrink-0">
              <div className="bg-surface-container rounded-xl p-4 text-center" style={{ border: '1px solid rgba(67,70,86,0.2)' }}>
                <p className="text-3xl font-headline font-extrabold text-on-surface">{femResult.total}</p>
                <p className="text-[10px] font-label font-black uppercase tracking-widest text-zinc-500 mt-1">Total Processed</p>
              </div>
              <div className="bg-green-900/20 rounded-xl p-4 text-center" style={{ border: '1px solid rgba(52,211,153,0.2)' }}>
                <p className="text-3xl font-headline font-extrabold text-green-400">{femResult.successful}</p>
                <p className="text-[10px] font-label font-black uppercase tracking-widest text-green-400/70 mt-1">Successfully Updated</p>
              </div>
              <div className="bg-tertiary-container/10 rounded-xl p-4 text-center" style={{ border: '1px solid rgba(215,26,24,0.2)' }}>
                <p className="text-3xl font-headline font-extrabold text-tertiary">{femResult.failed}</p>
                <p className="text-[10px] font-label font-black uppercase tracking-widest text-tertiary/70 mt-1">Failed / Skipped</p>
              </div>
            </div>

            {/* Detail table */}
            <div className="overflow-y-auto custom-scrollbar flex-1 px-6 pb-6">
              <table className="w-full text-xs font-body">
                <thead className="sticky top-0 bg-surface-container-low">
                  <tr>
                    {['Row', 'Chassis No.', 'Result', 'Note'].map((h) => (
                      <th key={h} className="py-2 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {femResult.details.map((d) => {
                    const colorMap: Record<FemDetail['status'], string> = {
                      success: 'text-green-400',
                      not_found: 'text-tertiary',
                      wrong_status: 'text-orange-400',
                      duplicate_chassis: 'text-yellow-400',
                      skipped: 'text-zinc-500',
                    };
                    const labelMap: Record<FemDetail['status'], string> = {
                      success: 'Updated ✓',
                      not_found: 'Not Found',
                      wrong_status: 'Wrong Status',
                      duplicate_chassis: 'Duplicate VIN',
                      skipped: 'Skipped',
                    };
                    return (
                      <tr key={d.row} style={{ borderBottom: '1px solid rgba(67,70,86,0.06)' }}>
                        <td className="py-2 pr-4 text-zinc-600">{d.row}</td>
                        <td className="py-2 pr-4 font-mono text-on-surface-variant">{d.chassisNumber || '—'}</td>
                        <td className={`py-2 pr-4 font-bold font-label uppercase tracking-wider ${colorMap[d.status]}`}>{labelMap[d.status]}</td>
                        <td className="py-2 text-zinc-500 text-[11px]">{d.note ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start p-6 pb-4" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
              <div>
                <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-on-surface">Edit Blocking</h2>
                <p className="font-label text-xs text-on-surface-variant mt-0.5">{selected.vehicle.model} {selected.vehicle.suffix} — {selected.branch.name}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div><label className="label">Customer Name</label><input className="input" value={editForm.customerName} onChange={(e) => setEditForm((f) => ({ ...f, customerName: e.target.value }))} /></div>
              <div><label className="label">Consultant Name</label><input className="input" value={editForm.consultantName} onChange={(e) => setEditForm((f) => ({ ...f, consultantName: e.target.value }))} /></div>
              <div>
                <label className="label">Payment Status</label>
                <div className="relative">
                  <select className="input appearance-none pr-8" value={editForm.paymentStatus} onChange={(e) => setEditForm((f) => ({ ...f, paymentStatus: e.target.value }))}>
                    <option value="">— Keep existing —</option>
                    <option>Down Payment Received</option>
                    <option>Only Booking Received</option>
                    <option>Part Payment Received</option>
                    <option>Full Payment Received</option>
                    <option>Ready for Disbursement</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                </div>
              </div>
              <div><label className="label">Admin Notes</label><textarea className="input" rows={2} value={editForm.adminNotes} onChange={(e) => setEditForm((f) => ({ ...f, adminNotes: e.target.value }))} /></div>

              {canExtendExpiry && (
                <div>
                  <label className="label">Extend Expiry Date</label>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      type="datetime-local"
                      value={extendDate}
                      onChange={(e) => setExtendDate(e.target.value)}
                    />
                    <button onClick={handleExtend} disabled={!extendDate} className="btn-primary text-xs px-4 whitespace-nowrap disabled:opacity-40">
                      Extend
                    </button>
                  </div>
                </div>
              )}
            </div>

            {selected.status === 'ACTIVE' && (
              <div className="px-6 pb-4 space-y-2" style={{ borderTop: '1px solid rgba(67,70,86,0.1)', paddingTop: '16px' }}>
                <label className="label">Mark as Delivered — Last Payment Receipt</label>
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Enter Retail ID / receipt number"
                    value={retailId}
                    onChange={(e) => setRetailId(e.target.value)}
                  />
                  <button onClick={handleDeliver} disabled={!retailId.trim()} className="btn-primary text-xs px-4 whitespace-nowrap disabled:opacity-40">
                    Mark Delivered
                  </button>
                </div>
              </div>
            )}

            <div className="p-6 pt-0 flex gap-3">
              {selected.status === 'ACTIVE' && (
                <button onClick={() => handleRelease(selected.id)} className="btn-danger flex-1 text-xs">Release Block</button>
              )}
              <button onClick={handleSave} className="btn-primary flex-1">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
