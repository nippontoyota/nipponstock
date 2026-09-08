import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getVehicleIncentive } from '../../lib/vehicleIncentives';

interface RawVehicle {
  model: string;
  suffix: string;
  colour: string;
  chassisNumber: string;
  chassisYear: number;
  assignmentDate: string | null;
  stockStatus: string | null;
}

function parseIndianNum(s: string): number {
  return parseInt(s.replace(/,/g, ''), 10) || 0;
}

function Countdown({ expiryAt }: { expiryAt: Date }) {
  const [remaining, setRemaining] = useState(Math.max(0, Math.floor((expiryAt.getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  return (
    <div className="flex items-center gap-3 bg-tertiary-container/10 px-5 py-2 rounded-xl" style={{ border: '1px solid rgba(215,26,24,0.2)' }}>
      <div className="flex flex-col items-end">
        <span className="font-label text-[9px] uppercase tracking-widest text-tertiary font-bold">Expires In</span>
        <span className="font-headline text-3xl font-bold text-tertiary leading-none">{mm}:{ss}</span>
      </div>
      <span className="material-symbols-outlined text-tertiary animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
    </div>
  );
}

const THIS_YEAR = new Date().getFullYear();
const PAYMENT_STATUSES = [
  'Only Booking Received',
  'Down Payment Received',
  'Part Payment Received',
  'Full Payment Received',
  'Ready for Disbursement',
];

const COLOUR_DOTS: Record<string, string> = {
  White: '#f5f5f5', Black: '#1a1a1a', Silver: '#c0c0c0', Grey: '#808080',
  Red: '#e53935', Blue: '#1e88e5', 'Dark Blue': '#0d47a1', Brown: '#6d4c41',
  Beige: '#d7ccc8', Orange: '#fb8c00', Green: '#43a047', Yellow: '#fdd835',
};

function colourDot(colour: string) {
  const bg = COLOUR_DOTS[colour] ?? '#6366f1';
  return <span className="inline-block w-3 h-3 rounded-full border border-white/20 mr-1.5 align-middle" style={{ background: bg }} />;
}

export default function OffersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isTL = user?.role === 'TEAM_LEADER';
  const isSO = user?.role === 'SO';

  const [vehicles, setVehicles] = useState<RawVehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedSuffix, setSelectedSuffix] = useState<string | null>(null);

  const [blockingId, setBlockingId] = useState('');
  const [expiryAt, setExpiryAt] = useState<Date | null>(null);
  const [chassisNumber, setChassisNumber] = useState('');
  const [placing, setPlacing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderIdError, setOrderIdError] = useState('');

  const [form, setForm] = useState({
    orderId: '', customerName: '', consultantName: '', teamLeaderName: '',
    paymentMode: 'CASH' as 'CASH' | 'FINANCE',
    amountReceived: '', financeType: '' as '' | 'IN_HOUSE' | 'OUTHOUSE',
    financierBank: '', paymentStatus: 'Only Booking Received', expectedBillingDate: '',
  });

  const fetchVehicles = () => {
    setLoading(true);
    api.get('/blocking/offer-vehicles')
      .then(({ data }) => setVehicles(data))
      .catch(() => toast.error('Failed to load offers'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchVehicles(); }, []);

  const offeredVehicles = vehicles.filter((v) => getVehicleIncentive(v.chassisNumber) !== null);

  // Level 1: group by model — max scheme, count
  const modelOffers = (() => {
    const map = new Map<string, { maxNum: number; maxStr: string; count: number }>();
    for (const v of offeredVehicles) {
      const inc = getVehicleIncentive(v.chassisNumber)!;
      const num = parseIndianNum(inc.customerScheme);
      const ex = map.get(v.model);
      if (!ex) map.set(v.model, { maxNum: num, maxStr: inc.customerScheme, count: 1 });
      else map.set(v.model, { maxNum: Math.max(ex.maxNum, num), maxStr: num > ex.maxNum ? inc.customerScheme : ex.maxStr, count: ex.count + 1 });
    }
    return Array.from(map.entries())
      .map(([model, d]) => ({ model, maxScheme: d.maxStr, maxSchemeNum: d.maxNum, count: d.count }))
      .sort((a, b) => b.maxSchemeNum - a.maxSchemeNum);
  })();

  // Level 2: group by suffix within selected model
  const suffixOffers = (() => {
    if (!selectedModel) return [];
    const map = new Map<string, { maxNum: number; maxStr: string; count: number; colours: Set<string>; years: Set<number> }>();
    for (const v of offeredVehicles.filter((v) => v.model === selectedModel)) {
      const inc = getVehicleIncentive(v.chassisNumber)!;
      const num = parseIndianNum(inc.customerScheme);
      const ex = map.get(v.suffix);
      if (!ex) map.set(v.suffix, { maxNum: num, maxStr: inc.customerScheme, count: 1, colours: new Set([v.colour]), years: new Set([v.chassisYear]) });
      else {
        ex.count++;
        ex.colours.add(v.colour);
        ex.years.add(v.chassisYear);
        if (num > ex.maxNum) { ex.maxNum = num; ex.maxStr = inc.customerScheme; }
      }
    }
    return Array.from(map.entries())
      .map(([suffix, d]) => ({ suffix, maxScheme: d.maxStr, maxSchemeNum: d.maxNum, count: d.count, colours: [...d.colours].sort(), years: [...d.years].sort() }))
      .sort((a, b) => b.maxSchemeNum - a.maxSchemeNum);
  })();

  // Level 3: group by colour+YOM within selected model+suffix
  const colourYomOffers = (() => {
    if (!selectedModel || !selectedSuffix) return [];
    const map = new Map<string, { colour: string; year: number; maxNum: number; maxStr: string; count: number }>();
    for (const v of offeredVehicles.filter((v) => v.model === selectedModel && v.suffix === selectedSuffix)) {
      const inc = getVehicleIncentive(v.chassisNumber)!;
      const num = parseIndianNum(inc.customerScheme);
      const key = `${v.colour}::${v.chassisYear}`;
      const ex = map.get(key);
      if (!ex) map.set(key, { colour: v.colour, year: v.chassisYear, maxNum: num, maxStr: inc.customerScheme, count: 1 });
      else { ex.count++; if (num > ex.maxNum) { ex.maxNum = num; ex.maxStr = inc.customerScheme; } }
    }
    return Array.from(map.values()).sort((a, b) => a.year - b.year || a.colour.localeCompare(b.colour));
  })();

  const handleColourYomClick = async (colour: string, chassisYear: number) => {
    if (placing) return;
    setPlacing(true);
    try {
      const { data } = await api.post('/blocking/soft', { model: selectedModel, suffix: selectedSuffix, colour, chassisYear });
      setBlockingId(data.id);
      setExpiryAt(new Date(data.expiryAt));
      setChassisNumber(data.chassisNumber ?? '');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not place soft block');
    } finally {
      setPlacing(false);
    }
  };

  const validateOrderId = (val: string) => {
    if (!/^\d{7}$/.test(val)) setOrderIdError('Order ID must be exactly 7 digits');
    else setOrderIdError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{7}$/.test(form.orderId)) { setOrderIdError('Order ID must be exactly 7 digits'); toast.error('Order ID must be exactly 7 digits'); return; }
    setSubmitting(true);
    const base = { blockingId, chassisYear: THIS_YEAR, orderId: form.orderId, customerName: form.customerName, consultantName: form.consultantName, teamLeaderName: form.teamLeaderName || undefined };
    const fin = isTL ? {} : {
      paymentMode: form.paymentMode,
      amountReceived: form.paymentMode === 'CASH' && form.amountReceived ? parseFloat(form.amountReceived) : undefined,
      financierBank: form.paymentMode === 'FINANCE' ? (form.financeType === 'IN_HOUSE' ? 'In-House' : form.financierBank) : undefined,
      paymentStatus: form.paymentStatus,
      expectedBillingDate: form.expectedBillingDate ? new Date(form.expectedBillingDate).toISOString() : undefined,
    };
    try {
      await api.post('/blocking/hard', { ...base, ...fin });
      toast.success('Vehicle blocked successfully!');
      navigate('/sales/my-blockings');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid = isTL
    ? /^\d{7}$/.test(form.orderId) && !!form.customerName && !!form.consultantName
    : /^\d{7}$/.test(form.orderId) && !!form.customerName && !!form.consultantName && !!form.paymentStatus &&
      (form.paymentMode === 'CASH' ? !!form.amountReceived : form.financeType !== '' && !!form.financierBank);

  const Breadcrumb = () => (
    <div className="flex items-center gap-2 text-[10px] font-label uppercase tracking-widest text-zinc-500 mb-1 flex-wrap">
      <button onClick={() => { setSelectedModel(null); setSelectedSuffix(null); }} className="hover:text-primary transition-colors">Offers</button>
      {selectedModel && <><span>/</span><button onClick={() => setSelectedSuffix(null)} className="hover:text-primary transition-colors">{selectedModel}</button></>}
      {selectedSuffix && <><span>/</span><span className="text-zinc-300">{selectedSuffix}</span></>}
    </div>
  );

  // ── Form ───────────────────────────────────────────────────────────────────
  if (blockingId && expiryAt) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => { setBlockingId(''); setExpiryAt(null); setChassisNumber(''); fetchVehicles(); }} className="text-zinc-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-3xl font-headline font-bold tracking-tighter uppercase">Complete <span className="text-primary">Reservation</span></h1>
            <p className="text-on-surface-variant text-sm font-body mt-1">{selectedModel} {selectedSuffix}</p>
          </div>
          <div className="ml-auto"><Countdown expiryAt={expiryAt} /></div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 bg-surface-container rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Order ID *</label>
              <input className={`input ${orderIdError ? 'border-red-500' : ''}`} placeholder="7-digit Order ID"
                value={form.orderId} onChange={(e) => { setForm((f) => ({ ...f, orderId: e.target.value })); validateOrderId(e.target.value); }} />
              {orderIdError && <p className="text-red-400 text-xs mt-1">{orderIdError}</p>}
            </div>
            <div>
              <label className="label">Customer Name *</label>
              <input className="input" placeholder="Customer Name" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} />
            </div>
            <div>
              <label className="label">Consultant Name *</label>
              <input className="input" placeholder="Consultant Name" value={form.consultantName} onChange={(e) => setForm((f) => ({ ...f, consultantName: e.target.value }))} />
            </div>
            <div>
              <label className="label">Team Leader Name</label>
              <input className="input" placeholder="Optional" value={form.teamLeaderName} onChange={(e) => setForm((f) => ({ ...f, teamLeaderName: e.target.value }))} />
            </div>
          </div>
          {!isTL && (
            <>
              <div>
                <label className="label">Payment Mode *</label>
                <div className="flex gap-3">
                  {(['CASH', 'FINANCE'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setForm((f) => ({ ...f, paymentMode: m, financierBank: '', financeType: '' }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${form.paymentMode === m ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>{m}</button>
                  ))}
                </div>
              </div>
              {form.paymentMode === 'CASH' && (
                <div>
                  <label className="label">Amount Received (₹) *</label>
                  <input className="input" type="number" placeholder="Amount" value={form.amountReceived} onChange={(e) => setForm((f) => ({ ...f, amountReceived: e.target.value }))} />
                </div>
              )}
              {form.paymentMode === 'FINANCE' && (
                <div className="space-y-3">
                  <div>
                    <label className="label">Finance Type *</label>
                    <div className="flex gap-3">
                      {([['IN_HOUSE', 'In-House'], ['OUTHOUSE', 'Outhouse']] as const).map(([val, label]) => (
                        <button key={val} type="button" onClick={() => setForm((f) => ({ ...f, financeType: val, financierBank: '' }))}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${form.financeType === val ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>{label}</button>
                      ))}
                    </div>
                  </div>
                  {form.financeType === 'OUTHOUSE' && (
                    <div>
                      <label className="label">Financier / Bank *</label>
                      <input className="input" placeholder="Bank name" value={form.financierBank} onChange={(e) => setForm((f) => ({ ...f, financierBank: e.target.value }))} />
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Payment Status *</label>
                  <select className="input" value={form.paymentStatus} onChange={(e) => setForm((f) => ({ ...f, paymentStatus: e.target.value }))}>
                    {PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Expected Billing Date</label>
                  <input className="input" type="date" value={form.expectedBillingDate} onChange={(e) => setForm((f) => ({ ...f, expectedBillingDate: e.target.value }))} />
                </div>
              </div>
            </>
          )}
          <button type="submit" disabled={!isFormValid || submitting}
            className="w-full bg-primary text-on-primary py-3 rounded-xl font-headline font-bold uppercase tracking-widest text-sm disabled:opacity-40 hover:brightness-110 transition-all">
            {submitting ? 'Confirming…' : 'Confirm Booking'}
          </button>
        </form>
      </div>
    );
  }

  // ── Level 3: Colour + YOM ─────────────────────────────────────────────────
  if (selectedModel && selectedSuffix) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Breadcrumb />
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedSuffix(null)} className="text-zinc-400 hover:text-white transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="text-3xl font-headline font-bold tracking-tighter uppercase">
              Select <span className="text-primary">Colour & Year</span>
            </h1>
          </div>
        </div>
        {colourYomOffers.length === 0 ? (
          <p className="text-on-surface-variant">No offer vehicles available.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {colourYomOffers.map((c) => {
              const cardContent = (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">Colour / Year</span>
                    {isSO && <span className="text-[9px] font-label uppercase tracking-widest text-zinc-600">View only</span>}
                  </div>
                  <div className="mb-1">
                    <p className="font-headline font-bold text-xl text-on-surface group-hover:text-primary transition-colors flex items-center">
                      {colourDot(c.colour)}{c.colour}
                    </p>
                    <p className="text-xs text-zinc-400 font-label uppercase tracking-widest mt-1">YOM {c.year}</p>
                  </div>
                  <div className="border-t border-outline-variant/20 pt-3 mt-3">
                    <p className="text-[10px] font-label uppercase tracking-widest text-amber-400 mb-1">Consumer Offer</p>
                    <p className="font-headline font-black text-2xl text-amber-300">₹{c.maxStr}</p>
                  </div>
                  {!isSO && placing && (
                    <div className="mt-3 flex items-center gap-2 text-primary text-xs font-bold">
                      <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                      Securing…
                    </div>
                  )}
                </>
              );
              return isSO ? (
                <div key={`${c.colour}::${c.year}`}
                  className="text-left bg-surface-container rounded-2xl p-5 border border-outline-variant/20 group">
                  {cardContent}
                </div>
              ) : (
                <button key={`${c.colour}::${c.year}`} disabled={placing}
                  onClick={() => handleColourYomClick(c.colour, c.year)}
                  className="text-left bg-surface-container hover:bg-surface-container-high rounded-2xl p-5 border border-outline-variant/20 hover:border-primary/40 transition-all active:scale-95 disabled:opacity-50 group">
                  {cardContent}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Level 2: Suffix ───────────────────────────────────────────────────────
  if (selectedModel) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <Breadcrumb />
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedModel(null)} className="text-zinc-400 hover:text-white transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <h1 className="text-3xl font-headline font-bold tracking-tighter uppercase">
              Select <span className="text-primary">Variant</span>
            </h1>
          </div>
        </div>
        {suffixOffers.length === 0 ? (
          <p className="text-on-surface-variant">No offer vehicles available for this model.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {suffixOffers.map((s) => (
              <button key={s.suffix} onClick={() => setSelectedSuffix(s.suffix)}
                className="text-left bg-surface-container hover:bg-surface-container-high rounded-2xl p-5 border border-outline-variant/20 hover:border-primary/40 transition-all active:scale-95 group">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-[10px] font-label uppercase tracking-widest text-on-surface-variant">Variant</span>
                </div>
                <p className="font-headline font-bold text-xl text-on-surface mb-2 group-hover:text-primary transition-colors">{s.suffix}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {s.colours.map((col) => (
                    <span key={col} className="flex items-center text-[10px] font-label bg-surface-container-high px-2 py-0.5 rounded-full text-zinc-300">
                      {colourDot(col)}{col}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {s.years.map((y) => (
                    <span key={y} className="text-[10px] font-label bg-primary/10 text-primary px-2 py-0.5 rounded-full">YOM {y}</span>
                  ))}
                </div>
                <div className="border-t border-outline-variant/20 pt-3">
                  <p className="text-[10px] font-label uppercase tracking-widest text-amber-400 mb-1">Consumer Offer</p>
                  <p className="font-headline font-black text-2xl text-amber-300">₹{s.maxScheme}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Level 1: Model ────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tighter uppercase mb-2">
          Current <span className="text-primary">Offers</span>
        </h1>
        <p className="text-on-surface-variant font-body">Select a model to view available consumer schemes.</p>
      </div>
      {loading ? (
        <div className="flex items-center gap-3 text-on-surface-variant">
          <span className="animate-spin material-symbols-outlined">progress_activity</span>
          Loading offers…
        </div>
      ) : modelOffers.length === 0 ? (
        <p className="text-on-surface-variant">No offer vehicles in stock currently.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modelOffers.map((m) => (
            <button key={m.model} onClick={() => setSelectedModel(m.model)}
              className="text-left bg-surface-container hover:bg-surface-container-high rounded-2xl p-5 border border-outline-variant/20 hover:border-primary/40 transition-all active:scale-95 group">
              <div className="mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>directions_car</span>
                </div>
              </div>
              <p className="font-headline font-bold text-2xl text-on-surface mb-3 group-hover:text-primary transition-colors">{m.model}</p>
              <div className="border-t border-outline-variant/20 pt-3">
                <p className="text-[10px] font-label uppercase tracking-widest text-amber-400 mb-1">Max Consumer Offer</p>
                <p className="font-headline font-black text-3xl text-amber-300">₹{m.maxScheme}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
