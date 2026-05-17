import { useState, useEffect } from 'react';
import { api } from '../utils/api.js';

const VIDE = { nom: '', adresse: '', telephone: '', email: '', rbq: '', neq: '' };

export default function ParametresEntreprise() {
  const [form, setForm]     = useState(VIDE);
  const [conditions, setCond] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    api.getConfig().then(cfg => {
      if (cfg.entreprise) setForm({ ...VIDE, ...cfg.entreprise });
      if (cfg.conditionsPersonnalisees) setCond(cfg.conditionsPersonnalisees);
    }).catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateConfig({ ...form, conditionsPersonnalisees: conditions });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const f = (field) => ({
    style: s.input,
    value: form[field],
    onChange: e => setForm(p => ({ ...p, [field]: e.target.value }),)
  });

  return (
    <div style={s.page}>
      <div style={s.topBar}>
        <div>
          <h1 style={s.h1}>⚙️ Paramètres</h1>
          <p style={s.sub}>Informations de votre entreprise — apparaissent sur toutes vos soumissions et contrats</p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        <div style={s.card}>
          <h2 style={s.cardTitle}>Profil de l'entreprise</h2>

          <div style={s.grid2}>
            <label style={s.label}>
              Nom de l'entreprise *
              <input {...f('nom')} placeholder="Ex: Construction Gratton Inc." />
            </label>
            <label style={s.label}>
              Numéro RBQ
              <input {...f('rbq')} placeholder="Ex: 8375-8374-01" />
            </label>
          </div>

          <label style={s.label}>
            Adresse
            <input {...f('adresse')} placeholder="Ex: 123 rue Principale, Gatineau, QC J8P 1A1" />
          </label>

          <div style={s.grid2}>
            <label style={s.label}>
              Téléphone
              <input {...f('telephone')} placeholder="Ex: 819 555-1234" />
            </label>
            <label style={s.label}>
              Courriel
              <input {...f('email')} type="email" placeholder="info@monentreprise.com" />
            </label>
          </div>

          <label style={s.label}>
            Numéro NEQ (optionnel)
            <input {...f('neq')} placeholder="Ex: 1234567890" />
          </label>
        </div>

        <div style={s.card}>
          <h2 style={s.cardTitle}>Conditions générales personnalisées</h2>
          <p style={s.hint}>
            Ajoutez vos propres clauses — elles seront intégrées dans toutes vos soumissions et contrats.
            Les clauses légales obligatoires (garantie RBQ, conformité, etc.) sont toujours incluses automatiquement.
          </p>
          <textarea
            style={s.textarea}
            value={conditions}
            onChange={e => setCond(e.target.value)}
            placeholder={`Ex:\n• Les travaux sont garantis 2 ans sur la main-d'oeuvre\n• Aucun animal de compagnie ne doit se trouver sur le chantier\n• Le client doit vider la pièce avant le début des travaux`}
            rows={8}
          />
        </div>

        <div style={s.footer}>
          {saved && <span style={s.savedMsg}>✅ Paramètres sauvegardés !</span>}
          <button type="submit" style={s.btnPrimary} disabled={saving}>
            {saving ? 'Sauvegarde...' : '💾 Sauvegarder'}
          </button>
        </div>
      </form>
    </div>
  );
}

const s = {
  page:    { padding: 32, maxWidth: 800, margin: '0 auto' },
  topBar:  { marginBottom: 28 },
  h1:      { margin: 0, fontSize: 26, fontWeight: 700, color: '#1c1917' },
  sub:     { margin: '4px 0 0', color: '#78716c', fontSize: 14 },
  card:    { background: '#fff', borderRadius: 16, padding: 28, marginBottom: 20, border: '1px solid #e7e5e4', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  cardTitle: { margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#1c1917' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  label:   { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: '#44403c', marginBottom: 16 },
  input:   { padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d6d3d1', fontSize: 14, color: '#1c1917', outline: 'none', fontFamily: 'inherit' },
  hint:    { color: '#78716c', fontSize: 13, marginBottom: 14, lineHeight: 1.5 },
  textarea:{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #d6d3d1', fontSize: 14, color: '#1c1917', outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  footer:  { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 },
  savedMsg:{ color: '#16a34a', fontWeight: 600, fontSize: 14 },
  btnPrimary: { background: '#ea580c', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', cursor: 'pointer', fontSize: 15, fontWeight: 700 },
};
