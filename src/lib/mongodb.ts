/**
 * ⚠️  ATTENTION — COMPATIBILITÉ NAVIGATEUR
 * ─────────────────────────────────────────────────────────────────────────────
 * Le driver `mongodb` est conçu pour Node.js (backend).
 * Il utilise net / tls / dns que le navigateur n'expose PAS.
 *
 * Ce fichier NE PEUT PAS être importé directement dans les composants React /
 * pages Vite — cela lèvera une erreur au build ou au runtime.
 *
 * OPTIONS CORRECTES pour accéder à MongoDB depuis une app Vite+React :
 *
 *   1. BACKEND SÉPARÉ (recommandé)
 *      Créer un serveur Express / Fastify et exposer une API REST :
 *        POST /api/transactions  GET /api/transactions  etc.
 *      → Ce fichier peut être utilisé côté serveur Node.js.
 *
 *   2. NEXT.JS (alternative)
 *      Migrer vers Next.js et utiliser les Route Handlers (app/api/...).
 *      → Ce fichier est utilisable dans les Server Components / API Routes.
 *
 *   3. MONGODB ATLAS DATA API (HTTP pur, compatible browser)
 *      Remplacer ce fichier par des appels fetch() vers :
 *        https://data.mongodb-api.com/app/<app-id>/endpoint/data/v1
 *      → Voir src/lib/mongodbDataApi.ts
 *
 *   4. SUPABASE (déjà intégré — SOLUTION RECOMMANDÉE)
 *      L'app possède déjà Supabase (src/lib/supabase.ts) qui fonctionne
 *      nativement dans le navigateur. Pas besoin de MongoDB.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Ce bloc n'est utilisable que dans un contexte Node.js (backend).
// N'importez PAS ce fichier dans vos composants React ou pages Vite.

import { MongoClient, Db } from 'mongodb';

const MONGODB_URI =
  'mongodb+srv://afromoney:MongoDB@2026!@cluster0.zoqjwsy.mongodb.net/?appName=Cluster0';
const DB_NAME = 'afromoney_db';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    cachedClient = client;
    cachedDb = db;

    console.log('✅ Connected to MongoDB');
    return { client, db };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

export async function getDatabase(): Promise<Db> {
  if (cachedDb) return cachedDb;
  const { db } = await connectToDatabase();
  return db;
}

export async function closeConnection(): Promise<void> {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = null;
    cachedDb = null;
    console.log('🔌 MongoDB connection closed');
  }
}

export { DB_NAME };
