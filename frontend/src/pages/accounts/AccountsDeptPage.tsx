import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';

interface Vehicle { chassisNumber: string; model: string; suffix: string; colour: string; chassisYear: number; }
interface Workflow {
  id: string; stage: string;
  customerName: string | null; salesOfficer: string | null; teamLeaderName: string | null;
  insuranceType: string | null; insuranceCompany: string | null; payout: number | null; premium: number | null; insuranceRemarks: string | null;
  tallyNo: string | null; tallyDate: string | null; roadTaxReceiptNo: string | null;
  blocking: { vehicle: Vehicle; user: { fullName: string }; customerName: string | null; };
  branch: { name: string; branchCode: string | null };
}

export default function AccountsDeptPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [form, setForm] = useState({ tallyNo: '', tallyDate: '', roadTaxReceiptNo: '' });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'tally' | 'roadtax'>('tally');

  const load = async () => {
    const res = await api.get('/delivery/cases');
    setWorkflows(res.data);
  };

  useEffect(() => { load(); }, []);

  const open = (wf: Workflow) => {
    setSelected(wf);
    setForm({ tallyNo: wf.tallyNo ?? '', tallyDate: wf.tallyDate ? new Date(wf.tallyDate).toISOString().split('T')[0] : '', roadTaxReceiptNo: wf.roadTaxReceiptNo ?? '' });
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {};
      if (selected.stage === 'ACCOUNTS_TALLY') {
        if (!form.tallyNo) { toast.error('Tally No is required'); setSaving(false); return; }
        data.tallyNo = form.tallyNo;
        data.tallyDate = form.tallyDate || undefined;
      } else {
        if (!form.roadTaxReceiptNo) { toast.error('Receipt No is required'); setSaving(false); return; }
        data.roadTaxReceiptNo = form.roadTaxReceiptNo;
      }
      await api.patch(`/delivery/${selected.id}`, data);
      toast.success('Saved & forwarded');
      setSelected(null);
      await load();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const tallyWfs = workflows.filter(w => w.stage === 'ACCOUNTS_TALLY');
  const roadtaxWfs = workflows.filter(w => w.stage === 'ACCOUNTS_ROAD_TAX');
  const completedWfs = workflows.filter(w => w.stage === 'COMPLETED');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Accounts Dashboard</h1>
        <p className="text-on-surface-variant font-body text-sm">Handle Tally entries and Road Tax receipts.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['tally', 'roadtax'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-label font-bold uppercase tracking-widest transition-colors ${tab === t ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
            {t === 'tally' ? `Tally Entry (${tallyWfs.length})` : `Road Tax (${roadtaxWfs.length})`}
          </button>
        ))}
        {completedWfs.length > 0 && (
          <span className="px-3 py-2 rounded-lg text-xs font-label font-bold uppercase tracking-widest text-green-400 bg-green-900/20 border border-green-500/20">
            Completed: {completedWfs.length}
          </span>
        )}
      </div>

      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        {(tab === 'tally' ? tallyWfs : roadtaxWfs).length === 0 ? (
          <p className="p-8 text-center text-on-surface-variant text-sm">No pending cases in this tab.</p>
        ) : (
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>{['Customer', 'Chassis No', 'Model', 'Branch', 'Insurance', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(tab === 'tally' ? tallyWfs : roadtaxWfs).map(wf => (
                <tr key={wf.id} className="hover:bg-surface-container transition-colors cursor-pointer" style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }} onClick={() => open(wf)}>
                  <td className="px-4 py-3 font-bold text-on-surface">{wf.customerName || wf.blocking.customerName || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary/80">{wf.blocking.vehicle.chassisNumber}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{wf.blocking.vehicle.model} {wf.blocking.vehicle.suffix}</td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs">{wf.branch.name}</td>
                  <td className="px-4 py-3 text-xs">
                    {wf.insuranceType ? (
                      <span className={`badge ${wf.insuranceType === 'IN_HOUSE' ? 'bg-blue-900/30 text-blue-400' : 'bg-orange-900/30 text-orange-400'}`}>
                        {wf.insuranceType === 'IN_HOUSE' ? 'In House' : 'Out House'}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3"><button className="text-xs text-primary hover:underline">Open →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 pb-4" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
              <div>
                <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-on-surface">
                  {selected.stage === 'ACCOUNTS_TALLY' ? 'Tally Entry' : 'Road Tax Receipt'}
                </h2>
                <p className="text-xs text-on-surface-variant mt-0.5">{selected.blocking.vehicle.chassisNumber}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Summary */}
              <div className="bg-surface-container rounded-lg p-3 space-y-1 text-xs">
                <div className="flex gap-4"><span className="text-zinc-500 w-28">Customer</span><span className="font-bold text-on-surface">{selected.customerName || '—'}</span></div>
                <div className="flex gap-4"><span className="text-zinc-500 w-28">Model</span><span className="text-on-surface-variant">{selected.blocking.vehicle.model} {selected.blocking.vehicle.suffix}</span></div>
                {selected.insuranceType && (
                  <>
                    <div className="flex gap-4"><span className="text-zinc-500 w-28">Insurance</span><span className="text-on-surface-variant">{selected.insuranceType === 'IN_HOUSE' ? 'In House' : 'Out House'}</span></div>
                    <div className="flex gap-4"><span className="text-zinc-500 w-28">Company</span><span className="text-on-surface-variant">{selected.insuranceCompany || '—'}</span></div>
                    {selected.payout != null && <div className="flex gap-4"><span className="text-zinc-500 w-28">Payout</span><span className="text-on-surface-variant">₹{selected.payout.toLocaleString()}</span></div>}
                    {selected.premium != null && <div className="flex gap-4"><span className="text-zinc-500 w-28">Premium</span><span className="text-on-surface-variant">₹{selected.premium.toLocaleString()}</span></div>}
                  </>
                )}
              </div>

              {selected.stage === 'ACCOUNTS_TALLY' ? (
                <>
                  <div><label className="label">Tally No <span className="text-red-400">*</span></label><input className="input" value={form.tallyNo} onChange={e => setForm(f => ({ ...f, tallyNo: e.target.value }))} /></div>
                  <div><label className="label">Tally Date</label><input className="input" type="date" value={form.tallyDate} onChange={e => setForm(f => ({ ...f, tallyDate: e.target.value }))} /></div>
                </>
              ) : (
                <div><label className="label">Road Tax Receipt No <span className="text-red-400">*</span></label><input className="input" value={form.roadTaxReceiptNo} onChange={e => setForm(f => ({ ...f, roadTaxReceiptNo: e.target.value }))} /></div>
              )}
            </div>

            <div className="p-6 pt-0">
              <button onClick={save} disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving…' : selected.stage === 'ACCOUNTS_TALLY' ? 'Save & Forward to Vahaan Done' : 'Save & Complete Workflow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
