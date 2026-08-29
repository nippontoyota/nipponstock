import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getVehicleIncentive } from '../lib/vehicleIncentives';

interface Counts { u5: number; u6: number }

const SESSION_KEY = 'consumer_offer_dismissed';
const ROLES_SHOWN = ['SO', 'TEAM_LEADER', 'SALES_MANAGER'];

export default function ConsumerOfferPopup({ role, offersPath = '/sales/offers' }: { role: string; offersPath?: string }) {
  const [visible, setVisible] = useState(false);
  const [counts, setCounts] = useState<Counts>({ u5: 0, u6: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    if (!ROLES_SHOWN.includes(role)) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setVisible(true);
    api.get('/blocking/offer-vehicles')
      .then((res) => {
        const vehicles: { model: string; suffix: string; colour: string; chassisNumber: string; chassisYear: number }[] = res.data;
        const u5 = vehicles.filter((v) => {
          if (v.model !== 'D22' || v.suffix !== 'D22U5' || v.chassisYear !== 2025) return false;
          const inc = getVehicleIncentive(v.chassisNumber);
          return inc?.customerScheme === '2,30,688';
        }).length;
        const u6 = vehicles.filter((v) => {
          if (v.model !== 'D22' || v.suffix !== 'D22U6' || v.colour === 'WBG' || v.chassisYear !== 2025) return false;
          const inc = getVehicleIncentive(v.chassisNumber);
          return inc?.customerScheme === '2,46,164';
        }).length;
        setCounts({ u5, u6 });
      })
      .catch(() => {});
  }, [role]);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(false);
  };

  const goToOffers = () => {
    dismiss();
    navigate(offersPath);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss(); }}
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'var(--surface-2,#1c1c2e)', border: '0.5px solid rgba(255,255,255,0.1)' }}>

        {/* Header */}
        <div style={{ background: '#0f0f1e', padding: '1.1rem 1.4rem 0.9rem', borderBottom: '0.5px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div style={{ background: '#f59e0b', borderRadius: 8, padding: '5px 8px', display: 'flex' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#0f0f1e' }}>local_offer</span>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: '#f59e0b', margin: 0, textTransform: 'uppercase' }}>New consumer offer</p>
                <p style={{ fontSize: 15, fontWeight: 500, color: '#fff', margin: 0 }}>D22 Hyryder — August 2026</p>
              </div>
            </div>
            <button
              onClick={dismiss}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#aaa' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
            </button>
          </div>
        </div>

        {/* Scheme cards */}
        <div style={{ padding: '1.1rem 1.4rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            <button
              onClick={goToOffers}
              style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderTop: '3px solid #3b82f6', borderRadius: 12, padding: '1rem', textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(59,130,246,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            >
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>D22U5</p>
              <p style={{ fontSize: 22, fontWeight: 500, color: '#fff', margin: '0 0 8px' }}>₹2,30,688</p>
              <span style={{ background: 'rgba(59,130,246,0.15)', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500, color: '#93c5fd' }}>
                {counts.u5} available
              </span>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '6px 0 0' }}>Tap to view offers</p>
            </button>

            <button
              onClick={goToOffers}
              style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderTop: '3px solid #8b5cf6', borderRadius: 12, padding: '1rem', textAlign: 'left', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,92,246,0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            >
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '0 0 4px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>D22U6</p>
              <p style={{ fontSize: 22, fontWeight: 500, color: '#fff', margin: '0 0 8px' }}>₹2,46,164</p>
              <span style={{ background: 'rgba(139,92,246,0.15)', borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 500, color: '#c4b5fd' }}>
                {counts.u6} available
              </span>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '6px 0 0' }}>Tap to view offers</p>
            </button>

          </div>

          {/* Notes */}
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '0.5px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '0.85rem 1rem' }}>
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#f59e0b', marginTop: 1, flexShrink: 0 }}>info</span>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#f59e0b', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Important notes</p>
                <ul style={{ margin: 0, paddingLeft: '1rem', listStyle: 'disc' }}>
                  <li style={{ fontSize: 13, color: '#fcd34d' }}>No Nandilath Coupon for both U5 and U6</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '0 1.4rem 1.1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={dismiss}
            style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '7px 18px', fontSize: 13, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
          >
            Got it, close
          </button>
        </div>

      </div>
    </div>
  );
}
