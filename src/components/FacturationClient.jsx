import { useState, useEffect } from 'react';
import { api, fmt, printDocument } from '../utils/api.js';

const TYPES = {
  acompte:     { label: 'Acompte',                         icon: '💰', desc: 'Premier versement avant les travaux' },
  'mi-travaux':{ label: 'Mi-travaux',                      icon: '🔨', desc: 'Versement à mi-chantier' },
  finale:      { label: 'Facture finale',                  icon: '✅', desc: 'Solde final à la livraison' },
  extras:      { label: 'Extras / Travaux supplémentaires',icon: '➕', desc: 'Travaux hors contrat original' },
  partielle:   { label: 'Facture partielle',               icon: '📄', desc: 'Facturation personnalisée' },
};

const STATUTS = {
  brouillon: { label: 'Brouillon', color: '#78716c', bg: '#f5f5f4' },
  envoyée:   { label: 'Envoyée',   color: '#2563eb', bg: '#eff6ff' },
  payée:     { label: 'Payée',     color: '#16a34a', bg: '#f0fdf4' },
};

const newPoste = () => ({ id: Date.now(), description: '', qte: 1, prixUnit: 0 });

export default function FacturationClient({ selectedChantier, setActiveTab }) {
  const [factures, setFactures]       = useState([]);
  const [extras, setExtras]           = useState([]);
  const [showForm, setShowForm]       = useState(false);
  const [generating, setGenerating]   = useState(false);
  const [preview, setPreview]         = useState(null);
  const [postes, setPostes]           = useState([newPoste()]);
  const [extrasChoisis, setExtrasChoisis] = useState([]);
  const [form, setForm] = useState({
    type: 'mi-travaux',
    modalitesPaiement: 'Payable sur réception',
    notes: '',
  });

  useEffect(() => {
    if (!selectedChantier) return;
    api.getFacturesClient(selectedChantier.id).then(setFactures).catch(() => {});
    api.getExtras(selectedChantier.id)
      .then(all => setExtras(all.filter(e => e.statut !== 'facturé')))
      .catch(() => {});
  }, [selectedChantier]);

  if (!selectedChantier) {
    return (
      <div style={s.noChantier}>
        <div style={s.noIcon}>🧾</div>
        <h2 style={s.noTitle}>Aucun chantier sélectionné</h2>
        <p style={s.noText}>Allez dans l'onglet Chantiers et sélectionnez un projet.</p>
        <button onClick={() => setActiveTab('chantiers')} style={s.btnPrimary}>🏗️ Aller aux chantiers</button>
      </div>
    );
  }

  const postesTotal   = postes.reduce((a, p) => a + ((parseFloat(p.qte)||0) * (parseFloat(p.prixUnit)||0)), 0);
  const extrasTotal   = extras.filter(e => extrasChoisis.includes(e.id)).reduce((a, e) => a + (e.total || 0), 0);
  const sousTotal     = postesTotal + extrasTotal;
  const tps           = sousTotal * 0.05;
  const tvq           = sousTotal * 0.09975;
  const total         = sousTotal + tps + tvq;

  const addPoste    = () => setPostes(p => [...p, newPoste()]);
  const removePoste = (id) => setPostes(p => p.filter(x => x.id !== id));
  const updatePoste = (id, field, val) => setPostes(p => p.map(x => x.id === id ? { ...x, [field]: val } : x));

  const toggleExtra = (id) => setExtrasChoisis(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const openForm = () => {
    setForm({ type: 'mi-travaux', modalitesPaiement: 'Payable sur réception', notes: '' });
    setPostes([newPoste()]);
    setExtrasChoisis([]);
    setPreview(null);
    setShowForm(true);
  };

  const handleGenerer = async (e) => {
    e.preventDefault();
    if (sousTotal <= 0) { alert('Ajoutez au moins un poste ou un extra avec un montant.'); return; }
    setGenerating(true);
    setPreview(null);
    try {
      const res = await api.genererFactureClient({
        chantierId: selectedChantier.id,
        ...form,
        postes: postes.filter(p => p.description && parseFloat(p.prixUnit) > 0),
        extrasIds: extrasChoisis,
      });
      if (res.success) {
        setFactures(prev => [res.facture, ...prev]);
        setPreview(res.facture);
        setShowForm(false);
        // Retirer les extras maintenant facturés
        setExtras(prev => prev.filter(e => !extrasChoisis.includes(e.id)));
        setExtrasChoisis([]);
      } else {
        alert('Erreur: ' + (res.error || 'Réponse inattendue'));
      }
    } catch (err) {
      alert('Erreur: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const changeStatut = async (fac, statut) => {
    const updated = await api.updateFactureClient(fac.id, { statut });
    setFactures(prev => prev.map(f => f.id === fac.id ? updated : f));
    if (preview?.id === fac.id) setPreview(updated);
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cette facture ?')) return;
    await api.deleteFactureClient(id);
    setFactures(prev => prev.filter(f => f.id !== id));
    if (preview?.id === id) setPreview(null);
  };

  const totalFacturé = factures.filter(f => f.statut !== 'brouillon').reduce((a, f) => a + (f.total || 0), 0);
  const totalPayé    = factures.filter(f => f.statut === 'payée').reduce((a, f) => a + (f.total || 0), 0);

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.h1}>🧾 Facturation client</h1>
          <p style={s.sub}>Chantier : <strong>{selectedChantier.nom}</strong> — {selectedChantier.client}</p>
        </div>
        <button onClick={openForm} style={s.btnPrimary}>+ Nouvelle facture</button>
      </div>

      {/* RÉSUMÉ */}
      {factures.length > 0 && (
        <div style={s.summary}>
          <div style={s.summaryItem}>
            <span style={s.summaryLabel}>Total facturé</span>
            <span style={s.summaryVal}>{fmt(totalFacturé)}</span>
          </div>
          <div style={s.summaryDivider} />
          <div style={s.summaryItem}>
            <span style={s.summaryLabel}>Reçu</span>
            <span style={{ ...s.summaryVal, color: '#16a34a' }}>{fmt(totalPayé)}</span>
          </div>
          <div style={s.summaryDivider} />
          <div style={s.summaryItem}>
            <span style={s.summaryLabel}>En attente</span>
            <span style={{ ...s.summaryVal, color: '#ea580c' }}>{fmt(totalFacturé - totalPayé)}</span>
          </div>
        </div>
      )}

      {/* FORMULAIRE */}
      {showForm && (
        <form onSubmit={handleGenerer} style={s.formCard} className="fade-in">
          <div style={s.formHeader}>
            <h2 style={s.formTitle}>Nouvelle facture</h2>
            <button type="button" onClick={() => setShowForm(false)} style={s.closeBtn}>✕</button>
          </div>

          {/* Choix du type */}
          <div style={s.section}>
            <span style={s.sectionTitle}>Type de facturation</span>
            <div style={s.typeGrid}>
              {Object.entries(TYPES).map(([key, t]) => (
                <button type="button" key={key} onClick={() => setForm(f => ({ ...f, type: key }))}
                  style={{ ...s.typeBtn, ...(form.type === key ? s.typeBtnActive : {}) }}>
                  <span style={s.typeIcon}>{t.icon}</span>
                  <span style={s.typeLabel}>{t.label}</span>
                  <span style={s.typeDesc}>{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Extras disponibles */}
          {extras.length > 0 && (
            <div style={s.section}>
              <span style={s.sectionTitle}>Extras non facturés ({extras.length})</span>
              <p style={s.hint}>Cochez les extras à inclure dans cette facture</p>
              <div style={s.extrasList}>
                {extras.map(e => (
                  <label key={e.id} style={s.extraItem}>
                    <input type="checkbox" checked={extrasChoisis.includes(e.id)}
                      onChange={() => toggleExtra(e.id)} style={{ margin: 0 }} />
                    <span style={s.extraDesc}>{e.description}</span>
                    <span style={s.extraDate}>{e.date}</span>
                    <span style={s.extraMont}>{fmt(e.total)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Postes manuels */}
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>Postes additionnels</span>
              <button type="button" onClick={addPoste} style={s.btnSmall}>+ Ajouter</button>
            </div>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, width: '50%' }}>Description</th>
                    <th style={{ ...s.th, width: '12%' }}>Qté</th>
                    <th style={{ ...s.th, width: '18%' }}>Prix unit.</th>
                    <th style={{ ...s.th, width: '15%' }}>Total</th>
                    <th style={{ ...s.th, width: '5%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {postes.map(p => (
                    <tr key={p.id}>
                      <td style={s.td}><input style={s.tdInput} value={p.description} placeholder="Description..." onChange={e => updatePoste(p.id, 'description', e.target.value)} /></td>
                      <td style={s.td}><input style={{ ...s.tdInput, textAlign: 'center' }} type="number" min="0" step="0.5" value={p.qte} onChange={e => updatePoste(p.id, 'qte', e.target.value)} /></td>
                      <td style={s.td}><input style={{ ...s.tdInput, textAlign: 'right' }} type="number" min="0" step="0.01" value={p.prixUnit} onChange={e => updatePoste(p.id, 'prixUnit', e.target.value)} /></td>
                      <td style={{ ...s.td, fontWeight: 600, textAlign: 'right', paddingRight: 8 }}>{fmt((parseFloat(p.qte)||0)*(parseFloat(p.prixUnit)||0))}</td>
                      <td style={s.td}><button type="button" onClick={() => removePoste(p.id)} style={s.removeBtn} disabled={postes.length === 1}>🗑️</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totaux */}
          <div style={s.totalBox}>
            {extrasTotal > 0 && <div style={s.totalRow}><span>Extras inclus</span><span>{fmt(extrasTotal)}</span></div>}
            {postesTotal > 0 && <div style={s.totalRow}><span>Postes additionnels</span><span>{fmt(postesTotal)}</span></div>}
            <div style={s.totalRow}><span>Sous-total</span><span>{fmt(sousTotal)}</span></div>
            <div style={s.totalRow}><span>TPS (5%)</span><span>{fmt(tps)}</span></div>
            <div style={s.totalRow}><span>TVQ (9.975%)</span><span>{fmt(tvq)}</span></div>
            <div style={{ ...s.totalRow, ...s.totalFinal }}><span>TOTAL DÛ</span><span>{fmt(total)}</span></div>
          </div>

          <div style={s.section}>
            <label style={s.label}>
              Modalités de paiement
              <input style={s.input} value={form.modalitesPaiement}
                onChange={e => setForm(f => ({ ...f, modalitesPaiement: e.target.value }))} />
            </label>
            <label style={s.label}>
              Notes (optionnel)
              <textarea style={{ ...s.input, minHeight: 60, resize: 'vertical' }} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Instructions, notes particulières..." />
            </label>
          </div>

          <div style={s.formBtns}>
            <button type="button" onClick={() => setShowForm(false)} style={s.btnSecondary}>Annuler</button>
            <button type="submit" style={s.btnPrimary} disabled={generating}>
              {generating ? '⏳ Claude génère la facture...' : '🧾 Générer la facture'}
            </button>
          </div>
        </form>
      )}

      {/* PREVIEW */}
      {preview && (
        <div style={s.previewCard} className="fade-in">
          <div style={s.previewHeader}>
            <div>
              <span style={s.previewNum}>{preview.numero} — {preview.typeLabel}</span>
              <span style={s.previewTotal}>{fmt(preview.total)}</span>
            </div>
            <div style={s.previewBtns}>
              <button onClick={() => printDocument(`Facture ${preview.numero}`, preview.texteGenere)} style={s.btnPrimary}>🖨️ Imprimer / PDF</button>
              <button onClick={() => setPreview(null)} style={s.btnSecondary}>Fermer</button>
            </div>
          </div>
          <pre style={s.previewText}>{preview.texteGenere}</pre>
        </div>
      )}

      {/* LISTE */}
      {factures.length > 0 ? (
        <div style={s.listSection}>
          <h2 style={s.listTitle}>Factures émises</h2>
          <div style={s.list}>
            {factures.map(fac => {
              const st = STATUTS[fac.statut] || STATUTS.brouillon;
              return (
                <div key={fac.id} style={s.listItem}>
                  <div style={s.listLeft}>
                    <span style={s.listNum}>{fac.numero}</span>
                    <span style={s.listType}>{fac.typeLabel}</span>
                    <span style={{ ...s.badge, color: st.color, background: st.bg }}>{st.label}</span>
                  </div>
                  <div style={s.listRight}>
                    <span style={s.listTotal}>{fmt(fac.total)}</span>
                    <select value={fac.statut} onChange={e => changeStatut(fac, e.target.value)} style={s.statSelect}>
                      {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <button onClick={() => setPreview(fac)} style={s.btnSmall}>👁 Voir</button>
                    <button onClick={() => printDocument(`Facture ${fac.numero}`, fac.texteGenere)} style={s.btnSmall}>🖨️</button>
                    <button onClick={() => handleDelete(fac.id)} style={{ ...s.btnSmall, color: '#dc2626', borderColor: '#fecaca' }}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : !showForm && (
        <div style={s.empty}>
          <div style={s.emptyIcon}>🧾</div>
          <p style={s.emptyText}>Aucune facture pour ce chantier</p>
          <button onClick={openForm} style={s.btnPrimary}>Créer la première facture</button>
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
  summary: { display: 'flex', gap: 0, background: '#fff', borderRadius: 12, border: '1px solid #e7e5e4', marginBottom: 28, overflow: 'hidden' },
  summaryItem: { flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 4 },
  summaryDivider: { width: 1, background: '#e7e5e4' },
  summaryLabel: { fontSize: 12, color: '#78716c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  summaryVal:   { fontSize: 22, fontWeight: 700, color: '#1c1917' },
  formCard: { background: '#fff', borderRadius: 16, padding: 28, marginBottom: 28, border: '1px solid #e7e5e4', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  formHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  formTitle: { margin: 0, fontSize: 20, fontWeight: 700, color: '#1c1917' },
  closeBtn: { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#78716c' },
  section:  { marginBottom: 24 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { display: 'block', fontSize: 15, fontWeight: 700, color: '#44403c', marginBottom: 10 },
  hint:     { margin: '0 0 10px', fontSize: 12, color: '#78716c' },
  typeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 },
  typeBtn:  { background: '#fafaf9', border: '2px solid #e7e5e4', borderRadius: 10, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 4 },
  typeBtnActive: { background: '#fff7ed', borderColor: '#fb923c' },
  typeIcon: { fontSize: 20 },
  typeLabel:{ fontSize: 13, fontWeight: 700, color: '#1c1917' },
  typeDesc: { fontSize: 11, color: '#78716c' },
  extrasList: { display: 'flex', flexDirection: 'column', gap: 6 },
  extraItem: { display: 'flex', alignItems: 'center', gap: 12, background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: 8, padding: '8px 12px', cursor: 'pointer' },
  extraDesc: { flex: 1, fontSize: 13, color: '#1c1917' },
  extraDate: { fontSize: 12, color: '#78716c' },
  extraMont: { fontSize: 13, fontWeight: 700, color: '#ea580c' },
  tableWrap: { overflowX: 'auto' },
  table:   { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:      { background: '#fef7ed', padding: '8px 6px', textAlign: 'left', fontWeight: 700, color: '#44403c', borderBottom: '2px solid #fed7aa' },
  td:      { padding: '6px 4px', borderBottom: '1px solid #f0f0f0' },
  tdInput: { width: '100%', padding: '6px 8px', border: '1px solid #e7e5e4', borderRadius: 6, fontSize: 13, outline: 'none', fontFamily: 'inherit' },
  removeBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.7 },
  totalBox:{ background: '#fef7ed', borderRadius: 12, padding: '16px 20px', marginBottom: 24, border: '1px solid #fed7aa' },
  totalRow:{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 14, color: '#44403c' },
  totalFinal: { borderTop: '2px solid #fb923c', marginTop: 8, paddingTop: 8, fontSize: 17, fontWeight: 700, color: '#c2410c' },
  label:   { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#44403c', marginBottom: 16 },
  input:   { padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d6d3d1', fontSize: 14, color: '#1c1917', outline: 'none', fontFamily: 'inherit' },
  formBtns:{ display: 'flex', justifyContent: 'flex-end', gap: 10 },
  previewCard: { background: '#fff', borderRadius: 16, padding: 28, marginBottom: 28, border: '2px solid #16a34a', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  previewNum:  { display: 'block', fontSize: 18, fontWeight: 700, color: '#1c1917' },
  previewTotal:{ display: 'block', fontSize: 22, fontWeight: 700, color: '#16a34a', marginTop: 4 },
  previewBtns: { display: 'flex', gap: 10 },
  previewText: { whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, color: '#1c1917', background: '#fafaf9', padding: 20, borderRadius: 8, maxHeight: 600, overflowY: 'auto', border: '1px solid #e7e5e4' },
  listSection: { marginTop: 24 },
  listTitle: { fontSize: 18, fontWeight: 700, color: '#1c1917', marginBottom: 12 },
  list:    { display: 'flex', flexDirection: 'column', gap: 8 },
  listItem:{ background: '#fff', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e7e5e4', flexWrap: 'wrap', gap: 10 },
  listLeft:{ display: 'flex', alignItems: 'center', gap: 12 },
  listNum: { fontWeight: 700, color: '#16a34a', fontSize: 14 },
  listType:{ fontSize: 14, color: '#44403c' },
  listRight:{ display: 'flex', alignItems: 'center', gap: 10 },
  listTotal:{ fontWeight: 700, fontSize: 15, color: '#1c1917' },
  badge:   { fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10 },
  statSelect: { padding: '6px 8px', borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 13, cursor: 'pointer' },
  empty:   { textAlign: 'center', padding: '60px 20px' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#78716c', marginBottom: 20 },
  btnPrimary:   { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  btnSecondary: { background: '#f5f5f4', color: '#44403c', border: '1px solid #d6d3d1', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnSmall:     { background: '#fff', color: '#44403c', border: '1px solid #d6d3d1', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};
