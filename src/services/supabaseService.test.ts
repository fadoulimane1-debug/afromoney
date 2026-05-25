/**
 * Tests de connexion et de santé Supabase.
 *
 * Pas de framework de test — s'exécute dans le navigateur.
 *
 * Usage depuis la console DevTools ou un bouton de debug :
 *   import { runSupabaseTests } from '@/services/supabaseService.test';
 *   await runSupabaseTests();
 */

import { supabase, SUPABASE_URL } from '@/lib/supabase';
import {
  createTransaction,
  getTransactions,
  createReliquat,
  getReliquats,
  calculateSoldes,
} from './supabaseService';
import type { Transaction, ReliquatDB } from '@/types/supabase';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  ok: boolean;
  detail?: string;
  ms: number;
}

function timer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

function pass(results: TestResult[], name: string, ms: number, detail?: string) {
  results.push({ name, ok: true, detail, ms });
  console.log(`  ✅ ${name}${detail ? ` — ${detail}` : ''} (${ms} ms)`);
}

function fail(results: TestResult[], name: string, ms: number, detail: string) {
  results.push({ name, ok: false, detail, ms });
  console.error(`  ❌ ${name} — ${detail} (${ms} ms)`);
}

// ──────────────────────────────────────────────────────────────
// Données de test (préfixe TEST_ pour faciliter le nettoyage)
// ──────────────────────────────────────────────────────────────

const TEST_TRANSACTION: Omit<Transaction, 'id' | 'created_at' | 'updated_at'> = {
  numero:            'TEST-0000',
  type:              'ACHAT',
  devise:            'EUR',
  montant:           100,
  montant_mad:       1050,
  taux:              10.5,
  operation:         'Test connexion Supabase',
  statut:            'PAYÉ',
  moment:            null,
  montant_a_payer:   null,
  client_id:         null,
  client_nom:        null,
  cin:               null,
  categorie:         'STANDARD',
  beneficiaire:      null,
  employe_id:        'TEST',
  employe_nom:       'Automatique',
  note:              '⚠️ Ligne de test — suppression automatique',
  caisse_depart:     null,
  jour:              25,
  mois:              5,
  annee:             2026,
  hash:              null,
  annulation_ref:    null,
  annulation_raison: null,
  date:              new Date().toISOString().slice(0, 10),
};

// ──────────────────────────────────────────────────────────────
// Tests individuels
// ──────────────────────────────────────────────────────────────

async function testConnexion(results: TestResult[]): Promise<void> {
  const t = timer();
  try {
    const { error } = await supabase.from('transactions').select('id').limit(1);
    if (error) throw error;
    pass(results, 'Connexion Supabase', t());
  } catch (err) {
    fail(results, 'Connexion Supabase', t(), String(err));
  }
}

async function testCreateTransaction(results: TestResult[]): Promise<string | null> {
  const t = timer();
  try {
    const created = await createTransaction(TEST_TRANSACTION);
    if (!created?.id) throw new Error('Aucune ligne retournée');
    pass(results, 'Créer une transaction', t(), `id=${created.id}`);
    return created.id;
  } catch (err) {
    fail(results, 'Créer une transaction', t(), String(err));
    return null;
  }
}

async function testGetTransactions(results: TestResult[]): Promise<void> {
  const t = timer();
  try {
    const rows = await getTransactions({ devise: 'EUR' });
    if (!Array.isArray(rows)) throw new Error('Résultat non tableau');
    pass(results, 'Récupérer les transactions (filtre EUR)', t(), `${rows.length} ligne(s)`);
  } catch (err) {
    fail(results, 'Récupérer les transactions', t(), String(err));
  }
}

