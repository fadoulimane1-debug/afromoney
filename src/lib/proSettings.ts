/** Paramètres professionnels (seuils, contrôles) — localStorage */

export interface ProSettings {
  /** Montant MAD au-delà duquel une vente/achat déclenche une alerte */
  seuilMontantMAD: number;
  /** Stock devise en unités : alerte si stock < seuil */
  seuilStockMinUnites: number;
  /** Écart clôture MAD max avant alerte critique */
  seuilEcartClotureMAD: number;
  /** Jours sans paiement créance → retard */
  joursRetardCredit: number;
  /** Exiger note si montant > seuil */
  exigerNoteGrosMontant: boolean;
  /** Bloquer vente si stock devise insuffisant */
  bloquerVenteStockInsuffisant: boolean;
}

export const DEFAULT_PRO_SETTINGS: ProSettings = {
  seuilMontantMAD: 50_000,
  seuilStockMinUnites: 100,
  seuilEcartClotureMAD: 100,
  joursRetardCredit: 30,
  exigerNoteGrosMontant: true,
  bloquerVenteStockInsuffisant: true,
};

const KEY = 'afromoney_pro_settings';

export function getProSettings(): ProSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PRO_SETTINGS };
    return { ...DEFAULT_PRO_SETTINGS, ...(JSON.parse(raw) as Partial<ProSettings>) };
  } catch {
    return { ...DEFAULT_PRO_SETTINGS };
  }
}

export function saveProSettings(settings: ProSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('afromoney-data'));
  }
}
