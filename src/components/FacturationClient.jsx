import { useState, useEffect } from 'react';
import { api, fmt, printDocument } from '../utils/api.js';

const STATUTS = {
  brouillon: { label: 'Brouillon', color: '#78716c', bg: '#f5f5f4' },
  envoyée:   { label: 'Envoyée',   color: '#2563eb', bg: '#eff6ff' },
  payée:     { label: 'Payée',     color: '#16a34a', bg: '#f0fdf4' },
};

const LABELS_VERSEMENT = ['Acompte', 'Mi-travaux', 'Solde final', 'Autre'];

export default function FacturationClient({ selectedChantier, setActiveTab }) {
  const [factures, setFactures]     = useState([]);
  const [extras, setExtras]         = useState([]);
  const [soumission, setSoumission] = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [mode, setMode]             = useState(null); // 'versement' | 'extras'
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview]       = useState(null);

  // Versement state
  const [labelVersement, setLabelVersement] = useState('Acompte');
  const [montantHT, setMontantHT]           = useState('');
  const [modalites, setModalites]           = useState('Payable sur réception');

  // Extras state
  const [extrasChoisis, setExtrasChoisis] = useState([]);

  useEffect(() => {
    if (!selectedChantier) return;
    api.getFacturesClient(selectedChantier.id).then(setFactures).catch(() => {});
    api.getExtras(selectedChantier.id)
      .then(all => setExtras(all.filter(e => e.statut !== 'facturé')))
      .catch(() => {});
    api.getSoumissions(selectedChantier.id)
      .then(list => {
        const ref = list.find(s => s.statut === 'acceptée')
          || list.find(s => s.statut === 'envoyée')
          || list[0];
        setSoumission(ref || null);
      }).catch(() => {});
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

  const tps = (v) => v * 0.05;
  const tvq = (v) => v * 0.09975;
  const ttc = (v) => v + tps(v) + tvq(v);

  const montantHTNum    = parseFloat(montantHT) || 0;
  const totalVersement  = ttc(montantHTNum);

  const extrasSelTotal  = extras.filter(e => extrasChoisis.includes(e.id)).reduce((a, e) => a + (e.total || 0), 0);
  const totalExtras     = ttc(extrasSelTotal);

  const pct = (p) => {
    if (!soumission) return;
    const ht = (soumission.sousTotal || 0) * p / 100;
    setMontantHT(ht.toFixed(2));
  };

  const toggleExtra = (id) => setExtrasChoisis(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const openForm = () => {
    setMode(null); setPreview(null);
    setLabelVersement('Acompte'); setMontantHT('');
    setModalites('Payable sur réception'); setExtrasChoisis([]);
    setShowForm(true);
  };

  const handleGenerer = async () => {
    if (mode === 'versement' && montantHTNum <= 0) { alert('Entre un montant.'); return; }
    if (mode === 'extras' && extrasChoisis.length === 0) { alert('Sélectionne au moins un extra.'); return; }
    setGenerating(true);
    try {
      const payload = mode === 'versement'
        ? { chantierId: selectedChantier.id, type: labelVersement.toLowerCase().replace(' ', '-'),
            postes: [{ description: labelVersement, qte: 1, prixUnit: montantHTNum }],
            extrasIds: [], modalitesPaiement: modalites }
        : { chantierId: selectedChantier.id, type: 'extras',
            postes: [], extrasIds: extrasChoisis, modalitesPaiement: modalites };

      const res = await api.genererFactureClient(payload);
      if (res.success) {
        setFactures(prev => [res.facture, ...prev]);
        setPreview(res.facture);
        setShowForm(false);
        setExtras(prev => prev.filter(e => !extrasChoisis.includes(e.id)));
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

      <div style={s.infoBar}>
        💡 <strong>À quoi ça sert :</strong> C'est ici que tu demandes d'être payé. Génère tes factures à envoyer au client — versements selon l'échéancier ou extras accumulés.
      </div>

      {/* RÉSUMÉ */}
      {factures.length > 0 && (
        <div style={s.summary}>
          <div style={s.summaryItem}>
            <span style={s.summaryLabel}>Facturé</span>
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
        <div style={s.formCard} className="fade-in">
          <div style={s.formHeader}>
            <h2 style={s.formTitle}>Nouvelle facture</h2>
            <button onClick={() => setShowForm(false)} style={s.closeBtn}>✕</button>
          </div>

          {/* Choix du mode */}
          {!mode && (
            <div style={s.modeGrid}>
              <button onClick={() => setMode('versement')} style={s.modeBtn}>
                <span style={s.modeIcon}>💰</span>
                <span style={s.modeTitle}>Versement</span>
                <span style={s.modeDesc}>Demander un paiement selon l'échéancier — acompte, mi-travaux, solde final</span>
              </button>
              <button onClick={() => setMode('extras')} style={s.modeBtn}>
                <span style={s.modeIcon}>➕</span>
                <span style={s.modeTitle}>Extras</span>
                <span style={s.modeDesc}>Facturer les travaux supplémentaires accumulés au cours du chantier</span>
              </button>
            </div>
          )}

          {/* MODE VERSEMENT */}
          {mode === 'versement' && (
            <div>
              <button onClick={() => setMode(null)} style={s.backBtn}>← Changer de mode</button>

              {soumission && (
                <div style={s.soumRef}>
                  📋 Réf. soumission <strong>{soumission.numero}</strong> — Total : <strong>{fmt(soumission.total)}</strong>
                  <div style={s.pctBtns}>
                    <span style={s.pctLabel}>Suggéré :</span>
                    <button onClick={() => pct(30)} style={s.pctBtn}>30 % ({fmt(ttc((soumission.sousTotal||0)*0.30))})</button>
                    <button onClick={() => pct(40)} style={s.pctBtn}>40 % ({fmt(ttc((soumission.sousTotal||0)*0.40))})</button>
                    <button onClick={() => { setLabelVersement('Solde final'); pct(30); }} style={s.pctBtn}>Solde 30 % ({fmt(ttc((soumission.sousTotal||0)*0.30))})</button>
                  </div>
                </div>
              )}

              <div style={s.versRow}>
                <div style={s.labelBtns}>
                  {LABELS_VERSEMENT.map(l => (
                    <button key={l} onClick={() => setLabelVersement(l)}
                      style={{ ...s.labelBtn, ...(labelVersement === l ? s.labelBtnActive : {}) }}>{l}</button>
                  ))}
                </div>
                <label style={s.label}>
                  Montant avant taxes ($)
                  <input style={s.input} type="number" min="0" step="0.01"
                    value={montantHT} onChange={e => setMontantHT(e.target.value)}
                    placeholder="Ex: 1 200.00" autoFocus />
                </label>
                {montantHTNum > 0 && (
                  <div style={s.totalPrev}>
                    <span>TPS {fmt(tps(montantHTNum))} · TVQ {fmt(tvq(montantHTNum))}</span>
                    <span style={s.totalPrevAmt}>Total TTC : {fmt(totalVersement)}</span>
                  </div>
                )}
              </div>

              <label style={s.label}>
                Modalités de paiement
                <input style={s.input} value={modalites} onChange={e => setModalites(e.target.value)} />
              </label>
            </div>
          )}

          {/* MODE EXTRAS */}
          {mode === 'extras' && (
            <div>
              <button onClick={() => setMode(null)} style={s.backBtn}>← Changer de mode</button>

              {extras.length === 0 ? (
                <div style={s.noExtras}>
                  Aucun extra à facturer pour ce chantier.
                  <button onClick={() => setActiveTab('extras')} style={s.btnSmall}>➕ Aller aux extras</button>
                </div>
              ) : (
                <>
                  <p style={s.hint}>Coche les extras à inclure dans cette facture :</p>
                  <div style={s.extrasList}>
                    {extras.map(e => (
                      <label key={e.id} style={s.extraItem}>
                        <input type="checkbox" checked={extrasChoisis.includes(e.id)}
                          onChange={() => toggleExtra(e.id)} />
                        <span style={s.extraDesc}>{e.description}</span>
                        <span style={s.extraDate}>{e.date}</span>
                        <span style={s.extraMont}>{fmt(e.total)}</span>
                      </label>
                    ))}
                  </div>
                  {extrasChoisis.length > 0 && (
                    <div style={s.totalPrev}>
                      <span>Sous-total {fmt(extrasSelTotal)} · TPS {fmt(tps(extrasSelTotal))} · TVQ {fmt(tvq(extrasSelTotal))}</span>
                      <span style={s.totalPrevAmt}>Total TTC : {fmt(totalExtras)}</span>
                    </div>
                  )}
                  <label style={{ ...s.label, marginTop: 16 }}>
                    Modalités de paiement
                    <input style={s.input} value={modalites} onChange={e => setModalites(e.target.value)} />
                  </label>
                </>
              )}
            </div>
          )}

          {mode && (
            <div style={s.formBtns}>
              <button onClick={() => setShowForm(false)} style={s.btnSecondary}>Annuler</button>
              <button onClick={handleGenerer} style={s.btnPrimary} disabled={generating}>
                {generating ? '⏳ Claude génère la facture...' : '🧾 Générer la facture'}
              </button>
            </div>
          )}
        </div>
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
  topBar:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  h1:      { margin: 0, fontSize: 26, fontWeight: 700, color: '#1c1917' },
  sub:     { margin: '4px 0 0', color: '#78716c', fontSize: 14 },
  infoBar: { background: '#fef9c3', border: '1px solid #fde047', borderRadius: 10, padding: '10px 16px', marginBottom: 24, fontSize: 13, color: '#713f12', lineHeight: 1.5 },
  noChantier: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', gap: 12 },
  noIcon:  { fontSize: 56 }, noTitle: { margin: 0, fontSize: 22, color: '#1c1917' }, noText: { color: '#78716c', maxWidth: 360 },
  summary: { display: 'flex', background: '#fff', borderRadius: 12, border: '1px solid #e7e5e4', marginBottom: 28, overflow: 'hidden' },
  summaryItem: { flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 4 },
  summaryDivider: { width: 1, background: '#e7e5e4' },
  summaryLabel: { fontSize: 12, color: '#78716c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  summaryVal:   { fontSize: 22, fontWeight: 700, color: '#1c1917' },
  formCard: { background: '#fff', borderRadius: 16, padding: 28, marginBottom: 28, border: '1px solid #e7e5e4', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  formHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  formTitle: { margin: 0, fontSize: 20, fontWeight: 700, color: '#1c1917' },
  closeBtn:  { background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#78716c' },
  modeGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  modeBtn:   { background: '#fafaf9', border: '2px solid #e7e5e4', borderRadius: 12, padding: 24, cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, transition: 'all 0.15s', ':hover': { borderColor: '#fb923c' } },
  modeIcon:  { fontSize: 32 },
  modeTitle: { fontSize: 17, fontWeight: 700, color: '#1c1917' },
  modeDesc:  { fontSize: 13, color: '#78716c', lineHeight: 1.5 },
  backBtn:   { background: 'none', border: 'none', color: '#78716c', cursor: 'pointer', fontSize: 13, marginBottom: 20, padding: 0 },
  soumRef:   { background: '#fef7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: '#92400e' },
  pctBtns:   { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  pctLabel:  { fontSize: 12, color: '#78716c' },
  pctBtn:    { background: '#fff', border: '1px solid #fed7aa', color: '#c2410c', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 },
  versRow:   { marginBottom: 16 },
  labelBtns: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  labelBtn:  { background: '#f5f5f4', border: '1.5px solid #e7e5e4', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#44403c' },
  labelBtnActive: { background: '#fff7ed', borderColor: '#fb923c', color: '#c2410c' },
  totalPrev: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef7ed', borderRadius: 8, padding: '10px 14px', marginTop: 10, fontSize: 13, color: '#78716c' },
  totalPrevAmt: { fontWeight: 700, fontSize: 16, color: '#c2410c' },
  noExtras:  { textAlign: 'center', padding: '32px 0', color: '#78716c', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  hint:      { fontSize: 13, color: '#78716c', marginBottom: 10 },
  extrasList:{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  extraItem: { display: 'flex', alignItems: 'center', gap: 12, background: '#fafaf9', border: '1px solid #e7e5e4', borderRadius: 8, padding: '10px 12px', cursor: 'pointer' },
  extraDesc: { flex: 1, fontSize: 13, color: '#1c1917' },
  extraDate: { fontSize: 12, color: '#78716c' },
  extraMont: { fontSize: 13, fontWeight: 700, color: '#ea580c' },
  label:     { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#44403c', marginBottom: 16 },
  input:     { padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d6d3d1', fontSize: 14, color: '#1c1917', outline: 'none', fontFamily: 'inherit' },
  formBtns:  { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
  previewCard: { background: '#fff', borderRadius: 16, padding: 28, marginBottom: 28, border: '2px solid #16a34a', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  previewNum:   { display: 'block', fontSize: 18, fontWeight: 700, color: '#1c1917' },
  previewTotal: { display: 'block', fontSize: 22, fontWeight: 700, color: '#16a34a', marginTop: 4 },
  previewBtns:  { display: 'flex', gap: 10 },
  previewText:  { whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, color: '#1c1917', background: '#fafaf9', padding: 20, borderRadius: 8, maxHeight: 600, overflowY: 'auto', border: '1px solid #e7e5e4' },
  listSection: { marginTop: 24 },
  listTitle:   { fontSize: 18, fontWeight: 700, color: '#1c1917', marginBottom: 12 },
  list:        { display: 'flex', flexDirection: 'column', gap: 8 },
  listItem:    { background: '#fff', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e7e5e4', flexWrap: 'wrap', gap: 10 },
  listLeft:    { display: 'flex', alignItems: 'center', gap: 12 },
  listNum:     { fontWeight: 700, color: '#16a34a', fontSize: 14 },
  listType:    { fontSize: 14, color: '#44403c' },
  listRight:   { display: 'flex', alignItems: 'center', gap: 10 },
  listTotal:   { fontWeight: 700, fontSize: 15, color: '#1c1917' },
  badge:       { fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10 },
  statSelect:  { padding: '6px 8px', borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 13, cursor: 'pointer' },
  empty:       { textAlign: 'center', padding: '60px 20px' },
  emptyIcon:   { fontSize: 48, marginBottom: 12 },
  emptyText:   { color: '#78716c', marginBottom: 20 },
  btnPrimary:  { background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  btnSecondary:{ background: '#f5f5f4', color: '#44403c', border: '1px solid #d6d3d1', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnSmall:    { background: '#fff', color: '#44403c', border: '1px solid #d6d3d1', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
};
