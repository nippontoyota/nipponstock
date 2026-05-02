import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';

interface Vehicle {
  id: string; chassisNumber: string; chassisYear: number; model: string; suffix: string;
  colour: string; stockyardLocation: string; dateOfArrival: string; status: string;
  stockStatus?: string | null;
  hiddenFromHeatmap: boolean;
  blockings: { user: { fullName: string } }[];
}

interface Branch { id: string; name: string; branchCode: string | null; }
interface CarSuffix { id: string; suffix: string; }
interface CarColour { id: string; colourCode: string; colourName: string; }
interface CarModel { id: string; modelCode: string; modelName: string; suffixes: CarSuffix[]; colours: CarColour[]; }

const statusColor: Record<string, string> = {
  OPEN: 'bg-green-900/30 text-green-400',
  SOFT_BLOCKED: 'bg-secondary-container/30 text-secondary',
  HARD_BLOCKED: 'bg-orange-900/30 text-orange-400',
  DELIVERED: 'bg-surface-container-high text-zinc-500',
  EXPIRED: 'bg-tertiary-container/20 text-tertiary',
};

const stockStatusColor: Record<string, string> = {
  BND: 'bg-primary/10 text-primary',
  MDDP: 'bg-green-900/30 text-green-400',
  CTDMS: 'bg-orange-900/30 text-orange-400',
};

// Year dropdown: current year + 5 years back / ahead
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 12 }, (_, i) => currentYear - 5 + i);

const emptyManualForm = {
  stockStatus: 'BND' as 'BND' | 'MDDP' | 'CTDMS',
  bndReportedMonth: '',
  chassisYear: String(currentYear),
  model: '',
  suffix: '',
  colour: '',
  chassisNumber: '',
  modelDisc: '',
  assignmentDate: '',
  yardOut: '',
  physicalStockBranchId: '',
  stockyardLocation: '',
};

