import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface Vehicle { chassisNumber: string; model: string; suffix: string; colour: string; chassisYear: number; }
interface Workflow {
  id: string; stage: string;
  customerName: string | null; salesOfficer: string | null; teamLeaderName: string | null;
  panCardUrl: string | null; aadharUrl: string | null; fileFrontUrl: string | null; fileBackUrl: string | null; doUrl: string | null;
  form21Url: string | null; disclaimerUrl: string | null;
  insuranceType: string | null; insuranceCompany: string | null; payout: number | null; premium: number | null; insuranceRemarks: string | null;
  insurancePolicyNumber: string | null; policyUrl: string | null;
  tallyNo: string | null; tallyDate: string | null; fastagUrl: string | null;
  roadTaxReceiptNo: string | null; roadTaxUrl: string | null;
  blocking: { vehicle: Vehicle; user: { fullName: string }; customerName: string | null; };
  branch: { name: string; branchCode: string | null };
}

const docFields = [
  { key: 'panCardUrl', label: 'PAN Card' }, { key: 'aadharUrl', label: 'Aadhar' },
  { key: 'fileFrontUrl', label: 'File Front' }, { key: 'fileBackUrl', label: 'File Back' },
  { key: 'doUrl', label: 'DO' }, { key: 'policyUrl', label: 'Insurance Policy' },
  { key: 'form21Url', label: 'Form 21' }, { key: 'disclaimerUrl', label: 'Disclaimer' },
] as const;

export default function AccountsDeptPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [form, setForm] = useState({ tallyNo: '', tallyDate: '', roadTaxReceiptNo: '' });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'tally' | 'roadtax' | 'completed'>('tally');
  const fastagRef = useRef<HTMLInputElement>(null);
  const roadTaxFileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const res = await api.get('/delivery/cases');
    setWorkflows(res.data);
  };

  useEffect(() => { load(); }, []);

  const open = (wf: Workflow) => {
    setSelected(wf);
    setForm({ tallyNo: wf.tallyNo ?? '', tallyDate: wf.tallyDate ? new Date(wf.tallyDate).toISOString().split('T')[0] : '', roadTaxReceiptNo: wf.roadTaxReceiptNo ?? '' });
  };

  const uploadFile = async (field: string, file: File) => {
    if (!selected) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post(`/delivery/${selected.id}/upload/${field}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Uploaded');
      const updated = await api.get(`/delivery/${selected.id}`);
      setSelected(updated.data);
    } catch { toast.error('Upload failed'); }
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
  const activeWfs = tab === 'tally' ? tallyWfs : tab === 'roadtax' ? roadtaxWfs : completedWfs;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Accounts Dashboard</h1>
        <p className="text-on-surface-variant font-body text-sm">Handle Tally entries and Road Tax receipts.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['tally', 'roadtax', 'completed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-label font-bold uppercase tracking-widest transition-colors ${tab === t ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
            {t === 'tally' ? `Tally Entry (${tallyWfs.length})` : t === 'roadtax' ? `Road Tax (${roadtaxWfs.length})` : `Completed (${completedWfs.length})`}
          </button>
        ))}
      </div>

      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        {activeWfs.length === 0 ? (
          <p className="p-8 text-center text-on-surface-variant text-sm">No cases in this tab.</p>
        ) : (
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>{['Customer', 'Chassis No', 'Model', 'Branch', 'Insurance', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {activeWfs.map(wf => (
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
                  {selected.stage === 'ACCOUNTS_TALLY' ? 'Tally Entry' : selected.stage === 'ACCOUNTS_ROAD_TAX' ? 'Road Tax Receipt' : 'Completed'}
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

              {selected.stage === 'ACCOUNTS_TALLY' && (
                <>
                  <div>
                    <p className="text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant mb-2">Documents Uploaded by DIC &amp; Insurance</p>
                    <div className="flex flex-wrap gap-2">
                      {docFields.map(({ key, label }) => (
                        <a key={key} href={selected[key] ? `${API}${selected[key]}` : undefined} target="_blank" rel="noreferrer"
                          className={`text-xs px-3 py-1 rounded-full border ${selected[key] ? 'border-green-500/50 text-green-400 hover:bg-green-900/20' : 'border-zinc-700 text-zinc-500 cursor-not-allowed'}`}>
                          {label} {selected[key] ? '✓' : '✗'}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div><label className="label">Tally No <span className="text-red-400">*</span></label><input className="input" value={form.tallyNo} onChange={e => setForm(f => ({ ...f, tallyNo: e.target.value }))} /></div>
                  <div><label className="label">Tally Date</label><input className="input" type="date" value={form.tallyDate} onChange={e => setForm(f => ({ ...f, tallyDate: e.target.value }))} /></div>
                  <div className="bg-surface-container rounded-lg p-3">
                    <p className="text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant mb-2">Upload Fastag</p>
                    {selected.fastagUrl ? (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-green-400 text-sm">check_circle</span>
                        <a href={`${API}${selected.fastagUrl}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View Fastag</a>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 mb-2">No file uploaded yet.</p>
                    )}
                    <input ref={fastagRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadFile('fastagUrl', e.target.files[0]); }} />
                    <button type="button" onClick={() => fastagRef.current?.click()} className="text-[10px] font-label font-bold uppercase tracking-widest text-primary hover:underline">
                      {selected.fastagUrl ? 'Re-upload Fastag' : 'Upload Fastag'}
                    </button>
                  </div>
                </>
              )}

              {selected.stage === 'ACCOUNTS_ROAD_TAX' && (
                <>
                  <div><label className="label">Road Tax Receipt No <span className="text-red-400">*</span></label><input className="input" value={form.roadTaxReceiptNo} onChange={e => setForm(f => ({ ...f, roadTaxReceiptNo: e.target.value }))} /></div>
                  <div className="bg-surface-container rounded-lg p-3">
                    <p className="text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant mb-2">Upload Road Tax Document</p>
                    {selected.roadTaxUrl ? (
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-green-400 text-sm">check_circle</span>
                        <a href={`${API}${selected.roadTaxUrl}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View Road Tax Document</a>
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500 mb-2">No file uploaded yet.</p>
                    )}
                    <input ref={roadTaxFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadFile('roadTaxUrl', e.target.files[0]); }} />
                    <button type="button" onClick={() => roadTaxFileRef.current?.click()} className="text-[10px] font-label font-bold uppercase tracking-widest text-primary hover:underline">
                      {selected.roadTaxUrl ? 'Re-upload Document' : 'Upload Document'}
                    </button>
                  </div>
                </>
              )}

              {selected.stage === 'COMPLETED' && (
                <div className="bg-surface-container rounded-lg p-4">
                  <p className="text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant mb-3">Road Tax Document</p>
                  {selected.roadTaxUrl ? (
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-green-400 text-sm">check_circle</span>
                      <a href={`${API}${selected.roadTaxUrl}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View Road Tax Document</a>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500">Not uploaded.</p>
                  )}
                </div>
              )}
            </div>

            {selected.stage !== 'COMPLETED' && (
              <div className="p-6 pt-0">
                <button onClick={save} disabled={saving} className="btn-primary w-full">
                  {saving ? 'Saving…' : selected.stage === 'ACCOUNTS_TALLY' ? 'Save & Forward to Vahaan Done' : 'Save & Complete Workflow'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
