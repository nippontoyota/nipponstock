import { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';

interface SalesReferral {
  id: string;
  customer_name: string;
  customer_phone: string;
  interested_model: string;
  referring_employee_id: string;
  referring_employee_name: string;
  referring_employee_phone?: string;
  referring_employee_dept?: string;
  referring_employee_branch?: string;
  branch_name?: string;
  submitted_at: string;
}

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<SalesReferral[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      const res = await api.get('/webhooks/sales-referrals');
      setReferrals(res.data);
    } catch {
      toast.error('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-headline font-bold uppercase tracking-tight text-white">
            HR Sales Referrals
          </h1>
          <p className="text-xs text-zinc-400 font-label mt-1">
            Customer leads referred by employees via WhatsApp
          </p>
        </div>
        <button
          onClick={fetchReferrals}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition-colors font-headline"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          Refresh
        </button>
      </div>

      {/* Referrals List Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-zinc-500 text-sm">Loading referrals...</div>
        ) : referrals.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">No referrals found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-body border-collapse">
              <thead className="bg-zinc-950/80 border-b border-zinc-800 text-[11px] font-label font-bold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Customer Name</th>
                  <th className="px-5 py-3.5">Phone Number</th>
                  <th className="px-5 py-3.5">Interested Model</th>
                  <th className="px-5 py-3.5">Employee ID</th>
                  <th className="px-5 py-3.5">Referred By</th>
                  <th className="px-5 py-3.5">Branch</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {referrals.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-800/40 transition-colors">
                    {/* Customer Name */}
                    <td className="px-5 py-3.5 font-bold text-white text-sm">
                      {r.customer_name}
                    </td>

                    {/* Customer Phone */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${r.customer_phone}`}
                          className="font-mono text-zinc-200 hover:text-primary transition-colors font-medium"
                        >
                          {r.customer_phone}
                        </a>
                        <a
                          href={`https://wa.me/91${r.customer_phone.replace(/\D/g, '').slice(-10)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 transition-colors p-1"
                          title="Chat on WhatsApp"
                        >
                          <span className="material-symbols-outlined text-base leading-none">chat</span>
                        </a>
                      </div>
                    </td>

                    {/* Interested Model */}
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-zinc-200 uppercase tracking-wide">
                        {r.interested_model || '—'}
                      </span>
                    </td>

                    {/* Employee ID */}
                    <td className="px-5 py-3.5">
                      <span className="font-mono font-bold text-white text-sm bg-zinc-800/80 px-2.5 py-1 rounded border border-zinc-700/60 inline-block">
                        {r.referring_employee_id || '—'}
                      </span>
                    </td>

                    {/* Referred By */}
                    <td className="px-5 py-3.5 text-white font-medium text-sm">
                      {r.referring_employee_name || '—'}
                    </td>

                    {/* Branch */}
                    <td className="px-5 py-3.5 text-zinc-300">
                      {r.referring_employee_branch || r.branch_name || '—'}
                    </td>

                    {/* Department */}
                    <td className="px-5 py-3.5 text-zinc-400">
                      {r.referring_employee_dept || '—'}
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5 text-zinc-400 whitespace-nowrap">
                      {formatDate(r.submitted_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
