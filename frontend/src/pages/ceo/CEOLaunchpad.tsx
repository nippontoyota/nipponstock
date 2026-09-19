import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CEOMarketShareModal from '../../components/CEOMarketShareModal';
import CRMModal from '../../components/CRMModal';
import AftersalesModal from '../../components/AftersalesModal';
import { useAuth } from '../../context/AuthContext';

export default function CEOLaunchpad() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [showMarketShare, setShowMarketShare] = useState(false);
  const [showCRM, setShowCRM] = useState(false);
  const [showAftersales, setShowAftersales] = useState(false);

  useEffect(() => {
    const handleClose = () => {
      setShowCRM(false);
      setShowMarketShare(false);
      setShowAftersales(false);
    };
    window.addEventListener('close-ceo-modals', handleClose);
    return () => window.removeEventListener('close-ceo-modals', handleClose);
  }, []);

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 py-12 px-6">
      <div className="text-center space-y-3">
        <h1 className="text-5xl font-headline font-black tracking-tighter text-on-surface uppercase">
          Executive Portal
        </h1>
        <p className="text-on-surface-variant font-body text-lg max-w-2xl mx-auto">
          Overview & Core Applications
        </p>

              </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
        
        {/* 1. Stock Blocking App */}
        <button
          onClick={() => navigate('/ceo/dashboard')}
          className="group relative bg-surface-container-low rounded-none p-8 border border-zinc-800/50 hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-2 text-left overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
          <div className="w-16 h-16 bg-blue-500/10 rounded-none flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <span className="material-symbols-outlined text-4xl text-blue-500">directions_car</span>
          </div>
          <h2 className="text-2xl font-headline font-bold text-on-surface mb-3 uppercase tracking-tight">
            Stock Blocking
          </h2>
          <p className="text-on-surface-variant font-body text-sm leading-relaxed">
            Access the live vehicle inventory, manage executive reservations, and review real-time stock availability across all branches.
          </p>
        </button>

        {/* 2. Follow-Up CRM */}
        <button
          onClick={() => setShowCRM(true)}
          className="group relative bg-surface-container-low rounded-none p-8 border border-zinc-800/50 hover:border-amber-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-2 text-left overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
          <div className="w-16 h-16 bg-amber-500/10 rounded-none flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <span className="material-symbols-outlined text-4xl text-amber-500">contact_phone</span>
          </div>
          <h2 className="text-2xl font-headline font-bold text-on-surface mb-3 uppercase tracking-tight">
            Follow-Up CRM
          </h2>
          <p className="text-on-surface-variant font-body text-sm leading-relaxed">
            Track lead lifecycle, manage sales team activities, monitor conversion pipelines, and review pending follow-ups.
          </p>
        </button>

        {/* 3. Market Share Dashboard */}
        <button
          onClick={() => setShowMarketShare(true)}
          className="group relative bg-surface-container-low rounded-none p-8 border border-zinc-800/50 hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10 hover:-translate-y-2 text-left overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-teal-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
          <div className="w-16 h-16 bg-emerald-500/10 rounded-none flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <span className="material-symbols-outlined text-4xl text-emerald-500">pie_chart</span>
          </div>
          <h2 className="text-2xl font-headline font-bold text-on-surface mb-3 uppercase tracking-tight">
            Market Share
          </h2>
          <p className="text-on-surface-variant font-body text-sm leading-relaxed">
            Run competitive analysis, simulate what-if scenarios, and analyze branch-level market performance.
          </p>
        </button>

        {/* 4. Aftersales Dashboard */}
        <button
          onClick={() => setShowAftersales(true)}
          className="group relative bg-surface-container-low rounded-none p-8 border border-zinc-800/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10 hover:-translate-y-2 text-left overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-fuchsia-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
          <div className="w-16 h-16 bg-purple-500/10 rounded-none flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <span className="material-symbols-outlined text-4xl text-purple-500">build_circle</span>
          </div>
          <h2 className="text-2xl font-headline font-bold text-on-surface mb-3 uppercase tracking-tight">
            Aftersales
          </h2>
          <p className="text-on-surface-variant font-body text-sm leading-relaxed">
            Monitor service appointments, parts inventory, and aftersales revenue metrics across the dealership network.
          </p>
        </button>



      </div>


      <CEOMarketShareModal isOpen={showMarketShare} onClose={() => setShowMarketShare(false)} />
      <CRMModal isOpen={showCRM} onClose={() => setShowCRM(false)} />
      <AftersalesModal isOpen={showAftersales} onClose={() => setShowAftersales(false)} />
    </div>
  );
}
