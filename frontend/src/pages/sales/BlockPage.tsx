import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../api';

interface HeatmapCell { model: string; suffix: string; colour: string; level: string; }
type Step = 'select' | 'form';

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
        <span className="font-headline text-3xl font-bold text-tertiary timer-glow leading-none">{mm}:{ss}</span>
      </div>
      <span className="material-symbols-outlined text-tertiary animate-pulse" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
    </div>
  );
}

const steps = [
  { n: '01', label: 'Select' },
  { n: '02', label: 'Details' },
  { n: '03', label: 'Confirm' },
];

const THIS_YEAR = new Date().getFullYear();

export default function BlockPage() {
  const navigate = useNavigate();
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [yom, setYom] = useState<string>('');       // Year of Manufacture filter
  const [model, setModel] = useState('');
  const [suffix, setSuffix] = useState('');
  const [colour, setColour] = useState('');
  const [step, setStep] = useState<Step>('select');
  const [blockingId, setBlockingId] = useState('');
  const [expiryAt, setExpiryAt] = useState<Date | null>(null);
  const [placing, setPlacing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderIdError, setOrderIdError] = useState('');
  const [form, setForm] = useState({
    orderId: '',
    customerName: '',
    consultantName: '',
    teamLeaderName: '',
    paymentMode: 'CASH' as 'CASH' | 'FINANCE',
    amountReceived: '',
    financeType: '' as '' | 'IN_HOUSE' | 'OUTHOUSE',
    financierBank: '',
    paymentStatus: 'Full payment received',
    expectedBillingDate: '',
  });

  // Fetch distinct years in stock
  useEffect(() => {
    api.get('/stock/years').then(({ data }) => setYearOptions(data));
  }, []);

  // Fetch heatmap filtered by YOM
  useEffect(() => {
    const params = yom ? `?year=${yom}` : '';
    api.get(`/stock/heatmap${params}`).then(({ data }) => setCells(data));
  }, [yom]);

  const models = [...new Set(cells.map((c) => c.model))].sort();
  const suffixes = [...new Set(cells.filter((c) => c.model === model).map((c) => c.suffix))].sort();
  const colours = [...new Set(cells.filter((c) => c.model === model && c.suffix === suffix).map((c) => c.colour))].sort();

  const handleColourSelect = async (c: string) => {
    setColour(c);
    setPlacing(true);
    try {
      const payload: Record<string, unknown> = { model, suffix, colour: c };
      if (yom) payload.chassisYear = parseInt(yom);
      const { data } = await api.post('/blocking/soft', payload);
      setBlockingId(data.id);
      setExpiryAt(new Date(data.expiryAt));
      setStep('form');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Could not place soft block');
      setColour('');
    } finally {
      setPlacing(false);
    }
  };

  const validateOrderId = (val: string) => {
    if (!/^\d{7}$/.test(val)) {
      setOrderIdError('Order ID must be exactly 7 digits');
    } else {
      setOrderIdError('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{7}$/.test(form.orderId)) {
      setOrderIdError('Order ID must be exactly 7 digits');
      toast.error('Order ID must be exactly 7 digits');
      return;
    }
    setSubmitting(true);
    const financierBank = form.paymentMode === 'FINANCE'
      ? (form.financeType === 'IN_HOUSE' ? 'In-House' : form.financierBank)
      : undefined;
    const amountReceived = form.paymentMode === 'CASH' && form.amountReceived
      ? parseFloat(form.amountReceived)
      : undefined;

    try {
      await api.post('/blocking/hard', {
        blockingId,
        chassisYear: yom ? parseInt(yom) : THIS_YEAR,
        orderId: form.orderId,
        customerName: form.customerName,
        consultantName: form.consultantName,
        teamLeaderName: form.teamLeaderName || undefined,
        paymentMode: form.paymentMode,
        amountReceived,
        financierBank,
        paymentStatus: form.paymentStatus,
        expectedBillingDate: form.expectedBillingDate ? new Date(form.expectedBillingDate).toISOString() : undefined,
      });
      toast.success('Vehicle blocked successfully!');
      navigate('/sales/my-blockings');
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isFormValid =
    /^\d{7}$/.test(form.orderId) &&
    form.customerName &&
    form.consultantName &&
    form.paymentStatus &&
    (form.paymentMode === 'CASH'
      ? !!form.amountReceived
      : form.financeType !== '' && !!form.financierBank);

  const currentStep = step === 'select' ? 0 : 1;

  return (
    <div>
      {/* Page header + progress */}
      <div className="max-w-6xl mx-auto mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tighter uppercase mb-2">
              Reserve <span className="text-primary">Vehicle</span>
            </h1>
            <p className="text-on-surface-variant font-body max-w-xl">
              {step === 'select'
                ? 'Select a configuration to secure a temporary 5-minute soft block.'
                : 'Complete the reservation form before your timer expires.'}
            </p>
          </div>
          <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-xl">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs font-headline ${i <= currentStep ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant opacity-40'}`}>
                    {s.n}
                  </div>
                  <span className={`text-[10px] uppercase font-label mt-2 tracking-tighter ${i <= currentStep ? 'text-primary' : 'opacity-40'}`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && <div className="w-10 h-[2px] bg-outline-variant/30 mb-5" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* STEP 1: Select */}
      {step === 'select' && (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-surface-container-low p-8 rounded-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <h3 className="text-xs font-label uppercase tracking-[0.3em] text-primary mb-8">Configurations</h3>
              <div className="space-y-8">

                {/* YOM selector */}
                <div className="space-y-2">
                  <label className="label">Year of Manufacture (YOM)</label>
                  <div className="relative">
                    <select
                      className="input appearance-none pr-10"
                      value={yom}
                      onChange={(e) => { setYom(e.target.value); setModel(''); setSuffix(''); setColour(''); }}
                    >
                      <option value="">All Years</option>
                      {yearOptions.map((y) => <option key={y} value={String(y)}>{y}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="label">Model Selection</label>
                  <div className="relative">
                    <select className="input appearance-none pr-10" value={model} onChange={(e) => { setModel(e.target.value); setSuffix(''); setColour(''); }}>
                      <option value="">Select Model…</option>
                      {models.map((m) => <option key={m}>{m}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label">Performance Suffix</label>
                  <div className="relative">
                    <select className="input appearance-none pr-10" value={suffix} disabled={!model} onChange={(e) => { setSuffix(e.target.value); setColour(''); }}>
                      <option value="">Select Suffix…</option>
                      {suffixes.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="label">Exterior Colour</label>
                  {suffix ? (
                    <div className="grid grid-cols-2 gap-2">
                      {colours.map((c) => (
                        <button
                          key={c}
                          disabled={placing}
                          onClick={() => handleColourSelect(c)}
                          className={`py-3 px-3 rounded-lg text-xs font-label font-bold uppercase tracking-wider transition-all text-left ${colour === c ? 'border-2 border-primary text-primary bg-primary/10' : 'bg-surface-container-lowest text-on-surface-variant hover:border-outline'}`}
                          style={{ border: colour === c ? undefined : '1px solid rgba(67,70,86,0.15)' }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="input text-outline-variant text-sm">Select suffix first…</div>
                  )}
                  {placing && <p className="text-sm text-primary animate-pulse font-label mt-2">Placing soft block…</p>}
                </div>
              </div>
            </div>

            <div className="bg-surface-container p-6 rounded-xl flex items-start gap-4" style={{ border: '1px solid rgba(67,70,86,0.1)' }}>
              <span className="material-symbols-outlined text-tertiary">info</span>
              <div>
                <h4 className="text-sm font-bold uppercase tracking-tight mb-1 font-headline">Soft Block Policy</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">A soft block prevents other branches from reserving this specific unit. If the timer expires, the stock becomes globally available again.</p>
              </div>
            </div>
          </div>

          {/* Right: preview */}
          <div className="lg:col-span-8">
            <div className="relative h-[480px] bg-surface-container-low rounded-xl overflow-hidden flex items-center justify-center">
              {model && suffix ? (
                <div className="text-center p-12">
                  <span className="material-symbols-outlined text-primary/20 mb-4" style={{ fontSize: '80px' }}>directions_car</span>
                  <p className="font-headline font-bold text-2xl uppercase tracking-tighter text-on-surface">{model} {suffix}</p>
                  {yom && <p className="text-primary font-label text-xs uppercase tracking-widest mt-1">YOM {yom}</p>}
                  <p className="text-on-surface-variant font-body mt-2">{colour ? `Colour: ${colour}` : 'Select a colour to continue'}</p>
                </div>
              ) : (
                <div className="text-center p-12">
                  <span className="material-symbols-outlined text-primary/10 mb-4" style={{ fontSize: '80px' }}>inventory_2</span>
                  <p className="text-on-surface-variant font-body">Select a model and suffix to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Full blocking form */}
      {step === 'form' && (
        <div className="max-w-7xl mx-auto">
          {/* Sticky form header with timer */}
          <div className="sticky top-16 z-40 bg-surface/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between rounded-xl mb-8" style={{ border: '1px solid rgba(67,70,86,0.1)' }}>
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/sales')} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
              <div>
                <h2 className="font-headline font-bold text-lg tracking-tighter uppercase text-primary">Full Blocking Protocol</h2>
                <p className="font-label text-[10px] text-on-surface-variant tracking-widest uppercase">
                  Securing: {model} {suffix} — {colour}{yom ? ` · YOM ${yom}` : ''}
                </p>
              </div>
            </div>
            {expiryAt && <Countdown expiryAt={expiryAt} />}
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left: vehicle + customer (7 cols) */}
              <div className="lg:col-span-7 space-y-8">
                {/* Locked vehicle telemetry */}
                <section className="bg-surface-container-low p-6 rounded-xl space-y-6">
                  <div className="flex justify-between items-end pb-4" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
                    <h2 className="font-headline text-lg font-semibold tracking-tight text-on-surface">Vehicle Information</h2>
                    <span className="font-label text-xs text-primary bg-primary/10 px-2 py-0.5 rounded uppercase font-semibold">Locked Configuration</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {[['YOM', yom || THIS_YEAR], ['Model', model], ['Suffix', suffix], ['Colour', colour]].map(([k, v]) => (
                      <div key={String(k)} className="space-y-1 opacity-60 cursor-not-allowed">
                        <span className="font-label text-[10px] uppercase tracking-wider text-on-surface-variant">{k}</span>
                        <p className="font-headline font-medium text-lg">{v}</p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Customer credentials */}
                <section className="space-y-6">
                  <h2 className="font-headline text-lg font-semibold tracking-tight text-on-surface px-1">Customer Credentials</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="label">Order ID * <span className="text-zinc-500 normal-case font-normal">(7 digits)</span></label>
                      <input
                        className={`input font-mono ${orderIdError ? 'border-red-500 focus:border-red-500' : ''}`}
                        placeholder="0000000"
                        maxLength={7}
                        value={form.orderId}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 7);
                          setForm((f) => ({ ...f, orderId: val }));
                          if (val.length > 0) validateOrderId(val);
                          else setOrderIdError('');
                        }}
                        required
                      />
                      {orderIdError && <p className="text-xs text-red-400 font-label">{orderIdError}</p>}
                    </div>
                    <div className="space-y-2">
                      <label className="label">Customer Name *</label>
                      <input className="input" placeholder="Enter full legal name" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="label">Sales Consultant Name *</label>
                      <input className="input" placeholder="Consultant handling this deal" value={form.consultantName} onChange={(e) => setForm((f) => ({ ...f, consultantName: e.target.value }))} required />
                    </div>
                    <div className="space-y-2">
                      <label className="label">Team Leader Name</label>
                      <input className="input" placeholder="Team leader (optional)" value={form.teamLeaderName} onChange={(e) => setForm((f) => ({ ...f, teamLeaderName: e.target.value }))} />
                    </div>
                  </div>
                </section>
              </div>

              {/* Right: financial (5 cols) */}
              <aside className="lg:col-span-5 space-y-8">
                <div className="bg-surface-container-low rounded-xl p-8 space-y-8 sticky top-40">
                  <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface pb-4" style={{ borderBottom: '1px solid rgba(67,70,86,0.1)' }}>
                    Financial Payload
                  </h2>

                  {/* Payment toggle */}
                  <div className="space-y-4">
                    <label className="label">Payment Method</label>
                    <div className="grid grid-cols-2 p-1 bg-surface-container-lowest rounded-xl">
                      {(['CASH', 'FINANCE'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, paymentMode: mode, financeType: '', financierBank: '' }))}
                          className={`py-3 px-4 rounded-lg font-headline font-bold text-sm tracking-tight transition-all ${form.paymentMode === mode ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-on-surface'}`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    {form.paymentMode === 'CASH' && (
                      <div className="space-y-2">
                        <label className="label">Amount Received (₹) *</label>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          placeholder="Enter amount received"
                          value={form.amountReceived}
                          onChange={(e) => setForm((f) => ({ ...f, amountReceived: e.target.value }))}
                          required
                        />
                      </div>
                    )}
                    {form.paymentMode === 'FINANCE' && (
                      <>
                        {/* In-House / Outhouse dropdown */}
                        <div className="space-y-2">
                          <label className="label">Finance Type *</label>
                          <div className="relative">
                            <select
                              className="input appearance-none pr-10"
                              value={form.financeType}
                              onChange={(e) => setForm((f) => ({ ...f, financeType: e.target.value as '' | 'IN_HOUSE' | 'OUTHOUSE', financierBank: '' }))}
                            >
                              <option value="">Select finance type…</option>
                              <option value="IN_HOUSE">In-House</option>
                              <option value="OUTHOUSE">Outhouse</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                          </div>
                        </div>
                        {/* Bank name — shown for both In-House and Outhouse */}
                        {form.financeType !== '' && (
                          <div className="space-y-2">
                            <label className="label">Financier Bank *</label>
                            <input className="input" placeholder={form.financeType === 'IN_HOUSE' ? 'e.g. Nippon In-House Finance' : 'Bank name'} value={form.financierBank} onChange={(e) => setForm((f) => ({ ...f, financierBank: e.target.value }))} required />
                          </div>
                        )}
                      </>
                    )}

                    <div className="space-y-2">
                      <label className="label">Payment Status *</label>
                      <div className="relative">
                        <select className="input appearance-none pr-10" value={form.paymentStatus} onChange={(e) => setForm((f) => ({ ...f, paymentStatus: e.target.value }))}>
                          <option value="Full payment received">Full payment received</option>
                          <option value="Only Booking Received">Only Booking Received</option>
                          <option value="Part payment received">Part payment received</option>
                          <option value="Ready for Disbursement">Ready for Disbursement</option>
                        </select>
                        <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-outline">expand_more</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="label">Expected Tally Billing Date <span className="text-zinc-600 normal-case font-normal">(optional)</span></label>
                      <input className="input" type="date" value={form.expectedBillingDate} onChange={(e) => setForm((f) => ({ ...f, expectedBillingDate: e.target.value }))} style={{ colorScheme: 'dark' }} />
                    </div>
                  </div>

                  <div className="pt-6 space-y-4">
                    <button
                      type="submit"
                      disabled={!isFormValid || submitting}
                      className="w-full py-4 rounded-lg font-headline font-black text-lg tracking-tighter uppercase flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-xl disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg, #b8c3ff 0%, #2e5bff 100%)', color: '#002388', boxShadow: '0 8px 24px rgba(46,91,255,0.2)' }}
                    >
                      {submitting ? 'Confirming…' : 'Confirm Block'}
                      {!submitting && <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 700" }}>lock</span>}
                    </button>
                    <p className="text-[10px] text-center text-on-surface-variant px-4">
                      By confirming, this unit will be removed from live inventory for the configured blocking period.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </form>
        </div>
      )}

      {/* Visual footer accent */}
      <div className="fixed bottom-0 left-0 w-full h-1 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent, rgba(184,195,255,0.3), transparent)' }} />
    </div>
  );
}
