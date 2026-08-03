import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';

interface Vehicle { chassisNumber: string; model: string; suffix: string; colour: string; chassisYear: number; }
interface Workflow {
  id: string; stage: string;
  customerName: string | null; salesOfficer: string | null; teamLeaderName: string | null;
  panCardUrl: string | null; aadharUrl: string | null; fileFrontUrl: string | null; fileBackUrl: string | null;
  insuranceType: string | null; insuranceCompany: string | null; payout: number | null; premium: number | null; insuranceRemarks: string | null;
  blocking: { vehicle: Vehicle; user: { fullName: string }; customerName: string | null; };
  branch: { name: string; branchCode: string | null };
}

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export default function InsurancePage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [insuranceType, setInsuranceType] = useState<'IN_HOUSE' | 'OUT_HOUSE'>('IN_HOUSE');
  const [form, setForm] = useState({ insuranceCompany: '', payout: '', premium: '', insuranceRemarks: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await api.get('/delivery/cases');
    setWorkflows(res.data);
  };

  useEffect(() => { load(); }, []);

  const open = (wf: Workflow) => {
    setSelected(wf);
    setInsuranceType((wf.insuranceType as 'IN_HOUSE' | 'OUT_HOUSE') ?? 'IN_HOUSE');
    setForm({
      insuranceCompany: wf.insuranceCompany ?? '',
      payout: wf.payout?.toString() ?? '',
      premium: wf.premium?.toString() ?? '',
      insuranceRemarks: wf.insuranceRemarks ?? '',
    });
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        insuranceType,
        insuranceCompany: form.insuranceCompany,
        insuranceRemarks: form.insuranceRemarks,
      };
      if (insuranceType === 'IN_HOUSE') data.payout = parseFloat(form.payout) || 0;
      else data.premium = parseFloat(form.premium) || 0;

      await api.patch(`/delivery/${selected.id}`, data);
      toast.success('Insurance details saved');
      setSelected(null);
      await load();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const docFields = [
    { key: 'panCardUrl', label: 'PAN Card' }, { key: 'aadharUrl', label: 'Aadhar' },
    { key: 'fileFrontUrl', label: 'File Front' }, { key: 'fileBackUrl', label: 'File Back' },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Insurance Cases</h1>
        <p className="text-on-surface-variant font-body text-sm">Update insurance details for vehicles pending in your queue.</p>
      </div>

      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        {workflows.length === 0 ? (
          <p className="p-8 text-center text-on-surface-variant text-sm">No pending insurance cases.</p>
        ) : (
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>{['Customer', 'Chassis No', 'Model', 'Branch', 'SM', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {workflows.map(wf => (
                <tr key={wf.id} className="hover:bg-surface-container transition-colors cursor-pointer" style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }} onClick={() => open(wf)}>
                  <td className="px-4 py-3 font-bold text-on-surface">{wf.customerName || wf.blocking.customerName || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-primary/80">{wf.blocking.vehicle.chassisNumber}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{wf.blocking.vehicle.model} {wf.blocking.vehicle.suffix}</td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs">{wf.branch.name}</td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs">{wf.blocking.user.fullName}</td>
                  <td className="px-4 py-3"><button className="text-xs text-primary hover:underline">Open →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 pb-4" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
              <div>
                <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-on-surface">Insurance Details</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">{selected.blocking.vehicle.chassisNumber} — {selected.blocking.vehicle.model} {selected.blocking.vehicle.suffix}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Customer summary */}
              <div className="bg-surface-container rounded-lg p-3 space-y-1 text-xs">
                <div className="flex gap-4"><span className="text-zinc-500 w-28">Customer</span><span className="font-bold text-on-surface">{selected.customerName || '—'}</span></div>
                <div className="flex gap-4"><span className="text-zinc-500 w-28">Sales Officer</span><span className="text-on-surface-variant">{selected.salesOfficer || '—'}</span></div>
                <div className="flex gap-4"><span className="text-zinc-500 w-28">Team Leader</span><span className="text-on-surface-variant">{selected.teamLeaderName || '—'}</span></div>
              </div>

              {/* Documents */}
              <div>
                <p className="text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant mb-2">Documents</p>
                <div className="flex flex-wrap gap-2">
                  {docFields.map(({ key, label }) => (
                    <a key={key} href={selected[key] ? `${API}${selected[key]}` : undefined} target="_blank" rel="noreferrer"
                      className={`text-xs px-3 py-1 rounded-full border ${selected[key] ? 'border-green-500/50 text-green-400 hover:bg-green-900/20' : 'border-zinc-700 text-zinc-500 cursor-not-allowed'}`}>
                      {label} {selected[key] ? '✓' : '✗'}
                    </a>
                  ))}
                </div>
              </div>

              {/* Insurance Type */}
              <div>
                <p className="label mb-2">Insurance Type</p>
                <div className="flex gap-3">
                  {(['IN_HOUSE', 'OUT_HOUSE'] as const).map(type => (
                    <button key={type} onClick={() => setInsuranceType(type)}
                      className={`flex-1 py-2 rounded-lg text-xs font-label font-bold uppercase tracking-widest transition-colors border ${insuranceType === type ? 'bg-primary text-on-primary border-primary' : 'border-zinc-700 text-on-surface-variant hover:border-zinc-500'}`}>
                      {type === 'IN_HOUSE' ? 'In House' : 'Out House'}
                    </button>
                  ))}
                </div>
              </div>

              <div><label className="label">Insurance Company Name</label><input className="input" value={form.insuranceCompany} onChange={e => setForm(f => ({ ...f, insuranceCompany: e.target.value }))} /></div>

              {insuranceType === 'IN_HOUSE' ? (
                <div><label className="label">Payout (₹)</label><input className="input" type="number" value={form.payout} onChange={e => setForm(f => ({ ...f, payout: e.target.value }))} /></div>
              ) : (
                <>
                  <div><label className="label">Premium (₹)</label><input className="input" type="number" value={form.premium} onChange={e => setForm(f => ({ ...f, premium: e.target.value }))} /></div>
                  <div><label className="label">Remarks</label><textarea className="input min-h-[80px] resize-none" value={form.insuranceRemarks} onChange={e => setForm(f => ({ ...f, insuranceRemarks: e.target.value }))} /></div>
                </>
              )}
            </div>

            <div className="p-6 pt-0">
              <button onClick={save} disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving…' : 'Save & Forward to Delivery (Vahaan Entry)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
