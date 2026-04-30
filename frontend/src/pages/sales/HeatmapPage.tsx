import { useEffect, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import socket from '../../socket';

interface HeatmapCell {
  model: string;
  suffix: string;
  colour: string;
  open: number;
  total: number;
  level: 'green' | 'yellow' | 'red';
}

// Real traffic-light colours for the cells
const cellStyle = {
  green:  'opacity-90 hover:opacity-100',
  yellow: 'opacity-90 hover:opacity-100',
  red:    'opacity-100',
};

const cellBg = {
  green:  '#16a34a',   // green-600
  yellow: '#ca8a04',   // yellow-600
  red:    '#dc2626',   // red-600
};

const levelLabel = { green: 'High', yellow: 'Medium', red: 'Critical' };

export default function HeatmapPage() {
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [yomFilter, setYomFilter] = useState<string>('');   // '' = all years
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const navigate = useNavigate();

  const fetchHeatmap = useCallback(async (year?: string) => {
    try {
      const params = year ? `?year=${year}` : '';
      const { data } = await api.get(`/stock/heatmap${params}`);
      setCells(data);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch distinct years from stock on mount
  useEffect(() => {
    api.get('/stock/years').then(({ data }) => setYearOptions(data));
  }, []);

  useEffect(() => {
    fetchHeatmap(yomFilter || undefined);
  }, [yomFilter, fetchHeatmap]);

  useEffect(() => {
    const handler = () => fetchHeatmap(yomFilter || undefined);
    socket.on('heatmap:update', handler);
    const interval = setInterval(handler, 15000);
    return () => {
      socket.off('heatmap:update', handler);
      clearInterval(interval);
    };
  }, [yomFilter, fetchHeatmap]);

  // Group: model → suffix → colours[]
  const byModel = cells.reduce<Record<string, Record<string, HeatmapCell[]>>>((acc, c) => {
    if (!acc[c.model]) acc[c.model] = {};
    if (!acc[c.model][c.suffix]) acc[c.model][c.suffix] = [];
    acc[c.model][c.suffix].push(c);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-headline font-bold tracking-tighter text-on-surface uppercase mb-1">Stock Overview</h2>
          <p className="text-on-surface-variant font-body text-sm tracking-tight">
            Real-time inventory mapping across Model, Suffix, and Colour variants.{' '}
            <span className="text-primary/60 text-xs">
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => navigate('/sales/block')}
            className="group relative flex items-center gap-3 px-8 py-4 font-headline font-bold uppercase tracking-widest text-sm rounded-lg overflow-hidden transition-transform active:scale-95 shadow-xl"
            style={{ background: 'linear-gradient(135deg, #b8c3ff 0%, #2e5bff 100%)', color: '#002388', boxShadow: '0 8px 24px rgba(46,91,255,0.2)' }}
          >
            <span className="material-symbols-outlined group-hover:rotate-90 transition-transform duration-500">add_box</span>
            Block a Vehicle
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            onClick={() => toast('Coming soon', { icon: '🚧' })}
            className="flex items-center gap-2 px-6 py-4 font-headline font-bold uppercase tracking-widest text-sm rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-lg">directions_car</span>
            Request for a Vehicle
          </button>
          <button
            onClick={() => toast('Coming soon', { icon: '🚧' })}
            className="flex items-center gap-2 px-6 py-4 font-headline font-bold uppercase tracking-widest text-sm rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
            Download PDF
          </button>
        </div>
      </section>

      {/* Legend + YOM filter bar */}
      <section className="flex flex-wrap items-center gap-6 py-4 bg-surface-container-low px-6 rounded-xl border-l-4 border-primary">
        <div className="flex items-center gap-4 border-r border-outline-variant/30 pr-6">
          <span className="text-[10px] font-label uppercase font-black text-zinc-500 tracking-tighter">Availability:</span>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cellBg.green }} />
            <span className="text-xs font-label text-on-surface-variant">High <span className="text-zinc-500">(&#62;5)</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cellBg.yellow }} />
            <span className="text-xs font-label text-on-surface-variant">Medium <span className="text-zinc-500">(&#62;2–5)</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cellBg.red }} />
            <span className="text-xs font-label text-on-surface-variant">Critical <span className="text-zinc-500">(&#8804;2)</span></span>
          </div>
        </div>

        {/* YOM Filter */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-label uppercase font-black text-zinc-500 tracking-tighter">YOM:</span>
          <div className="relative">
            <select
              className="bg-surface-container text-on-surface text-xs font-label font-bold uppercase tracking-wider rounded-lg px-3 py-1.5 appearance-none pr-7 border border-zinc-700/50 focus:border-primary outline-none"
              value={yomFilter}
              onChange={(e) => setYomFilter(e.target.value)}
            >
              <option value="">All Years</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 text-sm">expand_more</span>
          </div>
          {yomFilter && (
            <button
              onClick={() => setYomFilter('')}
              className="text-[10px] text-tertiary font-label font-bold uppercase tracking-wider hover:text-on-surface transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full ml-auto">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest">Live Sync Active</span>
        </div>
      </section>

      {/* Heatmap grid */}
      {Object.keys(byModel).length === 0 ? (
        <div className="bg-surface-container-low rounded-xl p-16 text-center text-on-surface-variant font-body">
          {yomFilter ? `No stock found for year ${yomFilter}.` : 'No stock available. Contact your admin to import vehicles.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-12">
          {Object.entries(byModel).map(([model, suffixes]) => {
            const colours = [...new Set(Object.values(suffixes).flat().map((c) => c.colour))].sort();
            return (
              <article key={model} className="space-y-6">
                <div className="flex items-baseline gap-4 pb-4" style={{ borderBottom: '1px solid #2a2a2b' }}>
                  <h3 className="text-2xl font-headline font-bold tracking-tighter uppercase text-on-surface">{model}</h3>
                  <span className="font-label text-[10px] font-black uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded" style={{ color: cellBg.green }}>
                    {Object.values(suffixes).flat().filter((c) => c.level === 'green').length} High Avail.
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Colour header row */}
                  <div className="grid gap-1 px-4" style={{ gridTemplateColumns: `200px repeat(${colours.length}, 1fr)` }}>
                    <div className="text-[10px] font-black text-zinc-600 uppercase tracking-tighter">Suffix / Config</div>
                    {colours.map((colour) => (
                      <div key={colour} className="text-center text-[10px] font-black text-zinc-600 uppercase tracking-tighter truncate px-1">{colour}</div>
                    ))}
                  </div>

                  {/* Suffix rows */}
                  {Object.entries(suffixes).map(([suffix, suffixCells]) => {
                    const colourMap = Object.fromEntries(suffixCells.map((c) => [c.colour, c]));
                    return (
                      <div
                        key={suffix}
                        className="grid gap-1 items-center bg-surface-container-low p-1 rounded-xl group hover:bg-surface-container transition-colors"
                        style={{ gridTemplateColumns: `200px repeat(${colours.length}, 1fr)` }}
                      >
                        <div className="pl-4">
                          <div className="text-sm font-bold text-on-surface uppercase tracking-tight">{suffix}</div>
                        </div>
                        {colours.map((colour) => {
                          const cell = colourMap[colour];
                          if (!cell) {
                            return (
                              <div key={colour} className="h-14 rounded-sm bg-surface-container-highest opacity-10" />
                            );
                          }
                          return (
                            <div
                              key={colour}
                              className={`h-14 rounded-sm cursor-pointer transition-all duration-200 ${cellStyle[cell.level]}`}
                              style={{ backgroundColor: cellBg[cell.level] }}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Stock insights bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <div className="col-span-2 bg-surface-container-low rounded-xl p-8 relative overflow-hidden group">
          <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">Stock Insights{yomFilter ? ` — YOM ${yomFilter}` : ''}</h4>
          <div className="flex gap-12">
            <div>
              <p className="text-4xl font-headline font-extrabold" style={{ color: cellBg.green }}>{cells.filter((c) => c.level === 'green').length}</p>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">High Availability</p>
            </div>
            <div>
              <p className="text-4xl font-headline font-extrabold" style={{ color: cellBg.yellow }}>{cells.filter((c) => c.level === 'yellow').length}</p>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Medium Availability</p>
            </div>
            <div>
              <p className="text-4xl font-headline font-extrabold" style={{ color: cellBg.red }}>{cells.filter((c) => c.level === 'red').length}</p>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Critical Low</p>
            </div>
            <div>
              <p className="text-4xl font-headline font-extrabold text-primary">{cells.reduce((s, c) => s + c.open, 0)}</p>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">Units Available</p>
            </div>
          </div>
          <div className="absolute right-0 bottom-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
            <span className="material-symbols-outlined" style={{ fontSize: '120px' }}>hub</span>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl p-6 flex flex-col justify-between" style={{ border: '1px solid rgba(67,70,86,0.1)' }}>
          <div>
            <h4 className="text-sm font-bold text-on-surface mb-4 uppercase font-headline tracking-tight">Quick Stats</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400 font-label">Total Variants</span>
                <span className="text-sm font-headline font-bold text-on-surface">{cells.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400 font-label">Models</span>
                <span className="text-sm font-headline font-bold text-on-surface">{Object.keys(byModel).length}</span>
              </div>
              {yomFilter && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-400 font-label">Filtered YOM</span>
                  <span className="text-sm font-headline font-bold text-primary">{yomFilter}</span>
                </div>
              )}
            </div>
          </div>
          <button
            className="w-full py-2 bg-surface-container-highest text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-on-surface transition-colors rounded-lg mt-4"
            onClick={() => fetchHeatmap(yomFilter || undefined)}
          >
            Refresh Now
          </button>
        </div>
      </div>
    </div>
  );
}
