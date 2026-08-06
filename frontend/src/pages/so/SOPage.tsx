import { useEffect, useState, useCallback } from 'react';
import api from '../../api';
import socket from '../../socket';
import { getVehicleIncentive } from '../../lib/vehicleIncentives';

interface HeatmapCell {
  model: string;
  suffix: string;
  colour: string;
  open: number;
  total: number;
  level: 'green' | 'yellow' | 'red';
  hasPhysical: boolean;
  yearBreakdown: { chassisYear: number; open: number; total: number; level: 'green' | 'yellow' | 'red'; hasPhysical: boolean }[];
}

interface OpenVehicle {
  id: string;
  chassisNumber: string;
  model: string;
  suffix: string;
  colour: string;
  chassisYear: number;
  stockStatus: string | null;
}

const cellBg = { green: '#16a34a', yellow: '#ca8a04', red: '#dc2626' };
const levelLabel = { green: 'High (>5 units)', yellow: 'Medium (3–4 units)', red: 'Critical (≤2 units)' };

export default function SOPage() {
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);

  const [selYear, setSelYear] = useState('');
  const [selModel, setSelModel] = useState('');
  const [selSuffix, setSelSuffix] = useState('');
  const [selColour, setSelColour] = useState('');

  const [openVehicles, setOpenVehicles] = useState<OpenVehicle[]>([]);
  const [incentiveLoading, setIncentiveLoading] = useState(false);

  const fetchHeatmap = useCallback(async (year?: string) => {
    setLoading(true);
    try {
      const params = year ? `?year=${year}` : '';
      const { data } = await api.get(`/stock/heatmap${params}`);
      setCells(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.get('/stock/years').then(({ data }) => setYearOptions(data));
  }, []);

  useEffect(() => {
    fetchHeatmap(selYear || undefined);
    setSelModel(''); setSelSuffix(''); setSelColour('');
    setOpenVehicles([]);
  }, [selYear, fetchHeatmap]);

  useEffect(() => {
    const handler = () => fetchHeatmap(selYear || undefined);
    socket.on('heatmap:update', handler);
    return () => { socket.off('heatmap:update', handler); };
  }, [selYear, fetchHeatmap]);

  // Fetch open vehicles when all 4 filters are selected
  useEffect(() => {
    if (!selModel || !selSuffix || !selColour) { setOpenVehicles([]); return; }
    setIncentiveLoading(true);
    const params = new URLSearchParams({ model: selModel, suffix: selSuffix, colour: selColour });
    if (selYear) params.set('year', selYear);
    api.get(`/stock/open?${params.toString()}`)
      .then(({ data }) => setOpenVehicles(data))
      .catch(() => setOpenVehicles([]))
      .finally(() => setIncentiveLoading(false));
  }, [selModel, selSuffix, selColour, selYear]);

  // Derived options from heatmap cells
  const models = [...new Set(cells.map((c) => c.model))].sort();
  const suffixes = selModel ? [...new Set(cells.filter((c) => c.model === selModel).map((c) => c.suffix))].sort() : [];
  const colours = (selModel && selSuffix)
    ? [...new Set(cells.filter((c) => c.model === selModel && c.suffix === selSuffix).map((c) => c.colour))].sort()
    : [];

  // Selected heatmap cell
  const selectedCell = selModel && selSuffix && selColour
    ? cells.find((c) => c.model === selModel && c.suffix === selSuffix && c.colour === selColour) ?? null
    : null;

  // Incentives from open vehicles
  const incentives = openVehicles
    .map((v) => getVehicleIncentive(v.chassisNumber))
    .filter(Boolean);

  // If all incentives have the same SO value, show it; otherwise show the range
  const soValues = [...new Set(incentives.map((i) => i!.so))];
  const customerSchemeValues = [...new Set(incentives.map((i) => i!.customerScheme))];
  const hasIncentiveData = incentives.length > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <section>
        <h2 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">
          Stock Availability
        </h2>
        <p className="text-on-surface-variant font-body text-sm tracking-tight">
          Select a vehicle configuration to check live availability and your SO incentive.
        </p>
      </section>

      {/* Selector card */}
      <section className="bg-surface-container-low rounded-xl p-6 space-y-5 border border-zinc-800/40">
        <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Select Configuration</h3>

        {/* YOM */}
        <div>
          <label className="label">Year of Manufacture (YOM)</label>
          <div className="relative">
            <select
              className="input appearance-none pr-8"
              value={selYear}
              onChange={(e) => { setSelYear(e.target.value); setSelModel(''); setSelSuffix(''); setSelColour(''); }}
            >
              <option value="">All Years</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="label">Model</label>
          <div className="relative">
            <select
              className="input appearance-none pr-8"
              value={selModel}
              onChange={(e) => { setSelModel(e.target.value); setSelSuffix(''); setSelColour(''); }}
              disabled={loading || models.length === 0}
            >
              <option value="">Select model…</option>
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
          </div>
        </div>

        {/* Suffix */}
        <div>
          <label className="label">Suffix / Variant</label>
          <div className="relative">
            <select
              className="input appearance-none pr-8"
              value={selSuffix}
              onChange={(e) => { setSelSuffix(e.target.value); setSelColour(''); }}
              disabled={!selModel || suffixes.length === 0}
            >
              <option value="">Select suffix…</option>
              {suffixes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
          </div>
        </div>

        {/* Colour */}
        <div>
          <label className="label">Colour</label>
          <div className="relative">
            <select
              className="input appearance-none pr-8"
              value={selColour}
              onChange={(e) => setSelColour(e.target.value)}
              disabled={!selSuffix || colours.length === 0}
            >
              <option value="">Select colour…</option>
              {colours.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-sm">expand_more</span>
          </div>
        </div>
      </section>

      {/* Result */}
      {selModel && selSuffix && selColour && (
        <section className="space-y-4">
          <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
            Result — {selModel} / {selSuffix} / {selColour}{selYear ? ` (YOM ${selYear})` : ''}
          </h3>

          {/* Availability */}
          <div className="bg-surface-container-low rounded-xl p-6 border border-zinc-800/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Availability</p>

            {selectedCell ? (
              <div className="flex items-center gap-6">
                {/* Coloured cell */}
                <div
                  className="w-24 h-20 rounded-lg flex items-end p-2 relative flex-shrink-0"
                  style={{ backgroundColor: cellBg[selectedCell.level] }}
                >
                  {selectedCell.hasPhysical && (
                    <span className="absolute bottom-2 left-2 text-sm font-black text-black/60 leading-none select-none">P</span>
                  )}
                  <span className="text-2xl font-headline font-black text-white/90 leading-none ml-auto">{selectedCell.open}</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cellBg[selectedCell.level] }} />
                    <span className="font-headline font-bold text-on-surface text-lg uppercase">{selectedCell.level === 'green' ? 'High' : selectedCell.level === 'yellow' ? 'Medium' : 'Critical'}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant font-body">{levelLabel[selectedCell.level]}</p>
                  <div className="flex gap-4 pt-1">
                    <div>
                      <span className="text-[10px] font-label uppercase tracking-wider text-zinc-500">Open</span>
                      <p className="font-headline font-bold text-on-surface">{selectedCell.open}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-label uppercase tracking-wider text-zinc-500">Total</span>
                      <p className="font-headline font-bold text-on-surface">{selectedCell.total}</p>
                    </div>
                    {selectedCell.hasPhysical && (
                      <div>
                        <span className="text-[10px] font-label uppercase tracking-wider text-zinc-500">Physical</span>
                        <p className="font-headline font-bold text-primary">P — Yes</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4 p-4 bg-surface-container-highest rounded-lg text-zinc-500">
                <span className="material-symbols-outlined text-2xl">inventory_2</span>
                <div>
                  <p className="font-bold text-sm">No stock available</p>
                  <p className="text-xs font-label">This variant has no open units{selYear ? ` for YOM ${selYear}` : ''}.</p>
                </div>
              </div>
            )}
          </div>

          {/* Incentive */}
          <div className="bg-surface-container-low rounded-xl p-6 border border-zinc-800/40">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Incentive Details</p>

            {incentiveLoading ? (
              <div className="flex items-center gap-3 text-zinc-500">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                <span className="text-sm font-label">Loading incentive data…</span>
              </div>
            ) : hasIncentiveData ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* SO incentive — highlighted */}
                <div className="col-span-2 md:col-span-1 bg-primary/10 border border-primary/30 rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Your SO Incentive</p>
                  <p className="text-3xl font-headline font-black text-primary">
                    ₹{soValues.join(' / ')}
                  </p>
                  {soValues.length > 1 && (
                    <p className="text-[10px] text-zinc-500 mt-1 font-label">varies by unit</p>
                  )}
                </div>

                {/* Customer scheme */}
                <div className="bg-surface-container rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Customer Scheme</p>
                  <p className="text-2xl font-headline font-bold text-on-surface">
                    ₹{customerSchemeValues.join(' / ')}
                  </p>
                </div>

                {/* TL incentive */}
                <div className="bg-surface-container rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">TL Incentive</p>
                  <p className="text-2xl font-headline font-bold text-on-surface">
                    ₹{[...new Set(incentives.map((i) => i!.tl))].join(' / ')}
                  </p>
                </div>

                {/* SM incentive */}
                <div className="bg-surface-container rounded-xl p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">SM Incentive</p>
                  <p className="text-2xl font-headline font-bold text-on-surface">
                    ₹{[...new Set(incentives.map((i) => i!.sm))].join(' / ')}
                  </p>
                </div>
              </div>
            ) : openVehicles.length > 0 ? (
              <div className="flex items-center gap-3 text-zinc-500">
                <span className="material-symbols-outlined text-xl">info</span>
                <p className="text-sm font-label">No scheme data available for the available units of this variant.</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-zinc-500">
                <span className="material-symbols-outlined text-xl">info</span>
                <p className="text-sm font-label">Incentive data will appear once units are available.</p>
              </div>
            )}
          </div>

          {/* YOM breakdown if showing all years */}
          {!selYear && selectedCell && selectedCell.yearBreakdown.length > 1 && (
            <div className="bg-surface-container-low rounded-xl p-6 border border-zinc-800/40">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">Year-wise Breakdown</p>
              <div className="flex flex-wrap gap-3">
                {selectedCell.yearBreakdown.map((y) => (
                  <div
                    key={y.chassisYear}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg"
                    style={{ backgroundColor: cellBg[y.level] + '22', border: `1px solid ${cellBg[y.level]}55` }}
                  >
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cellBg[y.level] }} />
                    <div>
                      <p className="font-headline font-bold text-on-surface text-sm">{y.chassisYear}</p>
                      <p className="text-[10px] text-zinc-400 font-label">{y.open} open</p>
                    </div>
                    {y.hasPhysical && (
                      <span className="text-xs font-black text-zinc-400">P</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Empty prompt */}
      {(!selModel || !selSuffix || !selColour) && !loading && (
        <div className="bg-surface-container-low rounded-xl p-12 text-center border border-dashed border-zinc-700/40">
          <span className="material-symbols-outlined text-4xl text-zinc-600 mb-3 block">search</span>
          <p className="text-on-surface-variant font-body text-sm">
            Select a YOM, model, suffix, and colour above to see availability and your incentive.
          </p>
        </div>
      )}
    </div>
  );
}
