import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage() {
  const [mode, setMode]               = useState('login');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  const { login, signup } = useAuth();

  const switchMode = (m) => { setMode(m); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(email, password, nomEntreprise);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoWrap}>
          <div style={s.logoIcon}>🏗️</div>
          <h1 style={s.logoTitle}>
            Construction<span style={s.logoAccent}>AI</span>
          </h1>
          <p style={s.logoSub}>Soumissions · Extras · Factures · Contrats</p>
        </div>

        {/* Toggle */}
        <div style={s.tabs}>
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => switchMode(m)} style={{ ...s.tab, ...(mode === m ? s.tabActive : {}) }}>
              {m === 'login' ? 'Se connecter' : 'Créer un compte'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          {mode === 'signup' && (
            <div style={s.field}>
              <label style={s.label}>Nom de l'entreprise</label>
              <input
                type="text"
                placeholder="Construction Tremblay Inc."
                value={nomEntreprise}
                onChange={e => setNomEntreprise(e.target.value)}
                style={s.input}
              />
            </div>
          )}

          <div style={s.field}>
            <label style={s.label}>Adresse courriel</label>
            <input
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={s.input}
            />
          </div>

          <div style={s.field}>
            <label style={s.label}>Mot de passe</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={s.input}
            />
            {mode === 'signup' && (
              <p style={s.hint}>Minimum 6 caractères</p>
            )}
          </div>

          {error && <div style={s.errBox}>{error}</div>}

          <button type="submit" disabled={loading} style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }}>
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter →' : 'Créer mon compte →'}
          </button>
        </form>

        {mode === 'signup' && (
          <p style={s.trialNote}>
            ✅ 1 projet complet gratuit · Aucune carte de crédit requise
          </p>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1c1917 0%, #292524 50%, #1c1917 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: 24,
  },
  card: {
    width: '100%', maxWidth: 420,
    background: '#fff', borderRadius: 20, padding: 40,
    boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
  },
  logoWrap:   { textAlign: 'center', marginBottom: 28 },
  logoIcon:   { fontSize: 44, marginBottom: 8 },
  logoTitle:  { color: '#1c1917', fontSize: 26, fontWeight: 900, margin: '0 0 4px' },
  logoAccent: { color: '#f97316' },
  logoSub:    { color: '#78716c', fontSize: 12, margin: 0 },
  tabs:       { display: 'flex', background: '#f5f5f4', borderRadius: 10, padding: 4, gap: 4 },
  tab: {
    flex: 1, padding: '9px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
    background: 'transparent', color: '#78716c', fontWeight: 500, fontSize: 13,
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#fff', color: '#1c1917', fontWeight: 700,
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
  },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#44403c', marginBottom: 6 },
  input: {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid #e7e5e4', borderRadius: 8,
    fontSize: 14, color: '#1c1917', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  },
  hint:    { fontSize: 12, color: '#a8a29e', margin: '4px 0 0' },
  errBox: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
    padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 13,
  },
  btn: {
    width: '100%', padding: '13px 0', marginTop: 8,
    background: '#f97316', color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', transition: 'background 0.2s', fontFamily: 'inherit',
  },
  btnDisabled: { background: '#d4d4d4', cursor: 'not-allowed' },
  trialNote: {
    textAlign: 'center', fontSize: 13, color: '#78716c',
    margin: '16px 0 0',
  },
};
