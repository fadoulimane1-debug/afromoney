/**
 * AFROMONEY — Diagnostic bénéfice négatif
 * Coller dans F12 > Console (sur la page de l'app)
 * ou : node diagnostic-benefice.js  (si vous exportez localStorage en JSON)
 * ================================================================
 */
(function diagAfromoney() {
  'use strict';

  // ── Helpers ─────────────────────────────────────────────────────
  const fr = (n, d = 2) =>
    Number(n || 0).toLocaleString('fr-MA', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });

  const sep = (char = '═', len = 72) => console.log(char.repeat(len));

  function parse(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  }

  // ── 1. Chargement ────────────────────────────────────────────────
  const raw = parse('transactions');
  if (!Array.isArray(raw)) {
    console.error('❌  Aucune donnée dans localStorage("transactions"). App ouverte ?');
    return;
  }

  // ── 2. Filtrage (même logique que filterTransactionsComptables) ──
  const annulRefs = new Set(
    raw.filter((t) => t.type === 'ANNULATION').map((t) => t.annulationRef)
  );
  const valides = raw.filter(
    (t) => t.type !== 'ANNULATION' && !annulRefs.has(t.id)
  );
  const annulee = raw.filter(
    (t) => t.type !== 'ANNULATION' && annulRefs.has(t.id)
  );

  const byType = (type) => valides.filter((t) => t.type === type);
  const achats   = byType('ACHAT');
  const ventes   = byType('VENTE');
  const depots   = byType('DEPOT');
  const retraits = byType('RETRAIT');
  const charges  = byType('CHARGES');

  const sum = (arr, f = 'montantMAD') =>
    arr.reduce((s, t) => s + (Number(t[f]) || 0), 0);

  const totalA = sum(achats);
  const totalV = sum(ventes);
  const totalD = sum(depots);
  const totalR = sum(retraits);
  const totalC = sum(charges);
  const benefice = totalV - totalA - totalC;

  // ── 3. Résumé global ─────────────────────────────────────────────
  sep();
  console.log('%cAFROMONEY — DIAGNOSTIC BÉNÉFICE', 'font-size:14px;font-weight:bold;color:#0ea5e9');
  sep();
  console.log(`Total transactions brutes   : ${raw.length}`);
  console.log(`  dont ANNULATION           : ${raw.filter((t) => t.type === 'ANNULATION').length}`);
  console.log(`  dont annulées             : ${annulee.length}`);
  console.log(`Transactions comptables     : ${valides.length}`);
  console.log('');
  console.log(`  ACHAT    : ${achats.length.toString().padStart(4)} tx  →  ${fr(totalA).padStart(16)} MAD`);
  console.log(`  VENTE    : ${ventes.length.toString().padStart(4)} tx  →  ${fr(totalV).padStart(16)} MAD`);
  console.log(`  DÉPÔT    : ${depots.length.toString().padStart(4)} tx  →  ${fr(totalD).padStart(16)} MAD`);
  console.log(`  RETRAIT  : ${retraits.length.toString().padStart(4)} tx  →  ${fr(totalR).padStart(16)} MAD`);
  console.log(`  CHARGES  : ${charges.length.toString().padStart(4)} tx  →  ${fr(totalC).padStart(16)} MAD`);
  sep('─');
  const style = benefice < 0 ? 'color:red;font-weight:bold' : 'color:green;font-weight:bold';
  console.log(`%cBÉNÉFICE NET (Ventes − Achats − Charges) : ${fr(benefice)} MAD`, style);
  sep();

  // ── 4. Top 10 achats ─────────────────────────────────────────────
  console.log('\n📦  TOP 10 ACHATS par montantMAD décroissant');
  sep('─');
  const top10 = [...achats]
    .sort((a, b) => (Number(b.montantMAD) || 0) - (Number(a.montantMAD) || 0))
    .slice(0, 10);

  top10.forEach((t, i) => {
    const date = (() => {
      const d = new Date(t.date);
      return isNaN(d) ? '????-??-??' : d.toISOString().slice(0, 10);
    })();
    const num   = t.numero  || '⚠️ SANS BCH';
    const hash  = t.hash    ? '🔒' : '⚠️ SANS HASH';
    const flags = [];
    if (!t.numero) flags.push('SANS-BCH');
    if (!t.hash)   flags.push('SANS-HASH');
    const flagStr = flags.length ? `  ← 🔴 ${flags.join(' + ')}` : '';
    console.log(
      `  ${String(i + 1).padStart(2)}. ${date}  ${t.devise.padEnd(4)} ` +
      `${fr(t.montant, 4).padStart(14)} × ${String(t.taux).padStart(8)} ` +
      `= ${fr(t.montantMAD).padStart(14)} MAD  |  ${num}  ${hash}${flagStr}`
    );
  });

  // ── 5. Transactions suspectes ─────────────────────────────────────
  const sansNumero = achats.filter((t) => !t.numero);
  const sansHash   = achats.filter((t) => !t.hash);
  const suspects   = [...new Map(
    [...sansNumero, ...sansHash].map((t) => [t.id, t])
  ).values()];

  sep('─');
  if (suspects.length === 0) {
    console.log('%c✅  Aucun ACHAT suspect (tous ont numéro BCH et hash).', 'color:green');
  } else {
    console.log(`%c🔴  ${suspects.length} ACHAT(S) SUSPECT(S) DÉTECTÉ(S)`, 'color:red;font-weight:bold');
    suspects.forEach((t) => {
      const date = new Date(t.date).toISOString().slice(0, 10);
      const why = [!t.numero && 'sans BCH', !t.hash && 'sans hash'].filter(Boolean).join(' + ');
      console.log(`     ID: ${t.id}  |  ${date}  |  ${fr(t.montantMAD)} MAD  |  [${why}]`);
    });

    // Impact: si on retire les suspects, quel serait le bénéfice ?
    const madSuspects = sum(suspects);
    const beneficeApres = benefice + madSuspects;
    console.log('');
    console.log(`  Impact suppression :`);
    console.log(`    Achats suspects    : ${fr(madSuspects)} MAD`);
    console.log(`    Bénéfice AVANT     : ${fr(benefice)} MAD`);
    console.log(`    Bénéfice APRÈS     : ${fr(beneficeApres)} MAD  ${beneficeApres >= 0 ? '✅' : '⚠️ toujours négatif'}`);
  }

  // ── 6. Timestamps à 00:00:00 ─────────────────────────────────────
  const minuit = valides.filter((t) => {
    const d = new Date(t.date);
    return !isNaN(d) && d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;
  });
  if (minuit.length > 0) {
    console.warn(`\n⚠️  ${minuit.length} transaction(s) avec heure 00:00:00`);
  } else {
    console.log('\n✅  Timestamps OK (aucun 00:00:00)');
  }

  // ── 7. Snippet de suppression ────────────────────────────────────
  if (suspects.length > 0) {
    const ids = JSON.stringify(suspects.map((t) => t.id));
    sep('─');
    console.log('%c📋  SNIPPET DE SUPPRESSION  (copiez ce bloc dans la console):', 'font-weight:bold');
    console.log(`
// ── Supprimer les transactions suspectes ────────────────────
const IDS_A_SUPPRIMER = ${ids};
const avant = JSON.parse(localStorage.getItem('transactions') || '[]');
const apres = avant.filter(t => !IDS_A_SUPPRIMER.includes(t.id));
localStorage.setItem('transactions', JSON.stringify(apres));
console.log(\`✅ Supprimé \${avant.length - apres.length} transaction(s). Avant: \${avant.length}, Après: \${apres.length}.\`);
window.dispatchEvent(new Event('afromoney-data'));
// location.reload(); // décommentez pour recharger la page
    `);
  }

  sep();
  console.log('%cDiagnostic terminé. Résultats ci-dessus ↑', 'color:#71717a;font-style:italic');
  sep();
})();
