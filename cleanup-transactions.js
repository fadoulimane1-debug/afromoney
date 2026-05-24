/**
 * AFROMONEY — Nettoyage transactions suspectes
 * Coller dans F12 > Console (sur la page de l'app)
 * ================================================================
 *
 * MODES DISPONIBLES :
 *
 *  MODE 1 — Supprimer les achats sans numéro BCH ET sans hash (auto-détection)
 *    cleanupAfromoney('auto');
 *
 *  MODE 2 — Supprimer des IDs spécifiques (liste manuelle)
 *    cleanupAfromoney('ids', ['1234567890', '9876543210']);
 *
 *  MODE 3 — Simulation (dry-run, sans toucher aux données)
 *    cleanupAfromoney('dry');
 *
 * ================================================================
 */
function cleanupAfromoney(mode, idsManuel) {
  'use strict';

  const fr = (n, d = 2) =>
    Number(n || 0).toLocaleString('fr-MA', {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  const sep = (c = '═', l = 72) => console.log(c.repeat(l));

  // ── Chargement ────────────────────────────────────────────────────
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem('transactions') || 'null');
  } catch {
    console.error('❌  localStorage("transactions") illisible.');
    return;
  }
  if (!Array.isArray(raw)) {
    console.error('❌  Aucune transaction. App ouverte ?');
    return;
  }

  // ── Calcul bénéfice (helper) ─────────────────────────────────────
  function calcBenefice(txList) {
    const annulRefs = new Set(
      txList.filter((t) => t.type === 'ANNULATION').map((t) => t.annulationRef)
    );
    const valides = txList.filter(
      (t) => t.type !== 'ANNULATION' && !annulRefs.has(t.id)
    );
    const s = (type, f = 'montantMAD') =>
      valides.filter((t) => t.type === type).reduce((acc, t) => acc + (Number(t[f]) || 0), 0);
    const A = s('ACHAT');
    const V = s('VENTE');
    const C = s('CHARGES');
    return {
      nbTotal: txList.length,
      nbValides: valides.length,
      totalAchats: A,
      totalVentes: V,
      totalCharges: C,
      benefice: V - A - C,
    };
  }

  // ── Déterminer les IDs à supprimer ───────────────────────────────
  let idsASupprimer = [];

  if (mode === 'ids') {
    if (!Array.isArray(idsManuel) || idsManuel.length === 0) {
      console.error('❌  MODE "ids" : passez un tableau d\'IDs en 2e argument.');
      console.log('    ex : cleanupAfromoney("ids", ["id1", "id2"])');
      return;
    }
    idsASupprimer = idsManuel;
  } else if (mode === 'auto' || mode === 'dry') {
    // Auto-détection : achats sans numéro BCH OU sans hash d'intégrité
    const annulRefs = new Set(
      raw.filter((t) => t.type === 'ANNULATION').map((t) => t.annulationRef)
    );
    const achatsValides = raw.filter(
      (t) => t.type === 'ACHAT' && !annulRefs.has(t.id)
    );
    const sansNumero = achatsValides.filter((t) => !t.numero);
    const sansHash   = achatsValides.filter((t) => !t.hash);
    const suspects   = [...new Map(
      [...sansNumero, ...sansHash].map((t) => [t.id, t])
    ).values()];
    idsASupprimer = suspects.map((t) => t.id);
  } else {
    console.error('❌  Mode invalide. Utilisez "auto", "dry" ou "ids".');
    console.log('    cleanupAfromoney("auto")');
    console.log('    cleanupAfromoney("dry")');
    console.log('    cleanupAfromoney("ids", ["id1","id2"])');
    return;
  }

  // ── Validation ────────────────────────────────────────────────────
  if (idsASupprimer.length === 0) {
    console.log('%c✅  Aucune transaction suspecte trouvée. Données propres !', 'color:green;font-weight:bold');
    return;
  }

  // Vérifier que les IDs existent
  const existants = idsASupprimer.filter((id) => raw.some((t) => t.id === id));
  const introuvables = idsASupprimer.filter((id) => !raw.some((t) => t.id === id));

  // ── Avant ─────────────────────────────────────────────────────────
  const avant = calcBenefice(raw);
  const propres = raw.filter((t) => !existants.includes(t.id));
  const apres  = calcBenefice(propres);

  // ── Affichage rapport ─────────────────────────────────────────────
  sep();
  console.log(
    `%cAFROMONEY — NETTOYAGE ${mode === 'dry' ? '(SIMULATION — aucune donnée modifiée)' : ''}`,
    'font-size:13px;font-weight:bold;color:#f97316'
  );
  sep();

  console.log(`Transactions à supprimer : ${existants.length}`);
  if (introuvables.length) {
    console.warn(`  ⚠️  ${introuvables.length} ID(s) introuvable(s) (déjà supprimé ?) :`);
    introuvables.forEach((id) => console.warn(`     ${id}`));
  }

  // Détail des transactions supprimées
  console.log('\nDétail des suppressions :');
  existants.forEach((id) => {
    const t = raw.find((x) => x.id === id);
    if (!t) return;
    const date = new Date(t.date).toISOString().slice(0, 10);
    const why = [!t.numero && 'sans BCH', !t.hash && 'sans hash']
      .filter(Boolean).join(' + ');
    console.log(
      `  🗑️  ${id.slice(0, 14)}…  ${date}  ${t.type} ${t.devise}  ` +
      `${fr(t.montantMAD)} MAD  [${why || 'ID manuel'}]`
    );
  });

  // ── Tableau avant / après ─────────────────────────────────────────
  sep('─');
  console.log('');
  console.log('                            AVANT          APRÈS        ΔDIFFÉRENCE');
  sep('─');
  const delta = (a, b) => {
    const d = b - a;
    return `${d >= 0 ? '+' : ''}${fr(d)}`;
  };
  console.log(`  Transactions totales  : ${String(avant.nbTotal).padStart(8)}       ${String(apres.nbTotal).padStart(8)}      ${String(apres.nbTotal - avant.nbTotal).padStart(10)}`);
  console.log(`  Achats (MAD)          : ${fr(avant.totalAchats).padStart(14)} ${fr(apres.totalAchats).padStart(14)}  ${delta(avant.totalAchats, apres.totalAchats).padStart(14)}`);
  console.log(`  Ventes (MAD)          : ${fr(avant.totalVentes).padStart(14)} ${fr(apres.totalVentes).padStart(14)}  ${delta(avant.totalVentes, apres.totalVentes).padStart(14)}`);
  console.log(`  Charges (MAD)         : ${fr(avant.totalCharges).padStart(14)} ${fr(apres.totalCharges).padStart(14)}  ${delta(avant.totalCharges, apres.totalCharges).padStart(14)}`);
  sep('─');
  const colBen = (v) => {
    const s = `${fr(v).padStart(14)} MAD`;
    return v < 0 ? `%c${s}` : `%c${s}`;
  };
  const styleBefore = avant.benefice < 0 ? 'color:red' : 'color:green';
  const styleAfter  = apres.benefice  < 0 ? 'color:red' : 'color:green;font-weight:bold';
  console.log(
    `  Bénéfice              : %c${fr(avant.benefice).padStart(14)} MAD%c  →  %c${fr(apres.benefice).padStart(14)} MAD`,
    styleBefore, 'color:initial', styleAfter
  );
  sep();

  // ── Exécution ou simulation ───────────────────────────────────────
  if (mode === 'dry') {
    console.log('%c⏸️  SIMULATION — Données NON modifiées.', 'color:#f97316;font-weight:bold');
    console.log('    Pour vraiment nettoyer : cleanupAfromoney("auto")');
    sep();
    return;
  }

  // Sauvegarde de sécurité dans sessionStorage
  try {
    sessionStorage.setItem('afromoney_backup_' + Date.now(), JSON.stringify(raw));
    console.log('%c💾  Sauvegarde de sécurité créée dans sessionStorage.', 'color:#0ea5e9');
  } catch {
    console.warn('⚠️  Impossible de créer la sauvegarde dans sessionStorage (quota ?).');
  }

  // Écriture
  localStorage.setItem('transactions', JSON.stringify(propres));
  window.dispatchEvent(new Event('afromoney-data'));

  console.log(
    `%c✅  NETTOYAGE TERMINÉ — ${existants.length} transaction(s) supprimée(s).`,
    'color:green;font-size:13px;font-weight:bold'
  );
  console.log('    Rechargez la page pour voir les chiffres mis à jour.');
  console.log('    Pour recharger maintenant : location.reload()');
  sep();
}

// ── Lancement automatique (simulation d'abord) ───────────────────────
console.log('%cAFROMONEY cleanup-transactions.js chargé.', 'color:#0ea5e9;font-weight:bold');
console.log('Commandes disponibles :');
console.log("  cleanupAfromoney('dry')          // simulation");
console.log("  cleanupAfromoney('auto')         // suppression auto");
console.log("  cleanupAfromoney('ids', ['...']) // IDs manuels");
console.log('');
console.log('%cLancement de la simulation automatique...', 'color:#f97316');
cleanupAfromoney('dry');
