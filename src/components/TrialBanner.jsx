import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../utils/api.js';

export default function TrialBanner() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!user) return null;
  if (user.subscription?.status === 'active') return null;

  const days = user.daysRemaining ?? 30;

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const { url, error } = await api.stripeCheckout();
      if (error) { alert(error); setLoading(false); return; }
      window.location.href = url;
    } catch (err) {
      if (!err.trialExpired) alert('Erreur: ' + err.message);
      setLoading(false);
    }
  };

  const bg     = days > 10 ? '#dcfce7' : days > 5 ? '#fef3c7' : '#fef2f2';
  const color  = days > 10 ? '#15803d' : days > 5 ? '#92400e' : '#dc2626';
  const border = days > 10 ? '#bbf7d0' : days > 5 ? '#fde68a' : '#fecaca';

  return (
    <div className="no-print" style={{ background: bg, borderBottom: `1px solid ${border}`, padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ color, fontSize: 13, fontWeight: 600 }}>
        {days > 0
          ? `⏳ Essai gratuit — ${days} jour${days > 1 ? 's' : ''} restant${days > 1 ? 's' : ''}`
          : '⚠️ Votre période d\'essai est terminée'}
      </span>
      <button onClick={handleSubscribe} disabled={loading} style={{
        background: '#f97316', color: '#fff', border: 'none', borderRadius: 8,
        padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
      }}>
        {loading ? '...' : 'S\'abonner — 199 $/mois →'}
      </button>
    </div>
  );
}
