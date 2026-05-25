import { useState, useEffect, useRef } from 'react';
import { api, fmt, fileToBase64, createThumbnail } from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';

const CATEGORIES = ['matériaux', 'sous-traitant', 'équipement', 'location', 'autre'];

const STATUT_CFG = {
  en_attente: { label: 'En attente', color: '#d97706', bg: '#fffbeb' },
  validée:    { label: 'Validée',    color: '#16a34a', bg: '#f0fdf4' },
  rejetée:    { label: 'Rejetée',    color: '#dc2626', bg: '#fef2f2' },
};

export default function FactureUpload({ selectedChantier, setActiveTab }) {
  const { refreshUser } = useAuth();
  const [factures, setFactures]     = useState([]);
  const [analysing, setAnalysing]   = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [newFacture, setNewFacture] = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    if (!selectedChantier) return;
    api.getFactures(selectedChantier.id).then(setFactures).catch(() => {});
  }, [selectedChantier]);

  if (!selectedChantier) {
    return (
      <div style={s.noChantier}>
        <div style={s.noIcon}>🧾</div>
        <h2 style={s.noTitle}>Aucun chantier sélectionné</h2>
        <p style={s.noText}>Sélectionnez un chantier dans l'onglet Chantiers.</p>
        <button onClick={() => setActiveTab('chantiers')} style={s.btnPrimary}>🏗️ Aller aux chantiers</button>
      </div>
    );
  }

  const handleFile = async (file) => {
    if (!file) return;
    const mimeType = file.type;
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(mimeType)) {
      alert('Formats acceptés : JPEG, PNG, WebP, PDF');
      return;
    }
    setAnalysing(true);
    setNewFacture(null);
    try {
      const [base64, thumbnail] = await Promise.all([fileToBase64(file), createThumbnail(file)]);
      const res = await api.analyserFacture({ base64, thumbnail, mimeType, chantierId: selectedChantier.id, fileName: file.name });
      if (res.success) {
        setNewFacture(res.facture);
        refreshUser();
      } else {
        alert('Erreur analyse: ' + (res.error || 'Inconnue'));
      }
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally {
      setAnalysing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const validerFacture = async (statut) => {
    if (!newFacture) return;
    const updated = await api.updateFacture(newFacture.id, { ...newFacture, statut });
    setFactures(prev => [updated, ...prev]);
    setNewFacture(null);
  };

  const updateNewFacture = (field, val) => {
    setNewFacture(f => ({ ...f, [field]: val }));
  };

  const changeStatut = async (id, statut) => {
    const updated = await api.updateFacture(id, { statut });
    setFactures(prev => prev.map(f => f.id === id ? updated : f));
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette facture ?')) return;
    await api.deleteFacture(id);
    setFactures(prev => prev.filter(f => f.id !== id));
  };

  const totalValidees = factures.filter(f => f.statut === 'validée').reduce((a, f) => a + (f.total || 0), 0);
  const totalEnAttente = factures.filter(f => f.statut === 'en_attente').length;

  const parCategorie = factures.filter(f => f.statut === 'validée').reduce((acc, f) => {
    const cat = f.categorie || 'autre';
    acc[cat] = (acc[cat] || 0) + (f.total || 0);
    return acc;
  }, {});

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.h1}>🧾 Factures fournisseurs</h1>
          <p style={s.sub}>Chantier : <strong>{selectedChantier.nom}</strong> — {selectedChantier.client}</p>
        </div>
      </div>
      <div style={s.infoBar}>
        💡 <strong>À quoi ça sert :</strong> Prends en photo tes factures de Home Depot, de sous-traitants, de location d'équipement — Claude extrait les données automatiquement. Tu gardes le contrôle de tes coûts réels par chantier, et tu vois ta marge dans l'onglet Chantiers.
      </div>

      {/* STATS */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <span style={s.statNum}>{factures.length}</span>
          <span style={s.statLabel}>Factures total</span>
        </div>
        <div style={{ ...s.statCard, background: totalEnAttente > 0 ? '#fffbeb' : '#fff', border: totalEnAttente > 0 ? '1px solid #fde68a' : '1px solid #e7e5e4' }}>
          <span style={{ ...s.statNum, color: totalEnAttente > 0 ? '#d97706' : '#1c1917' }}>{totalEnAttente}</span>
          <span style={s.statLabel}>En attente</span>
        </div>
        <div style={{ ...s.statCard, background: '#fef7ed', border: '1px solid #fed7aa' }}>
          <span style={{ ...s.statNum, color: '#c2410c' }}>{fmt(totalValidees)}</span>
          <span style={s.statLabel}>Total validé</span>
        </div>
      </div>

      {/* ZONE UPLOAD */}
      <div
        style={{ ...s.dropzone, ...(dragOver ? s.dropzoneActive : {}) }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !analysing && fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        {analysing ? (
          <div style={s.analysing}>
            <div style={s.spinner} />
            <p style={s.analysingText}>Claude analyse la facture...</p>
          </div>
        ) : (
          <>
            <div style={s.dropIcon}>📄</div>
            <p style={s.dropText}><strong>Déposez une facture ici</strong> ou cliquez pour choisir</p>
            <p style={s.dropSub}>JPEG, PNG, WebP ou PDF — Claude extrait automatiquement les données</p>
          </>
        )}
      </div>

      {/* RÉSULTAT ANALYSE */}
      {newFacture && (
        <div style={s.resultCard} className="fade-in">
          <div style={s.resultHeader}>
            <h3 style={s.resultTitle}>✅ Données extraites — À valider</h3>
          </div>
          <div style={s.resultGrid}>
            <label style={s.label}>
              Fournisseur
              <input style={s.input} value={newFacture.fournisseur} onChange={e => updateNewFacture('fournisseur', e.target.value)} />
            </label>
            <label style={s.label}>
              Numéro de facture
              <input style={s.input} value={newFacture.numeroFacture} onChange={e => updateNewFacture('numeroFacture', e.target.value)} />
            </label>
            <label style={s.label}>
              Date
              <input style={s.input} type="date" value={newFacture.date} onChange={e => updateNewFacture('date', e.target.value)} />
            </label>
            <label style={s.label}>
              Catégorie
              <select style={s.input} value={newFacture.categorie} onChange={e => updateNewFacture('categorie', e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </label>
          </div>
          <label style={s.label}>
            Description
            <input style={s.input} value={newFacture.description} onChange={e => updateNewFacture('description', e.target.value)} />
          </label>
          <div style={s.montantsRow}>
            <label style={s.label}>
              Sous-total
              <input style={s.input} type="number" step="0.01" value={newFacture.sousTotal} onChange={e => updateNewFacture('sousTotal', parseFloat(e.target.value)||0)} />
            </label>
            <label style={s.label}>
              TPS
              <input style={s.input} type="number" step="0.01" value={newFacture.tps} onChange={e => updateNewFacture('tps', parseFloat(e.target.value)||0)} />
            </label>
            <label style={s.label}>
              TVQ
              <input style={s.input} type="number" step="0.01" value={newFacture.tvq} onChange={e => updateNewFacture('tvq', parseFloat(e.target.value)||0)} />
            </label>
            <label style={s.label}>
              Total
              <input style={{ ...s.input, fontWeight: 700, color: '#c2410c' }} type="number" step="0.01" value={newFacture.total} onChange={e => updateNewFacture('total', parseFloat(e.target.value)||0)} />
            </label>
          </div>
          <div style={s.resultBtns}>
            <button onClick={() => setNewFacture(null)} style={s.btnDanger}>🗑️ Rejeter</button>
            <button onClick={() => validerFacture('validée')} style={s.btnPrimary}>✅ Valider et enregistrer</button>
          </div>
        </div>
      )}

      {/* RÉSUMÉ PAR CATÉGORIE */}
      {Object.keys(parCategorie).length > 0 && (
        <div style={s.categoriesCard}>
          <h3 style={s.catTitle}>Dépenses validées par catégorie</h3>
          <div style={s.catGrid}>
            {Object.entries(parCategorie).map(([cat, mont]) => (
              <div key={cat} style={s.catItem}>
                <span style={s.catName}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                <span style={s.catMont}>{fmt(mont)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LISTE FACTURES */}
      {factures.length > 0 && (
        <div style={s.listSection}>
          <h2 style={s.listTitle}>Toutes les factures</h2>
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Date</th>
                  <th style={s.th}>Fournisseur</th>
                  <th style={s.th}>Description</th>
                  <th style={s.th}>Catégorie</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>Total TTC</th>
                  <th style={s.th}>Statut</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {factures.map(f => {
                  const st = STATUT_CFG[f.statut] || STATUT_CFG.en_attente;
                  return (
                    <tr key={f.id}>
                      <td style={s.td}>{f.date}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{f.fournisseur || '—'}</td>
                      <td style={{ ...s.td, color: '#78716c', maxWidth: 200 }}>{f.description || '—'}</td>
                      <td style={s.td}>
                        <span style={s.catBadge}>{f.categorie}</span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>{fmt(f.total)}</td>
                      <td style={s.td}>
                        <select value={f.statut} onChange={e => changeStatut(f.id, e.target.value)}
                          style={{ ...s.statSelect, color: st.color }}>
                          {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td style={s.td}>
                        <button onClick={() => handleDelete(f.id)} style={s.iconBtn} title="Supprimer">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#fef7ed' }}>
                  <td colSpan={4} style={{ ...s.td, fontWeight: 700, paddingLeft: 12 }}>TOTAL VALIDÉ</td>
                  <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, fontSize: 16, color: '#c2410c' }}>{fmt(totalValidees)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page:    { padding: 32, maxWidth: 1100, margin: '0 auto' },
  infoBar: { background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#713f12', lineHeight: 1.5 },
  topBar:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  h1:      { margin: 0, fontSize: 26, fontWeight: 700, color: '#1c1917' },
  sub:     { margin: '4px 0 0', color: '#78716c', fontSize: 14 },
  noChantier: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', gap: 12 },
  noIcon:  { fontSize: 56 },
  noTitle: { margin: 0, fontSize: 22, color: '#1c1917' },
  noText:  { color: '#78716c', maxWidth: 360 },
  statsRow:{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  statCard:{ flex: '1 1 140px', background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, padding: '16px 20px', textAlign: 'center' },
  statNum: { display: 'block', fontSize: 24, fontWeight: 700, color: '#1c1917' },
  statLabel:{ display: 'block', fontSize: 12, color: '#78716c', marginTop: 4, fontWeight: 600 },
  dropzone:{
    background: '#fff', border: '2px dashed #d6d3d1', borderRadius: 16,
    padding: 40, textAlign: 'center', cursor: 'pointer', marginBottom: 24,
    transition: 'all 0.2s',
  },
  dropzoneActive: { border: '2px dashed #ea580c', background: '#fff7ed' },
  dropIcon:{ fontSize: 40, marginBottom: 8 },
  dropText:{ margin: '0 0 6px', fontSize: 15, color: '#44403c' },
  dropSub: { margin: 0, fontSize: 12, color: '#78716c' },
  analysing: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  spinner: { width: 32, height: 32, border: '3px solid #fed7aa', borderTopColor: '#ea580c', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  analysingText: { color: '#44403c', fontWeight: 600 },
  resultCard: { background: '#fff', borderRadius: 16, padding: 24, marginBottom: 24, border: '2px solid #fb923c', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  resultHeader: { marginBottom: 16 },
  resultTitle: { margin: 0, fontSize: 16, fontWeight: 700, color: '#1c1917' },
  resultGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 },
  montantsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 },
  label: { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#44403c', marginBottom: 12 },
  input: { padding: '8px 10px', borderRadius: 8, border: '1.5px solid #d6d3d1', fontSize: 14, color: '#1c1917', outline: 'none', fontFamily: 'inherit' },
  resultBtns: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  categoriesCard: { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid #e7e5e4' },
  catTitle: { margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1c1917' },
  catGrid:  { display: 'flex', gap: 12, flexWrap: 'wrap' },
  catItem:  { background: '#fef7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 16px', minWidth: 150 },
  catName:  { display: 'block', fontSize: 12, color: '#78716c', fontWeight: 600, textTransform: 'capitalize' },
  catMont:  { display: 'block', fontSize: 18, fontWeight: 700, color: '#c2410c', marginTop: 2 },
  catBadge: { background: '#fef7ed', color: '#c2410c', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 8, textTransform: 'capitalize' },
  listSection: { marginTop: 24 },
  listTitle: { fontSize: 18, fontWeight: 700, color: '#1c1917', marginBottom: 12 },
  tableWrap: { overflowX: 'auto', borderRadius: 12, border: '1px solid #e7e5e4', background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th:    { background: '#fef7ed', padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#44403c', borderBottom: '2px solid #fed7aa' },
  td:    { padding: '12px 14px', borderBottom: '1px solid #f0f0f0', color: '#1c1917' },
  statSelect: { padding: '5px 8px', borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 12, cursor: 'pointer', fontWeight: 700 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15 },
  btnPrimary: { background: '#ea580c', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  btnDanger:  { background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
};
