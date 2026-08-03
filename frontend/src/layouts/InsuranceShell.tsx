import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function InsuranceShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="bg-background min-h-screen flex">
      <aside className="hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 bg-zinc-900 z-40 py-6 border-r border-zinc-800/50">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-lg">shield</span>
            </div>
            <div>
              <h2 className="text-primary font-headline font-black text-xs uppercase tracking-widest">Insurance Portal</h2>
              <p className="text-[10px] text-zinc-500 font-label">{user?.fullName}</p>
            </div>
          </div>
        </div>
        <div className="px-4 py-6 border-t border-zinc-800/50 mt-auto">
          <button onClick={handleLogout} className="w-full text-zinc-500 py-2 flex items-center gap-3 hover:text-tertiary transition-colors text-xs uppercase font-bold tracking-wider px-2">
            <span className="material-symbols-outlined text-lg">logout</span>
            Logout
          </button>
        </div>
      </aside>
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl flex justify-between items-center w-full px-6 py-3">
          <div className="flex items-center gap-4">
            <img src="/nippon-logo.png" alt="Nippon Toyota" className="h-8 object-contain" />
            <span className="text-[10px] font-label uppercase tracking-widest text-primary border border-primary/30 px-2 py-0.5 rounded">Insurance</span>
          </div>
          <span className="text-xs font-label uppercase tracking-widest text-zinc-400">{user?.fullName}</span>
        </header>
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
