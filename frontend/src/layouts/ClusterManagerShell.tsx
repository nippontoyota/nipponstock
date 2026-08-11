import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const nav = [
  { to: '/cluster', icon: 'bar_chart', label: 'Dashboard', end: true },
  { to: '/cluster/availability', icon: 'analytics', label: 'Availability' },
];

export default function ClusterManagerShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="bg-background min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur-xl flex justify-between items-center w-full px-6 py-3 border-b border-zinc-800/50">
        <div className="flex items-center gap-4">
          <img src="/nippon-logo.png" alt="Nippon Toyota" className="h-8 object-contain" />
          <span className="text-[10px] font-label uppercase tracking-widest text-secondary border border-secondary/30 px-2 py-0.5 rounded">
            Cluster {user?.clusterNumber ?? ''} Manager
          </span>
          <nav className="hidden md:flex items-center gap-6 font-headline tracking-tighter uppercase text-sm pl-4 border-l border-zinc-800">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive
                    ? 'text-primary border-b-2 border-primary pb-1'
                    : 'text-zinc-400 font-medium hover:text-indigo-100 transition-colors duration-200'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-label uppercase tracking-widest text-zinc-400 hidden md:block">{user?.fullName}</span>
          <button
            onClick={handleLogout}
            className="text-zinc-500 hover:text-tertiary transition-colors text-xs uppercase font-bold tracking-wider flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-base">logout</span>
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-zinc-950/90 backdrop-blur-xl px-6 py-4 flex justify-around items-center z-50">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-zinc-500'}`
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-[8px] uppercase font-label font-bold">{item.label}</span>
          </NavLink>
        ))}
        <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-zinc-500">
          <span className="material-symbols-outlined">logout</span>
          <span className="text-[8px] uppercase font-label font-bold">Exit</span>
        </button>
      </nav>
    </div>
  );
}
