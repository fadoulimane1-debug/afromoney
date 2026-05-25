/**
 * Tests de connexion MongoDB — backend Node.js uniquement.
 *
 * ⚠️  Ne pas importer dans des composants React / pages Vite.
 *
 * Exécution :
 *   • Via l'endpoint Express (recommandé en dev) :
 *       GET http://localhost:3001/api/test-mongodb
 *
 *   • Via ts-node (manuel) :
 *       npx ts-node --esm src/services/mongodb.test.ts
 */

import { connectToDatabase } from '@/lib/mongodb';
import {
  createTransaction,
  getTransactions,
  calculateSoldes,
  deleteTransaction,
} from '@/services/mongodbService';

const TEST_TX_NUMERO = 'TEST-2026-999999';

export async function testMongoDB(): Promise<boolean> {
  let insertedId: string | null = null;

  try {
    // ── 1. Connexion ──────────────────────────────────────────────────────────
    console.group('🔄 Tests MongoDB');
    console.log('1/5  Connexion...');
    await connectToDatabase();
    console.log('     ✅ Connecté à MongoDB');

    // ── 2. Création transaction de test ───────────────────────────────────────
    console.log('2/5  Création transaction de test...');
    const now = new Date();
    const result = await createTransaction({
      numero:      TEST_TX_NUMERO,
      type:        'ACHAT',
      devise:      'EUR',
      montant:     100,
      montantMAD:  1085,
      taux:        10.85,
      operation:   'TEST — à supprimer',
      statut:      'PAYÉ',
      categorie:   'STANDARD',
      employeId:   'TEST_EMPLOYE',
      employeNom:  'Test Employé',
      jour:        now.getDate(),
      mois:        now.getMonth() + 1,
      annee:       now.getFullYear(),
      date:        now,
    });
    insertedId = result.insertedId;
    console.log('     ✅ Transaction créée :', insertedId);

    // ── 3. Récupération des transactions ──────────────────────────────────────
    console.log('3/5  Récupération des transactions...');
    const transactions = await getTransactions();
    console.log(`     ✅ ${transactions.length} transaction(s) trouvée(s)`);

    // ── 4. Calcul des soldes ──────────────────────────────────────────────────
    console.log('4/5  Calcul des soldes...');
    const soldes = await calculateSoldes();
    console.log(
      `     ✅ Soldes — achats: ${soldes.totalAchatsMAD} MAD | bénéfice: ${soldes.benefice} MAD`,
    );

    // ── 5. Nettoyage ──────────────────────────────────────────────────────────
    console.log('5/5  Nettoyage données de test...');
    await deleteTransaction(insertedId);
    insertedId = null;
    console.log('     ✅ Transaction de test supprimée');

    console.log('✅  ALL TESTS PASSED');
    console.groupEnd();
    return true;
  } catch (error) {
    console.error('❌  Test échoué :', error);
    // Tentative de nettoyage si la transaction a été créée
    if (insertedId) {
      try {
        await deleteTransaction(insertedId);
        console.log('🧹 Nettoyage après échec effectué.');
      } catch {
        console.warn('⚠️  Impossible de supprimer la transaction de test :', insertedId);
      }
    }
    console.groupEnd();
    return false;
  }
}
