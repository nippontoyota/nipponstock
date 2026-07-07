import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../api';

interface User { id: string; loginId: string; fullName: string; role: string; branchId: string | null; clusterNumber: number | null; isActive: boolean; branch?: { name: string } | null; }
interface Branch { id: string; name: string; }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ loginId: '', password: '', fullName: '', role: 'SALES_MANAGER', branchId: '', clusterNumber: '' });
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    const [u, b] = await Promise.all([api.get('/users'), api.get('/branches')]);
    setUsers(u.data);
    setBranches(b.data);
  };
  useEffect(() => { fetch(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/users', {
        ...form,
        branchId: form.branchId || undefined,
        clusterNumber: form.clusterNumber ? parseInt(form.clusterNumber) : undefined,
      });
      toast.success('User created');
      setShowForm(false);
      setForm({ loginId: '', password: '', fullName: '', role: 'SALES_MANAGER', branchId: '', clusterNumber: '' });
      fetch();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: unknown } } }).response?.data?.error;
      const errMsg = typeof errData === 'string'
        ? errData
        : errData && typeof errData === 'object'
          ? Object.values((errData as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {}).flat().join(', ') || JSON.stringify(errData)
          : 'Failed to create user';
      toast.error(errMsg);
    } finally { setSaving(false); }
  };

  const toggleActive = async (u: User) => {
    await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
    toast.success(u.isActive ? 'Deactivated' : 'Activated');
    fetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Users</h1>
          <p className="text-on-surface-variant font-body text-sm">Manage all sales manager and admin accounts.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary gap-2">
          <span className="material-symbols-outlined text-sm">person_add</span>
          New User
        </button>
      </div>

      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        <table className="w-full text-sm font-body">
          <thead className="bg-surface-container">
            <tr>
              {['Login ID', 'Name', 'Role', 'Branch', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-surface-container transition-colors" style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }}>
                <td className="px-4 py-3 font-mono text-xs text-primary/80">{u.loginId}</td>
                <td className="px-4 py-3 font-headline font-bold text-on-surface tracking-tight">{u.fullName}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.role === 'ADMIN' ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>{u.role}</span>
                </td>
                <td className="px-4 py-3 text-on-surface-variant text-xs">
                  {u.role === 'CLUSTER_MANAGER'
                    ? (u.clusterNumber ? `Cluster ${u.clusterNumber}` : '—')
                    : (u.branch?.name ?? '—')}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${u.isActive ? 'bg-green-900/30 text-green-400' : 'bg-tertiary-container/20 text-tertiary'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(u)} className="text-[10px] font-label font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors">
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create user modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-surface-container-low rounded-xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-6 pb-4" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
              <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-on-surface">Create User</h2>
              <button onClick={() => setShowForm(false)} className="text-on-surface-variant hover:text-on-surface w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-high">
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div><label className="label">Login ID</label><input className="input" value={form.loginId} onChange={(e) => setForm((f) => ({ ...f, loginId: e.target.value }))} /></div>
              <div><label className="label">Full Name</label><input className="input" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} /></div>
              <div><label className="label">Password</label><input className="input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
              <div>
                <label className="label">Role</label>
                <div className="relative">
                  <select className="input appearance-none pr-8" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, branchId: '', clusterNumber: '' }))}>
                    <option value="SALES_MANAGER">Sales Manager</option>
                    <option value="TEAM_LEADER">Team Leader</option>
                    <option value="FINANCE_OFFICER">Finance Officer</option>
                    <option value="FINANCE_HEAD">Finance Head</option>
                    <option value="CLUSTER_MANAGER">Cluster Manager</option>
                    <option value="CEO">CEO</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                </div>
              </div>
              {(form.role === 'SALES_MANAGER' || form.role === 'TEAM_LEADER' || form.role === 'FINANCE_OFFICER') && (
                <div>
                  <label className="label">Branch</label>
                  <div className="relative">
                    <select className="input appearance-none pr-8" value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value }))}>
                      <option value="">Select branch…</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                  </div>
                </div>
              )}
              {form.role === 'CLUSTER_MANAGER' && (
                <div>
                  <label className="label">Cluster Number</label>
                  <div className="relative">
                    <select className="input appearance-none pr-8" value={form.clusterNumber} onChange={(e) => setForm((f) => ({ ...f, clusterNumber: e.target.value }))}>
                      <option value="">Select cluster…</option>
                      <option value="1">Cluster 1 — CO01A, CO01B, KY01A</option>
                      <option value="2">Cluster 2 — TR01A, TR01C, KL01A</option>
                      <option value="3">Cluster 3 — IR01A, TI01A, MV01A</option>
                      <option value="4">Cluster 4 — KT01A, PH01A, TL01A</option>
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 pt-0">
              <button onClick={handleCreate} disabled={saving} className="btn-primary w-full">
                {saving ? 'Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
