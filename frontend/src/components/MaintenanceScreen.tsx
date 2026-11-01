export default function MaintenanceScreen({ fullName, onCheckAgain, onLogout }: { fullName?: string; onCheckAgain: () => void; onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <img src="/nippon-logo.png" alt="Nippon Toyota" className="h-10 object-contain mx-auto" />
        <div className="w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-amber-400" style={{ fontSize: 44 }}>build_circle</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-headline font-bold tracking-tighter text-on-surface uppercase">Under Maintenance</h1>
          <p className="text-on-surface-variant font-body text-sm">
            {fullName ? `${fullName}, we` : 'We'} are updating the system and blocking is temporarily unavailable. Please check back shortly.
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={onCheckAgain} className="btn-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-base">refresh</span>Check again
          </button>
          <button onClick={onLogout} className="btn-secondary flex items-center gap-2">
            <span className="material-symbols-outlined text-base">logout</span>Logout
          </button>
        </div>
      </div>
    </div>
  );
}
