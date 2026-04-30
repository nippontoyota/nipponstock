import { useEffect, useState } from 'react';
import { differenceInDays, differenceInHours } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../api';
import socket from '../../socket';
import * as XLSX from 'xlsx';

interface Blocking {
  id: string;
  blockType: string;
  status: string;
  customerName: string | null;
  consultantName: string | null;
  paymentMode: string | null;
  paymentStatus: string | null;
  orderId: string | null;
  financierBank: string | null;
  expectedBillingDate: string | null;
  expiryAt: string | null;
  hardBlockAt: string | null;
  vehicle: { model: string; suffix: string; colour: string; chassisYear: number; chassisNumber: string };
  branch: { name: string };
}

function expiryDays(expiryAt: string | null): { days: number; hours: number; expired: boolean } {
  if (!expiryAt) return { days: 0, hours: 0, expired: false };
  const h = differenceInHours(new Date(expiryAt), new Date());
  return { days: Math.max(0, Math.floor(h / 24)), hours: Math.max(0, h), expired: h < 0 };
}

function urgencyBorderColor(expiryAt: string | null): string {
  if (!expiryAt) return 'transparent';
  const days = differenceInDays(new Date(expiryAt), new Date());
  if (days > 3) return '#b8c3ff';
  if (days >= 1) return '#bcc7de';
  return '#d71a18';
}

function expiryTextColor(expiryAt: string | null) {
  if (!expiryAt) return 'text-on-surface-variant';
  const days = differenceInDays(new Date(expiryAt), new Date());
  if (days > 3) return 'text-primary';
  if (days >= 1) return 'text-secondary';
  return 'text-tertiary';
}

