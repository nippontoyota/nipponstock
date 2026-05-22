import { useEffect, useState, useRef, useCallback } from 'react';
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
interface SalesUser { id: string; fullName: string; loginId: string; role: string; isActive: boolean; branchId: string | null; branch?: { name: string } | null; }
interface CarSuffix { id: string; suffix: string; }
interface CarColour { id: string; colourCode: string; colourName: string; }
interface CarModel { id: string; modelCode: string; modelName: string; suffixes: CarSuffix[]; colours: CarColour[]; }

interface TallyDetail {
  row: number;
  chassisNumber: string;
  status: 'success' | 'not_found' | 'no_blocking' | 'branch_mismatch' | 'skipped';
  note?: string;
}
interface TallyResult {
  total: number;
  successful: number;
  notFound: number;
  noBlocking: number;
  branchMismatch: number;
  details: TallyDetail[];
}

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
  const [importResult, setImportResult] = useState<{ total: number; success: number; created: number; updated: number; rejected: { row: number; reason: string }[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ctdmsFileRef = useRef<HTMLInputElement>(null);
  const [ctdmsResult, setCtdmsResult] = useState<{ total: number; converted: number; notFound: number } | null>(null);
  const [uploadingCtdms, setUploadingCtdms] = useState(false);
  const tallyFileRef = useRef<HTMLInputElement>(null);
  const [tallyResult, setTallyResult] = useState<TallyResult | null>(null);
  const [uploadingTally, setUploadingTally] = useState(false);
  const [showTallyReport, setShowTallyReport] = useState(false);
  const limit = 50;

  // Filters
  const [filters, setFilters] = useState({ chassis: '', model: '', stockStatus: '' });

  // Admin block on behalf of user
  const [adminBlockVehicle, setAdminBlockVehicle] = useState<Vehicle | null>(null);
  const [adminBlockStep, setAdminBlockStep] = useState<1 | 2>(1);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [adminBlockForm, setAdminBlockForm] = useState({
    orderId: '', customerName: '', consultantName: '', teamLeaderName: '',
    paymentMode: 'CASH' as 'CASH' | 'FINANCE',
    amountReceived: '',
    financeType: '' as '' | 'IN_HOUSE' | 'OUTHOUSE',
    financierBank: '',
    paymentStatus: 'Full payment received',
    expectedBillingDate: '',
  });
  const [submittingAdminBlock, setSubmittingAdminBlock] = useState(false);
  const [orderIdError, setOrderIdError] = useState('');

  // Manual entry state
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [savingManual, setSavingManual] = useState(false);
  const [carModels, setCarModels] = useState<CarModel[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const fetchVehicles = useCallback(async (p = page) => {
    const params = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (filters.chassis) params.set('chassis', filters.chassis);
    if (filters.model) params.set('model', filters.model);
    if (filters.stockStatus) params.set('stockStatus', filters.stockStatus);
    const { data } = await api.get(`/stock?${params}`);
    setVehicles(data.vehicles);
    setTotal(data.total);
  }, [page, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

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

  const handleTallyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTally(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post('/stock/tally-done', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setTallyResult(data);
      setShowTallyReport(true);
      toast.success(`Tally Done: ${data.successful} delivered successfully`);
      fetchVehicles(1); setPage(1);
    } catch { toast.error('Tally Done upload failed'); }
    finally { setUploadingTally(false); if (tallyFileRef.current) tallyFileRef.current.value = ''; }
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

  const openAdminBlock = async (v: Vehicle) => {
    setAdminBlockVehicle(v);
    setAdminBlockStep(1);
    setSelectedUserId('');
    setAdminBlockForm({ orderId: '', customerName: '', consultantName: '', teamLeaderName: '', paymentMode: 'CASH', amountReceived: '', financeType: '', financierBank: '', paymentStatus: 'Full payment received', expectedBillingDate: '' });
    setOrderIdError('');
    if (salesUsers.length === 0) {
      const { data } = await api.get('/users');
      setSalesUsers((data as SalesUser[]).filter((u) => u.role === 'SALES_MANAGER' && u.isActive !== false));
    }
  };

  const handleAdminBlockSubmit = async () => {
    if (!/^\d{7}$/.test(adminBlockForm.orderId)) { setOrderIdError('Order ID must be exactly 7 digits'); return; }
    if (!adminBlockVehicle || !selectedUserId) return;
    setSubmittingAdminBlock(true);
    const financierBank = adminBlockForm.paymentMode === 'FINANCE'
      ? (adminBlockForm.financeType === 'IN_HOUSE' ? 'In-House' : adminBlockForm.financierBank)
      : undefined;
    try {
      await api.post('/blocking/admin-block', {
        vehicleId: adminBlockVehicle.id,
        onBehalfOfUserId: selectedUserId,
        orderId: adminBlockForm.orderId,
        customerName: adminBlockForm.customerName,
        consultantName: adminBlockForm.consultantName,
        teamLeaderName: adminBlockForm.teamLeaderName || undefined,
        paymentMode: adminBlockForm.paymentMode,
        amountReceived: adminBlockForm.paymentMode === 'CASH' && adminBlockForm.amountReceived ? parseFloat(adminBlockForm.amountReceived) : undefined,
        financierBank,
        paymentStatus: adminBlockForm.paymentStatus,
        expectedBillingDate: adminBlockForm.expectedBillingDate ? new Date(adminBlockForm.expectedBillingDate).toISOString() : undefined,
      });
      toast.success('Vehicle blocked successfully');
      setAdminBlockVehicle(null);
      fetchVehicles(1); setPage(1);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Block failed');
    } finally { setSubmittingAdminBlock(false); }
  };

  const abf = (partial: Partial<typeof adminBlockForm>) => setAdminBlockForm((f) => ({ ...f, ...partial }));

  const adminBlockFormValid =
    /^\d{7}$/.test(adminBlockForm.orderId) &&
    adminBlockForm.customerName &&
    adminBlockForm.consultantName &&
    adminBlockForm.paymentStatus &&
    (adminBlockForm.paymentMode === 'CASH'
      ? !!adminBlockForm.amountReceived
      : adminBlockForm.financeType !== '' && !!adminBlockForm.financierBank);

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
          {/* Tally Done — bulk deliver from Tally invoice export */}
          <input ref={tallyFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleTallyUpload} />
          <button onClick={() => tallyFileRef.current?.click()} disabled={uploadingTally} className="btn-secondary gap-2" style={{ borderColor: '#34d399', color: '#34d399' }}>
            <span className="material-symbols-outlined text-sm">receipt_long</span>
            {uploadingTally ? 'Processing…' : 'Tally Done'}
          </button>
          {tallyResult && (
            <button onClick={() => setShowTallyReport(true)} className="btn-secondary gap-2 text-xs" style={{ borderColor: '#34d399', color: '#34d399' }}>
              <span className="material-symbols-outlined text-sm">summarize</span>
              View Report
            </button>
          )}
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
            <div className="flex gap-4 mt-1">
              <span className="text-xs font-label text-green-400">✚ {importResult.created} new</span>
              <span className="text-xs font-label text-primary">↺ {importResult.updated} already in stock (updated)</span>
              {importResult.rejected.length > 0 && <span className="text-xs font-label text-tertiary">✕ {importResult.rejected.length} rejected</span>}
            </div>
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

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">pin</span>
          <input
            className="input pl-10 w-52"
            placeholder="Chassis Number…"
            value={filters.chassis}
            onChange={(e) => { setFilters((f) => ({ ...f, chassis: e.target.value })); setPage(1); }}
          />
        </div>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
          <input
            className="input pl-10 w-44"
            placeholder="Model…"
            value={filters.model}
            onChange={(e) => { setFilters((f) => ({ ...f, model: e.target.value })); setPage(1); }}
          />
        </div>
        <div className="relative">
          <select
            className="input appearance-none pr-8 w-40"
            value={filters.stockStatus}
            onChange={(e) => { setFilters((f) => ({ ...f, stockStatus: e.target.value })); setPage(1); }}
          >
            <option value="">All Stock Status</option>
            <option value="BND">BND</option>
            <option value="CTDMS">CTDMS</option>
            <option value="MDDP">MDDP</option>
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
        </div>
        {(filters.chassis || filters.model || filters.stockStatus) && (
          <button
            onClick={() => { setFilters({ chassis: '', model: '', stockStatus: '' }); setPage(1); }}
            className="text-tertiary hover:text-on-surface text-xs font-bold font-label uppercase tracking-wider transition-colors"
          >
            Clear Filters
          </button>
        )}
        <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest ml-auto">{total} vehicles</span>
      </div>

      {/* Table */}
      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                {['Chassis No.', 'Year', 'Model', 'Suffix', 'Colour', 'Stock Status', 'Yard Location', 'Arrived', 'Status', 'Blocked By', '', 'Heatmap'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-20 text-center">
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
                    {v.status === 'OPEN' && (
                      <button
                        onClick={() => openAdminBlock(v)}
                        className="flex items-center gap-1 text-[10px] font-label font-bold uppercase tracking-wider px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">lock</span>
                        Block
                      </button>
                    )}
                  </td>
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

      {/* Admin Block on Behalf Modal */}
      {adminBlockVehicle && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setAdminBlockVehicle(null)}>
          <div className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="flex justify-between items-start px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(67,70,86,0.12)' }}>
              <div>
                <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-on-surface">Block Vehicle</h2>
                <p className="font-label text-xs text-on-surface-variant mt-0.5">
                  {adminBlockVehicle.model} {adminBlockVehicle.suffix} · {adminBlockVehicle.colour} · <span className="font-mono">{adminBlockVehicle.chassisNumber}</span>
                </p>
              </div>
              <button onClick={() => setAdminBlockVehicle(null)} className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex px-6 pt-4 gap-3 flex-shrink-0">
              {[{ n: 1, label: 'Select User' }, { n: 2, label: 'Block Details' }].map((s) => (
                <div key={s.n} className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black font-headline ${adminBlockStep >= s.n ? 'bg-primary text-on-primary' : 'bg-surface-container text-zinc-500'}`}>{s.n}</div>
                  <span className={`text-[10px] font-label uppercase tracking-wider ${adminBlockStep >= s.n ? 'text-primary' : 'text-zinc-600'}`}>{s.label}</span>
                  {s.n < 2 && <span className="text-zinc-700 text-xs ml-1">›</span>}
                </div>
              ))}
            </div>

            {/* Step 1: Select User */}
            {adminBlockStep === 1 && (
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <p className="text-xs text-on-surface-variant font-label">Select the sales manager this block will be created under:</p>
                <div className="space-y-2">
                  {salesUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUserId(u.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all border ${selectedUserId === u.id ? 'border-primary bg-primary/10' : 'border-zinc-700/50 hover:border-zinc-500 bg-surface-container'}`}
                    >
                      <p className={`font-headline font-bold text-sm uppercase tracking-tight ${selectedUserId === u.id ? 'text-primary' : 'text-on-surface'}`}>{u.fullName}</p>
                      <p className="text-[10px] font-label text-zinc-500 mt-0.5">{u.loginId}{u.branch ? ` · ${u.branch.name}` : ' · No branch'}</p>
                    </button>
                  ))}
                  {salesUsers.length === 0 && <p className="text-xs text-zinc-500 font-label">No active sales managers found.</p>}
                </div>
              </div>
            )}

            {/* Step 2: Block Details Form */}
            {adminBlockStep === 2 && (
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {/* Order ID */}
                <div>
                  <label className="label">Order ID * <span className="text-zinc-500 normal-case font-normal">(7 digits)</span></label>
                  <input
                    className={`input font-mono ${orderIdError ? 'border-red-500' : ''}`}
                    placeholder="0000000" maxLength={7}
                    value={adminBlockForm.orderId}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 7); abf({ orderId: v }); setOrderIdError(v.length > 0 && !/^\d{7}$/.test(v) ? 'Must be exactly 7 digits' : ''); }}
                  />
                  {orderIdError && <p className="text-xs text-red-400 mt-1">{orderIdError}</p>}
                </div>
                {/* Customer + Consultant */}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Customer Name *</label><input className="input" value={adminBlockForm.customerName} onChange={(e) => abf({ customerName: e.target.value })} /></div>
                  <div><label className="label">Consultant Name *</label><input className="input" value={adminBlockForm.consultantName} onChange={(e) => abf({ consultantName: e.target.value })} /></div>
                </div>
                {/* Team Leader */}
                <div><label className="label">Team Leader <span className="text-zinc-500 normal-case font-normal">(optional)</span></label><input className="input" value={adminBlockForm.teamLeaderName} onChange={(e) => abf({ teamLeaderName: e.target.value })} /></div>
                {/* Payment Mode */}
                <div>
                  <label className="label">Payment Method</label>
                  <div className="grid grid-cols-2 p-1 bg-surface-container-lowest rounded-xl">
                    {(['CASH', 'FINANCE'] as const).map((mode) => (
                      <button key={mode} type="button" onClick={() => abf({ paymentMode: mode, financeType: '', financierBank: '' })}
                        className={`py-2 rounded-lg text-xs font-headline font-bold tracking-tight transition-all ${adminBlockForm.paymentMode === mode ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-on-surface'}`}>
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
                {adminBlockForm.paymentMode === 'CASH' && (
                  <div><label className="label">Amount Received (₹) *</label><input className="input" type="number" min="0" value={adminBlockForm.amountReceived} onChange={(e) => abf({ amountReceived: e.target.value })} /></div>
                )}
                {adminBlockForm.paymentMode === 'FINANCE' && (
                  <>
                    <div>
                      <label className="label">Finance Type *</label>
                      <div className="relative">
                        <select className="input appearance-none pr-8" value={adminBlockForm.financeType} onChange={(e) => abf({ financeType: e.target.value as '' | 'IN_HOUSE' | 'OUTHOUSE', financierBank: '' })}>
                          <option value="">Select finance type…</option>
                          <option value="IN_HOUSE">In-House</option>
                          <option value="OUTHOUSE">Outhouse</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                      </div>
                    </div>
                    {adminBlockForm.financeType !== '' && (
                      <div><label className="label">Financier Bank *</label><input className="input" placeholder={adminBlockForm.financeType === 'IN_HOUSE' ? 'e.g. Nippon In-House Finance' : 'Bank name'} value={adminBlockForm.financierBank} onChange={(e) => abf({ financierBank: e.target.value })} /></div>
                    )}
                  </>
                )}
                {/* Payment Status */}
                <div>
                  <label className="label">Payment Status *</label>
                  <div className="relative">
                    <select className="input appearance-none pr-8" value={adminBlockForm.paymentStatus} onChange={(e) => abf({ paymentStatus: e.target.value })}>
                      <option>Full payment received</option>
                      <option>Only Booking Received</option>
                      <option>Part payment received</option>
                      <option>Ready for Disbursement</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                  </div>
                </div>
                {/* Billing Date */}
                <div><label className="label">Expected Billing Date <span className="text-zinc-500 normal-case font-normal">(optional)</span></label><input className="input" type="date" style={{ colorScheme: 'dark' }} value={adminBlockForm.expectedBillingDate} onChange={(e) => abf({ expectedBillingDate: e.target.value })} /></div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="px-6 py-4 flex gap-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(67,70,86,0.12)' }}>
              {adminBlockStep === 1 ? (
                <>
                  <button onClick={() => setAdminBlockVehicle(null)} className="btn-secondary flex-1 text-xs">Cancel</button>
                  <button disabled={!selectedUserId} onClick={() => setAdminBlockStep(2)} className="btn-primary flex-1 disabled:opacity-40">
                    Next →
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setAdminBlockStep(1)} className="btn-secondary flex-1 text-xs">← Back</button>
                  <button disabled={!adminBlockFormValid || submittingAdminBlock} onClick={handleAdminBlockSubmit} className="btn-primary flex-1 disabled:opacity-40">
                    {submittingAdminBlock ? 'Blocking…' : 'Confirm Block'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tally Done Report Modal */}
      {showTallyReport && tallyResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowTallyReport(false)}>
          <div className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(67,70,86,0.12)' }}>
              <div>
                <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-on-surface">Tally Done Report</h2>
                <p className="text-xs text-on-surface-variant font-label mt-0.5">{tallyResult.total} rows processed</p>
              </div>
              <button onClick={() => setShowTallyReport(false)} className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3 p-6 flex-shrink-0">
              <div className="bg-green-900/20 rounded-xl p-4 text-center" style={{ border: '1px solid rgba(52,211,153,0.2)' }}>
                <p className="text-3xl font-headline font-extrabold text-green-400">{tallyResult.successful}</p>
                <p className="text-[10px] font-label font-black uppercase tracking-widest text-green-400/70 mt-1">Successful</p>
              </div>
              <div className="bg-tertiary-container/10 rounded-xl p-4 text-center" style={{ border: '1px solid rgba(215,26,24,0.2)' }}>
                <p className="text-3xl font-headline font-extrabold text-tertiary">{tallyResult.notFound}</p>
                <p className="text-[10px] font-label font-black uppercase tracking-widest text-tertiary/70 mt-1">Not Found</p>
              </div>
              <div className="bg-surface-container rounded-xl p-4 text-center" style={{ border: '1px solid rgba(67,70,86,0.2)' }}>
                <p className="text-3xl font-headline font-extrabold text-zinc-400">{tallyResult.noBlocking}</p>
                <p className="text-[10px] font-label font-black uppercase tracking-widest text-zinc-500 mt-1">No Blocking</p>
              </div>
              <div className="bg-orange-900/20 rounded-xl p-4 text-center" style={{ border: '1px solid rgba(251,146,60,0.2)' }}>
                <p className="text-3xl font-headline font-extrabold text-orange-400">{tallyResult.branchMismatch}</p>
                <p className="text-[10px] font-label font-black uppercase tracking-widest text-orange-400/70 mt-1">Branch Mismatch</p>
              </div>
            </div>

            {/* Detail rows */}
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
                  {tallyResult.details.map((d) => {
                    const colorMap = {
                      success: 'text-green-400',
                      not_found: 'text-tertiary',
                      no_blocking: 'text-zinc-400',
                      branch_mismatch: 'text-orange-400',
                      skipped: 'text-zinc-600',
                    };
                    const labelMap = {
                      success: 'Delivered ✓',
                      not_found: 'Not Found',
                      no_blocking: 'No Blocking',
                      branch_mismatch: 'Branch Mismatch',
                      skipped: 'Skipped',
                    };
                    return (
                      <tr key={d.row} style={{ borderBottom: '1px solid rgba(67,70,86,0.06)' }}>
                        <td className="py-2 pr-4 text-zinc-600">{d.row}</td>
                        <td className="py-2 pr-4 font-mono text-on-surface-variant">{d.chassisNumber || '—'}</td>
                        <td className={`py-2 pr-4 font-bold font-label uppercase tracking-wider ${colorMap[d.status]}`}>{labelMap[d.status]}</td>
                        <td className="py-2 text-zinc-500">{d.note ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
