import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';

interface UploadResult {
  total: number;
  success: number;
  created: number;
  updated: number;
  rejected: { row: number; reason: string }[];
}

export default function MaskedUploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post('/stock/import-masked', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      toast.success(`Imported: ${data.created} created, ${data.updated} updated`);
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Upload failed');
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-headline font-bold tracking-tighter uppercase mb-2">
          Upload <span className="text-primary">Masked Vehicles</span>
        </h1>
        <p className="text-on-surface-variant font-body text-sm">
          Import INN / FRN / IMV vehicles. Chassis numbers will be hidden from SM/TL until Full Payment Received.
          On Full Payment, the system auto-assigns the nearest CTDMS/BND unit of the same variant.
        </p>
      </div>

      {/* Format guide */}
      <div className="bg-surface-container rounded-2xl p-5 mb-6 border border-outline-variant/20">
        <p className="text-[10px] font-label uppercase tracking-widest text-primary mb-3">Required Excel Columns</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
          {['chassisNumber', 'chassisYear', 'model', 'suffix', 'colour', 'stockyardLocation', 'dateOfArrival', 'stockStatus (opt)'].map((c) => (
            <span key={c} className="bg-surface-container-high px-2 py-1 rounded text-zinc-300">{c}</span>
          ))}
        </div>
        <p className="text-[10px] text-zinc-500 mt-3">Model must be INN, FRN, or IMV. stockStatus optional (BND / MDDP / CTDMS).</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          dragOver ? 'border-primary bg-primary/5' : 'border-outline-variant/40 hover:border-primary/50 hover:bg-surface-container'
        }`}
      >
        <span className="material-symbols-outlined text-4xl text-primary mb-3 block" style={{ fontVariationSettings: "'FILL' 1" }}>upload_file</span>
        {loading
          ? <p className="text-on-surface-variant text-sm">Importing…</p>
          : <><p className="font-headline font-bold text-on-surface">Drop Excel file here</p>
            <p className="text-xs text-zinc-500 mt-1">or click to browse</p></>
        }
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
      </div>

      {/* Result */}
      {result && (
        <div className="mt-6 bg-surface-container rounded-2xl p-5 border border-outline-variant/20">
          <p className="text-[10px] font-label uppercase tracking-widest text-primary mb-4">Import Result</p>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Total Rows', val: result.total },
              { label: 'Created', val: result.created, color: 'text-green-400' },
              { label: 'Updated', val: result.updated, color: 'text-blue-400' },
              { label: 'Rejected', val: result.rejected.length, color: result.rejected.length > 0 ? 'text-red-400' : 'text-zinc-400' },
            ].map((s) => (
              <div key={s.label} className="bg-surface-container-high rounded-xl p-3 text-center">
                <p className={`font-headline font-black text-2xl ${s.color ?? 'text-on-surface'}`}>{s.val}</p>
                <p className="text-[10px] font-label uppercase tracking-widest text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>
          {result.rejected.length > 0 && (
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
              <p className="text-[10px] font-label uppercase tracking-widest text-red-400 mb-2">Rejected Rows</p>
              {result.rejected.map((r) => (
                <div key={r.row} className="text-xs text-zinc-400 bg-surface-container-high rounded px-3 py-1.5 mb-1">
                  <span className="text-red-400 font-bold mr-2">Row {r.row}</span>{r.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
