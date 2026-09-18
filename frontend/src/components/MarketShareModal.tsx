import React, { useEffect } from 'react';

interface MarketShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullName?: string;
}

const getRtoFromUsername = (fullName?: string) => {
  if (!fullName) return null;
  // e.g. "Kalamaserry_SM" -> "kalamaserry" or "Kalamassery Manager" -> "kalamassery"
  const prefix = fullName.split(/[_ ]/)[0].toLowerCase().trim();
  
  if (prefix === 'kalamaserry' || prefix === 'kalamassery') return 'Kalamassery';
  if (prefix === 'trivandrum' || prefix === 'trivandrumroyals') return 'Trivandrum Royals';
  if (prefix === 'kottayam') return 'Kottayam';
  if (prefix === 'kollam') return 'Kollam';
  if (prefix === 'trichur') return 'Trichur';
  if (prefix === 'muvattupuzha') return 'Muvattupuzha';
  if (prefix === 'kayamkulam') return 'Kayamkulam';
  if (prefix === 'nettoor') return 'Nettoor';
  if (prefix === 'irinjalakuda') return 'Irinjalakuda';
  if (prefix === 'pathanamthitta') return 'Pathanamthitta';
  if (prefix === 'thiruvalla') return 'Thiruvalla';
  
  return null; // fallback if unknown
};

export default function MarketShareModal({ isOpen, onClose, fullName }: MarketShareModalProps) {
  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const rto = getRtoFromUsername(fullName);

  // If we can't map their username, we safely default to just the cluster selector page
  const iframeSrc = rto 
    ? `https://market-share.bharath-c.workers.dev/rto-detail?rto=${encodeURIComponent(rto)}&view=cluster`
    : `https://market-share.bharath-c.workers.dev/rto-selection.html`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8 transition-opacity duration-300">
      <div className="bg-zinc-950 border border-zinc-800 shadow-2xl w-full h-full max-w-[1600px] flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl">pie_chart</span>
            <h2 className="text-white font-headline font-bold text-lg tracking-wide uppercase">
              Live Market Share <span className="text-zinc-500 text-sm ml-2">({rto || 'Regional'})</span>
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

        {/* Content Iframe */}
        <div className="flex-1 w-full bg-[#120708] relative">
          {/* Loading placeholder in background */}
          <div className="absolute inset-0 flex items-center justify-center z-0">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
          <iframe 
            src={iframeSrc}
            className="w-full h-full border-none relative z-10"
            title="Market Share Dashboard"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
