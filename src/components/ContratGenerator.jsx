import { useState, useEffect } from 'react';
import { api, fmt, printDocument } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUT_SOUM = {
  brouillon: { label: 'Brouillon',  color: '#78716c' },
  envoyée:   { label: 'Envoyée',    color: '#2563eb' },
  acceptée:  { label: 'Acceptée',   color: '#16a34a' },
  refusée:   { label: 'Refusée',    color: '#dc2626' },
};

export default function ContratGenerator({ selectedChantier, setActiveTab }) {
  const { refreshUser } = useAuth();
  const [soumissions, setSoumissions]   = useState([]);
  const [contrats, setContrats]         = useState([]);
  const [generating, setGenerating]     = useState(null);
  const [activeContrat, setActiveContrat] = useState(null);

  useEffect(() => {
    if (!selectedChantier) return;
    Promise.all([
      api.getSoumissions(selectedChantier.id),
      api.getContrats(selectedChantier.id),
    ]).then(([s, c]) => { setSoumissions(s); setContrats(c); }).catch(() => {});
  }, [selectedChantier]);

  if (!selectedChantier) {
    return (
      <div style={s.noChantier}>
        <div style={s.noIcon}>📄</div>
        <h2 style={s.noTitle}>Aucun chantier sélectionné</h2>
        <p style={s.noText}>Sélectionnez un chantier dans l'onglet Chantiers.</p>
        <button onClick={() => setActiveTab('chantiers')} style={s.btnPrimary}>🏗️ Aller aux chantiers</button>
      </div>
    );
  }

  const handleGenerer = async (soumission) => {
    setGenerating(soumission.id);
    setActiveContrat(null);
    try {
      const res = await api.genererContrat({ chantierId: selectedChantier.id, soumissionId: soumission.id });
      if (res.success) {
        setContrats(prev => [res.contrat, ...prev]);
        setActiveContrat(res.contrat);
        refreshUser();
      }
    } catch (err) {
      alert('Erreur génération: ' + err.message);
    } finally {
      setGenerating(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce contrat ?')) return;
    await api.deleteContrat(id);
    setContrats(prev => prev.filter(c => c.id !== id));
    if (activeContrat?.id === id) setActiveContrat(null);
  };

  const soumSansContrat = soumissions.filter(s => !contrats.some(c => c.soumissionId === s.id));
  const soumAvecContrat = soumissions.filter(s =>  contrats.some(c => c.soumissionId === s.id));

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.h1}>📄 Contrats</h1>
          <p style={s.sub}>Chantier : <strong>{selectedChantier.nom}</strong> — {selectedChantier.client}</p>
        </div>
      </div>

      <div style={s.infoBar}>
        💡 <strong>À quoi ça sert :</strong> Une soumission acceptée verbalement, ça ne protège personne. Le contrat met tout par écrit en langage clair — ce qu'on fait, combien, quand, et quoi faire si ça ne marche pas. Ça prend 30 secondes à générer, ça t'évite des problèmes.
      </div>

      {/* CONTRAT PREVIEW */}
      {activeContrat && (
        <div style={s.previewCard} className="fade-in">
          <div style={s.previewHeader}>
            <div>
              <h2 style={s.previewTitle}>Contrat — {activeContrat.numeroSoumission}</h2>
              <span style={s.previewDate}>Généré le {new Date(activeContrat.createdAt).toLocaleDateString('fr-CA')}</span>
            </div>
            <div style={s.previewBtns}>
              <button onClick={() => printDocument(`Contrat — ${activeContrat.numeroSoumission}`, activeContrat.texte)} style={s.btnPrimary}>🖨️ Imprimer / PDF</button>
              <button onClick={() => setActiveContrat(null)} style={s.btnSecondary}>Fermer</button>
            </div>
          </div>
          <pre style={s.previewText}>{activeContrat.texte}</pre>
        </div>
      )}

      {/* SOUMISSIONS SANS CONTRAT */}
      {soumissions.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}>📋</div>
          <p style={s.emptyText}>Aucune soumission pour ce chantier. Créez d'abord une soumission.</p>
          <button onClick={() => setActiveTab('soumissions')} style={s.btnPrimary}>📋 Aller aux soumissions</button>
        </div>
      ) : (
        <>
          {soumSansContrat.length > 0 && (
            <div style={s.section}>
              <h2 style={s.sectionTitle}>Soumissions sans contrat</h2>
              <div style={s.soumList}>
                {soumSansContrat.map(soum => {
                  const st = STATUT_SOUM[soum.statut] || STATUT_SOUM.brouillon;
                  const isGenerating = generating === soum.id;
                  return (
                    <div key={soum.id} style={s.soumCard}>
                      <div style={s.soumLeft}>
                        <span style={s.soumNum}>{soum.numero}</span>
                        <span style={s.soumType}>{soum.typesTravaux}</span>
                        <span style={{ ...s.badge, color: st.color }}>{st.label}</span>
                      </div>
                      <div style={s.soumRight}>
                        <span style={s.soumTotal}>{fmt(soum.total)}</span>
                        <button
                          onClick={() => handleGenerer(soum)}
                          style={{ ...s.btnPrimary, ...(isGenerating ? {} : {}) }}
                          disabled={!!generating}
                        >
                          {isGenerating ? '⏳ Génération...' : '📄 Générer le contrat'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {soumAvecContrat.length > 0 && (
            <div style={s.section}>
              <h2 style={s.sectionTitle}>Contrats existants</h2>
              <div style={s.contratList}>
                {contrats.map(contrat => {
                  const soum = soumissions.find(s => s.id === contrat.soumissionId);
                  return (
                    <div key={contrat.id} style={s.contratCard}>
                      <div style={s.contratLeft}>
                        <span style={s.contratIcon}>📄</span>
                        <div>
                          <span style={s.contratNum}>Contrat — {contrat.numeroSoumission}</span>
                          <span style={s.contratDate}>Généré le {new Date(contrat.createdAt).toLocaleDateString('fr-CA')}</span>
                          {soum && <span style={s.contratMont}>{fmt(soum.total)}</span>}
                        </div>
                      </div>
                      <div style={s.contratBtns}>
                        <button onClick={() => setActiveContrat(contrat)} style={s.btnSecondary}>👁 Voir</button>
                        <button onClick={() => printDocument(`Contrat — ${contrat.numeroSoumission}`, contrat.texte)} style={s.btnSecondary}>🖨️ Imprimer</button>
                        <button onClick={() => handleDelete(contrat.id)} style={{ ...s.btnSecondary, color: '#dc2626', borderColor: '#fecaca' }}>🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const s = {
  page:    { padding: 32, maxWidth: 1100, margin: '0 auto' },
  infoBar: { background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, padding: '10px 16px', marginBottom: 24, fontSize: 13, color: '#713f12', lineHeight: 1.5 },
  topBar:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  h1:      { margin: 0, fontSize: 26, fontWeight: 700, color: '#1c1917' },
  sub:     { margin: '4px 0 0', color: '#78716c', fontSize: 14 },
  noChantier: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', gap: 12 },
  noIcon:  { fontSize: 56 },
  noTitle: { margin: 0, fontSize: 22, color: '#1c1917' },
  noText:  { color: '#78716c', maxWidth: 360 },
  empty:   { textAlign: 'center', padding: '60px 20px' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#78716c', marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#1c1917', marginBottom: 14 },
  soumList: { display: 'flex', flexDirection: 'column', gap: 10 },
  soumCard: {
    background: '#fff', borderRadius: 12, padding: '16px 20px',
    border: '1px solid #e7e5e4', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap', gap: 12,
  },
  soumLeft:  { display: 'flex', alignItems: 'center', gap: 12 },
  soumRight: { display: 'flex', alignItems: 'center', gap: 12 },
  soumNum:   { fontWeight: 700, color: '#ea580c', fontSize: 14 },
  soumType:  { fontSize: 14, color: '#44403c' },
  soumTotal: { fontWeight: 700, fontSize: 16, color: '#1c1917' },
  badge:     { fontSize: 12, fontWeight: 700 },
  contratList: { display: 'flex', flexDirection: 'column', gap: 10 },
  contratCard: {
    background: '#f0fdf4', borderRadius: 12, padding: '16px 20px',
    border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', flexWrap: 'wrap', gap: 12,
  },
  contratLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  contratIcon: { fontSize: 28 },
  contratNum:  { display: 'block', fontWeight: 700, fontSize: 15, color: '#1c1917' },
  contratDate: { display: 'block', fontSize: 12, color: '#78716c', marginTop: 2 },
  contratMont: { display: 'block', fontSize: 14, fontWeight: 700, color: '#ea580c', marginTop: 2 },
  contratBtns: { display: 'flex', gap: 8 },
  previewCard: { background: '#fff', borderRadius: 16, padding: 28, marginBottom: 28, border: '2px solid #fb923c', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  previewTitle: { margin: 0, fontSize: 20, fontWeight: 700, color: '#1c1917' },
  previewDate:  { display: 'block', fontSize: 13, color: '#78716c', marginTop: 4 },
  previewBtns:  { display: 'flex', gap: 10 },
  previewText: { whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, color: '#1c1917', background: '#fafaf9', padding: 20, borderRadius: 8, maxHeight: 600, overflowY: 'auto', border: '1px solid #e7e5e4' },
  btnPrimary:   { background: '#ea580c', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  btnSecondary: { background: '#f5f5f4', color: '#44403c', border: '1px solid #d6d3d1', borderRadius: 8, padding: '10px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};
