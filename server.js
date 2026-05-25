// ConstructionAI — Backend Express + Anthropic + Auth + Stripe
import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());

// ── Stripe webhook needs raw body — register BEFORE express.json() ──
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).json({ error: 'Stripe non configuré' });
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const users = readJSON(FILES.users);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const idx = users.findIndex(u => u.id === session.metadata?.userId);
    if (idx !== -1) {
      users[idx].subscription = { status: 'active', stripeCustomerId: session.customer, stripeSubscriptionId: session.subscription };
      writeJSON(FILES.users, users);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    const idx = users.findIndex(u => u.subscription?.stripeSubscriptionId === sub.id);
    if (idx !== -1) { users[idx].subscription.status = 'expired'; writeJSON(FILES.users, users); }
  }

  res.json({ received: true });
});

app.use(express.json({ limit: '50mb' }));

// ──────────────────────────── DATA FILES ────────────────────────────

const DATA_DIR = join(__dirname, 'data');
const FILES = {
  chantiers:      join(DATA_DIR, 'chantiers.json'),
  soumissions:    join(DATA_DIR, 'soumissions.json'),
  extras:         join(DATA_DIR, 'extras.json'),
  factures:       join(DATA_DIR, 'factures.json'),
  facturesClient: join(DATA_DIR, 'facturesClient.json'),
  contrats:       join(DATA_DIR, 'contrats.json'),
  config:         join(DATA_DIR, 'config.json'),
  users:          join(DATA_DIR, 'users.json'),
};

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR);
const DEFAULTS = {
  chantiers: '[]', soumissions: '[]', extras: '[]', factures: '[]',
  facturesClient: '[]', contrats: '[]',
  users: '[]',
  config: JSON.stringify({
    entreprise: { nom: '', adresse: '', telephone: '', email: '', rbq: '', neq: '' },
    compteur_soumissions: 0,
    compteur_factures_client: 0,
  }, null, 2),
};
Object.entries(FILES).forEach(([k, p]) => { if (!existsSync(p)) writeFileSync(p, DEFAULTS[k]); });

const readJSON  = (f) => JSON.parse(readFileSync(f, 'utf-8'));
const writeJSON = (f, d) => writeFileSync(f, JSON.stringify(d, null, 2));
const fmt = (n) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n || 0);

function nextSoumissionNum() {
  const cfg = readJSON(FILES.config);
  cfg.compteur_soumissions = (cfg.compteur_soumissions || 0) + 1;
  writeJSON(FILES.config, cfg);
  return `SOU-${new Date().getFullYear()}-${String(cfg.compteur_soumissions).padStart(3, '0')}`;
}

function nextFactureClientNum() {
  const cfg = readJSON(FILES.config);
  cfg.compteur_factures_client = (cfg.compteur_factures_client || 0) + 1;
  writeJSON(FILES.config, cfg);
  return `FAC-${new Date().getFullYear()}-${String(cfg.compteur_factures_client).padStart(3, '0')}`;
}

function computeUserOut(user) {
  const { passwordHash: _, ...userOut } = user;
  return { ...userOut };
}

// ──────────────────────────── AUTH MIDDLEWARE ────────────────────────────

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-change-me');
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

function requireSubscribedOrFirstChantier(req, res, next) {
  const users = readJSON(FILES.users);
  const user  = users.find(u => u.id === req.user.userId);
  if (!user) return res.status(401).json({ error: 'Utilisateur introuvable' });
  if (user.subscription?.status === 'active') return next();

  const chantierCount = readJSON(FILES.chantiers).filter(c => c.userId === req.user.userId).length;
  if (chantierCount >= 1) {
    return res.status(402).json({
      error: 'Votre essai gratuit inclut 1 projet complet. Abonnez-vous pour créer des projets illimités.',
      chantierLimit: true,
    });
  }
  next();
}

// ──────────────────────────── HEALTH ────────────────────────────

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ──────────────────────────── AUTH ROUTES ────────────────────────────

