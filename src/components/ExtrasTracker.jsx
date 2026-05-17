import { useState, useEffect } from 'react';
import { api, fmt } from '../utils/api.js';

const STATUTS = {
  noté:     { label: 'Noté',    color: '#78716c', bg: '#f5f5f4' },
  approuvé: { label: 'Approuvé',color: '#2563eb', bg: '#eff6ff' },
  facturé:  { label: 'Facturé', color: '#16a34a', bg: '#f0fdf4' },
};

const UNITES = ['h', 'm²', 'm', 'pi²', 'pi', 'forfait', 'unité', 'jour', 'voyage'];

const FORM_VIDE = {
  description: '', qte: 1, unite: 'h', prixUnit: 0,
  date: new Date().toISOString().split('T')[0],
};

export default function ExtrasTracker({ selectedChantier, setActiveTab }) {
  const [extras, setExtras]           = useState([]);
  const [soumissions, setSoumissions] = useState([]);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState(FORM_VIDE);
  const [saving, setSaving]           = useState(false);
  const [editId, setEditId]           = useState(null);

  useEffect(() => {
    if (!selectedChantier) return;
    api.getExtras(selectedChantier.id).then(setExtras).catch(() => {});
    api.getSoumissions(selectedChantier.id).then(setSoumissions).catch(() => {});
  }, [selectedChantier]);

  if (!selectedChantier) {
    return (
      <div style={s.noChantier}>
        <div style={s.noIcon}>➕</div>
        <h2 style={s.noTitle}>Aucun chantier sélectionné</h2>
        <p style={s.noText}>Sélectionnez un chantier dans l'onglet Chantiers.</p>
        <button onClick={() => setActiveTab('chantiers')} style={s.btnPrimary}>🏗️ Aller aux chantiers</button>
      </div>
    );
  }

  const nonFactures   = extras.filter(e => e.statut !== 'facturé');
  const montantNF     = nonFactures.reduce((a, e) => a + (e.total || 0), 0);
  const totalTTC      = extras.reduce((a, e) => a + (e.total || 0), 0);
  const soumAcceptee  = soumissions.find(s => s.statut === 'acceptée');
  const totalProjet   = (soumAcceptee?.total || 0) + totalTTC;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        const updated = await api.updateExtra(editId, form);
        setExtras(prev => prev.map(x => x.id === editId ? updated : x));
      } else {
        const created = await api.createExtra({ ...form, chantierId: selectedChantier.id });
        setExtras(prev => [created, ...prev]);
      }
      setShowForm(false);
      setForm(FORM_VIDE);
      setEditId(null);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (extra) => {
    setForm({ description: extra.description, qte: extra.qte, unite: extra.unite, prixUnit: extra.prixUnit, date: extra.date });
    setEditId(extra.id);
    setShowForm(true);
  };

  const changeStatut = async (extra, statut) => {
    const updated = await api.updateExtra(extra.id, { statut });
    setExtras(prev => prev.map(x => x.id === extra.id ? updated : x));
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer cet extra ?')) return;
    await api.deleteExtra(id);
    setExtras(prev => prev.filter(x => x.id !== id));
  };

  const totalCalc = (parseFloat(form.qte)||0) * (parseFloat(form.prixUnit)||0);

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.h1}>➕ Extras chantier</h1>
          <p style={s.sub}>Chantier : <strong>{selectedChantier.nom}</strong> — {selectedChantier.client}</p>
        </div>
        <button onClick={() => { setShowForm(true); setForm(FORM_VIDE); setEditId(null); }} style={s.btnPrimary}>+ Ajouter un extra</button>
      </div>

      {/* STATS */}
      <div style={s.statsRow}>
        <div style={s.statCard}>
          <span style={s.statNum}>{extras.length}</span>
          <span style={s.statLabel}>Extras total</span>
        </div>
        <div style={{ ...s.statCard, background: nonFactures.length > 0 ? '#fff7ed' : '#f0fdf4', border: nonFactures.length > 0 ? '1px solid #fed7aa' : '1px solid #bbf7d0' }}>
          <span style={{ ...s.statNum, color: nonFactures.length > 0 ? '#c2410c' : '#16a34a' }}>{nonFactures.length}</span>
          <span style={s.statLabel}>Non facturés</span>
        </div>
        <div style={{ ...s.statCard, background: '#fff7ed', border: '1px solid #fed7aa' }}>
          <span style={{ ...s.statNum, color: '#c2410c' }}>{fmt(montantNF)}</span>
          <span style={s.statLabel}>À facturer</span>
        </div>
        <div style={s.statCard}>
          <span style={s.statNum}>{fmt(totalTTC)}</span>
          <span style={s.statLabel}>Total extras</span>
        </div>
        {soumAcceptee && (
          <div style={{ ...s.statCard, background: '#f0fdf4', border: '1px solid #bbf7d0', flex: '2 1 280px' }}>
            <span style={{ ...s.statNum, color: '#16a34a', fontSize: 20 }}>{fmt(totalProjet)}</span>
            <span style={s.statLabel}>Total projet (soumission {soumAcceptee.numero} + extras)</span>
          </div>
        )}
      </div>

      {/* FORMULAIRE */}
      {showForm && (
        <div style={s.overlay} onClick={() => { setShowForm(false); setEditId(null); }}>
          <form style={s.modal} onClick={e => e.stopPropagation()} onSubmit={handleSubmit}>
            <h2 style={s.modalTitle}>{editId ? 'Modifier l\'extra' : 'Nouvel extra'}</h2>

            <label style={s.label}>
              Description *
              <input style={s.input} value={form.description} required
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Dépose de cloison supplémentaire..." />
            </label>

            <div style={s.grid3}>
              <label style={s.label}>
                Quantité
                <input style={s.input} type="number" min="0" step="0.5" value={form.qte}
                  onChange={e => setForm(f => ({ ...f, qte: e.target.value }))} />
              </label>
              <label style={s.label}>
                Unité
                <select style={s.input} value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}>
                  {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label style={s.label}>
                Prix unitaire ($)
                <input style={s.input} type="number" min="0" step="0.01" value={form.prixUnit}
                  onChange={e => setForm(f => ({ ...f, prixUnit: e.target.value }))} />
              </label>
            </div>

            <div style={s.totalPreview}>
              Total : <strong style={{ color: '#ea580c' }}>{fmt(totalCalc)}</strong>
            </div>

            <label style={s.label}>
              Date
              <input style={s.input} type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </label>

            <div style={s.modalBtns}>
              <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} style={s.btnSecondary}>Annuler</button>
              <button type="submit" style={s.btnPrimary} disabled={saving}>{saving ? 'Sauvegarde...' : editId ? 'Modifier' : 'Ajouter'}</button>
            </div>
          </form>
        </div>
      )}

      {/* LISTE */}
      {extras.length === 0 ? (
        <div style={s.empty}>
          <div style={s.emptyIcon}>📝</div>
          <p style={s.emptyText}>Aucun extra enregistré pour ce chantier</p>
          <button onClick={() => setShowForm(true)} style={s.btnPrimary}>Ajouter le premier extra</button>
        </div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Date</th>
                <th style={s.th}>Description</th>
                <th style={s.th}>Qté × Unité</th>
                <th style={s.th}>Prix/u</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Total</th>
                <th style={s.th}>Statut</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {extras.map(extra => {
                const st = STATUTS[extra.statut] || STATUTS.noté;
                return (
                  <tr key={extra.id} style={{ background: extra.statut === 'facturé' ? '#f9fafb' : '#fff' }}>
                    <td style={s.td}>{extra.date}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{extra.description}</td>
                    <td style={s.td}>{extra.qte} {extra.unite}</td>
                    <td style={s.td}>{fmt(extra.prixUnit)}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, color: '#ea580c' }}>{fmt(extra.total)}</td>
                    <td style={s.td}>
                      <select value={extra.statut} onChange={e => changeStatut(extra, e.target.value)}
                        style={{ ...s.statSelect, color: st.color }}>
                        {Object.entries(STATUTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => openEdit(extra)} style={s.iconBtn} title="Modifier">✏️</button>
                        <button onClick={() => handleDelete(extra.id)} style={s.iconBtn} title="Supprimer">🗑️</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#fef7ed' }}>
                <td colSpan={4} style={{ ...s.td, fontWeight: 700, color: '#44403c', paddingLeft: 12 }}>TOTAL</td>
                <td style={{ ...s.td, textAlign: 'right', fontWeight: 700, fontSize: 16, color: '#c2410c' }}>{fmt(totalTTC)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

const s = {
  page:    { padding: 32, maxWidth: 1100, margin: '0 auto' },
  topBar:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  h1:      { margin: 0, fontSize: 26, fontWeight: 700, color: '#1c1917' },
  sub:     { margin: '4px 0 0', color: '#78716c', fontSize: 14 },
  statsRow:{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  statCard:{ flex: '1 1 140px', background: '#fff', border: '1px solid #e7e5e4', borderRadius: 12, padding: '16px 20px', textAlign: 'center' },
  statNum: { display: 'block', fontSize: 24, fontWeight: 700, color: '#1c1917' },
  statLabel:{ display: 'block', fontSize: 12, color: '#78716c', marginTop: 4, fontWeight: 600 },
  noChantier: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', gap: 12 },
  noIcon:  { fontSize: 56 },
  noTitle: { margin: 0, fontSize: 22, color: '#1c1917' },
  noText:  { color: '#78716c', maxWidth: 360 },
  empty:   { textAlign: 'center', padding: '60px 20px' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#78716c', marginBottom: 20 },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
  },
  modal:   { background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' },
  modalTitle: { margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: '#1c1917' },
  modalBtns: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  grid3:   { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 },
  label:   { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#44403c', marginBottom: 16 },
  input:   { padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d6d3d1', fontSize: 14, color: '#1c1917', outline: 'none', fontFamily: 'inherit' },
  totalPreview: { fontSize: 15, color: '#44403c', marginBottom: 16, padding: '10px 14px', background: '#fef7ed', borderRadius: 8 },
  tableWrap: { overflowX: 'auto', borderRadius: 12, border: '1px solid #e7e5e4', background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th:    { background: '#fef7ed', padding: '12px 14px', textAlign: 'left', fontWeight: 700, color: '#44403c', borderBottom: '2px solid #fed7aa' },
  td:    { padding: '12px 14px', borderBottom: '1px solid #f0f0f0', color: '#1c1917' },
  statSelect: { padding: '6px 8px', borderRadius: 6, border: '1px solid #d6d3d1', fontSize: 12, cursor: 'pointer', fontWeight: 700 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, padding: '3px 5px' },
  btnPrimary:   { background: '#ea580c', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 700 },
  btnSecondary: { background: '#f5f5f4', color: '#44403c', border: '1px solid #d6d3d1', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
};
