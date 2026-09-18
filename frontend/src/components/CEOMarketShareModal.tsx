import React, { useEffect, useState } from 'react';
import api from '../api';

// Core layout and target definitions
const CLUSTER_SKELETON = [
  {
    cluster: 'Cochin Cluster (Biju)',
    branches: [
      { name: 'Kalamassery', dataKey: 'Kalamassery', targetPct: 11 },
      { name: 'Nettoor', dataKey: 'Nettoor', targetPct: 14 },
      { name: 'Kayamkulam', dataKey: 'Kayamkulam', targetPct: 8 }
    ]
  },
  {
    cluster: 'Trivandrum Cluster (Praveen)',
    branches: [
      { name: 'Kazhakoottam & Enjakkal', dataKey: 'Kazhakkottam & Enchakkal', targetPct: 11 },
      { name: 'Kollam', dataKey: 'Kollam', targetPct: 9 }
    ]
  },
  {
    cluster: 'Thrissur Cluster (Vinod)',
    branches: [
      { name: 'Trichur', dataKey: 'Trichur', targetPct: 11 },
      { name: 'Irinjalakuda', dataKey: 'Irinjalakuda', targetPct: 13 },
      { name: 'Muvattupuzha', dataKey: 'Muvattupuzha', targetPct: 9 }
    ]
  },
  {
    cluster: 'Kottayam Cluster (Nirmal)',
    branches: [
      { name: 'Kottayam', dataKey: 'Kottayam', targetPct: 10 },
      { name: 'Pathanamthitta', dataKey: 'Pathanamthitta', targetPct: 13 },
      { name: 'Thiruvalla', dataKey: 'Thiruvalla', targetPct: 14 }
    ]
  }
];

