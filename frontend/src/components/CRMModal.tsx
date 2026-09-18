import { useEffect, useState } from 'react';

export default function CRMModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(true);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const crmUrl = "https://follow-up-crm.onrender.com/api/sso?token=nippon-ceo-token-2026";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8 transition-opacity duration-300">
      <div className="bg-zinc-950 border border-zinc-800 shadow-2xl w-full h-full max-w-[1600px] flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-500 text-2xl">contact_phone</span>
            <h2 className="text-white font-headline font-bold text-lg tracking-wide uppercase">
              Follow-Up CRM <span className="text-zinc-500 text-sm ml-2">(SECURE SESSION)</span>
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800 p-2 transition-colors flex items-center justify-center"
            title="Close Window"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Iframe Body */}
        <div className="flex-1 w-full bg-[#120708] relative">
          {/* Enhanced Professional Loading State */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-[#120708]">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-zinc-800 border-t-amber-500"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-500 text-sm">lock</span>
                </div>
              </div>
              <p className="text-zinc-400 font-headline uppercase tracking-widest text-sm mt-6 animate-pulse">
                Establishing Secure Session...
              </p>
            </div>
          )}
          
          <iframe 
            src={crmUrl}
            className={`w-full h-full border-none relative z-10 bg-white transition-opacity duration-700 ${loading ? 'opacity-0' : 'opacity-100'}`}
            title="Follow-Up CRM"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>
    </div>
  );
}
