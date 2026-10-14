import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

interface MarketShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullName?: string;
}

// Maps any branch name, branch code, or username string to the exact Market Share cluster key
function mapToMarketShareCluster(str?: string | null): string | null {
  if (!str) return null;
  const s = str.toLowerCase().trim();

  if (s.includes('kalamaser') || s.includes('kalamasser') || s.includes('co01b')) return 'Kalamassery';
  if (s.includes('nettoor') || s.includes('co01a')) return 'Nettoor';
  if (s.includes('trichur') || s.includes('thrissur') || s.includes('ti01a')) return 'Trichur';
  if (s.includes('irinjalakuda') || s.includes('ir01a')) return 'Irinjalakuda';
  if (s.includes('muvattupuzha') || s.includes('mv01a')) return 'Muvattupuzha';
  if (s.includes('kottayam') || s.includes('kt01a') || s.includes('kt01b') || s.includes('pala')) return 'Kottayam';
  if (s.includes('pathanamthitta') || s.includes('ph01a')) return 'Pathanamthitta';
  if (s.includes('thiruvalla') || s.includes('tl01a')) return 'Thiruvalla';
  if (s.includes('kayamkulam') || s.includes('ky01a')) return 'Kayamkulam';
  if (s.includes('kollam') || s.includes('kl01a')) return 'Kollam';
  if (s.includes('kazhakoottam') || s.includes('kazhakkottam') || s.includes('enjakkal') || s.includes('enchakkal') || s.includes('tr01a') || s.includes('tr01c')) return 'Kazhakkottam & Enchakkal';
  if (s.includes('royal') || s.includes('trivandrum')) return 'Trivandrum Royals';

  return null;
}

// Module-level cache for branches list so we only fetch once per session
let cachedBranches: Array<{ id: string; name: string; branchCode?: string }> | null = null;

export default function MarketShareModal({ isOpen, onClose, fullName }: MarketShareModalProps) {
  const { user } = useAuth();
  const [resolvedRto, setResolvedRto] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(true);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Dynamically resolve the user's branch
  useEffect(() => {
    if (!isOpen) {
      setIsResolving(true);
      return;
    }

    let isMounted = true;

    async function resolve() {
      setIsResolving(true);

      // 1. Check if fullName or loginId directly contains a branch name
      const directMatch =
        mapToMarketShareCluster(fullName) ||
        mapToMarketShareCluster(user?.fullName) ||
        mapToMarketShareCluster(user?.loginId);

      if (directMatch) {
        if (isMounted) {
          setResolvedRto(directMatch);
          setIsResolving(false);
        }
        return;
      }

      // 2. If user is assigned to a branchId, look up their branch from the branches list
      if (user?.branchId) {
        try {
          if (!cachedBranches) {
            const res = await api.get('/branches');
            if (Array.isArray(res.data)) {
              cachedBranches = res.data;
            }
          }

          if (cachedBranches && isMounted) {
            const myBranch = cachedBranches.find((b) => b.id === user.branchId);
            if (myBranch) {
              const cluster = mapToMarketShareCluster(myBranch.name) || mapToMarketShareCluster(myBranch.branchCode);
              if (cluster) {
                setResolvedRto(cluster);
                setIsResolving(false);
                return;
              }
            }
          }
        } catch (err) {
          console.error('Failed to lookup branch for market share modal:', err);
        }
      }

      if (isMounted) {
        setResolvedRto(null);
        setIsResolving(false);
      }
    }

    resolve();
    return () => { isMounted = false; };
  }, [isOpen, user?.branchId, user?.fullName, user?.loginId, fullName]);

  if (!isOpen) return null;

  const baseUrl = import.meta.env.VITE_MARKET_SHARE_URL || 'http://localhost:3000';
  const timestamp = new Date().getTime();
  const targetPath = resolvedRto 
    ? `/rto-detail.html?rto=${encodeURIComponent(resolvedRto)}&view=cluster&t=${timestamp}`
    : `/rto-selection.html?t=${timestamp}`;

  const iframeSrc = `${baseUrl}/api/sso?token=nippon-branch-token-2026&redirect=${encodeURIComponent(targetPath)}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8 transition-opacity duration-300">
      <div className="bg-zinc-950 border border-zinc-800 shadow-2xl w-full h-full max-w-[1600px] flex flex-col overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-2xl">pie_chart</span>
            <h2 className="text-white font-headline font-bold text-lg tracking-wide uppercase">
              Live Market Share <span className="text-zinc-500 text-sm ml-2">({isResolving ? 'Connecting...' : (resolvedRto || 'Regional')})</span>
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
          {isResolving ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-[#120708]">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
              <p className="text-zinc-400 font-headline uppercase tracking-widest text-xs mt-4 animate-pulse">
                Identifying Branch Dashboard...
              </p>
            </div>
          ) : (
            <iframe 
              src={iframeSrc}
              className="w-full h-full border-none relative z-10"
              title="Market Share Dashboard"
            />
          )}
        </div>
      </div>
    </div>
  );
}
