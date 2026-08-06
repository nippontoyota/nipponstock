import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SOShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-xl flex justify-between items-center w-full px-6 py-3 border-b border-zinc-800/50">
        <div className="flex items-center gap-4">
          <img src="/nippon-logo.png" alt="Nippon Toyota" className="h-8 object-contain" />
          <div className="flex items-center gap-2 text-[10px] font-label font-black uppercase tracking-widest text-zinc-500 border-l border-zinc-800 pl-4">
            <span className="material-symbols-outlined text-primary text-sm">storefront</span>
            Sales Officer Portal
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest">Live Sync</span>
          </div>
          <span className="text-xs font-label uppercase tracking-widest text-zinc-400 hidden md:block">{user?.fullName}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-zinc-500 hover:text-tertiary transition-colors text-xs uppercase font-bold tracking-wider"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface">
        <Outlet />
      </main>
    </div>
  );
}
