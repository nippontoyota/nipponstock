import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function FinanceHeadShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-xl flex justify-between items-center w-full px-6 py-3 border-b border-zinc-800/50">
        <div className="flex items-center gap-4">
          <img src="/nippon-logo.png" alt="Nippon Toyota" className="h-8 object-contain" />
          <span className="text-[10px] font-label uppercase tracking-widest text-primary border border-primary/30 px-2 py-0.5 rounded">Finance Head</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-label uppercase tracking-widest text-zinc-400">{user?.fullName}</span>
          <button
            onClick={handleLogout}
            className="text-zinc-500 hover:text-tertiary transition-colors text-xs uppercase font-bold tracking-wider flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            Logout
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface">
        <Outlet />
      </main>
    </div>
  );
}
