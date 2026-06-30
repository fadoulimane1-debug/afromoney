import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';

// ── Config ────────────────────────────────────────────────────────────────────

const PORT     = process.env.PORT ?? 3001;
const MONGO_URI = process.env.MONGODB_URI
  ?? 'mongodb+srv://afromoney:MongoDB@2026!@cluster0.zoqjwsy.mongodb.net/?appName=Cluster0';
const DB_NAME  = process.env.DB_NAME ?? 'afromoney_db';

// ── MongoDB connection (singleton) ────────────────────────────────────────────

let db = null;

async function getDb() {
  if (db) return db;
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log('✅ Connected to MongoDB:', DB_NAME);
  return db;
}

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();

/** Origines autorisées (Vercel + previews + local). */
const ALLOWED_ORIGINS = new Set([
  'https://afromoney.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
]);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return /^https:\/\/afromoney[a-z0-9-]*\.vercel\.app$/i.test(origin);
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) callback(null, true);
      else callback(null, true); // bureau de change : autoriser toutes origines HTTPS en prod
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// En-têtes CORS explicites (requêtes depuis afromoney.vercel.app)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  try {
    await getDb();
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.json({
      status: 'ok',
      db: 'disconnected',
      hint: 'Ajoutez MONGODB_URI dans Railway → Variables',
      error: err.message,
    });
  }
});

/** Racine : rappel que l’interface est sur Vercel (évite la confusion avec le build Vite). */
app.get('/', (_req, res) => {
  res.json({
    service: 'AFROMONEY API',
    ui: 'https://afromoney.vercel.app',
    health: '/api/health',
  });
});

// ── Test endpoint (dev only) ──────────────────────────────────────────────────

