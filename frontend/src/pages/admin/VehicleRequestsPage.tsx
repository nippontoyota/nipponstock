import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import api from '../../api';

interface VehicleRequest {
  id: string;
  model: string;
  suffix: string;
  colour: string;
  notes: string | null;
  status: string;
  createdAt: string;
  user: { fullName: string; loginId: string };
  branch: { name: string };
}

const statusColor: Record<string, string> = {
  PENDING: 'bg-primary/10 text-primary',
  APPROVED: 'bg-green-900/30 text-green-400',
  REJECTED: 'bg-red-900/30 text-red-400',
  FULFILLED: 'bg-surface-container text-zinc-400',
};

const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED', 'FULFILLED'];

export default function VehicleRequestsPage() {
  const [requests, setRequests] = useState<VehicleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data } = await api.get('/vehicle-requests');
    setRequests(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await api.patch(`/vehicle-requests/${id}`, { status });
      toast.success(`Status updated to ${status}`);
      fetchRequests();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = filterStatus ? requests.filter((r) => r.status === filterStatus) : requests;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Vehicle Requests</h1>
        <p className="text-on-surface-variant font-body text-sm">Review and action vehicle requests submitted by sales managers.</p>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative">
          <select
            className="input appearance-none pr-8 w-44"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
        </div>
        <span className="font-label text-xs text-on-surface-variant uppercase tracking-widest">{filtered.length} requests</span>
      </div>

      <div className="bg-surface-container-low rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead className="bg-surface-container">
              <tr>
                {['Branch', 'Sales Manager', 'Model', 'Suffix', 'Colour', 'Notes', 'Status', 'Requested', 'Action'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-label font-black text-zinc-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-16 text-center text-on-surface-variant font-label uppercase tracking-widest text-xs">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-16 text-center text-on-surface-variant font-label uppercase tracking-widest text-xs">No requests found</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-surface-container transition-colors" style={{ borderBottom: '1px solid rgba(67,70,86,0.08)' }}>
                  <td className="px-4 py-3 font-bold font-headline text-xs tracking-tight text-on-surface">{r.branch.name}</td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs">{r.user.fullName}</td>
                  <td className="px-4 py-3 font-medium text-on-surface">{r.model}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{r.suffix}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{r.colour}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 max-w-xs truncate">{r.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusColor[r.status] ?? 'bg-surface-container text-zinc-500'}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant whitespace-nowrap">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</td>
                  <td className="px-4 py-3">
                    {r.status === 'PENDING' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus(r.id, 'APPROVED')}
                          disabled={updatingId === r.id}
                          className="text-xs font-bold font-label uppercase tracking-widest text-green-400 hover:text-green-300 transition-colors disabled:opacity-40"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => updateStatus(r.id, 'REJECTED')}
                          disabled={updatingId === r.id}
                          className="text-xs font-bold font-label uppercase tracking-widest text-red-400 hover:text-red-300 transition-colors disabled:opacity-40"
                        >
                          Reject
                        </button>
                      </div>
                    ) : r.status === 'APPROVED' ? (
                      <button
                        onClick={() => updateStatus(r.id, 'FULFILLED')}
                        disabled={updatingId === r.id}
                        className="text-xs font-bold font-label uppercase tracking-widest text-primary hover:text-on-primary-container transition-colors disabled:opacity-40"
                      >
                        Mark Fulfilled
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
