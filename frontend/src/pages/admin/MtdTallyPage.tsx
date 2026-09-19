import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';

interface Row { display: string; branchCode: string; target: number; mtdTally: number; }

export default function MtdTallyPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/admin/mtd-tally');
    setRows(data);
    setDirty(false);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const updateField = (branchCode: string, field: 'target' | 'mtdTally', value: string) => {
    const num = value === '' ? 0 : Math.max(0, parseInt(value, 10) || 0);
    setRows((rs) => rs.map((r) => (r.branchCode === branchCode ? { ...r, [field]: num } : r)));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/mtd-tally', {
        rows: rows.map((r) => ({ branchCode: r.branchCode, target: r.target, mtdTally: r.mtdTally })),
      });
      toast.success('MTD Tally saved — synced to CEO dashboard');
      setDirty(false);
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const totals = rows.reduce(
    (acc, r) => ({ target: acc.target + r.target, mtdTally: acc.mtdTally + r.mtdTally }),
    { target: 0, mtdTally: 0 }
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-primary text-4xl">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">MTD Tally</h1>
          <p className="text-on-surface-variant font-body text-sm">Edit branch targets and MTD tally figures — synced live to the CEO dashboard.</p>
        </div>
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="btn-primary disabled:opacity-40 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">{saving ? 'sync' : 'save'}</span>
          {saving ? 'Saving…' : 'Save & Sync'}
        </button>
      </div>

      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        <table className="w-full text-sm font-body">
          <thead className="bg-surface-container">
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-label font-black uppercase tracking-widest text-zinc-400">Branch</th>
              <th className="px-4 py-3 text-center text-[10px] font-label font-black uppercase tracking-widest text-zinc-400">MTD Target</th>
              <th className="px-4 py-3 text-center text-[10px] font-label font-black uppercase tracking-widest text-zinc-400">MTD Tally</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.branchCode} style={{ borderBottom: '1px solid rgba(67,70,86,0.08)', background: i % 2 === 0 ? 'transparent' : 'rgba(67,70,86,0.03)' }}>
                <td className="px-4 py-2 font-headline font-bold text-on-surface">{r.display}</td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    className="input text-center w-28 mx-auto block"
                    value={r.target}
                    onChange={(e) => updateField(r.branchCode, 'target', e.target.value)}
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    type="number"
                    min={0}
                    className="input text-center w-28 mx-auto block"
                    value={r.mtdTally}
                    onChange={(e) => updateField(r.branchCode, 'mtdTally', e.target.value)}
                  />
                </td>
              </tr>
            ))}
            <tr className="bg-surface-container">
              <td className="px-4 py-3 font-headline font-bold text-primary uppercase text-xs tracking-widest">Total</td>
              <td className="px-4 py-3 text-center font-bold text-primary">{totals.target}</td>
              <td className="px-4 py-3 text-center font-bold text-primary">{totals.mtdTally}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
