import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../utils/api.js';

export default function SubscribeModal() {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleSubscribe = async () => {
    setLoading(true);
    setErr('');
    try {
      const { url, error } = await api.stripeCheckout();
      if (error) { setErr(error); setLoading(false); return; }
      window.location.href = url;
    } catch (e) {
      setErr(e.message);
      setLoading(false);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>⏰</div>
        <h2 style={s.title}>Votre essai gratuit est terminé</h2>
        <p style={s.sub}>Continuez à utiliser ConstructionAI sans interruption avec un abonnement mensuel.</p>

        <div style={s.priceBox}>
          <div style={s.price}>199 <span style={s.priceSub}>$/mois CAD</span></div>
          <p style={s.cancel}>Annulable en tout temps</p>
          <div style={s.features}>
            {[
              '✅ Soumissions professionnelles illimitées',
              '✅ Analyse de factures par IA',
              '✅ Génération de contrats légaux',
              '✅ Gestion des extras et chantiers',
              '✅ Support prioritaire',
            ].map(f => <div key={f} style={s.feature}>{f}</div>)}
          </div>
        </div>

        {err && <div style={s.errBox}>{err}</div>}

        <button onClick={handleSubscribe} disabled={loading} style={{ ...s.btn, ...(loading ? s.btnDis : {}) }}>
          {loading ? 'Redirection vers Stripe...' : 'S\'abonner maintenant →'}
        </button>

        <button onClick={logout} style={s.logoutBtn}>Se déconnecter</button>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(28,25,23,0.88)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: 24,
  },
  card: {
    background: '#fff', borderRadius: 20, padding: '48px 40px',
    maxWidth: 480, width: '100%', textAlign: 'center',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  },
  title:    { fontSize: 24, fontWeight: 800, color: '#1c1917', margin: '0 0 10px' },
  sub:      { color: '#78716c', fontSize: 15, margin: '0 0 24px' },
  priceBox: { background: '#fef7ed', border: '1px solid #fed7aa', borderRadius: 14, padding: 24, marginBottom: 20 },
  price:    { fontSize: 42, fontWeight: 900, color: '#f97316' },
  priceSub: { fontSize: 18 },
  cancel:   { color: '#a8a29e', fontSize: 13, margin: '4px 0 16px' },
  features: { display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' },
  feature:  { fontSize: 13, color: '#44403c' },
  errBox: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
    padding: '10px 14px', marginBottom: 12, color: '#dc2626', fontSize: 13,
  },
  btn: {
    width: '100%', padding: '14px 0', background: '#f97316',
    color: '#fff', border: 'none', borderRadius: 10, fontSize: 16,
    fontWeight: 700, cursor: 'pointer', marginBottom: 12, fontFamily: 'inherit',
  },
  btnDis:     { background: '#d4d4d4', cursor: 'not-allowed' },
  logoutBtn: {
    background: 'none', border: 'none', color: '#a8a29e',
    fontSize: 13, cursor: 'pointer', textDecoration: 'underline',
  },
};