async function testCreateReliquat(results: TestResult[]): Promise<string | null> {
  const t = timer();
  const today = new Date().toISOString().slice(0, 10);
  const payload: Omit<ReliquatDB, 'id' | 'created_at' | 'updated_at'> = {
    client:           'Client TEST',
    categorie_client: 'STANDARD',
    operation_ref:    'TEST-REF-0000',
    operation_numero: 'TEST-0000',
    devise:           'EUR',
    montant_initial:  500,
    montant_restant:  500,
    statut:           'NON_SOLDE',
    versements:       [],
    note:             '⚠️ Reliquat de test — suppression automatique',
    date_creation:    today,
    date_maj:         today,
  };
  try {
    const created = await createReliquat(payload);
    if (!created?.id) throw new Error('Aucune ligne retournée');
    pass(results, 'Créer un reliquat', t(), `id=${created.id}`);
    return created.id;
  } catch (err) {
    fail(results, 'Créer un reliquat', t(), String(err));
    return null;
  }
}

async function testGetReliquats(results: TestResult[]): Promise<void> {
  const t = timer();
  try {
    const rows = await getReliquats();
    if (!Array.isArray(rows)) throw new Error('Résultat non tableau');
    pass(results, 'Récupérer les reliquats', t(), `${rows.length} reliquat(s)`);
  } catch (err) {
    fail(results, 'Récupérer les reliquats', t(), String(err));
  }
}

async function testCalculateSoldes(results: TestResult[]): Promise<void> {
  const t = timer();
  try {
    const soldes = await calculateSoldes();
    if (!soldes) throw new Error('Résultat null');
    const totalDevises = soldes.parDevise.length;
    pass(
      results,
      'Calculer les soldes',
      t(),
      `bénéfice total=${soldes.beneficeTotal.toFixed(2)} MAD · ${totalDevises} devise(s)`,
    );
  } catch (err) {
    fail(results, 'Calculer les soldes', t(), String(err));
  }
}

async function testCleanup(results: TestResult[], txId: string | null): Promise<void> {
  const t = timer();
  if (!txId) {
    pass(results, 'Nettoyage données de test', t(), 'ignoré (transaction non créée)');
    return;
  }
  try {
    const { error } = await supabase.from('transactions').delete().eq('id', txId);
    if (error) throw error;
    pass(results, 'Nettoyage données de test', t(), `transaction ${txId} supprimée`);
  } catch (err) {
    fail(results, 'Nettoyage données de test', t(), String(err));
  }
}

// ──────────────────────────────────────────────────────────────
// Fonction principale exportée
// ──────────────────────────────────────────────────────────────

export async function runSupabaseTests(): Promise<TestResult[]> {
  console.group('🔧 Tests Supabase — AFROMONEY');
  console.log(`   URL : ${SUPABASE_URL}`);
  console.log(`   Date: ${new Date().toLocaleString('fr-MA')}\n`);

  const results: TestResult[] = [];

  // 1. Connexion
  await testConnexion(results);

  // 2. Créer une transaction de test
  const txId = await testCreateTransaction(results);

  // 3. Créer un reliquat de test
  const reliquatId = await testCreateReliquat(results);

  // 4. Récupérer les transactions
  await testGetTransactions(results);

  // 5. Récupérer les reliquats
  await testGetReliquats(results);

  // 6. Calculer les soldes
  await testCalculateSoldes(results);

  // 7. Nettoyage transactions
  await testCleanup(results, txId);

  // 8. Nettoyage reliquats
  if (reliquatId) {
    const t = timer();
    const { error } = await supabase.from('reliquats').delete().eq('id', reliquatId);
    if (error) fail(results, 'Nettoyage reliquat de test', t(), error.message);
    else pass(results, 'Nettoyage reliquat de test', t(), `reliquat ${reliquatId} supprimé`);
  }

  // ── Résumé ──
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const totalMs = results.reduce((s, r) => s + r.ms, 0);

  console.log('');
  console.log(`  Résultat : ${passed}/${results.length} tests réussis · ${totalMs} ms total`);

  if (failed === 0) {
    console.log('  🎉 Tous les tests ont réussi.');
  } else {
    console.warn(`  ⚠️  ${failed} test(s) en échec — vérifiez les tables Supabase et les RLS.`);
  }

  console.groupEnd();
  return results;
}

// ──────────────────────────────────────────────────────────────
// Auto-run optionnel (retirer le commentaire pour activer)
// ──────────────────────────────────────────────────────────────
// void runSupabaseTests();
