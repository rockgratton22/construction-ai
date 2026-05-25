import { useState, useEffect } from 'react';
import { api, fmt } from '../utils/api.js';

const STATUTS = {
  en_soumission: { label: 'En soumission', color: '#3b82f6', bg: '#eff6ff' },
  en_cours:      { label: 'En cours',      color: '#16a34a', bg: '#f0fdf4' },
  complété:      { label: 'Complété',      color: '#6b7280', bg: '#f9fafb' },
  annulé:        { label: 'Annulé',        color: '#dc2626', bg: '#fef2f2' },
};

const CHAMP_VIDE = { nom: '', client: '', email: '', tel: '', adresse: '', statut: 'en_soumission', dateDebut: '' };

export default function ChantierManager({ chantiers, setChantiers, selectedChantier, setSelectedChantier, setActiveTab }) {
  const [showForm, setShowForm]   = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm]           = useState(CHAMP_VIDE);
  const [saving, setSaving]       = useState(false);
  const [stats, setStats]         = useState({});
  const [rent, setRent]           = useState(null);

  useEffect(() => {
    api.getDashboard().then(d => {
      const map = {};
      d.chantiers?.forEach(c => { map[c.id] = {}; });
      setStats(map);
    }).catch(() => {});
  }, [chantiers]);

  useEffect(() => {
    if (!selectedChantier) { setRent(null); return; }
    api.getRentabilite(selectedChantier.id).then(setRent).catch(() => setRent(null));
  }, [selectedChantier]);

  const openNew  = () => { setForm(CHAMP_VIDE); setEditTarget(null); setShowForm(true); };
  const openEdit = (c, e) => { e.stopPropagation(); setForm({ ...c }); setEditTarget(c.id); setShowForm(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await api.updateChantier(editTarget, form);
        setChantiers(prev => prev.map(c => c.id === editTarget ? updated : c));
        if (selectedChantier?.id === editTarget) setSelectedChantier(updated);
      } else {
        const created = await api.createChantier(form);
        setChantiers(prev => [...prev, created]);
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Supprimer ce chantier et toutes ses données ?')) return;
    await api.deleteChantier(id);
    setChantiers(prev => prev.filter(c => c.id !== id));
    if (selectedChantier?.id === id) setSelectedChantier(null);
  };

  const handleSelect = (c) => {
    setSelectedChantier(c.id === selectedChantier?.id ? null : c);
  };

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.h1}>Chantiers</h1>
          <p style={s.sub}>{chantiers.length} projet{chantiers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} style={s.btnPrimary}>+ Nouveau chantier</button>
      </div>

      {showForm && (
        <div style={s.overlay} onClick={() => setShowForm(false)}>
          <form style={s.modal} onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
            <h2 style={s.modalTitle}>{editTarget ? 'Modifier le chantier' : 'Nouveau chantier'}</h2>

            <div style={s.grid2}>
              <label style={s.label}>
                Nom du projet *
                <input style={s.input} value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} required placeholder="Ex: Rénovation cuisine Tremblay" />
              </label>
              <label style={s.label}>
                Statut
                <select style={s.input} value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                  {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
            </div>

            <label style={s.label}>
              Nom du client *
              <input style={s.input} value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} required placeholder="Prénom Nom" />
            </label>

            <div style={s.grid2}>
              <label style={s.label}>
                Courriel
                <input style={s.input} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="client@email.com" />
              </label>
              <label style={s.label}>
                Téléphone
                <input style={s.input} value={form.tel} onChange={e => setForm(f => ({ ...f, tel: e.target.value }))} placeholder="819-555-1234" />
              </label>
            </div>

            <label style={s.label}>
              Adresse des travaux
              <input style={s.input} value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} placeholder="123 rue Principale, Gatineau" />
            </label>

            <label style={s.label}>
              Date de début estimée
              <input style={s.input} type="date" value={form.dateDebut} onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))} />
            </label>

            <div style={s.modalBtns}>
              <button type="button" onClick={() => setShowForm(false)} style={s.btnSecondary}>Annuler</button>
              <button type="submit" style={s.btnPrimary} disabled={saving}>{saving ? 'Sauvegarde...' : editTarget ? 'Modifier' : 'Créer'}</button>
            </div>
          </form>
        </div>
      )}

      {chantiers.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}>🏗️</div>
          <p style={s.emptyText}>Aucun chantier pour l'instant</p>
          <button onClick={openNew} style={s.btnPrimary}>Créer mon premier chantier</button>
        </div>
      ) : (
        <div style={s.grid}>
          {chantiers.map(c => {
            const st = STATUTS[c.statut] || STATUTS.en_soumission;
            const isSelected = selectedChantier?.id === c.id;
            return (
              <div key={c.id} onClick={() => handleSelect(c)}
                style={{ ...s.card, ...(isSelected ? s.cardSelected : {}) }}>
                <div style={s.cardTop}>
                  <div style={{ ...s.badge, color: st.color, background: st.bg }}>{st.label}</div>
                  <div style={s.cardActions}>
                    <button onClick={e => openEdit(c, e)} style={s.iconBtn} title="Modifier">✏️</button>
                    <button onClick={e => handleDelete(c.id, e)} style={s.iconBtn} title="Supprimer">🗑️</button>
                  </div>
                </div>
                <h3 style={s.cardTitle}>{c.nom}</h3>
                <p style={s.cardClient}>👤 {c.client}</p>
                {c.adresse && <p style={s.cardAddr}>📍 {c.adresse}</p>}
                {c.dateDebut && <p style={s.cardDate}>📅 Début: {new Date(c.dateDebut).toLocaleDateString('fr-CA')}</p>}

                {isSelected && (
                  <div style={s.selectedBar}>
                    <span>✓ Sélectionné</span>
                    <div style={s.quickLinks}>
                      <button onClick={e => { e.stopPropagation(); setActiveTab('soumissions'); }} style={s.quickLink}>📋 Soumissions</button>
                      <button onClick={e => { e.stopPropagation(); setActiveTab('extras'); }} style={s.quickLink}>➕ Extras</button>
                      <button onClick={e => { e.stopPropagation(); setActiveTab('factures'); }} style={s.quickLink}>📦 Fournisseurs</button>
                      <button onClick={e => { e.stopPropagation(); setActiveTab('facturation'); }} style={s.quickLink}>🧾 Facturation</button>
                      <button onClick={e => { e.stopPropagation(); setActiveTab('contrats'); }} style={s.quickLink}>📄 Contrats</button>
                    </div>
                    {rent && rent.revenusEstimes > 0 && (
                      <div onClick={e => e.stopPropagation()}>
                        {rent.margePct < 0 && (
                          <div style={s.alertDanger}>
                            🚨 <strong>PERTE SUR CE CHANTIER</strong> — Tes coûts fournisseurs ({fmt(rent.coutsFournisseurs)}) dépassent ton budget soumissionné ({fmt(rent.revenusEstimes)}). Tu perds {fmt(Math.abs(rent.margeEstimee))} si tu continues sans ajuster.
                          </div>
                        )}
                        {rent.margePct >= 0 && rent.margePct < 15 && (
                          <div style={s.alertWarning}>
                            ⚠️ <strong>Marge très faible ({rent.margePct}%)</strong> — Reste peu de place pour les imprévus. Surveille tes coûts de près.
                          </div>
                        )}
                      <div style={s.rentBox}>
                        <div style={s.rentRow}>
                          <span style={s.rentLabel}>Budget soumissionné</span>
                          <span style={s.rentVal}>{fmt(rent.budgetSoumission)}</span>
                        </div>
                        <div style={s.rentRow}>
                          <span style={s.rentLabel}>+ Extras</span>
                          <span style={s.rentVal}>{fmt(rent.extrasTotal)}</span>
                        </div>
                        <div style={s.rentRow}>
                          <span style={s.rentLabel}>− Coûts fournisseurs</span>
                          <span style={{ ...s.rentVal, color: '#dc2626' }}>−{fmt(rent.coutsFournisseurs)}</span>
                        </div>
                        <div style={s.rentDivider} />
                        <div style={s.rentRow}>
                          <span style={{ ...s.rentLabel, fontWeight: 700 }}>Marge estimée</span>
                          <span style={{ ...s.rentVal, fontWeight: 700, color: rent.margePct >= 30 ? '#16a34a' : rent.margePct >= 15 ? '#ea580c' : '#dc2626' }}>
                            {fmt(rent.margeEstimee)} ({rent.margePct}%)
                          </span>
                        </div>
                        {rent.factureClientTotal > 0 && (
                          <div style={s.rentRow}>
                            <span style={s.rentLabel}>Facturé au client</span>
                            <span style={{ ...s.rentVal, color: '#16a34a' }}>{fmt(rent.factureClientTotal)}</span>
                          </div>
                        )}
                      </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
  grid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 },
  card: {
    background: '#fff', borderRadius: 12, padding: 20,
    border: '2px solid #e7e5e4', cursor: 'pointer',
    transition: 'all 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  cardSelected: { border: '2px solid #fb923c', boxShadow: '0 0 0 3px rgba(251,146,60,0.15)' },
  cardTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge:      { fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 12 },
  cardActions:{ display: 'flex', gap: 4 },
  iconBtn:    { background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: '2px 4px', borderRadius: 4 },
  cardTitle:  { margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#1c1917' },
  cardClient: { margin: '0 0 4px', fontSize: 13, color: '#57534e' },
  cardAddr:   { margin: '0 0 4px', fontSize: 12, color: '#78716c' },
  cardDate:   { margin: 0, fontSize: 12, color: '#78716c' },
  selectedBar:{
    marginTop: 14, paddingTop: 14, borderTop: '1px solid #fed7aa',
    fontSize: 12, color: '#c2410c', fontWeight: 600,
  },
  quickLinks: { display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  quickLink:  {
    background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c',
    borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
  },
  alertDanger: { marginTop: 10, background: '#fef2f2', border: '2px solid #dc2626', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#991b1b', lineHeight: 1.5 },
  alertWarning:{ marginTop: 10, background: '#fffbeb', border: '2px solid #f59e0b', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e', lineHeight: 1.5 },
  rentBox:     { marginTop: 8, background: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '10px 12px', border: '1px solid #fed7aa' },
  rentRow:     { display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 },
  rentLabel:   { color: '#78716c' },
  rentVal:     { fontWeight: 600, color: '#1c1917' },
  rentDivider: { borderTop: '1px solid #e7e5e4', margin: '6px 0' },
  empty:     { textAlign: 'center', padding: '80px 20px' },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyText: { color: '#78716c', fontSize: 16, marginBottom: 20 },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  },
  modal: {
    background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 560,
    maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  modalTitle: { margin: '0 0 24px', fontSize: 20, fontWeight: 700, color: '#1c1917' },
  modalBtns:  { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 },
  grid2:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  label:  { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#44403c', marginBottom: 16 },
  input:  { padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d6d3d1', fontSize: 14, color: '#1c1917', outline: 'none' },
  btnPrimary:  { background: '#ea580c', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  btnSecondary:{ background: '#f5f5f4', color: '#44403c', border: '1px solid #d6d3d1', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
};
