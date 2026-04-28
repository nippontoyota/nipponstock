import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ loginId: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      login(data.token, data.user);
      navigate(data.user.role === 'ADMIN' ? '/admin' : '/sales');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Login failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden bg-background">
      {/* Background speed lanes */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-surface opacity-90" />
        <div className="absolute top-0 right-0 w-1/3 h-full bg-primary/5 -skew-x-12 transform translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-tertiary/5 -skew-x-12 transform -translate-x-1/2" />
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-tertiary/5 blur-[150px] rounded-full" />
      </div>

      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden rounded-xl bg-surface-container-low shadow-2xl shadow-black/50">
        {/* Left branding — 7 cols */}
        <div className="lg:col-span-7 relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
          <div className="z-10">
            <h1 className="font-headline text-3xl font-black tracking-tighter text-primary uppercase">
              Kinetic Precision
            </h1>
            <p className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant mt-2 opacity-60">
              Sales Management Hub
            </p>
          </div>
          <div className="z-10 mt-auto">
            <div className="space-y-4">
              <h2 className="font-headline text-5xl font-bold tracking-tighter text-on-surface leading-none">
                VELOCITY IS<br />
                <span className="text-primary-container">AUTHORITY.</span>
              </h2>
              <p className="max-w-md text-on-surface-variant font-body">
                Access the live telemetry of your regional inventory. Manage blockings, reserve high-value stock, and drive branch performance with precision.
              </p>
            </div>
          </div>
          {/* Decorative glow */}
          <div className="absolute -bottom-20 -right-20 w-96 h-96 rounded-full bg-primary-container opacity-10 blur-[100px]" />
        </div>

        {/* Right form — 5 cols */}
        <div className="lg:col-span-5 bg-surface-container p-8 md:p-16 flex flex-col justify-center">
          <div className="lg:hidden mb-12">
            <h1 className="font-headline text-2xl font-black tracking-tighter text-primary uppercase">Kinetic Precision</h1>
          </div>

          <header className="mb-10">
            <h3 className="font-headline text-2xl font-bold text-on-surface">Sales Terminal</h3>
            <p className="text-on-surface-variant font-body mt-1 text-sm">Authorized Executive Access Only</p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-2">
              <label className="label" htmlFor="exec-id">Sales Executive ID</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                  <span className="material-symbols-outlined text-lg">badge</span>
                </div>
                <input
                  id="exec-id"
                  className="input pl-12"
                  type="text"
                  placeholder="EX-000-000"
                  autoComplete="username"
                  value={form.loginId}
                  onChange={(e) => setForm((f) => ({ ...f, loginId: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="label" htmlFor="password">Security Cipher</label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-on-surface-variant group-focus-within:text-primary transition-colors">
                  <span className="material-symbols-outlined text-lg">lock</span>
                </div>
                <input
                  id="password"
                  className="input pl-12 pr-12"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-outline hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 rounded-lg font-headline font-bold text-lg tracking-tight uppercase flex items-center justify-center gap-3 active:scale-[0.98] transition-transform shadow-lg disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #b8c3ff 0%, #2e5bff 100%)', color: '#002388' }}
              >
                {loading ? 'Authenticating…' : 'Access Inventory'}
                {!loading && <span className="material-symbols-outlined">bolt</span>}
              </button>
            </div>

            <footer className="pt-8 border-t border-outline-variant/10">
              <div className="flex items-center gap-4">
                <div className="h-2 w-2 rounded-full bg-tertiary-container animate-pulse" />
                <span className="font-label text-xs text-on-surface-variant opacity-70 uppercase tracking-widest">
                  System Status: All Systems Nominal
                </span>
              </div>
            </footer>
          </form>
        </div>
      </div>

      {/* Floating telemetry decorations */}
      <div className="absolute top-12 right-12 hidden xl:block glass-panel px-6 py-4 rounded-xl pointer-events-none" style={{ border: '1px solid rgba(67,70,86,0.1)' }}>
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] text-primary/60 uppercase tracking-widest">Global Latency</span>
          <span className="font-headline text-xl font-bold text-on-surface">14ms</span>
          <div className="w-full h-1 bg-surface-container-lowest mt-2 overflow-hidden rounded-full">
            <div className="h-full bg-primary w-2/3" />
          </div>
        </div>
      </div>
      <div className="absolute bottom-12 left-12 hidden xl:block glass-panel px-6 py-4 rounded-xl pointer-events-none" style={{ border: '1px solid rgba(67,70,86,0.1)' }}>
        <div className="flex flex-col gap-1">
          <span className="font-label text-[10px] text-tertiary/60 uppercase tracking-widest">Secure Handshake</span>
          <span className="font-headline text-xl font-bold text-on-surface">AES-256</span>
          <div className="flex gap-1 mt-2">
            <div className="h-1 w-4 bg-tertiary rounded-full" />
            <div className="h-1 w-4 bg-tertiary/40 rounded-full" />
            <div className="h-1 w-4 bg-tertiary/20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
