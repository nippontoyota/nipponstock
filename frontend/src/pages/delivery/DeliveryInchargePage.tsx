import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface Vehicle { chassisNumber: string; model: string; suffix: string; colour: string; chassisYear: number; }
interface FPBlocking { id: string; customerName: string | null; consultantName: string | null; teamLeaderName: string | null; vehicle: Vehicle; user: { fullName: string }; fullPaymentAt: string | null; }
interface Workflow {
  id: string; blockingId: string; stage: string; branchId: string;
  customerName: string | null; salesOfficer: string | null; teamLeaderName: string | null;
  panCardUrl: string | null; aadharUrl: string | null; fileFrontUrl: string | null; fileBackUrl: string | null;
  form21Url: string | null;
  blocking: { vehicle: Vehicle; user: { fullName: string }; customerName: string | null; };
}

const STAGE_LABEL: Record<string, string> = {
  DI_DOCUMENTS: 'Stage 1 — Documents',
  DI_VAHAAN_ENTRY: 'Stage 2 — Vahaan Entry',
  DI_VAHAAN_DONE: 'Stage 3 — Vahaan Done',
};

export default function DeliveryInchargePage() {
  const [fpBlockings, setFpBlockings] = useState<FPBlocking[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState<Workflow | null>(null);
  const [tab, setTab] = useState<'new' | 'active'>('new');
  const [form, setForm] = useState({ customerName: '', salesOfficer: '', teamLeaderName: '' });
  const [saving, setSaving] = useState(false);
  const fileRefs = { panCardUrl: useRef<HTMLInputElement>(null), aadharUrl: useRef<HTMLInputElement>(null), fileFrontUrl: useRef<HTMLInputElement>(null), fileBackUrl: useRef<HTMLInputElement>(null), form21Url: useRef<HTMLInputElement>(null) };

  const load = async () => {
    const [fp, wf] = await Promise.all([api.get('/delivery/full-payment-ready'), api.get('/delivery/cases')]);
    setFpBlockings(fp.data);
    setWorkflows(wf.data);
  };

  useEffect(() => { load(); }, []);

  const initWorkflow = async (blockingId: string) => {
    setSaving(true);
    try {
      await api.post(`/delivery/${blockingId}/init`);
      toast.success('Delivery workflow started');
      await load();
      setTab('active');
    } catch { toast.error('Failed to start workflow'); }
    finally { setSaving(false); }
  };

  const openWorkflow = (wf: Workflow) => {
    setSelected(wf);
    setForm({ customerName: wf.customerName ?? '', salesOfficer: wf.salesOfficer ?? '', teamLeaderName: wf.teamLeaderName ?? '' });
  };

  const uploadFile = async (field: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      await api.post(`/delivery/${selected!.id}/upload/${field}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Uploaded');
      const updated = await api.get(`/delivery/${selected!.id}`);
      setSelected(updated.data);
    } catch { toast.error('Upload failed'); }
  };

  const saveAndAdvance = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = { ...form };
      if (selected.stage === 'DI_VAHAAN_DONE') data.vaahanDone = true;
      await api.patch(`/delivery/${selected.id}`, data);
      toast.success('Saved & sent to next stage');
      setSelected(null);
      await load();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const diWorkflows = workflows.filter(w => ['DI_DOCUMENTS', 'DI_VAHAAN_ENTRY', 'DI_VAHAAN_DONE'].includes(w.stage));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Delivery Dashboard</h1>
        <p className="text-on-surface-variant font-body text-sm">Manage delivery workflow for fully paid vehicles.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['new', 'active'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-xs font-label font-bold uppercase tracking-widest transition-colors ${tab === t ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
            {t === 'new' ? `Pending Start (${fpBlockings.length})` : `Active Cases (${diWorkflows.length})`}
          </button>
        ))}
      </div>

      {tab === 'new' && (
        <div className="bg-surface-container-low rounded-xl overflow-hidden">
          {fpBlockings.length === 0 ? (
            <p className="p-8 text-center text-on-surface-variant text-sm">No pending full payment cases.</p>
          ) : (
            <table className="w-full text-sm font-body">
              <thead className="bg-surface-container">
                <tr>{['Customer', 'Chassis No', 'Model', 'SM', 'Full Payment Date', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {fpBlockings.map(b => (
                  <tr key={b.id} className="hover:bg-surface-container transition-colors" style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }}>
                    <td className="px-4 py-3 font-bold text-on-surface">{b.customerName ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-primary/80">{b.vehicle.chassisNumber}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{b.vehicle.model} {b.vehicle.suffix}</td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">{b.user.fullName}</td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">{b.fullPaymentAt ? new Date(b.fullPaymentAt).toLocaleDateString('en-GB') : '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => initWorkflow(b.id)} disabled={saving} className="btn-primary text-xs py-1 px-3">Start Delivery</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'active' && (
        <div className="space-y-4">
          {(['DI_DOCUMENTS', 'DI_VAHAAN_ENTRY', 'DI_VAHAAN_DONE'] as const).map(stage => {
            const stageWfs = diWorkflows.filter(w => w.stage === stage);
            return (
              <div key={stage}>
                <h2 className="text-xs font-label font-black uppercase tracking-widest text-primary mb-2">{STAGE_LABEL[stage]} ({stageWfs.length})</h2>
                {stageWfs.length === 0 ? (
                  <p className="text-xs text-on-surface-variant pl-2">No cases.</p>
                ) : (
                  <div className="bg-surface-container-low rounded-xl overflow-hidden">
                    <table className="w-full text-sm font-body">
                      <thead className="bg-surface-container">
                        <tr>{['Customer', 'Chassis No', 'Model', ''].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest">{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {stageWfs.map(wf => (
                          <tr key={wf.id} className="hover:bg-surface-container transition-colors cursor-pointer" style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }} onClick={() => openWorkflow(wf)}>
                            <td className="px-4 py-3 font-bold text-on-surface">{wf.customerName || wf.blocking.customerName || '—'}</td>
                            <td className="px-4 py-3 font-mono text-xs text-primary/80">{wf.blocking.vehicle.chassisNumber}</td>
                            <td className="px-4 py-3 text-on-surface-variant">{wf.blocking.vehicle.model} {wf.blocking.vehicle.suffix}</td>
                            <td className="px-4 py-3"><button className="text-xs text-primary hover:underline">Open →</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 pb-4" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
              <div>
                <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-on-surface">{STAGE_LABEL[selected.stage]}</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">{selected.blocking.vehicle.chassisNumber} — {selected.blocking.vehicle.model} {selected.blocking.vehicle.suffix}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {selected.stage === 'DI_DOCUMENTS' && (
                <>
                  <div><label className="label">Customer Name</label><input className="input" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} /></div>
                  <div><label className="label">Sales Officer</label><input className="input" value={form.salesOfficer} onChange={e => setForm(f => ({ ...f, salesOfficer: e.target.value }))} /></div>
                  <div><label className="label">Team Leader</label><input className="input" value={form.teamLeaderName} onChange={e => setForm(f => ({ ...f, teamLeaderName: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {(['panCardUrl', 'aadharUrl', 'fileFrontUrl', 'fileBackUrl'] as const).map(field => {
                      const labels: Record<string, string> = { panCardUrl: 'PAN Card', aadharUrl: 'Aadhar', fileFrontUrl: 'File Front Page', fileBackUrl: 'File Back Page' };
                      const uploaded = selected[field];
                      return (
                        <div key={field} className="bg-surface-container rounded-lg p-3">
                          <p className="text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant mb-2">{labels[field]}</p>
                          {uploaded ? (
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-green-400 text-sm">check_circle</span>
                              <a href={`${API}${uploaded}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View</a>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-500">Not uploaded</span>
                          )}
                          <input ref={fileRefs[field]} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadFile(field, e.target.files[0]); }} />
                          <button onClick={() => fileRefs[field].current?.click()} className="mt-2 text-[10px] font-label font-bold uppercase tracking-widest text-primary hover:underline">
                            {uploaded ? 'Re-upload' : 'Upload'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {selected.stage === 'DI_VAHAAN_ENTRY' && (
                <div className="bg-surface-container rounded-lg p-4">
                  <p className="text-[10px] font-label font-black uppercase tracking-widest text-on-surface-variant mb-3">Form 21</p>
                  {selected.form21Url ? (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-green-400 text-sm">check_circle</span>
                      <a href={`${API}${selected.form21Url}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View Uploaded Form 21</a>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 mb-2">No file uploaded yet.</p>
                  )}
                  <input ref={fileRefs.form21Url} type="file" accept="image/*,.pdf" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadFile('form21Url', e.target.files[0]); }} />
                  <button onClick={() => fileRefs.form21Url.current?.click()} className="text-xs font-label font-bold uppercase tracking-widest text-primary hover:underline">
                    {selected.form21Url ? 'Re-upload Form 21' : 'Upload Form 21'}
                  </button>
                </div>
              )}

              {selected.stage === 'DI_VAHAAN_DONE' && (
                <div className="bg-surface-container rounded-lg p-4 text-center">
                  <span className="material-symbols-outlined text-4xl text-primary mb-2 block">how_to_reg</span>
                  <p className="font-headline font-bold text-on-surface mb-1">Vahaan Entry Done?</p>
                  <p className="text-xs text-on-surface-variant">Click Save to confirm Vahaan is done and forward to Accounts for Tally entry.</p>
                </div>
              )}
            </div>

            <div className="p-6 pt-0">
              <button onClick={saveAndAdvance} disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving…' : selected.stage === 'DI_VAHAAN_DONE' ? 'Confirm Vahaan Done' : 'Save & Send to Next Stage'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
