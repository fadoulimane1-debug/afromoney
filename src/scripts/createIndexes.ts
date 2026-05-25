/**
 * Création des index MongoDB — backend Node.js uniquement.
 *
 * ⚠️  Ne pas importer dans des composants React / pages Vite.
 *     Ce script est exécuté automatiquement au démarrage du serveur Express
 *     (server/index.js) ou manuellement via ts-node :
 *
 *       npx ts-node --esm src/scripts/createIndexes.ts
 */

import { getDatabase } from '@/lib/mongodb';

export async function createMongoIndexes(): Promise<void> {
  try {
    const db = await getDatabase();

    // ── Transactions ──────────────────────────────────────────────────────────
    await db.collection('transactions').createIndex({ date: -1 });
    await db.collection('transactions').createIndex({ numero: 1 }, { unique: true });
    await db.collection('transactions').createIndex({ devise: 1 });
    await db.collection('transactions').createIndex({ type: 1 });
    await db.collection('transactions').createIndex({ employeId: 1 });
    await db.collection('transactions').createIndex({ annee: 1, mois: 1 });

    // ── Reliquats ─────────────────────────────────────────────────────────────
    await db.collection('reliquats').createIndex({ statut: 1 });
    await db.collection('reliquats').createIndex({ client: 1 });
    await db.collection('reliquats').createIndex({ dateCreation: -1 });

    // ── Mouvements caisse ─────────────────────────────────────────────────────
    await db.collection('mouvements_caisse').createIndex({ timestamp: -1 });
    await db.collection('mouvements_caisse').createIndex({ devise: 1 });

    console.log('✅ MongoDB indexes created');
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
  }
}