export default function MyBlockingsPage() {
  const [blockings, setBlockings] = useState<Blocking[]>([]);
  const [selected, setSelected] = useState<Blocking | null>(null);
  const [retailId, setRetailId] = useState('');
  const [delivering, setDelivering] = useState(false);
  const [tab, setTab] = useState<'active' | 'history'>('active');

  // Release modal state
  const [releaseTarget, setReleaseTarget] = useState<Blocking | null>(null);
  const [releaseReason, setReleaseReason] = useState('');
  const [releaseRemarks, setReleaseRemarks] = useState('');
  const [releaseSalesId, setReleaseSalesId] = useState('');
  const [releasing, setReleasing] = useState(false);

  const RELEASE_REASONS = [
    'Finance Issue',
    'Color / Model Unavailable',
    'Lost to Competitor',
    'Lost to Co-Dealer',
    'Purchase Cancelled',
    'Exchange Value Issue',
    'Discount Issue',
    'Purchase Postponed',
    'OEM Direct Purchase',
    'Others',
  ];

  const fetch = async () => {
    const { data } = await api.get('/blocking/my');
    setBlockings(data);
  };

  useEffect(() => {
    fetch();
    socket.on('blocking:update', fetch);
    return () => { socket.off('blocking:update', fetch); };
  }, []);

  const handleDeliver = async () => {
    if (!selected || !retailId) return;
    setDelivering(true);
    try {
      await api.patch(`/blocking/${selected.id}/deliver`, { retailId });
      toast.success('Marked as delivered!');
      setSelected(null);
      setRetailId('');
      fetch();
    } catch {
      toast.error('Failed to mark delivery');
    } finally {
      setDelivering(false);
    }
  };

  const handleRelease = async () => {
    const isOthers = releaseReason === 'Others';
    if (!releaseTarget || !releaseReason || !releaseSalesId || (isOthers && !releaseRemarks)) {
      toast.error('All fields are required');
      return;
    }
    const finalReason = isOthers ? `Others — ${releaseRemarks}` : releaseReason;
    setReleasing(true);
    try {
      await api.patch(`/blocking/${releaseTarget.id}/self-release`, {
        reason: finalReason,
        salesId: releaseSalesId,
      });
      toast.success('Vehicle released back to open pool');
      setReleaseTarget(null);
      setReleaseReason('');
      setReleaseRemarks('');
      setReleaseSalesId('');
      fetch();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to release');
    } finally {
      setReleasing(false);
    }
  };

  const active = blockings.filter((b) => b.status === 'ACTIVE' && b.blockType === 'HARD');
  const expiring = active.filter((b) => b.expiryAt && differenceInDays(new Date(b.expiryAt), new Date()) <= 3);
  const history = blockings.filter((b) => b.status !== 'ACTIVE' || b.blockType === 'SOFT');
  const displayed = tab === 'active' ? active : history;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-headline font-bold tracking-tighter uppercase text-on-surface mb-2">My Blockings</h1>
          <p className="text-on-surface-variant font-body">Manage reserved inventory and pending retail conversions.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const rows = active.map((b) => ({
                'Customer': b.customerName ?? '',
                'Vehicle': `${b.vehicle.chassisYear} ${b.vehicle.model} ${b.vehicle.suffix}`,
                'Colour': b.vehicle.colour,
                'Chassis No': b.vehicle.chassisNumber,
                'Order ID': b.orderId ?? '',
                'Payment Mode': b.paymentMode ?? '',
                'Payment Status': b.paymentStatus ?? '',
                'Branch': b.branch.name,
                'Expiry': b.expiryAt ? new Date(b.expiryAt).toLocaleDateString() : '',
              }));
              const ws = XLSX.utils.json_to_sheet(rows);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'Blockings');
              XLSX.writeFile(wb, 'active_blockings.xlsx');
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container text-xs font-bold uppercase tracking-widest font-headline transition-colors"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Download Excel
          </button>
          <div className="bg-surface-container-low p-1 rounded-lg flex gap-1">
            <button
              onClick={() => setTab('active')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors font-headline ${tab === 'active' ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              All ({active.length})
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors font-headline ${tab === 'history' ? 'bg-surface-container-high text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Expiring ({expiring.length})
            </button>
          </div>
        </div>
      </div>

      {/* Bento grid */}
      {displayed.length === 0 ? (
        <div className="bg-surface-container-low rounded-xl p-16 text-center text-on-surface-variant font-body">
          No blockings found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {displayed.map((b) => {
            const { days, expired } = expiryDays(b.expiryAt);
            const borderColor = urgencyBorderColor(b.expiryAt);
            const isCritical = b.expiryAt && differenceInDays(new Date(b.expiryAt), new Date()) <= 2;

            return (
              <div
                key={b.id}
                className="bg-surface-container-low rounded-xl overflow-hidden flex flex-col group speed-lane cursor-pointer"
                style={{ borderLeftColor: borderColor, borderLeftWidth: '3px', borderLeftStyle: 'solid' }}
                onClick={() => setSelected(b)}
              >
                {/* Card top info */}
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-headline font-bold tracking-tight text-on-surface">
                        {b.vehicle.chassisYear} {b.vehicle.model.toUpperCase()}
                      </h3>
                      <p className="text-sm text-on-surface-variant">{b.vehicle.colour} · {b.vehicle.suffix}</p>
                    </div>
                    <span className={`badge ${b.status === 'ACTIVE' ? 'bg-primary/10 text-primary' : b.status === 'DELIVERED' ? 'bg-green-900/30 text-green-400' : 'bg-tertiary-container/10 text-tertiary'}`}>
                      {b.status}
                    </span>
                  </div>

                  {/* Customer info */}
                  <div className={`p-4 rounded-lg mb-4 ${isCritical ? 'bg-tertiary-container/10' : 'bg-surface-container-high/50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isCritical ? 'bg-tertiary-container/20 text-tertiary' : 'bg-primary/10 text-primary'}`}>
                        <span className="material-symbols-outlined text-lg">person</span>
                      </div>
                      <div>
                        <p className={`text-[10px] uppercase tracking-widest font-bold ${isCritical ? 'text-tertiary/80' : 'text-zinc-500'}`}>Customer</p>
                        <p className="text-sm font-semibold text-on-surface">{b.customerName ?? '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Expiry badge */}
                  {b.expiryAt && (
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 bg-zinc-950/50 px-3 py-2 rounded-xl" style={{ border: '1px solid rgba(67,70,86,0.3)' }}>
                        <p className={`text-[10px] font-label uppercase tracking-widest ${expiryTextColor(b.expiryAt)}`}>Days to Expiry</p>
                        <span className={`text-2xl font-headline font-bold tracking-tighter ${expired ? 'text-tertiary animate-pulse' : expiryTextColor(b.expiryAt)}`}>
                          {expired ? 'EXP' : String(days).padStart(2, '0')}
                        </span>
                      </div>
                      <span className={`badge ${b.paymentMode === 'CASH' ? 'bg-surface-container-high text-zinc-400' : 'bg-secondary-container text-secondary'}`}>
                        {b.paymentMode}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-auto space-y-2">
                    <div className="flex gap-3">
                      {b.status === 'ACTIVE' && b.blockType === 'HARD' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelected(b); }}
                          className={`flex-1 text-xs font-bold uppercase tracking-widest py-3 rounded-lg transition-all font-headline ${isCritical ? 'bg-tertiary-container text-on-tertiary-container hover:brightness-110' : 'bg-primary text-on-primary hover:brightness-110'}`}
                        >
                          Payment Received
                        </button>
                      )}
                    </div>
                    {/* Release button */}
                    {b.status === 'ACTIVE' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setReleaseTarget(b); setReleaseReason(''); setReleaseRemarks(''); setReleaseSalesId(''); }}
                        className="w-full py-2.5 rounded-lg border border-tertiary/30 text-tertiary hover:bg-tertiary-container/10 text-xs font-bold uppercase tracking-widest transition-all font-headline"
                      >
                        <span className="material-symbols-outlined text-sm align-middle mr-1">lock_open</span>
                        Release to Pool
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail / Delivery modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => { setSelected(null); setRetailId(''); }}>
          <div className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex justify-between items-start p-6 pb-4" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
              <div>
                <h2 className="font-headline text-lg font-bold tracking-tighter text-on-surface uppercase">
                  {selected.vehicle.chassisYear} {selected.vehicle.model}
                </h2>
                <p className="font-label text-xs text-on-surface-variant mt-0.5">{selected.vehicle.suffix} · {selected.vehicle.colour}</p>
              </div>
              <button onClick={() => { setSelected(null); setRetailId(''); }} className="text-on-surface-variant hover:text-on-surface transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Details */}
            <div className="p-6 space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
              {[
                ['Chassis No.', selected.vehicle.chassisNumber],
                ['Customer', selected.customerName],
                ['Consultant', selected.consultantName],
                ['Order ID', selected.orderId],
                ['Payment', `${selected.paymentMode}${selected.financierBank ? ` — ${selected.financierBank}` : ''}`],
                ['Payment Status', selected.paymentStatus],
                ['Expected Billing', selected.expectedBillingDate ? new Date(selected.expectedBillingDate).toLocaleDateString() : '—'],
                ['Status', selected.status],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between items-center py-1.5">
                  <dt className="text-xs font-label uppercase tracking-widest text-on-surface-variant">{k}</dt>
                  <dd className="text-sm font-body font-medium text-on-surface text-right">{String(v ?? '—')}</dd>
                </div>
              ))}
            </div>

            {/* Payment Received form */}
            {selected.status === 'ACTIVE' && selected.blockType === 'HARD' && (
              <div className="p-6 space-y-3 bg-surface-container" style={{ borderTop: '1px solid rgba(67,70,86,0.1)' }}>
                <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant font-bold mb-3">Payment Received</p>
                <input
                  className="input"
                  placeholder="Last Payment Receipt No. *"
                  value={retailId}
                  onChange={(e) => setRetailId(e.target.value)}
                />
                <button
                  disabled={!retailId || delivering}
                  onClick={handleDeliver}
                  className="w-full py-3 rounded-lg font-headline font-bold text-sm uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #b8c3ff 0%, #2e5bff 100%)', color: '#002388' }}
                >
                  {delivering ? 'Processing…' : 'Confirm Payment'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Release to Pool modal */}
      {releaseTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setReleaseTarget(null)}>
          <div className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 pb-4" style={{ borderBottom: '1px solid rgba(215,26,24,0.15)' }}>
              <div>
                <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-tertiary">Release to Open Pool</h2>
                <p className="font-label text-xs text-on-surface-variant mt-0.5">
                  {releaseTarget.vehicle.chassisYear} {releaseTarget.vehicle.model} · {releaseTarget.vehicle.colour}
                </p>
              </div>
              <button onClick={() => setReleaseTarget(null)} className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-tertiary-container/10 rounded-xl p-4 flex items-start gap-3" style={{ border: '1px solid rgba(215,26,24,0.2)' }}>
                <span className="material-symbols-outlined text-tertiary text-lg">warning</span>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Releasing this vehicle will return it to the open pool and cancel the current booking. This action is logged.
                </p>
              </div>

              <div>
                <label className="label">Sales ID *</label>
                <input
                  className="input font-mono"
                  placeholder="Your sales employee ID"
                  value={releaseSalesId}
                  onChange={(e) => setReleaseSalesId(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Reason for Release *</label>
                <div className="relative">
                  <select
                    className="input appearance-none pr-10"
                    value={releaseReason}
                    onChange={(e) => { setReleaseReason(e.target.value); setReleaseRemarks(''); }}
                  >
                    <option value="">Select a reason…</option>
                    {RELEASE_REASONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                </div>
              </div>

              {releaseReason === 'Others' && (
                <div>
                  <label className="label">Remarks *</label>
                  <textarea
                    className="input resize-none"
                    rows={3}
                    placeholder="Please describe the reason…"
                    value={releaseRemarks}
                    onChange={(e) => setReleaseRemarks(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="p-6 pt-0">
              <button
                onClick={handleRelease}
                disabled={!releaseReason || !releaseSalesId || (releaseReason === 'Others' && !releaseRemarks) || releasing}
                className="btn-danger w-full disabled:opacity-40"
              >
                {releasing ? 'Releasing…' : 'Confirm Release'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
