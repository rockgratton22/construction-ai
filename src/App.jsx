import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { api } from './utils/api.js';
import AuthPage from './pages/AuthPage.jsx';
import TrialBanner from './components/TrialBanner.jsx';
import SubscribeModal from './components/SubscribeModal.jsx';
import Header from './components/Header.jsx';
import ChantierManager from './components/ChantierManager.jsx';
import SoumissionGenerator from './components/SoumissionGenerator.jsx';
import ExtrasTracker from './components/ExtrasTracker.jsx';
import FactureUpload from './components/FactureUpload.jsx';
import ContratGenerator from './components/ContratGenerator.jsx';
import ParametresEntreprise from './components/ParametresEntreprise.jsx';

export default function App() {
  const { user, loading: authLoading, token, trialExpired, refreshUser } = useAuth();
  const [activeTab, setActiveTab]         = useState('chantiers');
  const [chantiers, setChantiers]         = useState([]);
  const [selectedChantier, setSelectedChantier] = useState(null);
  const [serverOk, setServerOk]           = useState(null);
  const [verifyingSession, setVerifyingSession] = useState(false);

  // Server health check (no auth required)
  useEffect(() => {
    fetch('/api/health')
      .then(r => r.ok ? setServerOk(true) : setServerOk(false))
      .catch(() => setServerOk(false));
  }, []);

  // Load chantiers when authenticated
  useEffect(() => {
    if (!user) return;
    api.getChantiers()
      .then(setChantiers)
      .catch(() => {});
  }, [user]);

  // Handle Stripe success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId || !token) return;
    setVerifyingSession(true);
    window.history.replaceState({}, '', '/');
    api.stripeVerify(sessionId)
      .then(() => refreshUser())
      .catch(() => {})
      .finally(() => setVerifyingSession(false));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (serverOk === false) {
    return (
      <div style={s.errWrap}>
        <div style={s.errCard}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ margin: '0 0 12px', color: '#1c1917' }}>Serveur non démarré</h2>
          <p style={{ color: '#78716c', marginBottom: 20 }}>Lancez l'application dans le terminal :</p>
          <code style={s.code}>npm run dev</code>
        </div>
      </div>
    );
  }

  if (serverOk === null || authLoading || verifyingSession) {
    return <div style={s.loading}>⚡ Chargement...</div>;
  }

  if (!token || !user) return <AuthPage />;

  if (trialExpired) return <SubscribeModal />;

  return (
    <div style={s.app}>
      <TrialBanner />
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedChantier={selectedChantier}
        setSelectedChantier={setSelectedChantier}
      />
      <main style={s.main}>
        {activeTab === 'chantiers' && (
          <ChantierManager
            chantiers={chantiers}
            setChantiers={setChantiers}
            selectedChantier={selectedChantier}
            setSelectedChantier={setSelectedChantier}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'soumissions' && (
          <SoumissionGenerator selectedChantier={selectedChantier} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'extras' && (
          <ExtrasTracker selectedChantier={selectedChantier} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'factures' && (
          <FactureUpload selectedChantier={selectedChantier} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'contrats' && (
          <ContratGenerator selectedChantier={selectedChantier} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'parametres' && <ParametresEntreprise />}
      </main>
    </div>
  );
}

const s = {
  app:     { minHeight: '100vh', background: '#fef7ed', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  main:    { minHeight: 'calc(100vh - 64px)' },
  errWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#fef7ed' },
  errCard: { background: '#fff', border: '1px solid #e7e5e4', borderRadius: 16, padding: 48, maxWidth: 480, textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  code:    { display: 'inline-block', background: '#1c1917', color: '#fb923c', padding: '10px 24px', borderRadius: 8, fontFamily: 'monospace', fontSize: 16 },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#78716c', fontSize: 18 },
};
