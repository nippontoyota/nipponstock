import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const sideNav = [
  { to: '/sales', icon: 'analytics', label: 'Live Inventory', end: true },
  { to: '/sales/block', icon: 'directions_car', label: 'Reserve Vehicle' },
  { to: '/sales/my-blockings', icon: 'lock_clock', label: 'Active Blockings' },
];

export default function SalesShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="bg-background min-h-screen flex">
      {/* Side Nav */}
      <aside className="hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 bg-zinc-900 z-40 py-6 border-r border-zinc-800/50">
        <div className="px-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-lg">hub</span>
            </div>
            <div>
              <h2 className="text-primary font-headline font-black text-sm uppercase tracking-widest">AutoStock</h2>
              <p className="text-[10px] text-zinc-500 font-label">{user?.fullName}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
          {sideNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-6 py-3 flex items-center gap-3 transition-all duration-300 group font-body font-semibold text-xs uppercase tracking-tight ${
                  isActive
                    ? 'bg-primary/10 text-primary border-r-4 border-primary'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-indigo-200'
                }`
              }
            >
              <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-6 border-t border-zinc-800/50 space-y-4">
          <NavLink
            to="/sales/block"
            className="w-full bg-primary-container text-on-primary-container py-3 rounded-lg font-headline font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Block a Vehicle
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full text-zinc-500 py-2 flex items-center gap-3 hover:text-tertiary transition-colors text-xs uppercase font-bold tracking-wider px-2"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Canvas */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl flex justify-between items-center w-full px-6 py-3">
          <div className="flex items-center gap-8">
            <span className="text-lg font-bold tracking-tighter text-primary font-headline uppercase">Kinetic Precision</span>
            <nav className="hidden lg:flex items-center gap-6 font-headline tracking-tighter uppercase text-sm">
              {sideNav.map((item) => (
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
            <div className="flex items-center gap-2 px-3 py-1 bg-surface-container rounded-full">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest">Live Sync</span>
            </div>
            <div className="flex items-center gap-3 pl-4 border-l border-outline-variant/30">
              <span className="text-xs font-label uppercase tracking-widest text-zinc-400 hidden md:block">{user?.fullName}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-zinc-950/90 backdrop-blur-xl px-6 py-4 flex justify-around items-center z-50">
          {[
            { to: '/sales', icon: 'analytics', label: 'Dash', end: true },
            { to: '/sales/block', icon: 'directions_car', label: 'Reserve' },
            { to: '/sales/my-blockings', icon: 'lock_clock', label: 'Blocks' },
          ].map((item) => (
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
    </div>
  );
}
