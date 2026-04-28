import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';

interface Branch { id: string; name: string; branchCode: string | null; location: string; }

const emptyForm = { name: '', branchCode: '', location: '' };

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchBranches = async () => {
    const { data } = await api.get('/branches');
    setBranches(data);
  };
  useEffect(() => { fetchBranches(); }, []);

  const openCreate = () => { setEditTarget(null); setForm(emptyForm); setShowForm(true); };
  const openEdit = (b: Branch) => {
    setEditTarget(b);
    setForm({ name: b.name, branchCode: b.branchCode ?? '', location: b.location });
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditTarget(null); };

  const handleSave = async () => {
    if (!form.name || !form.branchCode || !form.location) { toast.error('All fields are required'); return; }
    setSaving(true);
    try {
      if (editTarget) {
        await api.patch(`/branches/${editTarget.id}`, form);
        toast.success('Branch updated');
      } else {
        await api.post('/branches', form);
        toast.success('Branch created');
      }
      closeForm();
      fetchBranches();
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (b: Branch) => {
    if (!confirm(`Delete branch "${b.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/branches/${b.id}`);
      toast.success('Branch deleted');
      fetchBranches();
    } catch {
      toast.error('Cannot delete — branch may have users or blockings attached');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Branches</h1>
          <p className="text-on-surface-variant font-body text-sm">Manage all dealership branches and their codes.</p>
        </div>
        <button onClick={openCreate} className="btn-primary gap-2">
          <span className="material-symbols-outlined text-sm">add_business</span>
          New Branch
        </button>
      </div>

      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        <table className="w-full text-sm font-body">
          <thead className="bg-surface-container">
            <tr>
              {['Branch Code', 'Branch Name', 'Location', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-20 text-center">
                  <span className="material-symbols-outlined text-4xl text-zinc-700 block mb-3">corporate_fare</span>
                  <p className="text-on-surface-variant font-label text-xs uppercase tracking-widest">No branches yet. Create your first branch.</p>
                </td>
              </tr>
            ) : branches.map((b) => (
              <tr key={b.id} className="hover:bg-surface-container transition-colors" style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }}>
                <td className="px-4 py-3 font-mono text-xs text-primary/80">{b.branchCode ?? '—'}</td>
                <td className="px-4 py-3 font-headline font-bold text-on-surface tracking-tight">{b.name}</td>
                <td className="px-4 py-3 text-on-surface-variant text-xs">{b.location}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => openEdit(b)} className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary transition-colors">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(b)} className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-tertiary transition-colors">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={closeForm}>
          <div className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 pb-4" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
              <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-on-surface">
                {editTarget ? 'Edit Branch' : 'New Branch'}
              </h2>
              <button onClick={closeForm} className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="label">Branch Code</label>
                <input className="input" placeholder="e.g. BRC-01" value={form.branchCode} onChange={(e) => setForm((f) => ({ ...f, branchCode: e.target.value }))} />
              </div>
              <div>
                <label className="label">Branch Name</label>
                <input className="input" placeholder="e.g. Kuala Lumpur HQ" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Location</label>
                <input className="input" placeholder="e.g. Jalan Ampang, KL" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
            </div>

            <div className="p-6 pt-0">
              <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Branch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
