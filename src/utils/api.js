const BASE = '/api';

function getToken() {
  return localStorage.getItem('ca_token');
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('ca_token');
    window.location.reload();
    throw new Error('Session expirée');
  }

  if (res.status === 402) {
    window.dispatchEvent(new CustomEvent('ca:trialExpired'));
    const err = new Error('Essai terminé');
    err.trialExpired = true;
    throw err;
  }

  return res;
}

async function apiFetchJSON(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await apiFetch(url, { ...options, headers });
  return res.json();
}

export const api = {
  // Health (no auth)
  health: () => fetch(`${BASE}/health`).then(r => r.json()),

  // Config entreprise
  getConfig:    ()       => apiFetchJSON(`${BASE}/config`),
  updateConfig: (data)   => apiFetchJSON(`${BASE}/config`, { method: 'PUT', body: JSON.stringify(data) }),

  // Chantiers
  getChantiers:    ()       => apiFetchJSON(`${BASE}/chantiers`),
  createChantier:  (data)   => apiFetchJSON(`${BASE}/chantiers`, { method: 'POST', body: JSON.stringify(data) }),
  updateChantier:  (id, d)  => apiFetchJSON(`${BASE}/chantiers/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteChantier:  (id)     => apiFetchJSON(`${BASE}/chantiers/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: () => apiFetchJSON(`${BASE}/dashboard`),

  // Soumissions
  getSoumissions:    (chantierId) => apiFetchJSON(`${BASE}/chantiers/${chantierId}/soumissions`),
  genererSoumission: (data)       => apiFetchJSON(`${BASE}/soumissions`, { method: 'POST', body: JSON.stringify(data) }),
  updateSoumission:  (id, d)      => apiFetchJSON(`${BASE}/soumissions/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteSoumission:  (id)         => apiFetchJSON(`${BASE}/soumissions/${id}`, { method: 'DELETE' }),

  // Extras
  getExtras:   (chantierId) => apiFetchJSON(`${BASE}/chantiers/${chantierId}/extras`),
  createExtra: (data)       => apiFetchJSON(`${BASE}/extras`, { method: 'POST', body: JSON.stringify(data) }),
  updateExtra: (id, d)      => apiFetchJSON(`${BASE}/extras/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteExtra: (id)         => apiFetchJSON(`${BASE}/extras/${id}`, { method: 'DELETE' }),

  // Factures
  getFactures:    (chantierId) => apiFetchJSON(`${BASE}/chantiers/${chantierId}/factures`),
  analyserFacture:(data)       => apiFetchJSON(`${BASE}/factures/analyser`, { method: 'POST', body: JSON.stringify(data) }),
  updateFacture:  (id, d)      => apiFetchJSON(`${BASE}/factures/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteFacture:  (id)         => apiFetchJSON(`${BASE}/factures/${id}`, { method: 'DELETE' }),

  // Contrats
  getContrats:    (chantierId) => apiFetchJSON(`${BASE}/chantiers/${chantierId}/contrats`),
  genererContrat: (data)       => apiFetchJSON(`${BASE}/contrats/generer`, { method: 'POST', body: JSON.stringify(data) }),
  deleteContrat:  (id)         => apiFetchJSON(`${BASE}/contrats/${id}`, { method: 'DELETE' }),

  // Facturation client
  getFacturesClient:    (chantierId) => apiFetchJSON(`${BASE}/chantiers/${chantierId}/factures-client`),
  genererFactureClient: (data)       => apiFetchJSON(`${BASE}/factures-client/generer`, { method: 'POST', body: JSON.stringify(data) }),
  updateFactureClient:  (id, d)      => apiFetchJSON(`${BASE}/factures-client/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
  deleteFactureClient:  (id)         => apiFetchJSON(`${BASE}/factures-client/${id}`, { method: 'DELETE' }),

  // Rentabilité
  getRentabilite: (chantierId) => apiFetchJSON(`${BASE}/chantiers/${chantierId}/rentabilite`),

  // Stripe
  stripeCheckout: ()           => apiFetchJSON(`${BASE}/stripe/checkout`, { method: 'POST' }),
  stripeVerify:   (sessionId)  => apiFetchJSON(`${BASE}/stripe/verify-session`, { method: 'POST', body: JSON.stringify({ sessionId }) }),
};

export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload  = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export const createThumbnail = (file, maxPx = 400) => new Promise((resolve) => {
  if (file.type === 'application/pdf') { resolve(null); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.65).split(',')[1]);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

export const fmt = (n) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n || 0);

export const printDocument = (titre, contenu) => {
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head>
    <meta charset="UTF-8"><title>${titre}</title>
    <style>
      body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.7;
             max-width: 820px; margin: 40px auto; color: #000; }
      pre  { white-space: pre-wrap; font-family: inherit; margin: 0; }
      @media print { body { margin: 20px; } }
    </style>
  </head><body><pre>${contenu.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
  <script>setTimeout(() => window.print(), 300);<\/script>
  </body></html>`);
  w.document.close();
};
