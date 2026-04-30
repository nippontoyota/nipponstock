import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const sideNav = [
  { to: '/admin', icon: 'dashboard', label: 'Dashboard', end: true },
  { to: '/admin/blockings', icon: 'lock_clock', label: 'All Blockings' },
  { to: '/admin/stock', icon: 'inventory_2', label: 'Stock' },
  { to: '/admin/analytics', icon: 'assessment', label: 'Analytics' },
  { to: '/admin/branches', icon: 'corporate_fare', label: 'Branches' },
  { to: '/admin/cars', icon: 'directions_car', label: 'Car Catalogue' },
  { to: '/admin/config', icon: 'tune', label: 'Config' },
  { to: '/admin/users', icon: 'manage_accounts', label: 'Users' },
];

export default function AdminShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="bg-background min-h-screen flex">
      {/* Side Nav */}
      <aside className="hidden lg:flex flex-col h-screen w-64 fixed left-0 top-0 bg-zinc-900 z-40 py-6 border-r border-zinc-800/50">
        <div className="px-6 mb-8">
          <h2 className="text-primary font-headline font-black tracking-widest text-lg uppercase">AutoStock</h2>
          <p className="font-label text-[10px] text-zinc-500 uppercase tracking-tighter">Admin Portal</p>
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

        <div className="px-4 py-6 border-t border-zinc-800/50 space-y-2">
          <div className="px-2 py-2 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-sm">person</span>
            </div>
            <div>
              <p className="text-xs font-bold text-on-surface">{user?.fullName}</p>
              <p className="text-[10px] text-zinc-500 font-label uppercase">Admin</p>
            </div>
          </div>
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
        <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-xl flex justify-between items-center w-full px-6 py-3">
          <div className="flex items-center gap-8">
            <img src="/nippon-logo.png" alt="Nippon Toyota" className="h-8 object-contain" />
            <nav className="hidden lg:flex items-center gap-6 font-headline tracking-tighter uppercase text-sm">
              {sideNav.slice(0, 4).map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    isActive
                      ? 'text-primary border-b-2 border-primary pb-1'
                      : 'text-zinc-400 font-medium hover:text-indigo-100 transition-colors'
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-xs font-label text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="uppercase tracking-widest hidden md:block">{user?.fullName}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-surface">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