app.get('/api/test-mongodb', async (_req, res) => {
  const log = [];
  let insertedId = null;

  function step(msg) { log.push(msg); console.log(msg); }

  try {
    const database = await getDb();
    step('✅ 1/5  Connexion MongoDB OK');

    // Création transaction de test
    const now = new Date();
    const doc = {
      numero:     'TEST-2026-999999',
      type:       'ACHAT',
      devise:     'EUR',
      montant:    100,
      montantMAD: 1085,
      taux:       10.85,
      operation:  'TEST — à supprimer',
      statut:     'PAYÉ',
      categorie:  'STANDARD',
      employeId:  'TEST_EMPLOYE',
      jour:       now.getDate(),
      mois:       now.getMonth() + 1,
      annee:      now.getFullYear(),
      date:       now,
      createdAt:  now,
      updatedAt:  now,
    };
    const result = await database.collection('transactions').insertOne(doc);
    insertedId = result.insertedId;
    step(`✅ 2/5  Transaction créée : ${insertedId}`);

    // Lecture
    const transactions = await database.collection('transactions').find({}).toArray();
    step(`✅ 3/5  ${transactions.length} transaction(s) trouvée(s)`);

    // Calcul soldes
    const txAll = await database.collection('transactions').find({}).toArray();
    const totalAchats = txAll
      .filter((t) => t.type === 'ACHAT')
      .reduce((s, t) => s + (t.montantMAD ?? 0), 0);
    step(`✅ 4/5  Soldes calculés — achats: ${totalAchats} MAD`);

    // Nettoyage
    await database.collection('transactions').deleteOne({ _id: insertedId });
    insertedId = null;
    step('✅ 5/5  Données de test nettoyées');

    step('✅ ALL TESTS PASSED');
    res.json({ success: true, log });
  } catch (err) {
    step(`❌ Test échoué : ${err.message}`);
    if (insertedId) {
      try {
        const database = await getDb();
        await database.collection('transactions').deleteOne({ _id: insertedId });
        step('🧹 Nettoyage après échec effectué');
      } catch { /* ignore */ }
    }
    res.status(500).json({ success: false, log, error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTIONS — /api/transactions
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/transactions', async (req, res) => {
  try {
    const database = await getDb();
    const query = {};

    const { dateDebut, dateFin, devise, type, employeId } = req.query;

    if (dateDebut || dateFin) {
      query.date = {};
      if (dateDebut) query.date.$gte = new Date(dateDebut);
      if (dateFin)   query.date.$lte = new Date(dateFin);
    }
    if (devise)    query.devise    = devise;
    if (type)      query.type      = type;
    if (employeId) query.employeId = employeId;

    const rows = await database
      .collection('transactions')
      .find(query)
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    res.json(rows.map(serializeTx));
  } catch (err) {
    console.error('[GET /api/transactions]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const database = await getDb();
    const doc = {
      ...req.body,
      date:      req.body.date ? new Date(req.body.date) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await database.collection('transactions').insertOne(doc);
    const inserted = await database.collection('transactions').findOne({ _id: result.insertedId });
    res.status(201).json(serializeTx(inserted));
  } catch (err) {
    console.error('[POST /api/transactions]', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/transactions/:id', async (req, res) => {
  try {
    const database = await getDb();
    const { id } = req.params;
    const update = { ...req.body, updatedAt: new Date() };
    if (update.date) update.date = new Date(update.date);

    await database
      .collection('transactions')
      .updateOne({ _id: new ObjectId(id) }, { $set: update });

    const updated = await database.collection('transactions').findOne({ _id: new ObjectId(id) });
    res.json(serializeTx(updated));
  } catch (err) {
    console.error('[PATCH /api/transactions/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const database = await getDb();
    await database.collection('transactions').deleteOne({ _id: new ObjectId(req.params.id) });
    res.status(204).end();
  } catch (err) {
    console.error('[DELETE /api/transactions/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// RELIQUATS — /api/reliquats
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/reliquats', async (req, res) => {
  try {
    const database = await getDb();
    const query = {};
    const { statut, client } = req.query;
    if (statut) query.statut = statut;
    if (client) query.client = { $regex: client, $options: 'i' };

    const rows = await database
      .collection('reliquats')
      .find(query)
      .sort({ dateCreation: -1 })
      .toArray();

    res.json(rows.map(serializeDoc));
  } catch (err) {
    console.error('[GET /api/reliquats]', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reliquats', async (req, res) => {
  try {
    const database = await getDb();
    const doc = {
      ...req.body,
      dateCreation: req.body.dateCreation ? new Date(req.body.dateCreation) : new Date(),
      dateMaj:      new Date(),
      createdAt:    new Date(),
      updatedAt:    new Date(),
    };
    const result  = await database.collection('reliquats').insertOne(doc);
    const inserted = await database.collection('reliquats').findOne({ _id: result.insertedId });
    res.status(201).json(serializeDoc(inserted));
  } catch (err) {
    console.error('[POST /api/reliquats]', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reliquats/:id', async (req, res) => {
  try {
    const database = await getDb();
    await database.collection('reliquats').deleteOne({ _id: new ObjectId(req.params.id) });
    res.status(204).end();
  } catch (err) {
    console.error('[DELETE /api/reliquats/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/reliquats/:id', async (req, res) => {
  try {
    const database = await getDb();
    const update = { ...req.body, updatedAt: new Date(), dateMaj: new Date() };

    await database
      .collection('reliquats')
      .updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });

    const updated = await database.collection('reliquats').findOne({ _id: new ObjectId(req.params.id) });
    res.json(serializeDoc(updated));
  } catch (err) {
    console.error('[PATCH /api/reliquats/:id]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SOLDES calculés — /api/soldes
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/soldes', async (req, res) => {
  try {
    const database = await getDb();
    const query = {};
    const { dateDebut, dateFin } = req.query;

    if (dateDebut || dateFin) {
      query.date = {};
      if (dateDebut) query.date.$gte = new Date(dateDebut);
      if (dateFin)   query.date.$lte = new Date(dateFin);
    }

    const transactions = await database.collection('transactions').find(query).toArray();

    const deviseMap = new Map();
    let totalAchatsMAD = 0;
    let totalVentesMAD = 0;
    let totalCharges   = 0;

    for (const tx of transactions) {
      const devise = tx.devise ?? 'MAD';
      if (!deviseMap.has(devise)) {
        deviseMap.set(devise, { devise, achats: 0, ventes: 0, net: 0 });
      }
      const entry = deviseMap.get(devise);

      if (tx.type === 'ACHAT') {
        entry.achats   += tx.montant    ?? 0;
        totalAchatsMAD += tx.montantMAD ?? 0;
      } else if (tx.type === 'VENTE') {
        entry.ventes   += tx.montant    ?? 0;
        totalVentesMAD += tx.montantMAD ?? 0;
      } else if (tx.type === 'CHARGES') {
        totalCharges   += tx.montantMAD ?? 0;
      }
    }

    const parDevise = [...deviseMap.values()].map((d) => ({
      ...d,
      net: d.ventes - d.achats,
    }));

    res.json({
      parDevise,
      totalAchatsMAD,
      totalVentesMAD,
      totalCharges,
      benefice: totalVentesMAD - totalAchatsMAD - totalCharges,
    });
  } catch (err) {
    console.error('[GET /api/soldes]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// CLÔTURES — /api/closures
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/closures', async (_req, res) => {
  try {
    const database = await getDb();
    const rows = await database
      .collection('closures')
      .find({})
      .sort({ date: -1 })
      .toArray();
    res.json(rows.map(serializeDoc));
  } catch (err) {
    console.error('[GET /api/closures]', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/closures', async (req, res) => {
  try {
    const database = await getDb();
    const doc = { ...req.body, updatedAt: new Date() };
    if (!doc.date) {
      res.status(400).json({ error: 'date requise' });
      return;
    }
    await database.collection('closures').updateOne(
      { date: doc.date },
      { $set: doc },
      { upsert: true },
    );
    const saved = await database.collection('closures').findOne({ date: doc.date });
    res.json(serializeDoc(saved));
  } catch (err) {
    console.error('[PUT /api/closures]', err);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PARAMÈTRES — taux de change partagés
// ══════════════════════════════════════════════════════════════════════════════

const SETTINGS_RATES_ID = 'exchange_rates';

app.get('/api/settings/exchange-rates', async (_req, res) => {
  try {
    const database = await getDb();
    const doc = await database.collection('settings').findOne({ _id: SETTINGS_RATES_ID });
    res.json({ rates: doc?.rates ?? [] });
  } catch (err) {
    console.error('[GET /api/settings/exchange-rates]', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings/exchange-rates', async (req, res) => {
  try {
    const database = await getDb();
    const rates = req.body?.rates ?? [];
    await database.collection('settings').updateOne(
      { _id: SETTINGS_RATES_ID },
      { $set: { rates, updatedAt: new Date() } },
      { upsert: true },
    );
    res.json({ ok: true, count: rates.length });
  } catch (err) {
    console.error('[PUT /api/settings/exchange-rates]', err);
    res.status(500).json({ error: err.message });
  }
});
// ══════════════════════════════════════════════════════════════════════════════
// SNAPSHOTS (solde journalier : DEPART / CLOTURE / FINAL) — /api/snapshots
// ══════════════════════════════════════════════════════════════════════════════

app.get('/api/snapshots', async (req, res) => {
  try {
    const database = await getDb();
    const query = {};
    const { caisse_id, date_comptable } = req.query;
    if (caisse_id) query.caisse_id = Number(caisse_id);
    if (date_comptable) query.date_comptable = date_comptable;

    const rows = await database
      .collection('snapshots')
      .find(query)
      .sort({ horodatage: -1 })
      .toArray();

    res.json(rows.map(serializeDoc));
  } catch (err) {
    console.error('[GET /api/snapshots]', err);
    res.status(500).json({ error: err.message });
  }
});

// Upsert d'une ligne (clé = caisse_id + date_comptable + type_solde + devise_code)
app.put('/api/snapshots', async (req, res) => {
  try {
    const database = await getDb();
    const doc = { ...req.body, updatedAt: new Date() };
    const { caisse_id, date_comptable, type_solde, devise_code } = doc;
    if (!caisse_id || !date_comptable || !type_solde || !devise_code) {
      res.status(400).json({ error: 'caisse_id, date_comptable, type_solde, devise_code requis' });
      return;
    }
    await database.collection('snapshots').updateOne(
      { caisse_id, date_comptable, type_solde, devise_code },
      { $set: doc },
      { upsert: true },
    );
    const saved = await database.collection('snapshots').findOne({ caisse_id, date_comptable, type_solde, devise_code });
    res.json(serializeDoc(saved));
  } catch (err) {
    console.error('[PUT /api/snapshots]', err);
    res.status(500).json({ error: err.message });
  }
});

// Remplace en une fois toutes les devises d'un type pour un jour donné (bulk upsert)
app.put('/api/snapshots/bulk', async (req, res) => {
  try {
    const database = await getDb();
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'rows[] requis' });
      return;
    }
    const ops = rows.map((r) => ({
      updateOne: {
        filter: {
          caisse_id: r.caisse_id,
          date_comptable: r.date_comptable,
          type_solde: r.type_solde,
          devise_code: r.devise_code,
        },
        update: { $set: { ...r, updatedAt: new Date() } },
        upsert: true,
      },
    }));
    await database.collection('snapshots').bulkWrite(ops);
    res.json({ ok: true, count: rows.length });
  } catch (err) {
    console.error('[PUT /api/snapshots/bulk]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Serializers (ObjectId → string, Date → ISO string) ────────────────────────

function serializeTx(doc) {
  if (!doc) return null;
  return {
    ...doc,
    _id:       doc._id?.toString(),
    date:      doc.date instanceof Date      ? doc.date.toISOString()      : doc.date,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  };
}

function serializeDoc(doc) {
  if (!doc) return null;
  const out = { ...doc, _id: doc._id?.toString() };
  for (const [k, v] of Object.entries(out)) {
    if (v instanceof Date) out[k] = v.toISOString();
  }
  return out;
}

// ── Index creation ────────────────────────────────────────────────────────────

async function createIndexes(database) {
  try {
    // Transactions
    await database.collection('transactions').createIndex({ date: -1 });
    await database.collection('transactions').createIndex({ numero: 1 }, { unique: true, sparse: true });
    await database.collection('transactions').createIndex({ devise: 1 });
    await database.collection('transactions').createIndex({ type: 1 });
    await database.collection('transactions').createIndex({ employeId: 1 });
    await database.collection('transactions').createIndex({ annee: 1, mois: 1 });
    await database.collection('snapshots').createIndex(
  { caisse_id: 1, date_comptable: 1, type_solde: 1, devise_code: 1 },
  { unique: true },
   );

    // Reliquats
    await database.collection('reliquats').createIndex({ statut: 1 });
    await database.collection('reliquats').createIndex({ client: 1 });
    await database.collection('reliquats').createIndex({ dateCreation: -1 });

    // Mouvements caisse
    await database.collection('mouvements_caisse').createIndex({ timestamp: -1 });
    await database.collection('mouvements_caisse').createIndex({ devise: 1 });

    await database.collection('closures').createIndex({ date: 1 }, { unique: true });

    console.log('✅ MongoDB indexes ready');
  } catch (err) {
    console.error('❌ Error creating indexes:', err.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`🚀 AFROMONEY API server running on http://localhost:${PORT}/api`);
  const database = await getDb().catch(() => null);
  if (database) await createIndexes(database);
});