export default function CEOMarketShareModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [expandedClusters, setExpandedClusters] = useState<string[]>([]);
  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch Live Data
  useEffect(() => {
    if (isOpen && !apiData) {
      setLoading(true);
      api.get('/ceo/market-share-data')
        .then(res => {
          const data = res.data;
          setApiData(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch live market share data", err);
          setLoading(false);
        });
    }
  }, [isOpen, apiData]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleCluster = (clusterName: string) => {
    setExpandedClusters(prev => 
      prev.includes(clusterName) ? prev.filter(c => c !== clusterName) : [...prev, clusterName]
    );
  };

  // Helper to extract SEP data from the API JSON
  const getBranchData = (dataKey: string) => {
    if (!apiData || !apiData[dataKey]) return { tiv: 0, tally: 0 };
    const monthlyArray = apiData[dataKey].monthly2026 || [];
    const sepData = monthlyArray.find((m: any) => m.month === 'SEP');
    return sepData ? { tiv: sepData.tiv || 0, tally: sepData.toyota || 0 } : { tiv: 0, tally: 0 };
  };

  let grandTally = 0, grandTiv = 0, grandExpected = 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8 transition-opacity duration-300">
      <div className="bg-zinc-950 border border-zinc-800 shadow-2xl w-full h-full max-w-[1200px] flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-500 text-2xl">pie_chart</span>
            <h2 className="text-white font-headline font-bold text-lg tracking-wide uppercase">
              Live Market Share <span className="text-zinc-500 text-sm ml-2">(EXECUTIVE SUMMARY)</span>
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {loading && <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>}
            <button 
              onClick={onClose}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 p-2 transition-colors flex items-center justify-center rounded-lg"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto bg-[#120708] p-6 relative">
          <div className="bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden shadow-xl">
            <table className="w-full text-sm font-body">
              <thead className="bg-zinc-900 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 text-left font-label font-bold text-xs uppercase tracking-widest text-zinc-400">Location</th>
                  <th className="px-6 py-4 text-center font-label font-bold text-xs uppercase tracking-widest text-zinc-400">TIV</th>
                  <th className="px-6 py-4 text-center font-label font-bold text-xs uppercase tracking-widest text-emerald-400">NIPPON TALLY</th>
                  <th className="px-6 py-4 text-center font-label font-bold text-xs uppercase tracking-widest text-zinc-400">MS %</th>
                  <th className="px-6 py-4 text-center font-label font-bold text-xs uppercase tracking-widest text-blue-400">TARGET</th>
                  <th className="px-6 py-4 text-center font-label font-bold text-xs uppercase tracking-widest text-zinc-400">EXPECTED</th>
                  <th className="px-6 py-4 text-center font-label font-bold text-xs uppercase tracking-widest text-rose-400">GAP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {CLUSTER_SKELETON.map((clusterData) => {
                  
                  // Calculate live cluster totals
                  let clusterTally = 0, clusterTiv = 0, clusterExpected = 0;
                  
                  const liveBranches = clusterData.branches.map(b => {
                    const { tiv, tally } = getBranchData(b.dataKey);
                    const expected = Math.round(tiv * (b.targetPct / 100));
                    clusterTiv += tiv;
                    clusterTally += tally;
                    clusterExpected += expected;
                    return { ...b, tiv, tally, expected };
                  });
                  
                  const clusterShare = clusterTiv > 0 ? ((clusterTally / clusterTiv) * 100).toFixed(1) : '0.0';
                  const clusterTargetPct = clusterTiv > 0 ? ((clusterExpected / clusterTiv) * 100).toFixed(1) : '0.0';
                  const clusterGap = clusterExpected - clusterTally;
                  
                  grandTally += clusterTally;
                  grandTiv += clusterTiv;
                  grandExpected += clusterExpected;
                  
                  const isExpanded = expandedClusters.includes(clusterData.cluster);

                  return (
                    <React.Fragment key={clusterData.cluster}>
                      {/* Master Cluster Row */}
                      <tr 
                        onClick={() => toggleCluster(clusterData.cluster)}
                        className="group bg-zinc-950 hover:bg-zinc-900/80 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <span className={`material-symbols-outlined text-zinc-500 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                              chevron_right
                            </span>
                            <span className="font-headline font-bold text-white tracking-wide">{clusterData.cluster}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center font-medium text-zinc-400">{clusterTiv}</td>
                        <td className="px-6 py-5 text-center font-bold text-emerald-400 text-lg">{clusterTally}</td>
                        <td className="px-6 py-5 text-center font-bold text-white">{clusterShare}%</td>
                        <td className="px-6 py-5 text-center font-bold text-blue-400">{clusterTargetPct}%</td>
                        <td className="px-6 py-5 text-center font-medium text-zinc-400">{clusterExpected}</td>
                        <td className={`px-6 py-5 text-center font-bold text-lg ${clusterGap > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {clusterGap > 0 ? `-${clusterGap}` : `+${Math.abs(clusterGap)}`}
                        </td>
                      </tr>
                      
                      {/* Expanded Branch Rows */}
                      {isExpanded && liveBranches.map((branch) => {
                        const branchShare = branch.tiv > 0 ? ((branch.tally / branch.tiv) * 100).toFixed(1) : '0.0';
                        const branchGap = branch.expected - branch.tally;
                        
                        return (
                          <tr key={branch.name} className="bg-[#15151c]">
                            <td className="px-6 py-3 pl-16">
                              <span className="font-body text-zinc-400 font-medium">{branch.name}</span>
                            </td>
                            <td className="px-6 py-3 text-center text-zinc-500 text-sm">{branch.tiv}</td>
                            <td className="px-6 py-3 text-center text-emerald-500/80 font-bold">{branch.tally}</td>
                            <td className="px-6 py-3 text-center text-zinc-300 font-bold">{branchShare}%</td>
                            <td className="px-6 py-3 text-center text-blue-400/80 font-bold">{branch.targetPct}%</td>
                            <td className="px-6 py-3 text-center text-zinc-500">{branch.expected}</td>
                            <td className={`px-6 py-3 text-center font-bold ${branchGap > 0 ? 'text-rose-500/80' : 'text-emerald-500/80'}`}>
                              {branchGap > 0 ? `-${branchGap}` : `+${Math.abs(branchGap)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                
                {/* Grand Total Row */}
                <tr className="bg-zinc-900">
                  <td className="px-6 py-6 text-right font-headline font-bold text-emerald-500 tracking-widest uppercase">
                    Grand Total
                  </td>
                  <td className="px-6 py-6 text-center font-bold text-zinc-300 text-lg">{grandTiv}</td>
                  <td className="px-6 py-6 text-center font-bold text-emerald-400 text-2xl">{grandTally}</td>
                  <td className="px-6 py-6 text-center font-black text-white text-xl">
                    {grandTiv > 0 ? ((grandTally / grandTiv) * 100).toFixed(1) : '0.0'}%
                  </td>
                  <td className="px-6 py-6 text-center font-black text-blue-400 text-xl">
                    {grandTiv > 0 ? ((grandExpected / grandTiv) * 100).toFixed(1) : '0.0'}%
                  </td>
                  <td className="px-6 py-6 text-center font-bold text-zinc-300 text-lg">{grandExpected}</td>
                  <td className={`px-6 py-6 text-center font-black text-2xl ${(grandExpected - grandTally) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {(grandExpected - grandTally) > 0 ? `-${grandExpected - grandTally}` : `+${Math.abs(grandExpected - grandTally)}`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
