import { useAuth } from '../context/AuthContext.jsx';

export default function Header({ activeTab, setActiveTab, selectedChantier, setSelectedChantier }) {
  const { user, logout } = useAuth();

  const tabs = [
    { id: 'chantiers',   label: '🏗️ Chantiers' },
    { id: 'soumissions', label: '📋 Soumissions' },
    { id: 'extras',      label: '➕ Extras' },
    { id: 'factures',    label: '🧾 Factures' },
    { id: 'contrats',    label: '📄 Contrats' },
    { id: 'parametres',  label: '⚙️ Paramètres' },
  ];

  return (
    <header style={s.header} className="no-print">
      <div style={s.logo}>
        <span style={s.logoIcon}>🏗️</span>
        <div>
          <span style={s.logoName}>ConstructionAI</span>
          <span style={s.logoTag}>Soumissions · Extras · Factures · Contrats</span>
        </div>
      </div>

      <nav style={s.nav}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ ...s.navBtn, ...(activeTab === tab.id ? s.navActive : {}) }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {selectedChantier && (
        <div style={s.chantierBadge}>
          <span style={s.chantierLabel}>📍 {selectedChantier.nom}</span>
          <button onClick={() => setSelectedChantier(null)} style={s.clearBtn} title="Désélectionner">✕</button>
        </div>
      )}

      {user && (
        <div style={s.userArea}>
          <span style={s.userEmail}>{user.email}</span>
          <button onClick={logout} style={s.logoutBtn} title="Déconnexion">↪ Déconnexion</button>
        </div>
      )}
    </header>
  );
}

const s = {
  header: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '0 20px', height: 64, background: '#1c1917',
    boxShadow: '0 2px 8px rgba(0,0,0,0.4)', position: 'sticky', top: 0, zIndex: 100,
    flexWrap: 'wrap',
  },
  logo:     { display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 },
  logoIcon: { fontSize: 26 },
  logoName: { color: '#fff', fontWeight: 700, fontSize: 18, display: 'block', lineHeight: 1.2 },
  logoTag:  { color: '#fb923c', fontSize: 10, display: 'block' },
  nav:      { display: 'flex', gap: 2, flex: 1 },
  navBtn: {
    background: 'transparent', border: 'none', color: '#a8a29e',
    padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
    fontWeight: 500, transition: 'all 0.15s',
  },
  navActive: { background: 'rgba(251,146,60,0.2)', color: '#fb923c', fontWeight: 700 },
  chantierBadge: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)',
    borderRadius: 20, padding: '4px 12px',
  },
  chantierLabel: { color: '#fb923c', fontSize: 13, fontWeight: 600 },
  clearBtn: {
    background: 'none', border: 'none', color: '#fb923c', cursor: 'pointer',
    fontSize: 12, padding: '0 2px', lineHeight: 1,
  },
  userArea: { display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  userEmail: { color: '#78716c', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  logoutBtn: {
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#a8a29e', borderRadius: 6, padding: '5px 12px', fontSize: 12,
    cursor: 'pointer', fontFamily: 'inherit',
  },
};
