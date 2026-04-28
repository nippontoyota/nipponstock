import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';

interface ModelConfig { id: string; modelName: string; blockingDurationDays: number; }

export default function ConfigPage() {
  const [configs, setConfigs] = useState<ModelConfig[]>([]);
  const [globalDays, setGlobalDays] = useState(7);
  const [globalInput, setGlobalInput] = useState('7');
  const [newModel, setNewModel] = useState('');
  const [newDays, setNewDays] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});

  const fetchAll = async () => {
    const [c, g] = await Promise.all([api.get('/config/models'), api.get('/config/global')]);
    setConfigs(c.data);
    setGlobalDays(g.data.defaultDays);
    setGlobalInput(String(g.data.defaultDays));
  };
  useEffect(() => { fetchAll(); }, []);

  const saveGlobal = async () => {
    const days = parseInt(globalInput);
    if (isNaN(days) || days < 1) { toast.error('Enter a valid number'); return; }
    try { await api.put('/config/global', { defaultDays: days }); toast.success('Global default saved'); setGlobalDays(days); }
    catch { toast.error('Failed'); }
  };

  const saveModel = async (modelName: string) => {
    const days = parseInt(edits[modelName] ?? '');
    if (isNaN(days) || days < 1) { toast.error('Enter a valid number'); return; }
    try { await api.put(`/config/models/${encodeURIComponent(modelName)}`, { blockingDurationDays: days }); toast.success(`${modelName} saved`); fetchAll(); }
    catch { toast.error('Failed'); }
  };

  const addModel = async () => {
    const days = parseInt(newDays);
    if (!newModel || isNaN(days) || days < 1) { toast.error('Enter model name and valid days'); return; }
    try { await api.put(`/config/models/${encodeURIComponent(newModel)}`, { blockingDurationDays: days }); toast.success('Model config added'); setNewModel(''); setNewDays(''); fetchAll(); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Configuration</h1>
        <p className="text-on-surface-variant font-body text-sm">Set blocking duration rules per model and globally.</p>
      </div>

      {/* Global default */}
      <div className="bg-surface-container-low rounded-xl p-8 space-y-6" style={{ borderLeft: '3px solid #b8c3ff' }}>
        <div>
          <h4 className="text-[10px] font-label font-black text-primary uppercase tracking-[0.3em] mb-1">Global Default</h4>
          <h2 className="font-headline text-lg font-bold tracking-tight text-on-surface">Default Blocking Duration</h2>
          <p className="text-xs text-on-surface-variant mt-1">Applies to all models without a specific configuration.</p>
        </div>
        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-2">
            <label className="label">Duration (days)</label>
            <input className="input" type="number" min={1} value={globalInput} onChange={(e) => setGlobalInput(e.target.value)} />
          </div>
          <button onClick={saveGlobal} className="btn-primary">Save</button>
        </div>
        <p className="text-xs text-on-surface-variant">Current: <span className="text-primary font-bold">{globalDays} days</span></p>
      </div>

      {/* Per-model */}
      <div className="bg-surface-container-low rounded-xl p-8 space-y-6">
        <div>
          <h4 className="text-[10px] font-label font-black text-primary uppercase tracking-[0.3em] mb-1">Per-Model Config</h4>
          <h2 className="font-headline text-lg font-bold tracking-tight text-on-surface">Model Blocking Durations</h2>
        </div>

        <div className="space-y-3">
          {configs.length === 0 && (
            <p className="text-xs text-on-surface-variant font-label">No model-specific configs yet.</p>
          )}
          {configs.map((c) => (
            <div key={c.id} className="flex gap-3 items-center p-4 bg-surface-container rounded-xl">
              <span className="flex-1 font-headline font-bold text-on-surface tracking-tight">{c.modelName}</span>
              <input
                className="input w-20 text-center"
                type="number"
                min={1}
                value={edits[c.modelName] ?? String(c.blockingDurationDays)}
                onChange={(e) => setEdits((prev) => ({ ...prev, [c.modelName]: e.target.value }))}
              />
              <span className="text-xs text-on-surface-variant font-label">days</span>
              <button onClick={() => saveModel(c.modelName)} className="btn-secondary text-xs px-4 py-2">Save</button>
            </div>
          ))}
        </div>

        <div className="pt-2 space-y-3" style={{ borderTop: '1px solid rgba(67,70,86,0.1)' }}>
          <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant font-bold">Add Model Config</p>
          <div className="flex gap-3">
            <input className="input flex-1" placeholder="Model name" value={newModel} onChange={(e) => setNewModel(e.target.value)} />
            <input className="input w-20" type="number" min={1} placeholder="Days" value={newDays} onChange={(e) => setNewDays(e.target.value)} />
            <button onClick={addModel} className="btn-primary whitespace-nowrap">Add</button>
          </div>
        </div>
      </div>
    </div>
  );
}