export default function StockAdminPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [importResult, setImportResult] = useState<{ total: number; success: number; rejected: { row: number; reason: string }[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ctdmsFileRef = useRef<HTMLInputElement>(null);
  const [ctdmsResult, setCtdmsResult] = useState<{ total: number; converted: number; notFound: number } | null>(null);
  const [uploadingCtdms, setUploadingCtdms] = useState(false);
  const limit = 50;

  // Manual entry state
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [savingManual, setSavingManual] = useState(false);
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const fetchVehicles = async (p = page) => {
    const { data } = await api.get(`/stock?page=${p}&limit=${limit}`);
    setVehicles(data.vehicles);
    setTotal(data.total);
  };
  useEffect(() => { fetchVehicles(); }, [page]);

  const openManual = async () => {
    setManualForm(emptyManualForm);
    try {
      const [{ data: models }, { data: branchData }] = await Promise.all([
        api.get('/cars'),
        api.get('/branches'),
      ]);
      setCarModels(models);
      setBranches(branchData);
    } catch { /* non-fatal */ }
    setShowManual(true);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/stock/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImportResult(data);
      toast.success(`Imported ${data.success} / ${data.total} rows`);
      fetchVehicles(1); setPage(1);
    } catch { toast.error('Import failed'); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleCtdmsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCtdms(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/stock/upload-ctdms', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setCtdmsResult(data);
      toast.success(`Converted ${data.converted} MDDP → CTDMS`);
      fetchVehicles(1); setPage(1);
    } catch { toast.error('CTDMS upload failed'); }
    finally { setUploadingCtdms(false); if (ctdmsFileRef.current) ctdmsFileRef.current.value = ''; }
  };

  const handleExport = async () => {
    const { data } = await api.get('/stock/export', { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url; a.download = 'stock_export.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleVisibility = async (v: Vehicle) => {
    try {
      await api.patch(`/stock/${v.id}/toggle-visibility`);
      toast.success(v.hiddenFromHeatmap ? 'Vehicle visible on heatmap' : 'Vehicle hidden from heatmap');
      fetchVehicles();
    } catch { toast.error('Failed to update visibility'); }
  };

  const handleManualSave = async () => {
    if (!manualForm.chassisNumber || !manualForm.model || !manualForm.suffix || !manualForm.colour) {
      toast.error('Chassis number, model, suffix and colour are required');
      return;
    }
    setSavingManual(true);
    try {
      const payload: Record<string, unknown> = {
        stockStatus: manualForm.stockStatus,
        chassisYear: parseInt(manualForm.chassisYear),
        model: manualForm.model,
        suffix: manualForm.suffix,
        colour: manualForm.colour,
        chassisNumber: manualForm.chassisNumber,
        stockyardLocation: manualForm.stockyardLocation || '',
        modelDisc: manualForm.modelDisc || null,
        yardOut: manualForm.yardOut || null,
        physicalStockBranchId: manualForm.physicalStockBranchId || null,
      };
      // Convert "YYYY-MM" month input → "YYYY-MM-01" so the backend can parse as a date
      if (manualForm.stockStatus === 'BND') {
        payload.bndReportedMonth = manualForm.bndReportedMonth ? `${manualForm.bndReportedMonth}-01` : null;
      }
      if (manualForm.stockStatus === 'MDDP' || manualForm.stockStatus === 'CTDMS') {
        payload.assignmentDate = manualForm.assignmentDate || null;
      }
      await api.post('/stock/manual', payload);
      toast.success('Vehicle added successfully');
      setShowManual(false);
      fetchVehicles(1); setPage(1);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to add vehicle');
    } finally { setSavingManual(false); }
  };

  // Derived: suffixes and colours for selected model
  const selectedCarModel = carModels.find((m) => m.modelName === manualForm.model || m.modelCode === manualForm.model);
  const availableSuffixes = selectedCarModel?.suffixes ?? [];
  const availableColours = selectedCarModel?.colours ?? [];

  const setMF = (partial: Partial<typeof emptyManualForm>) =>
    setManualForm((f) => ({ ...f, ...partial }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Stock Management</h1>
          <p className="text-on-surface-variant font-body text-sm">Import, export and monitor your entire vehicle inventory.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary gap-2">
            <span className="material-symbols-outlined text-sm">upload</span>
            {importing ? 'Importing…' : 'Import File'}
          </button>
          {/* CTDMS Upload — converts matching MDDP → CTDMS */}
          <input ref={ctdmsFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleCtdmsUpload} />
          <button onClick={() => ctdmsFileRef.current?.click()} disabled={uploadingCtdms} className="btn-secondary gap-2" style={{ borderColor: '#fb923c', color: '#fb923c' }}>
            <span className="material-symbols-outlined text-sm">swap_horiz</span>
            {uploadingCtdms ? 'Processing…' : 'Upload CTDMS Stock'}
          </button>
          <button onClick={handleExport} className="btn-secondary gap-2">
            <span className="material-symbols-outlined text-sm">download</span>
            Export Excel
          </button>
          <button onClick={openManual} className="btn-primary gap-2">
            <span className="material-symbols-outlined text-sm">add</span>
            Add Vehicle
          </button>
        </div>
      </div>

      {importResult && (
        <div className={`rounded-xl p-5 flex items-start gap-4 ${importResult.rejected.length > 0 ? 'bg-tertiary-container/10' : 'bg-green-900/20'}`} style={{ borderLeft: `3px solid ${importResult.rejected.length > 0 ? '#d71a18' : '#34d399'}` }}>
          <span className="material-symbols-outlined text-2xl">{importResult.rejected.length > 0 ? 'warning' : 'check_circle'}</span>
          <div className="flex-1">
            <p className="font-headline font-bold uppercase tracking-tight text-on-surface">
              Import Result: {importResult.success} / {importResult.total} rows imported
            </p>
            {importResult.rejected.length > 0 && (
              <ul className="mt-2 space-y-1">
                {importResult.rejected.slice(0, 5).map((r) => (
                  <li key={r.row} className="text-xs text-tertiary font-label">Row {r.row}: {r.reason}</li>
                ))}
                {importResult.rejected.length > 5 && <li className="text-xs text-zinc-500">…and {importResult.rejected.length - 5} more</li>}
              </ul>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="text-zinc-500 hover:text-on-surface"><span className="material-symbols-outlined text-lg">close</span></button>
        </div>
      )}

      {ctdmsResult && (
        <div className="rounded-xl p-5 flex items-start gap-4 bg-orange-900/20" style={{ borderLeft: '3px solid #fb923c' }}>
          <span className="material-symbols-outlined text-2xl text-orange-400">swap_horiz</span>
          <div className="flex-1">
            <p className="font-headline font-bold uppercase tracking-tight text-on-surface">
              CTDMS Upload: {ctdmsResult.converted} converted, {ctdmsResult.notFound} not matched
            </p>
            <p className="text-xs text-zinc-400 mt-1">Matching MDDP vehicles were updated to CTDMS status (earliest-booked first)</p>
          </div>
          <button onClick={() => setCtdmsResult(null)} className="text-zinc-500 hover:text-on-surface"><span className="material-symbols-outlined text-lg">close</span></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                {['Chassis No.', 'Year', 'Model', 'Suffix', 'Colour', 'Stock Status', 'Yard Location', 'Arrived', 'Status', 'Blocked By', 'Heatmap'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-20 text-center">
                    <span className="material-symbols-outlined text-4xl text-zinc-700 block mb-3">inventory_2</span>
                    <p className="text-on-surface-variant font-label text-xs uppercase tracking-widest">No stock found. Import a file or add a vehicle manually.</p>
                  </td>
                </tr>
              ) : vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-surface-container transition-colors" style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }}>
                  <td className="px-4 py-3 font-mono text-xs text-primary/80">{v.chassisNumber}</td>
                  <td className="px-4 py-3 text-on-surface">{v.chassisYear}</td>
                  <td className="px-4 py-3 font-bold text-on-surface font-headline tracking-tight">{v.model}</td>
                  <td className="px-4 py-3 text-on-surface">{v.suffix}</td>
                  <td className="px-4 py-3 text-on-surface">{v.colour}</td>
                  <td className="px-4 py-3">
                    {v.stockStatus ? (
                      <span className={`badge ${stockStatusColor[v.stockStatus] ?? 'bg-surface-container text-zinc-500'}`}>{v.stockStatus}</span>
                    ) : <span className="text-zinc-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{v.stockyardLocation || '—'}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{new Date(v.dateOfArrival).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><span className={`badge ${statusColor[v.status] ?? 'bg-surface-container text-zinc-500'}`}>{v.status}</span></td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{v.blockings[0]?.user.fullName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleVisibility(v)}
                      title={v.hiddenFromHeatmap ? 'Hidden from heatmap — click to show' : 'Visible on heatmap — click to hide'}
                      className={`flex items-center gap-1.5 text-[10px] font-label font-bold uppercase tracking-wider transition-colors rounded px-2 py-1 ${
                        v.hiddenFromHeatmap
                          ? 'bg-tertiary-container/20 text-tertiary hover:bg-tertiary-container/30'
                          : 'bg-green-900/20 text-green-400 hover:bg-green-900/30'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">{v.hiddenFromHeatmap ? 'visibility_off' : 'visibility'}</span>
                      {v.hiddenFromHeatmap ? 'Hidden' : 'Visible'}
                    </button>
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

      {/* Manual Entry Modal */}
      {showManual && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowManual(false)}>
          <div
            className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 bg-surface-container flex-shrink-0" style={{ borderBottom: '1px solid rgba(67,70,86,0.12)' }}>
              <div>
                <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-on-surface">Add Vehicle</h2>
                <p className="text-xs text-on-surface-variant font-label mt-0.5">Manual stock entry</p>
              </div>
              <button onClick={() => setShowManual(false)} className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Form — scrollable body */}
            <div className="overflow-y-auto custom-scrollbar p-6 space-y-5 flex-1">

              {/* Stock Status */}
              <div>
                <label className="label">Stock Status *</label>
                <div className="flex gap-3">
                  {(['BND', 'MDDP', 'CTDMS'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setMF({ stockStatus: s, bndReportedMonth: '', assignmentDate: '' })}
                      className={`flex-1 py-2 rounded-lg text-xs font-label font-bold uppercase tracking-widest transition-all border ${
                        manualForm.stockStatus === s
                          ? 'bg-primary/15 text-primary border-primary'
                          : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* BND Reported Month — only if BND */}
              {manualForm.stockStatus === 'BND' && (
                <div>
                  <label className="label">BND Reported Month</label>
                  <input
                    className="input"
                    type="month"
                    value={manualForm.bndReportedMonth}
                    onChange={(e) => setMF({ bndReportedMonth: e.target.value })}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              )}

              {/* Row: Chassis Year + Chassis Number */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Chassis Year *</label>
                  <div className="relative">
                    <select className="input appearance-none pr-8" value={manualForm.chassisYear} onChange={(e) => setMF({ chassisYear: e.target.value })}>
                      {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                  </div>
                </div>
                <div>
                  <label className="label">Chassis Number *</label>
                  <input className="input font-mono" placeholder="e.g. MHF4G3DD5P0012345" value={manualForm.chassisNumber} onChange={(e) => setMF({ chassisNumber: e.target.value.toUpperCase() })} />
                </div>
              </div>

              {/* Model */}
              <div>
                <label className="label">Model *</label>
                <div className="relative">
                  <select
                    className="input appearance-none pr-8"
                    value={manualForm.model}
                    onChange={(e) => setMF({ model: e.target.value, suffix: '', colour: '' })}
                  >
                    <option value="">Select model…</option>
                    {carModels.map((m) => (
                      <option key={m.id} value={m.modelName}>{m.modelName} ({m.modelCode})</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                </div>
              </div>

              {/* Row: Suffix + Colour */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Suffix *</label>
                  <div className="relative">
                    <select
                      className="input appearance-none pr-8"
                      value={manualForm.suffix}
                      onChange={(e) => setMF({ suffix: e.target.value })}
                      disabled={!manualForm.model}
                    >
                      <option value="">Select suffix…</option>
                      {availableSuffixes.map((s) => (
                        <option key={s.id} value={s.suffix}>{s.suffix}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                  </div>
                </div>
                <div>
                  <label className="label">Colour *</label>
                  <div className="relative">
                    <select
                      className="input appearance-none pr-8"
                      value={manualForm.colour}
                      onChange={(e) => setMF({ colour: e.target.value })}
                      disabled={!manualForm.model}
                    >
                      <option value="">Select colour…</option>
                      {availableColours.map((c) => (
                        <option key={c.id} value={c.colourName}>{c.colourName} ({c.colourCode})</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Model Disc */}
              <div>
                <label className="label">Model Disc</label>
                <input className="input" placeholder="e.g. MR23" value={manualForm.modelDisc} onChange={(e) => setMF({ modelDisc: e.target.value })} />
              </div>

              {/* Assignment Date — only if MDDP or CTDMS */}
              {(manualForm.stockStatus === 'MDDP' || manualForm.stockStatus === 'CTDMS') && (
                <div>
                  <label className="label">Assignment Date *</label>
                  <input
                    className="input"
                    type="date"
                    value={manualForm.assignmentDate}
                    onChange={(e) => setMF({ assignmentDate: e.target.value })}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              )}

              {/* Row: Yard Out + Physical Stock Branch */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Yard Out <span className="text-zinc-500">(optional)</span></label>
                  <input
                    className="input"
                    type="date"
                    value={manualForm.yardOut}
                    onChange={(e) => setMF({ yardOut: e.target.value })}
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="label">Physical Stock Branch</label>
                  <div className="relative">
                    <select
                      className="input appearance-none pr-8"
                      value={manualForm.physicalStockBranchId}
                      onChange={(e) => setMF({ physicalStockBranchId: e.target.value })}
                    >
                      <option value="">None / HQ</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}{b.branchCode ? ` (${b.branchCode})` : ''}</option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                  </div>
                </div>
              </div>

              {/* Stockyard Location */}
              <div>
                <label className="label">Stockyard Location</label>
                <input className="input" placeholder="e.g. Yard A - Bay 3" value={manualForm.stockyardLocation} onChange={(e) => setMF({ stockyardLocation: e.target.value })} />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(67,70,86,0.12)' }}>
              <button onClick={handleManualSave} disabled={savingManual} className="btn-primary w-full">
                {savingManual ? 'Adding Vehicle…' : 'Add Vehicle to Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