app.post('/api/auth/signup', async (req, res) => {
  const { email, password, nomEntreprise } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe: minimum 6 caractères' });

  const users = readJSON(FILES.users);
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Cet email est déjà utilisé' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    email: email.toLowerCase().trim(),
    passwordHash,
    nomEntreprise: nomEntreprise?.trim() || '',
    firstUseDate: null,
    subscription: { status: 'trial', stripeCustomerId: null, stripeSubscriptionId: null },
    trialUsage: { soumissions: 0, contrats: 0, factures: 0 },
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeJSON(FILES.users, users);

  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'default-secret-change-me', { expiresIn: '30d' });
  res.json({ token, user: computeUserOut(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(FILES.users);
  const user = users.find(u => u.email.toLowerCase() === email?.toLowerCase().trim());

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'default-secret-change-me', { expiresIn: '30d' });
  res.json({ token, user: computeUserOut(user) });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const users = readJSON(FILES.users);
  const user = users.find(u => u.id === req.user.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(computeUserOut(user));
});

// ──────────────────────────── STRIPE ROUTES ────────────────────────────

app.post('/api/stripe/checkout', requireAuth, async (req, res) => {
  if (!stripe || !process.env.STRIPE_PRICE_ID) {
    return res.status(503).json({ error: 'Stripe non configuré. Ajoutez STRIPE_SECRET_KEY et STRIPE_PRICE_ID dans .env' });
  }

  const users = readJSON(FILES.users);
  const user = users.find(u => u.id === req.user.userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

  const baseUrl = process.env.APP_URL || 'http://localhost:3001';

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${baseUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/`,
      metadata: { userId: user.id },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stripe/verify-session', requireAuth, async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe non configuré' });

  const { sessionId } = req.body;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify session belongs to the authenticated user
    const users = readJSON(FILES.users);
    const idx = users.findIndex(u => u.id === req.user.userId);
    if (idx === -1) return res.status(404).json({ error: 'Utilisateur introuvable' });

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Paiement non confirmé' });
    }

    // Double-check subscription is active directly with Stripe
    if (!session.subscription) {
      return res.status(400).json({ error: 'Aucun abonnement associé' });
    }
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    if (subscription.status !== 'active') {
      return res.status(400).json({ error: `Abonnement non actif (statut: ${subscription.status})` });
    }

    users[idx].subscription = {
      status: 'active',
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
    };
    writeJSON(FILES.users, users);
    return res.json({ success: true, user: computeUserOut(users[idx]) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────── CONFIG ENTREPRISE ────────────────────────────

app.get('/api/config', requireAuth, (_req, res) => res.json(readJSON(FILES.config)));

app.put('/api/config', requireAuth, (req, res) => {
  const cfg = readJSON(FILES.config);
  const { conditionsPersonnalisees, ...entrepriseFields } = req.body;
  cfg.entreprise = { ...cfg.entreprise, ...entrepriseFields };
  if (conditionsPersonnalisees !== undefined) cfg.conditionsPersonnalisees = conditionsPersonnalisees;
  writeJSON(FILES.config, cfg);
  res.json(cfg);
});

// ──────────────────────────── CHANTIERS ────────────────────────────

app.get('/api/chantiers', requireAuth, (req, res) => {
  res.json(readJSON(FILES.chantiers).filter(c => c.userId === req.user.userId));
});

app.post('/api/chantiers', requireAuth, requireSubscribedOrFirstChantier, (req, res) => {
  const chantiers = readJSON(FILES.chantiers);
  const c = { id: uuidv4(), statut: 'en_soumission', ...req.body, userId: req.user.userId, createdAt: new Date().toISOString() };
  chantiers.push(c);
  writeJSON(FILES.chantiers, chantiers);
  res.json(c);
});

app.put('/api/chantiers/:id', requireAuth, (req, res) => {
  const chantiers = readJSON(FILES.chantiers);
  const idx = chantiers.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Chantier introuvable' });
  chantiers[idx] = { ...chantiers[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON(FILES.chantiers, chantiers);
  res.json(chantiers[idx]);
});

app.delete('/api/chantiers/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  writeJSON(FILES.chantiers,      readJSON(FILES.chantiers).filter(c => c.id !== id));
  writeJSON(FILES.soumissions,    readJSON(FILES.soumissions).filter(s => s.chantierId !== id));
  writeJSON(FILES.extras,         readJSON(FILES.extras).filter(e => e.chantierId !== id));
  writeJSON(FILES.factures,       readJSON(FILES.factures).filter(f => f.chantierId !== id));
  writeJSON(FILES.facturesClient, readJSON(FILES.facturesClient).filter(f => f.chantierId !== id));
  writeJSON(FILES.contrats,       readJSON(FILES.contrats).filter(c => c.chantierId !== id));
  res.json({ ok: true });
});

// ──────────────────────────── DASHBOARD ────────────────────────────

app.get('/api/dashboard', requireAuth, (req, res) => {
  const userId      = req.user.userId;
  const chantiers   = readJSON(FILES.chantiers).filter(c => c.userId === userId);
  const chantierIds = chantiers.map(c => c.id);
  const soumissions = readJSON(FILES.soumissions).filter(s => chantierIds.includes(s.chantierId));
  const extras      = readJSON(FILES.extras).filter(e => chantierIds.includes(e.chantierId));
  const factures    = readJSON(FILES.factures).filter(f => chantierIds.includes(f.chantierId));
  const extrasNonFactures = extras.filter(e => e.statut !== 'facturé');
  res.json({
    chantiers,
    stats: {
      totalChantiers:           chantiers.length,
      chantiersActifs:          chantiers.filter(c => c.statut === 'en_cours').length,
      soumissionsEnvoyees:      soumissions.filter(s => s.statut === 'envoyée').length,
      extrasNonFacturesCount:   extrasNonFactures.length,
      montantExtrasNonFactures: extrasNonFactures.reduce((a, e) => a + (e.total || 0), 0),
      facturesEnAttente:        factures.filter(f => f.statut === 'en_attente').length,
    },
  });
});

// ──────────────────────────── SOUMISSIONS ────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.get('/api/chantiers/:id/soumissions', requireAuth, (req, res) => {
  res.json(readJSON(FILES.soumissions).filter(s => s.chantierId === req.params.id));
});

app.post('/api/soumissions', requireAuth, async (req, res) => {
  const { chantierId, typesTravaux, description, postes = [], mainOeuvreHeures, mainOeuvreRate,
          delaiEstime, modalitesPaiement, conditionsSpeciales } = req.body;

  const chantier = readJSON(FILES.chantiers).find(c => c.id === chantierId);
  if (!chantier) return res.status(404).json({ error: 'Chantier introuvable' });

  const cfg    = readJSON(FILES.config);
  const numero = nextSoumissionNum();
  const today  = new Date().toLocaleDateString('fr-CA');

  const tauxHoraire  = parseFloat(mainOeuvreRate)  || 75;
  const heures       = parseFloat(mainOeuvreHeures) || 0;
  const totalPostes  = postes.reduce((a, p) => a + ((parseFloat(p.qte) || 0) * (parseFloat(p.prixUnit) || 0)), 0);
  const totalMO      = heures * tauxHoraire;
  const sousTotal    = totalPostes + totalMO;
  const tps          = sousTotal * 0.05;
  const tvq          = sousTotal * 0.09975;
  const total        = sousTotal + tps + tvq;

  const postesText = postes.length
    ? postes.map(p => `  • ${p.description}: ${p.qte} ${p.unite} × ${fmt(p.prixUnit)} = ${fmt((parseFloat(p.qte)||0)*(parseFloat(p.prixUnit)||0))}`).join('\n')
    : '  • Voir description des travaux';

  const ent = cfg.entreprise;
  const entHeader = ent.nom
    ? [ent.nom, ent.adresse, ent.telephone ? `Tél: ${ent.telephone}` : '', ent.email, ent.rbq ? `RBQ: ${ent.rbq}` : ''].filter(Boolean).join('\n')
    : '[Nom de votre entreprise]\n[Adresse] | [Téléphone]\n[Email] | [Numéro RBQ]';

  const prompt = `Tu es ConstructionAI, assistant pour entrepreneurs en construction du Québec.
Génère une soumission professionnelle complète en français québécois.

ENTREPRENEUR:
${entHeader}

CLIENT: ${chantier.client}
${chantier.email ? `Email: ${chantier.email}` : ''}
${chantier.tel   ? `Tél: ${chantier.tel}`     : ''}
ADRESSE DES TRAVAUX: ${chantier.adresse || '[adresse du chantier]'}

DATE: ${today}
NUMÉRO: ${numero}
TYPE DE TRAVAUX: ${typesTravaux}
DESCRIPTION: ${description || 'Travaux selon le détail ci-dessous'}

POSTES DE TRAVAUX:
${postesText}

MAIN D'ŒUVRE: ${heures}h × ${fmt(tauxHoraire)}/h = ${fmt(totalMO)}

RÉCAPITULATIF:
Sous-total matériaux et services: ${fmt(totalPostes)}
Sous-total main d'oeuvre: ${fmt(totalMO)}
Sous-total: ${fmt(sousTotal)}
TPS (5%): ${fmt(tps)}
TVQ (9.975%): ${fmt(tvq)}
TOTAL: ${fmt(total)}

MODALITÉS DE PAIEMENT: ${modalitesPaiement || '30 % à la signature, 40 % mi-travaux, 30 % à la livraison'}
DÉLAI ESTIMÉ: ${delaiEstime || 'À confirmer'}
${conditionsSpeciales ? `CONDITIONS SPÉCIALES: ${conditionsSpeciales}` : ''}
${cfg.conditionsPersonnalisees ? `\nCONDITIONS PERSONNALISÉES DE L'ENTREPRENEUR:\n${cfg.conditionsPersonnalisees}\n` : ''}
Génère une soumission en texte formaté incluant:
1. En-tête avec infos entrepreneur et client
2. Numéro et date de soumission
3. Description claire des travaux (2-3 phrases max, langage simple)
4. Tableau des postes et prix (reproduis les montants exacts)
5. Récapitulatif financier avec taxes (reproduis les montants exacts)
6. Conditions de paiement
7. Conditions générales — IMPORTANT: écris-les en langage simple et direct, comme si tu parlais à un voisin. PAS de jargon juridique, PAS de références à des articles de loi. Maximum 8 points courts. Couvre: validité 30 jours, extras par autorisation écrite, garantie 1 an, retards hors contrôle (météo etc.), accès au chantier, nettoyage, litiges à l'amiable d'abord. Chaque point = 1-2 lignes max.
8. Bloc de signature (Entrepreneur et Client avec espace date)

Style: clair, direct, humain. Un entrepreneur et son client doivent tout comprendre en 2 minutes. Pas de markdown.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: 'Tu es ConstructionAI, spécialisé en documents de construction au Québec. Génère des soumissions professionnelles en français québécois. Retourne uniquement le texte du document.',
      messages: [{ role: 'user', content: prompt }],
    });

    const texteGenere = response.content[0].text;
    const soumission = {
      id: uuidv4(), chantierId, numero, typesTravaux, description,
      postes, mainOeuvreHeures: heures, mainOeuvreRate: tauxHoraire,
      delaiEstime, modalitesPaiement, conditionsSpeciales,
      sousTotal, tps, tvq, total, texteGenere,
      statut: 'brouillon',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    const soumissions = readJSON(FILES.soumissions);
    soumissions.push(soumission);
    writeJSON(FILES.soumissions, soumissions);

    const usersArr = readJSON(FILES.users);
    const uIdx = usersArr.findIndex(u => u.id === req.user.userId);
    if (uIdx !== -1 && usersArr[uIdx].subscription?.status !== 'active') {
      if (!usersArr[uIdx].trialUsage) usersArr[uIdx].trialUsage = { soumissions: 0, contrats: 0, factures: 0 };
      usersArr[uIdx].trialUsage.soumissions = (usersArr[uIdx].trialUsage.soumissions || 0) + 1;
      writeJSON(FILES.users, usersArr);
    }

    res.json({ success: true, soumission });
  } catch (err) {
    console.error('Erreur soumission:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/soumissions/:id', requireAuth, (req, res) => {
  const soumissions = readJSON(FILES.soumissions);
  const idx = soumissions.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Soumission introuvable' });
  soumissions[idx] = { ...soumissions[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON(FILES.soumissions, soumissions);
  res.json(soumissions[idx]);
});

app.delete('/api/soumissions/:id', requireAuth, (req, res) => {
  writeJSON(FILES.soumissions, readJSON(FILES.soumissions).filter(s => s.id !== req.params.id));
  res.json({ ok: true });
});

// ──────────────────────────── EXTRAS ────────────────────────────

app.get('/api/chantiers/:id/extras', requireAuth, (req, res) => {
  res.json(readJSON(FILES.extras).filter(e => e.chantierId === req.params.id));
});

app.post('/api/extras', requireAuth, (req, res) => {
  const extras = readJSON(FILES.extras);
  const qte   = parseFloat(req.body.qte)     || 1;
  const prix  = parseFloat(req.body.prixUnit) || 0;
  const extra = {
    id: uuidv4(), ...req.body, qte, prixUnit: prix, total: qte * prix,
    statut: 'noté',
    date: req.body.date || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  extras.push(extra);
  writeJSON(FILES.extras, extras);
  res.json(extra);
});

app.put('/api/extras/:id', requireAuth, (req, res) => {
  const extras = readJSON(FILES.extras);
  const idx = extras.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Extra introuvable' });
  const updated = { ...extras[idx], ...req.body, updatedAt: new Date().toISOString() };
  updated.total = (parseFloat(updated.qte) || 1) * (parseFloat(updated.prixUnit) || 0);
  extras[idx] = updated;
  writeJSON(FILES.extras, extras);
  res.json(extras[idx]);
});

app.delete('/api/extras/:id', requireAuth, (req, res) => {
  writeJSON(FILES.extras, readJSON(FILES.extras).filter(e => e.id !== req.params.id));
  res.json({ ok: true });
});

// ──────────────────────────── FACTURES FOURNISSEURS ────────────────────────────

app.get('/api/chantiers/:id/factures', requireAuth, (req, res) => {
  res.json(readJSON(FILES.factures).filter(f => f.chantierId === req.params.id).map(({ thumbnail, ...f }) => f));
});

app.post('/api/factures/analyser', requireAuth, async (req, res) => {
  const { base64, thumbnail, mimeType, chantierId, fileName } = req.body;
  if (!base64 || !chantierId) return res.status(400).json({ error: 'Paramètres manquants' });
  if (!readJSON(FILES.chantiers).find(c => c.id === chantierId)) return res.status(404).json({ error: 'Chantier introuvable' });

  try {
    const imageContent = mimeType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image',    source: { type: 'base64', media_type: mimeType,            data: base64 } };

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: 'Tu extrais des données de factures fournisseurs construction québécois. Retourne UNIQUEMENT du JSON valide, sans markdown.',
      messages: [{
        role: 'user',
        content: [imageContent, { type: 'text', text: `Extrais les informations de cette facture fournisseur. Retourne UNIQUEMENT ce JSON (montants numériques sans symboles) :
{
  "fournisseur": "",
  "numero_facture": "",
  "date": "YYYY-MM-DD",
  "description": "",
  "sous_total": 0,
  "tps": 0,
  "tvq": 0,
  "total": 0,
  "categorie": "matériaux|sous-traitant|équipement|location|autre"
}` }],
      }],
    });

    const raw = response.content[0].text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const x   = JSON.parse(raw);

    const facture = {
      id: uuidv4(), chantierId,
      nom:          fileName || 'facture',
      thumbnail:    thumbnail || null,
      fournisseur:  x.fournisseur   || '',
      numeroFacture:x.numero_facture|| '',
      date:         x.date          || new Date().toISOString().split('T')[0],
      description:  x.description   || '',
      sousTotal:    parseFloat(x.sous_total) || 0,
      tps:          parseFloat(x.tps)        || 0,
      tvq:          parseFloat(x.tvq)        || 0,
      total:        parseFloat(x.total)      || 0,
      categorie:    x.categorie     || 'autre',
      statut: 'en_attente',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    const factures = readJSON(FILES.factures);
    factures.push(facture);
    writeJSON(FILES.factures, factures);

    const usersArr2 = readJSON(FILES.users);
    const uIdx2 = usersArr2.findIndex(u => u.id === req.user.userId);
    if (uIdx2 !== -1 && usersArr2[uIdx2].subscription?.status !== 'active') {
      if (!usersArr2[uIdx2].trialUsage) usersArr2[uIdx2].trialUsage = { soumissions: 0, contrats: 0, factures: 0 };
      usersArr2[uIdx2].trialUsage.factures = (usersArr2[uIdx2].trialUsage.factures || 0) + 1;
      writeJSON(FILES.users, usersArr2);
    }

    const { thumbnail: _t, ...factureOut } = facture;
    res.json({ success: true, facture: factureOut });
  } catch (err) {
    console.error('Erreur analyse facture:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/factures/:id', requireAuth, (req, res) => {
  const factures = readJSON(FILES.factures);
  const idx = factures.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Facture introuvable' });
  factures[idx] = { ...factures[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON(FILES.factures, factures);
  const { thumbnail, ...out } = factures[idx];
  res.json(out);
});

app.delete('/api/factures/:id', requireAuth, (req, res) => {
  writeJSON(FILES.factures, readJSON(FILES.factures).filter(f => f.id !== req.params.id));
  res.json({ ok: true });
});

// ──────────────────────────── CONTRATS ────────────────────────────

app.get('/api/chantiers/:id/contrats', requireAuth, (req, res) => {
  res.json(readJSON(FILES.contrats).filter(c => c.chantierId === req.params.id));
});

app.post('/api/contrats/generer', requireAuth, async (req, res) => {
  const { chantierId, soumissionId } = req.body;

  const chantier   = readJSON(FILES.chantiers).find(c => c.id === chantierId);
  const soumission = readJSON(FILES.soumissions).find(s => s.id === soumissionId);
  if (!chantier || !soumission) return res.status(404).json({ error: 'Chantier ou soumission introuvable' });

  const cfg = readJSON(FILES.config);
  const ent = cfg.entreprise;
  const entHeader = ent.nom
    ? [ent.nom, ent.adresse, ent.telephone ? `Tél: ${ent.telephone}` : '', ent.email, ent.rbq ? `RBQ: ${ent.rbq}` : ''].filter(Boolean).join('\n')
    : '[Nom de l\'entreprise]\n[Adresse] | [Téléphone] | [Email] | [RBQ]';

  const prompt = `Génère un contrat de construction complet, professionnel et légalement solide pour le Québec.

ENTREPRENEUR:
${entHeader}

CLIENT:
${chantier.client}
${chantier.email || ''}  ${chantier.tel || ''}

CHANTIER:
Adresse des travaux: ${chantier.adresse || '[adresse]'}
Référence soumission: ${soumission.numero}

TYPE DE TRAVAUX: ${soumission.typesTravaux}
DESCRIPTION: ${soumission.description || ''}
DÉLAI ESTIMÉ: ${soumission.delaiEstime || 'À confirmer'}

PRIX:
Sous-total: ${fmt(soumission.sousTotal)}
TPS (5%): ${fmt(soumission.tps)}
TVQ (9.975%): ${fmt(soumission.tvq)}
TOTAL: ${fmt(soumission.total)}
MODALITÉS: ${soumission.modalitesPaiement || '30 % à la signature, 40 % mi-travaux, 30 % à la livraison'}
${soumission.conditionsSpeciales ? `CONDITIONS SPÉCIALES: ${soumission.conditionsSpeciales}` : ''}

Date du contrat: ${new Date().toLocaleDateString('fr-CA')}

Génère un contrat clair et court (max 2 pages) avec ces sections en langage simple et direct:
1. LES PARTIES — qui fait quoi (entrepreneur et client, coordonnées)
2. LES TRAVAUX — ce qu'on va faire, à quelle adresse, référence soumission
3. LE PRIX ET LE PAIEMENT — montants exacts, échéancier clair (reproduis les montants exacts)
4. LES DÉLAIS — quand ça commence, combien de temps
5. LES EXTRAS — tout changement = entente écrite signée avant de commencer
6. LA GARANTIE — 1 an sur les travaux, comme l'exige la RBQ
7. SI ÇA NE MARCHE PAS — on essaie de s'entendre, sinon les tribunaux du Québec
8. SIGNATURES — espace pour signer (entrepreneur et client, avec date)

IMPORTANT: Écris comme si tu expliquais à un ami. Phrases courtes. Pas de jargon juridique. Pas de références aux articles du Code civil. Un entrepreneur et son client doivent lire ça en 3 minutes et tout comprendre. Le document reste légalement valide même en langage simple. Texte formaté, pas de markdown.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: 'Tu es ConstructionAI, assistant pour entrepreneurs en construction au Québec. Tu génères des contrats clairs et simples, compréhensibles sans formation juridique, mais légalement valides. Langage humain, direct, québécois. Retourne uniquement le texte du contrat.',
      messages: [{ role: 'user', content: prompt }],
    });

    const contrat = {
      id: uuidv4(), chantierId, soumissionId,
      numeroSoumission: soumission.numero,
      texte: response.content[0].text,
      statut: 'brouillon',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    const contrats = readJSON(FILES.contrats);
    contrats.push(contrat);
    writeJSON(FILES.contrats, contrats);

    const usersArr3 = readJSON(FILES.users);
    const uIdx3 = usersArr3.findIndex(u => u.id === req.user.userId);
    if (uIdx3 !== -1 && usersArr3[uIdx3].subscription?.status !== 'active') {
      if (!usersArr3[uIdx3].trialUsage) usersArr3[uIdx3].trialUsage = { soumissions: 0, contrats: 0, factures: 0 };
      usersArr3[uIdx3].trialUsage.contrats = (usersArr3[uIdx3].trialUsage.contrats || 0) + 1;
      writeJSON(FILES.users, usersArr3);
    }

    res.json({ success: true, contrat });
  } catch (err) {
    console.error('Erreur contrat:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/contrats/:id', requireAuth, (req, res) => {
  writeJSON(FILES.contrats, readJSON(FILES.contrats).filter(c => c.id !== req.params.id));
  res.json({ ok: true });
});

// ──────────────────────────── FACTURATION CLIENT ────────────────────────────

const TYPE_FAC_LABELS = {
  acompte:     'Acompte',
  'mi-travaux':'Facture mi-travaux',
  finale:      'Facture finale',
  extras:      'Extras / Travaux supplémentaires',
  partielle:   'Facture partielle',
};

app.get('/api/chantiers/:id/factures-client', requireAuth, (req, res) => {
  res.json(readJSON(FILES.facturesClient).filter(f => f.chantierId === req.params.id));
});

app.post('/api/factures-client/generer', requireAuth, async (req, res) => {
  const { chantierId, type, postes = [], modalitesPaiement, notes, extrasIds = [] } = req.body;

  const chantier = readJSON(FILES.chantiers).find(c => c.id === chantierId);
  if (!chantier) return res.status(404).json({ error: 'Chantier introuvable' });

  const cfg    = readJSON(FILES.config);
  const ent    = cfg.entreprise;
  const numero = nextFactureClientNum();
  const today  = new Date().toLocaleDateString('fr-CA');

  const allExtras   = readJSON(FILES.extras);
  const extrasInclus = extrasIds.length ? allExtras.filter(e => extrasIds.includes(e.id)) : [];

  const tousPostes = [
    ...postes.map(p => ({
      description: p.description,
      qte: parseFloat(p.qte) || 1,
      prixUnit: parseFloat(p.prixUnit) || 0,
      total: (parseFloat(p.qte) || 1) * (parseFloat(p.prixUnit) || 0),
    })),
    ...extrasInclus.map(e => ({
      description: e.description + (e.date ? ` (${e.date})` : ''),
      qte: parseFloat(e.qte) || 1,
      prixUnit: parseFloat(e.prixUnit) || 0,
      total: e.total || 0,
    })),
  ];

  const sousTotal = tousPostes.reduce((a, p) => a + p.total, 0);
  const tps       = sousTotal * 0.05;
  const tvq       = sousTotal * 0.09975;
  const total     = sousTotal + tps + tvq;

  const entHeader = ent.nom
    ? [ent.nom, ent.adresse, ent.telephone ? `Tél: ${ent.telephone}` : '', ent.email, ent.rbq ? `RBQ: ${ent.rbq}` : ''].filter(Boolean).join('\n')
    : '[Nom de votre entreprise]\n[Adresse] | [Téléphone] | [Email]';

  const postesText = tousPostes.length
    ? tousPostes.map(p => `  • ${p.description}: ${p.qte} × ${fmt(p.prixUnit)} = ${fmt(p.total)}`).join('\n')
    : '  • Travaux selon contrat';

  const soumRef = (readJSON(FILES.soumissions))
    .filter(s => s.chantierId === chantierId)
    .sort((a, b) => (b.statut === 'acceptée' ? 1 : 0) - (a.statut === 'acceptée' ? 1 : 0))[0];

  const prompt = `Tu es ConstructionAI, assistant pour entrepreneurs en construction du Québec.
Génère une facture client professionnelle et complète en français québécois.

ENTREPRENEUR:
${entHeader}

CLIENT: ${chantier.client}
${chantier.email ? `Courriel: ${chantier.email}` : ''}
${chantier.tel   ? `Tél: ${chantier.tel}` : ''}
ADRESSE DES TRAVAUX: ${chantier.adresse || '[adresse du chantier]'}

NUMÉRO DE FACTURE: ${numero}
DATE: ${today}
TYPE: ${TYPE_FAC_LABELS[type] || type}
${soumRef ? `RÉFÉRENCE SOUMISSION: ${soumRef.numero}` : ''}

POSTES FACTURÉS:
${postesText}

RÉCAPITULATIF:
Sous-total: ${fmt(sousTotal)}
TPS (5%): ${fmt(tps)}
TVQ (9.975%): ${fmt(tvq)}
TOTAL DÛ: ${fmt(total)}

MODALITÉS DE PAIEMENT: ${modalitesPaiement || 'Payable sur réception'}
${notes ? `NOTES: ${notes}` : ''}

Génère une facture professionnelle incluant:
1. En-tête avec infos entrepreneur et client
2. Numéro, date et type de facture
3. Référence soumission/contrat si disponible
4. Tableau des postes facturés avec montants exacts
5. Récapitulatif financier avec taxes (montants exacts)
6. Modalités de paiement claires
7. Instructions de paiement (chèque à l'ordre de / virement)
8. Note: intérêts de 1,5%/mois après 30 jours
9. Remerciement professionnel

Style: professionnel, sobre, clair, conforme aux pratiques québécoises. Pas de markdown.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'Tu es ConstructionAI, spécialisé en facturation de construction au Québec. Génère des factures professionnelles en français québécois. Retourne uniquement le texte du document.',
      messages: [{ role: 'user', content: prompt }],
    });

    const facture = {
      id: uuidv4(), chantierId, numero,
      type, typeLabel: TYPE_FAC_LABELS[type] || type,
      postes: tousPostes, extrasIds,
      sousTotal, tps, tvq, total,
      texteGenere: response.content[0].text,
      modalitesPaiement: modalitesPaiement || 'Payable sur réception',
      notes: notes || '',
      soumissionRef: soumRef?.numero || null,
      statut: 'brouillon',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };

    const facturesClient = readJSON(FILES.facturesClient);
    facturesClient.push(facture);
    writeJSON(FILES.facturesClient, facturesClient);

    // Marquer les extras comme facturés
    if (extrasIds.length) {
      const extras = readJSON(FILES.extras);
      extrasIds.forEach(eid => {
        const idx = extras.findIndex(e => e.id === eid);
        if (idx !== -1) extras[idx].statut = 'facturé';
      });
      writeJSON(FILES.extras, extras);
    }

    res.json({ success: true, facture });
  } catch (err) {
    console.error('Erreur facture client:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/factures-client/:id', requireAuth, (req, res) => {
  const facturesClient = readJSON(FILES.facturesClient);
  const idx = facturesClient.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Facture introuvable' });
  facturesClient[idx] = { ...facturesClient[idx], ...req.body, updatedAt: new Date().toISOString() };
  writeJSON(FILES.facturesClient, facturesClient);
  res.json(facturesClient[idx]);
});

app.delete('/api/factures-client/:id', requireAuth, (req, res) => {
  writeJSON(FILES.facturesClient, readJSON(FILES.facturesClient).filter(f => f.id !== req.params.id));
  res.json({ ok: true });
});

// ──────────────────────────── RENTABILITÉ ────────────────────────────

app.get('/api/chantiers/:id/rentabilite', requireAuth, (req, res) => {
  const chantierId = req.params.id;
  const soumissions    = readJSON(FILES.soumissions).filter(s => s.chantierId === chantierId);
  const extras         = readJSON(FILES.extras).filter(e => e.chantierId === chantierId);
  const factures       = readJSON(FILES.factures).filter(f => f.chantierId === chantierId);
  const facturesClient = readJSON(FILES.facturesClient).filter(f => f.chantierId === chantierId);

  const mainSoum = soumissions.find(s => s.statut === 'acceptée')
    || soumissions.find(s => s.statut === 'envoyée')
    || soumissions[soumissions.length - 1];

  const budgetSoumission  = mainSoum?.total || 0;
  const coutsFournisseurs = factures.reduce((a, f) => a + (f.total || 0), 0);
  const extrasTotal       = extras.reduce((a, e) => a + (e.total || 0), 0);
  const factureClientTotal= facturesClient.filter(f => f.statut !== 'brouillon').reduce((a, f) => a + (f.total || 0), 0);
  const factureClientBrut = facturesClient.reduce((a, f) => a + (f.total || 0), 0);

  const revenusEstimes    = budgetSoumission + extrasTotal;
  const margeEstimee      = revenusEstimes - coutsFournisseurs;
  const margePct          = revenusEstimes > 0 ? Math.round((margeEstimee / revenusEstimes) * 100) : 0;

  res.json({
    budgetSoumission,
    coutsFournisseurs,
    extrasTotal,
    factureClientTotal,
    factureClientBrut,
    revenusEstimes,
    margeEstimee,
    margePct,
    soumissionNumero: mainSoum?.numero || null,
  });
});

// ──────────────────────────── STATIC (production) ────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const distPath = join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(distPath, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`✅ ConstructionAI: http://localhost:${PORT}`));
