import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';

interface CarSuffix { id: string; suffix: string; description?: string | null; }
interface CarColour { id: string; colourCode: string; colourName: string; }
interface CarModel {
  id: string;
  modelCode: string;
  modelName: string;
  description?: string | null;
  suffixes: CarSuffix[];
  colours: CarColour[];
}

const emptyModel = { modelCode: '', modelName: '', description: '' };
const emptySuffix = { suffix: '', description: '' };
const emptyColour = { colourCode: '', colourName: '' };

export default function CarsPage() {
  const [models, setModels] = useState<CarModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<CarModel | null>(null);
  const [activeTab, setActiveTab] = useState<'models' | 'suffixes' | 'colours'>('models');

  // Model form
  const [showModelForm, setShowModelForm] = useState(false);
  const [editModel, setEditModel] = useState<CarModel | null>(null);
  const [modelForm, setModelForm] = useState(emptyModel);
  const [savingModel, setSavingModel] = useState(false);

  // Suffix form
  const [suffixForm, setSuffixForm] = useState(emptySuffix);
  const [savingSuffix, setSavingSuffix] = useState(false);

  // Colour form
  const [colourForm, setColourForm] = useState(emptyColour);
  const [savingColour, setSavingColour] = useState(false);

  // Bulk upload
  const [bulkResult, setBulkResult] = useState<{ total: number; success: number; rejected: { row: number; reason: string }[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchModels = async () => {
    const { data } = await api.get('/cars');
    setModels(data);
    // Refresh selected model if there was one
    if (selectedModel) {
      const updated = data.find((m: CarModel) => m.id === selectedModel.id);
      setSelectedModel(updated ?? null);
    }
  };
  useEffect(() => { fetchModels(); }, []);

  // ── Model CRUD ────────────────────────────────────────────────────────────
  const openCreateModel = () => { setEditModel(null); setModelForm(emptyModel); setShowModelForm(true); };
  const openEditModel = (m: CarModel) => { setEditModel(m); setModelForm({ modelCode: m.modelCode, modelName: m.modelName, description: m.description ?? '' }); setShowModelForm(true); };

  const handleSaveModel = async () => {
    if (!modelForm.modelCode || !modelForm.modelName) { toast.error('Model code and name are required'); return; }
    setSavingModel(true);
    try {
      if (editModel) {
        await api.patch(`/cars/${editModel.id}`, modelForm);
        toast.success('Model updated');
      } else {
        await api.post('/cars', modelForm);
        toast.success('Model created');
      }
      setShowModelForm(false);
      fetchModels();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed');
    } finally { setSavingModel(false); }
  };

  const handleDeleteModel = async (m: CarModel) => {
    if (!confirm(`Delete model "${m.modelName}"? All suffixes and colours will also be deleted.`)) return;
    try {
      await api.delete(`/cars/${m.id}`);
      toast.success('Model deleted');
      if (selectedModel?.id === m.id) setSelectedModel(null);
      fetchModels();
    } catch { toast.error('Failed to delete model'); }
  };

  const selectModel = (m: CarModel) => {
    setSelectedModel(m);
    setActiveTab('suffixes');
    setSuffixForm(emptySuffix);
    setColourForm(emptyColour);
  };

  // ── Suffix CRUD ───────────────────────────────────────────────────────────
  const handleAddSuffix = async () => {
    if (!selectedModel || !suffixForm.suffix) { toast.error('Suffix is required'); return; }
    setSavingSuffix(true);
    try {
      await api.post(`/cars/${selectedModel.id}/suffixes`, suffixForm);
      toast.success('Suffix added');
      setSuffixForm(emptySuffix);
      fetchModels();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed');
    } finally { setSavingSuffix(false); }
  };

  const handleDeleteSuffix = async (id: string) => {
    try {
      await api.delete(`/cars/suffixes/${id}`);
      toast.success('Suffix removed');
      fetchModels();
    } catch { toast.error('Failed'); }
  };

  // ── Colour CRUD ───────────────────────────────────────────────────────────
  const handleAddColour = async () => {
    if (!selectedModel || !colourForm.colourCode || !colourForm.colourName) { toast.error('Colour code and name are required'); return; }
    setSavingColour(true);
    try {
      await api.post(`/cars/${selectedModel.id}/colours`, colourForm);
      toast.success('Colour added');
      setColourForm(emptyColour);
      fetchModels();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed');
    } finally { setSavingColour(false); }
  };

  const handleDeleteColour = async (id: string) => {
    try {
      await api.delete(`/cars/colours/${id}`);
      toast.success('Colour removed');
      fetchModels();
    } catch { toast.error('Failed'); }
  };

  // ── Bulk Upload ───────────────────────────────────────────────────────────
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/cars/bulk-upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setBulkResult(data);
      toast.success(`Uploaded ${data.success} / ${data.total} rows`);
      fetchModels();
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const currentSuffixes = selectedModel ? models.find((m) => m.id === selectedModel.id)?.suffixes ?? [] : [];
  const currentColours = selectedModel ? models.find((m) => m.id === selectedModel.id)?.colours ?? [] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Car Catalogue</h1>
          <p className="text-on-surface-variant font-body text-sm">Manage models, suffixes and colour codes.</p>
        </div>
        <div className="flex gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleBulkUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary gap-2">
            <span className="material-symbols-outlined text-sm">upload</span>
            {uploading ? 'Uploading…' : 'Bulk Upload'}
          </button>
          <button onClick={openCreateModel} className="btn-primary gap-2">
            <span className="material-symbols-outlined text-sm">add</span>
            New Model
          </button>
        </div>
      </div>

      {/* Bulk upload result */}
      {bulkResult && (
        <div className={`rounded-xl p-5 flex items-start gap-4 ${bulkResult.rejected.length > 0 ? 'bg-tertiary-container/10' : 'bg-green-900/20'}`} style={{ borderLeft: `3px solid ${bulkResult.rejected.length > 0 ? '#d71a18' : '#34d399'}` }}>
          <span className="material-symbols-outlined text-2xl">{bulkResult.rejected.length > 0 ? 'warning' : 'check_circle'}</span>
          <div className="flex-1">
            <p className="font-headline font-bold uppercase tracking-tight text-on-surface">
              Upload Result: {bulkResult.success} / {bulkResult.total} rows processed
            </p>
            {bulkResult.rejected.length > 0 && (
              <ul className="mt-2 space-y-1">
                {bulkResult.rejected.slice(0, 5).map((r) => (
                  <li key={r.row} className="text-xs text-tertiary font-label">Row {r.row}: {r.reason}</li>
                ))}
                {bulkResult.rejected.length > 5 && <li className="text-xs text-zinc-500">…and {bulkResult.rejected.length - 5} more</li>}
              </ul>
            )}
          </div>
          <button onClick={() => setBulkResult(null)} className="text-zinc-500 hover:text-on-surface"><span className="material-symbols-outlined text-lg">close</span></button>
        </div>
      )}

      {/* Bulk upload template hint */}
      <div className="bg-surface-container-low rounded-xl px-5 py-3 flex items-center gap-3" style={{ borderLeft: '3px solid rgba(184,195,255,0.3)' }}>
        <span className="material-symbols-outlined text-primary text-lg">info</span>
        <p className="text-xs font-label text-on-surface-variant">
          Bulk upload columns: <span className="text-primary font-mono">modelCode, modelName, description, suffix, suffixDescription, colourCode, colourName</span>
        </p>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Models list */}
        <div className="lg:col-span-2 bg-surface-container-low rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-surface-container flex items-center justify-between">
            <span className="text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest">Models ({models.length})</span>
          </div>
          {models.length === 0 ? (
            <div className="py-16 text-center">
              <span className="material-symbols-outlined text-3xl text-zinc-700 block mb-2">directions_car</span>
              <p className="text-xs text-on-surface-variant font-label uppercase tracking-widest">No models yet</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-800/20">
              {models.map((m) => (
                <div
                  key={m.id}
                  onClick={() => selectModel(m)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${selectedModel?.id === m.id ? 'bg-primary/10 border-r-4 border-primary' : 'hover:bg-surface-container'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-headline font-bold text-on-surface tracking-tight text-sm">{m.modelName}</p>
                      <p className="font-mono text-[10px] text-primary/70 mt-0.5">{m.modelCode}</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">{m.suffixes.length} suffixes · {m.colours.length} colours</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModel(m); }}
                        className="text-on-surface-variant hover:text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteModel(m); }}
                        className="text-on-surface-variant hover:text-tertiary transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Suffixes + Colours detail */}
        <div className="lg:col-span-3 bg-surface-container-low rounded-xl overflow-hidden">
          {!selectedModel ? (
            <div className="h-full flex items-center justify-center py-24">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-zinc-700 block mb-3">touch_app</span>
                <p className="text-xs text-on-surface-variant font-label uppercase tracking-widest">Select a model to manage suffixes and colours</p>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex bg-surface-container" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
                {(['suffixes', 'colours'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-3 text-[10px] font-label font-black uppercase tracking-widest transition-colors ${
                      activeTab === tab ? 'text-primary border-b-2 border-primary' : 'text-zinc-500 hover:text-on-surface'
                    }`}
                  >
                    {tab === 'suffixes' ? `Suffixes (${currentSuffixes.length})` : `Colours (${currentColours.length})`}
                  </button>
                ))}
                <div className="flex-1 px-4 py-3 flex items-center justify-end">
                  <span className="font-headline font-bold text-xs text-on-surface tracking-tight">{selectedModel.modelName}</span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {activeTab === 'suffixes' && (
                  <>
                    {/* Add suffix */}
                    <div className="flex gap-3">
                      <input className="input flex-1" placeholder="Suffix (e.g. 2.0G)" value={suffixForm.suffix} onChange={(e) => setSuffixForm((f) => ({ ...f, suffix: e.target.value }))} />
                      <input className="input flex-1" placeholder="Description (optional)" value={suffixForm.description} onChange={(e) => setSuffixForm((f) => ({ ...f, description: e.target.value }))} />
                      <button onClick={handleAddSuffix} disabled={savingSuffix} className="btn-primary whitespace-nowrap">
                        {savingSuffix ? '…' : 'Add'}
                      </button>
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                      {currentSuffixes.length === 0 ? (
                        <p className="text-xs text-on-surface-variant font-label text-center py-8 uppercase tracking-widest">No suffixes yet</p>
                      ) : currentSuffixes.map((s) => (
                        <div key={s.id} className="flex items-center justify-between px-4 py-2 bg-surface-container rounded-xl">
                          <div>
                            <span className="font-headline font-bold text-sm text-on-surface">{s.suffix}</span>
                            {s.description && <span className="text-xs text-on-surface-variant ml-3">{s.description}</span>}
                          </div>
                          <button onClick={() => handleDeleteSuffix(s.id)} className="text-on-surface-variant hover:text-tertiary transition-colors">
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {activeTab === 'colours' && (
                  <>
                    {/* Add colour */}
                    <div className="flex gap-3">
                      <input className="input w-36" placeholder="Code (e.g. WH1)" value={colourForm.colourCode} onChange={(e) => setColourForm((f) => ({ ...f, colourCode: e.target.value }))} />
                      <input className="input flex-1" placeholder="Colour name (e.g. Pearl White)" value={colourForm.colourName} onChange={(e) => setColourForm((f) => ({ ...f, colourName: e.target.value }))} />
                      <button onClick={handleAddColour} disabled={savingColour} className="btn-primary whitespace-nowrap">
                        {savingColour ? '…' : 'Add'}
                      </button>
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                      {currentColours.length === 0 ? (
                        <p className="text-xs text-on-surface-variant font-label text-center py-8 uppercase tracking-widest">No colours yet</p>
                      ) : currentColours.map((c) => (
                        <div key={c.id} className="flex items-center justify-between px-4 py-2 bg-surface-container rounded-xl">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-[10px] text-primary/80 bg-primary/10 px-2 py-0.5 rounded">{c.colourCode}</span>
                            <span className="font-body text-sm text-on-surface">{c.colourName}</span>
                          </div>
                          <button onClick={() => handleDeleteColour(c.id)} className="text-on-surface-variant hover:text-tertiary transition-colors">
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create / Edit Model Modal */}
      {showModelForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowModelForm(false)}>
          <div className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 pb-4" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
              <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-on-surface">
                {editModel ? 'Edit Model' : 'New Model'}
              </h2>
              <button onClick={() => setShowModelForm(false)} className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="label">Model Code</label>
                <input className="input" placeholder="e.g. ATIV" value={modelForm.modelCode} onChange={(e) => setModelForm((f) => ({ ...f, modelCode: e.target.value }))} />
              </div>
              <div>
                <label className="label">Model Name</label>
                <input className="input" placeholder="e.g. Toyota Agya / Wigo" value={modelForm.modelName} onChange={(e) => setModelForm((f) => ({ ...f, modelName: e.target.value }))} />
              </div>
              <div>
                <label className="label">Description <span className="text-zinc-500">(optional)</span></label>
                <input className="input" placeholder="Short description" value={modelForm.description} onChange={(e) => setModelForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>

            <div className="p-6 pt-0">
              <button onClick={handleSaveModel} disabled={savingModel} className="btn-primary w-full">
                {savingModel ? 'Saving…' : editModel ? 'Save Changes' : 'Create Model'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
