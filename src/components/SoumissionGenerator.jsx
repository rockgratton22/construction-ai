import { useState, useEffect } from 'react';
import { api, fmt, printDocument } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const UNITES = ['h', 'm²', 'm', 'pi²', 'pi', 'forfait', 'unité', 'tonne', 'verge³'];
const MODALITES_DEF = '30 % à la signature, 40 % mi-travaux, 30 % à la livraison';

const newPoste = () => ({ id: Date.now(), description: '', qte: 1, unite: 'h', prixUnit: 0 });

const STATUT_CFG = {
  brouillon: { label: 'Brouillon',  color: '#78716c', bg: '#f5f5f4' },
  envoyée:   { label: 'Envoyée',    color: '#2563eb', bg: '#eff6ff' },
  acceptée:  { label: 'Acceptée',   color: '#16a34a', bg: '#f0fdf4' },
  refusée:   { label: 'Refusée',    color: '#dc2626', bg: '#fef2f2' },
};

export default function SoumissionGenerator({ selectedChantier, setActiveTab }) {
  const { refreshUser } = useAuth();
  const [soumissions, setSoumissions]   = useState([]);
  const [showForm, setShowForm]         = useState(false);
  const [generating, setGenerating]     = useState(false);
  const [preview, setPreview]           = useState(null);
  const [postes, setPostes]             = useState([newPoste()]);
  const [form, setForm]                 = useState({
    typesTravaux: '', description: '', mainOeuvreHeures: 0, mainOeuvreRate: 75,
    delaiEstime: '', modalitesPaiement: MODALITES_DEF, conditionsSpeciales: '',
  });

  useEffect(() => {
    if (!selectedChantier) return;
    api.getSoumissions(selectedChantier.id).then(setSoumissions).catch(() => {});
  }, [selectedChantier]);

  if (!selectedChantier) {
    return (
      <div style={s.noChantier}>
        <div style={s.noIcon}>📋</div>
        <h2 style={s.noTitle}>Aucun chantier sélectionné</h2>
        <p style={s.noText}>Allez dans l'onglet Chantiers et cliquez sur un projet pour le sélectionner.</p>
        <button onClick={() => setActiveTab('chantiers')} style={s.btnPrimary}>🏗️ Aller aux chantiers</button>
      </div>
    );
  }

  const totalPostes = postes.reduce((a, p) => a + ((parseFloat(p.qte)||0) * (parseFloat(p.prixUnit)||0)), 0);
  const totalMO     = (parseFloat(form.mainOeuvreHeures)||0) * (parseFloat(form.mainOeuvreRate)||75);
  const sousTotal   = totalPostes + totalMO;
  const tps         = sousTotal * 0.05;
  const tvq         = sousTotal * 0.09975;
  const total       = sousTotal + tps + tvq;

  const addPoste    = () => setPostes(p => [...p, newPoste()]);
  const removePoste = (id) => setPostes(p => p.filter(x => x.id !== id));
  const updatePoste = (id, field, val) => setPostes(p => p.map(x => x.id === id ? { ...x, [field]: val } : x));

  const handleGenerer = async (e) => {
    e.preventDefault();
    setGenerating(true);
    setPreview(null);
    try {
      const res = await api.genererSoumission({ chantierId: selectedChantier.id, ...form, postes });
      if (res.success) {
        setSoumissions(prev => [res.soumission, ...prev]);
        setPreview(res.soumission);
        setShowForm(false);
        refreshUser();
      } else {
        alert('Erreur serveur: ' + (res.error || 'Réponse inattendue'));
      }
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const changeStatut = async (soum, statut) => {
    const updated = await api.updateSoumission(soum.id, { statut });
    setSoumissions(prev => prev.map(s => s.id === soum.id ? updated : s));
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette soumission ?')) return;
    await api.deleteSoumission(id);
    setSoumissions(prev => prev.filter(s => s.id !== id));
    if (preview?.id === id) setPreview(null);
  };

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.h1}>📋 Soumissions</h1>
          <p style={s.sub}>Chantier : <strong>{selectedChantier.nom}</strong> — {selectedChantier.client}</p>
        </div>
        <button onClick={() => { setShowForm(true); setPreview(null); }} style={s.btnPrimary}>+ Nouvelle soumission</button>
      </div>

      {/* FORMULAIRE */}
      {showForm && (
        <form onSubmit={handleGenerer} style={s.formCard} className="fade-in">
          <div style={s.formHeader}>
            <h2 style={s.formTitle}>Nouvelle soumission</h2>
            <button type="button" onClick={() => setShowForm(false)} style={s.closeBtn}>✕</button>
          </div>

          <div style={s.section}>
            <div style={s.grid2}>
              <label style={s.label}>
                Type de travaux *
                <input style={s.input} value={form.typesTravaux} required
                  onChange={e => setForm(f => ({ ...f, typesTravaux: e.target.value }))}
                  placeholder="Ex: Rénovation cuisine, toiture, fondation..." />
              </label>
              <label style={s.label}>
                Délai estimé
                <input style={s.input} value={form.delaiEstime}
                  onChange={e => setForm(f => ({ ...f, delaiEstime: e.target.value }))}
                  placeholder="Ex: 3 semaines" />
              </label>
            </div>
            <label style={s.label}>
              Description du projet
              <textarea style={{ ...s.input, minHeight: 80, resize: 'vertical' }} value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Décrivez les travaux prévus..." />
            </label>
          </div>

          <div style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>Postes de travaux</span>
              <button type="button" onClick={addPoste} style={s.btnSmall}>+ Ajouter un poste</button>
            </div>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, width: '40%' }}>Description</th>
                    <th style={{ ...s.th, width: '10%' }}>Qté</th>
                    <th style={{ ...s.th, width: '12%' }}>Unité</th>
                    <th style={{ ...s.th, width: '14%' }}>Prix/u</th>
                    <th style={{ ...s.th, width: '14%' }}>Total</th>
                    <th style={{ ...s.th, width: '10%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {postes.map(p => (
                    <tr key={p.id}>
                      <td style={s.td}><input style={s.tdInput} value={p.description} placeholder="Description..." onChange={e => updatePoste(p.id, 'description', e.target.value)} /></td>
                      <td style={s.td}><input style={{ ...s.tdInput, textAlign: 'center' }} type="number" min="0" step="0.5" value={p.qte} onChange={e => updatePoste(p.id, 'qte', e.target.value)} /></td>
                      <td style={s.td}>
                        <select style={s.tdInput} value={p.unite} onChange={e => updatePoste(p.id, 'unite', e.target.value)}>
                          {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td style={s.td}><input style={{ ...s.tdInput, textAlign: 'right' }} type="number" min="0" step="0.01" value={p.prixUnit} onChange={e => updatePoste(p.id, 'prixUnit', e.target.value)} /></td>
                      <td style={{ ...s.td, fontWeight: 600, textAlign: 'right', paddingRight: 8 }}>{fmt((parseFloat(p.qte)||0)*(parseFloat(p.prixUnit)||0))}</td>
                      <td style={s.td}>
                        <button type="button" onClick={() => removePoste(p.id)} style={s.removeBtn} disabled={postes.length === 1}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={s.section}>
            <span style={s.sectionTitle}>Main d'oeuvre</span>
            <div style={s.moRow}>
              <label style={{ ...s.label, margin: 0 }}>
                Heures
                <input style={{ ...s.input, width: 100 }} type="number" min="0" step="0.5"
                  value={form.mainOeuvreHeures} onChange={e => setForm(f => ({ ...f, mainOeuvreHeures: e.target.value }))} />
              </label>
              <span style={s.moX}>×</span>
              <label style={{ ...s.label, margin: 0 }}>
                Taux ($/h)
                <input style={{ ...s.input, width: 100 }} type="number" min="0" step="0.5"
                  value={form.mainOeuvreRate} onChange={e => setForm(f => ({ ...f, mainOeuvreRate: e.target.value }))} />
              </label>
              <span style={s.moTotal}>{fmt(totalMO)}</span>
            </div>
          </div>

          <div style={s.totalBox}>
            <div style={s.totalRow}><span>Sous-total postes</span><span>{fmt(totalPostes)}</span></div>
            <div style={s.totalRow}><span>Main d'oeuvre</span><span>{fmt(totalMO)}</span></div>
            <div style={s.totalRow}><span>Sous-total</span><span>{fmt(sousTotal)}</span></div>
            <div style={s.totalRow}><span>TPS (5%)</span><span>{fmt(tps)}</span></div>
            <div style={s.totalRow}><span>TVQ (9.975%)</span><span>{fmt(tvq)}</span></div>
            <div style={{ ...s.totalRow, ...s.totalFinal }}><span>TOTAL</span><span>{fmt(total)}</span></div>
          </div>

          <div style={s.section}>
            <label style={s.label}>
              Modalités de paiement
              <input style={s.input} value={form.modalitesPaiement}
                onChange={e => setForm(f => ({ ...f, modalitesPaiement: e.target.value }))} />
            </label>
            <label style={s.label}>
              Conditions spéciales (optionnel)
              <textarea style={{ ...s.input, minHeight: 60, resize: 'vertical' }} value={form.conditionsSpeciales}
                onChange={e => setForm(f => ({ ...f, conditionsSpeciales: e.target.value }))}
                placeholder="Conditions particulières, exclusions, notes..." />
            </label>
          </div>

          <div style={s.formBtns}>
            <button type="button" onClick={() => setShowForm(false)} style={s.btnSecondary}>Annuler</button>
            <button type="submit" style={s.btnPrimary} disabled={generating}>
              {generating ? '⏳ Claude génère la soumission...' : '✨ Générer la soumission'}
            </button>
          </div>
        </form>
      )}

      {/* PREVIEW */}
      {preview && (
        <div style={s.previewCard} className="fade-in">
          <div style={s.previewHeader}>
            <div>
              <span style={s.previewNum}>{preview.numero}</span>
              <span style={s.previewTotal}>{fmt(preview.total)}</span>
            </div>
            <div style={s.previewBtns}>
              <button onClick={() => printDocument(`Soumission ${preview.numero}`, preview.texteGenere)} style={s.btnPrimary}>🖨️ Imprimer / PDF</button>
              <button onClick={() => setPreview(null)} style={s.btnSecondary}>Fermer</button>
            </div>
          </div>
          <pre style={s.previewText}>{preview.texteGenere}</pre>
        </div>
      )}

      {/* LISTE DES SOUMISSIONS */}
      {soumissions.length > 0 && (
        <div style={s.listSection}>
          <h2 style={s.listTitle}>Soumissions existantes</h2>
          <div style={s.list}>
            {soumissions.map(soum => {
              const st = STATUT_CFG[soum.statut] || STATUT_CFG.brouillon;
              return (
                <div key={soum.id} style={s.listItem}>
                  <div style={s.listLeft}>
                    <span style={s.listNum}>{soum.numero}</span>
                    <span style={s.listType}>{soum.typesTravaux}</span>
                    <span style={{ ...s.badge, color: st.color, background: st.bg }}>{st.label}</span>
                  </div>
                  <div style={s.listRight}>
                    <span style={s.listTotal}>{fmt(soum.total)}</span>
                    <select value={soum.statut} onChange={e => changeStatut(soum, e.target.value)} style={s.statSelect}>
                      {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <button onClick={() => setPreview(soum)} style={s.btnSmall}>👁 Voir</button>
                    <button onClick={() => handleDelete(soum.id)} style={{ ...s.btnSmall, color: '#dc2626', borderColor: '#fecaca' }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page:    { padding: 32, maxWidth: 1100, margin: '0 auto' },
  topBar:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  h1:      { margin: 0, fontSize: 26, fontWeight: 700, color: '#1c1917' },
  sub:     { margin: '4px 0 0', color: '#78716c', fontSize: 14 },
  noChantier: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', gap: 12 },
  noIcon:  { fontSize: 56 },
  noTitle: { margin: 0, fontSize: 22, color: '#1c1917' },
  noText:  { color: '#78716c', maxWidth: 360 },
  formCard: { background: '#fff', borderRadius: 16, padding: 28, marginBottom: 28, border: '1px solid #e7e5e4', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  formHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  formTitle: { margin: 0, fontSize: 20, fontWeight: 700, color: '#1c1917' },
  closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#78716c' },
  section:  { marginBottom: 24 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#44403c' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 },
  label:   { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#44403c', marginBottom: 16 },
  input:   { padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d6d3d1', fontSize: 14, color: '#1c1917', outline: 'none', fontFamily: 'inherit' },
  tableWrap: { overflowX: 'auto' },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:      { background: '#fef7ed', padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#44403c', borderBottom: '2px solid #fed7aa' },
  td:      { padding: '6px 4px', borderBottom: '1px solid #f0f0f0' },
  tdInput: { width: '100%', padding: '6px 8px', border: '1px solid #e7e5e4', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit' },
  removeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.7 },
  moRow:   { display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: 8 },
  moX:     { fontSize: 18, fontWeight: 700, color: '#78716c', paddingBottom: 10 },
  moTotal: { fontSize: 18, fontWeight: 700, color: '#ea580c', paddingBottom: 10 },
  totalBox:{ background: '#fef7ed', borderRadius: 12, padding: '16px 20px', marginBottom: 24, border: '1px solid #fed7aa' },
  totalRow:{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14, color: '#44403c' },
  totalFinal: { borderTop: '2px solid #fb923c', marginTop: 8, paddingTop: 8, fontSize: 17, fontWeight: 700, color: '#c2410c' },
  formBtns:{ display: 'flex', justifyContent: 'flex-end', gap: 10 },
  previewCard: { background: '#fff', borderRadius: 16, padding: 28, marginBottom: 28, border: '1px solid #fed7aa', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  previewNum:  { display: 'block', fontSize: 18, fontWeight: 700, color: '#1c1917' },
  previewTotal:{ display: 'block', fontSize: 22, fontWeight: 700, color: '#ea580c', marginTop: 4 },
  previewBtns: { display: 'flex', gap: 10 },
  previewText: { whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, color: '#1c1917', background: '#fafaf9', padding: 20, borderRadius: 8, maxHeight: 600, overflowY: 'auto', border: '1px solid #e7e5e4' },
  listSection: { marginTop: 24 },
  listTitle: { fontSize: 18, fontWeight: 700, color: '#1c1917', marginBottom: 12 },
  list:    { display: 'flex', flexDirection: 'column', gap: 8 },
  listItem:{ background: '#fff', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e7e5e4', flexWrap: 'wrap', gap: 10 },
  listLeft:{ display: 'flex', alignItems: 'center', gap: 12 },
  listNum: { fontWeight: 700, color: '#ea580c', fontSize: 14 },
  listType:{ fontSize: 14, color: '#44403c' },
  listRight:{ display: 'flex', alignItems: 'center', gap: 10 },
  listTotal:{ fontWeight: 700, fontSize: 15, color: '#1c1917' },
  badge:   { fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10 },
  statSelect: { padding: '6px 8px', borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 13, cursor: 'pointer' },
  btnPrimary:   { background: '#ea580c', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  btnSecondary: { background: '#f5f5f4', color: '#44403c', border: '1px solid #d6d3d1', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnSmall:     { background: '#fff', color: '#44403c', border: '1px solid #d6d3d1', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};
