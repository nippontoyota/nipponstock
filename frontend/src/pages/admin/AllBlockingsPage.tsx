import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../api';

interface Blocking {
  id: string; blockType: string; status: string; customerName: string | null; consultantName: string | null;
  paymentMode: string | null; paymentStatus: string | null; orderId: string | null; financierBank: string | null;
  expectedBillingDate: string | null; expiryAt: string | null; adminNotes: string | null;
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
  const [blockings, setBlockings] = useState<Blocking[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [selected, setSelected] = useState<Blocking | null>(null);
  const [editForm, setEditForm] = useState<{ customerName: string; consultantName: string; paymentStatus: string; adminNotes: string }>({ customerName: '', consultantName: '', paymentStatus: '', adminNotes: '' });
  const [extendDate, setExtendDate] = useState('');
  const [loading, setLoading] = useState(false);
  const limit = 20;

  const fetch = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const { data } = await api.get(`/blocking/all?${params}`);
    setBlockings(data.blockings);
    setTotal(data.total);
    setLoading(false);
  }, [page, filters]);

  useEffect(() => { fetch(); }, [fetch]);

  const openEdit = (b: Blocking) => {
    setSelected(b);
    setEditForm({ customerName: b.customerName ?? '', consultantName: b.consultantName ?? '', paymentStatus: b.paymentStatus ?? '', adminNotes: b.adminNotes ?? '' });
    setExtendDate('');
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
            className="input pl-10 w-72"
            placeholder="Customer, chassis, order ID…"
            value={filters.search}
            onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(1); }}
          />
        </div>
        <div className="relative">
          <select className="input appearance-none pr-8 w-44" value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
            <option value="">All Statuses</option>
            <option>ACTIVE</option><option>EXPIRED</option><option>DELIVERED</option>
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
        </div>
        <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{total} results</span>
      </div>

      {/* Table */}
      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                {['Branch', 'Sales Manager', 'Vehicle', 'VIN', 'Stock', 'Customer', 'Type', 'Status', 'Expires', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="py-16 text-center text-on-surface-variant font-label uppercase tracking-widest text-xs">Loading…</td></tr>
              ) : blockings.length === 0 ? (
                <tr><td colSpan={10} className="py-16 text-center text-on-surface-variant font-label uppercase tracking-widest text-xs">No blockings found</td></tr>
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
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{b.expiryAt ? formatDistanceToNow(new Date(b.expiryAt), { addSuffix: true }) : '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openEdit(b)} className="text-primary hover:text-on-primary-container font-label text-xs font-bold uppercase tracking-widest transition-colors">Edit</button>
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
                    <option>Pending</option><option>Token Paid</option><option>Full Payment Done</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                </div>
              </div>
              <div><label className="label">Admin Notes</label><textarea className="input" rows={2} value={editForm.adminNotes} onChange={(e) => setEditForm((f) => ({ ...f, adminNotes: e.target.value }))} /></div>

              <div className="pt-2" style={{ borderTop: '1px solid rgba(67,70,86,0.1)' }}>
                <label className="label">Extend Expiry Date</label>
                <div className="flex gap-2">
                  <input className="input flex-1" type="datetime-local" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} style={{ colorScheme: 'dark' }} />
                  <button onClick={handleExtend} disabled={!extendDate} className="btn-secondary text-xs px-4 whitespace-nowrap disabled:opacity-40">Extend</button>
                </div>
              </div>
            </div>

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
