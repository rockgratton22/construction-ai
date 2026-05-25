import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../utils/api.js';

export default function TrialBanner() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  if (!user) return null;
  if (user.subscription?.status === 'active') return null;

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

  return (
    <div className="no-print" style={s.bar}>
      <span style={s.text}>
        🎁 <strong>Essai gratuit</strong> — 1 projet complet inclus. Abonnez-vous pour des projets illimités.
      </span>
      <button onClick={handleSubscribe} disabled={loading} style={s.btn}>
        {loading ? '...' : 'S\'abonner — 199 $/mois →'}
      </button>
    </div>
  );
}

const s = {
  bar: {
    background: '#fef9c3', borderBottom: '1px solid #fde047',
    padding: '8px 24px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
  },
  text:  { color: '#713f12', fontSize: 13 },
  btn: {
    background: '#f97316', color: '#fff', border: 'none', borderRadius: 8,
    padding: '6px 16px', fontSize: 13, fontWeight: 700,
    cursor: 'pointer', whiteSpace: 'nowrap',
  },
};
