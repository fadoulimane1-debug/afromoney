import type { Transaction, ExchangeRate, User, DailyClosure, Reliquat, Versement, MouvementCaisse, Client, ContexteCoffre, Role } from '../types';
import { normalizeTransaction } from '@/lib/transactionNormalize';
import dayjs from 'dayjs';
import { getCaisseDepartJour } from '@/lib/caisseDepartLocal';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditLog';
import { getNextOperationNumber } from '@/lib/numerotation';
import { generateHash } from '@/lib/audit';
import { UTILISATEURS_TEST } from '@/lib/constants';
import { filterTransactionsComptables } from '@/lib/transactionFilters';
import { fmtMad } from '@/lib/formatNumbers';
import { calculRapportMensuel, depotRetraitMadCaisseActif, montantMadComptable } from '@/lib/calculations';
import { isCloudSyncEnabled } from '@/lib/cloudConfig';
import {
  cloudCreateTransaction,
  cloudDeleteTransaction,
  cloudUpdateTransaction,
  cloudUpsertClosure,
  cloudPutExchangeRates,
} from '@/lib/cloudSync';

function txDateStr(d: Transaction['date']): string {
  const t = d instanceof Date ? d : new Date(d);
  return t.toISOString().slice(0, 10);
}

function emitDataChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('afromoney-data'));
}

// TRANSACTIONS
export const getTransactions = (): Transaction[] => {
  const data = localStorage.getItem('transactions');
  if (!data) return [];
  const parsed = JSON.parse(data) as Record<string, unknown>[];
  return parsed.map((row) => normalizeTransaction(row));
};

export const saveTransactions = (transactions: Transaction[]): void => {
  localStorage.setItem('transactions', JSON.stringify(transactions));
  emitDataChanged();
};

export const addTransaction = (transaction: Omit<Transaction, 'id'>): Transaction => {
  const transactions = getTransactions();
  const id = Date.now().toString();
  const numero = getNextOperationNumber();
  const hash = generateHash({
    id,
    numero,
    type: transaction.type,
    devise: transaction.devise,
    montant: transaction.montant,
    montantMAD: transaction.montantMAD,
    taux: transaction.taux,
    employeId: transaction.employeId,
  });
  const newTransaction = { ...transaction, id, numero, hash };
  transactions.push(newTransaction);
  saveTransactions(transactions);
  if (isCloudSyncEnabled()) void cloudCreateTransaction(newTransaction);
  logAudit(
    AUDIT_ACTIONS.TX_CREATE,
    {
      id: newTransaction.id,
      type: newTransaction.type,
      devise: newTransaction.devise,
      montantMAD: newTransaction.montantMAD,
    },
    txDateStr(newTransaction.date),
  );
  appendMouvementsTransaction(newTransaction);
  return newTransaction;
};

export const deleteTransaction = (id: string): void => {
  const tx = getTransactions().find((t) => t.id === id);
  saveTransactions(getTransactions().filter((t) => t.id !== id));
  if (isCloudSyncEnabled()) void cloudDeleteTransaction(id);
  if (tx) {
    logAudit(AUDIT_ACTIONS.TX_DELETE, { id, type: tx.type, montantMAD: tx.montantMAD }, txDateStr(tx.date));
  }
};

export const updateTransaction = (id: string, updates: Partial<Transaction>): void => {
  const prev = getTransactions().find((t) => t.id === id);
  saveTransactions(
    getTransactions().map((t) => (t.id === id ? { ...t, ...updates } : t))
  );
  const next = getTransactions().find((t) => t.id === id);
  if (prev && next) syncDepotRetraitMadMouvement(prev, next);
  if (isCloudSyncEnabled()) void cloudUpdateTransaction(id, updates);
  if (prev) {
    logAudit(
      AUDIT_ACTIONS.TX_UPDATE,
      { id, updates, before: { statut: prev.statut, montantMAD: prev.montantMAD } },
      txDateStr(prev.date),
    );
  }
};

// TAUX DE CHANGE
export const getExchangeRates = (): ExchangeRate[] => {
  const data = localStorage.getItem('exchangeRates');
  return data ? JSON.parse(data) : [];
};

export const saveExchangeRates = (rates: ExchangeRate[]): void => {
  localStorage.setItem('exchangeRates', JSON.stringify(rates));
  if (isCloudSyncEnabled()) void cloudPutExchangeRates(rates);
  emitDataChanged();
};

export const getBKAMRates = (): ExchangeRate[] => {
  const data = localStorage.getItem('afromoney_bkam_rates');
  return data ? JSON.parse(data) : [];
};

const CDN_REFERENCE_KEY = 'afromoney_cdn_reference_rates';

/** Référence marché CDN (quand BKAM est indisponible) — jamais l’édition manuelle bureau. */
export const getCdnReferenceRates = (): ExchangeRate[] => {
  try {
    const data = localStorage.getItem(CDN_REFERENCE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveCdnReferenceRates = (rates: ExchangeRate[]): void => {
  localStorage.setItem(CDN_REFERENCE_KEY, JSON.stringify(rates));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('afromoney-bkam-rates'));
  }
};

export const saveBKAMRates = (rates: ExchangeRate[]): void => {
  localStorage.setItem('afromoney_bkam_rates', JSON.stringify(rates));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('afromoney-bkam-rates'));
  }
};

export const initializeDefaultRates = (): void => {
  if (getExchangeRates().length > 0) return;
  const now = new Date();
  const defaults: ExchangeRate[] = [
    { devise: 'EUR', tauxAchat: 11.20, tauxVente: 11.30, tauxJour: 11.25, dateUpdate: now },
    { devise: 'USD', tauxAchat: 10.10, tauxVente: 10.20, tauxJour: 10.15, dateUpdate: now },
    { devise: 'GBP', tauxAchat: 13.10, tauxVente: 13.30, tauxJour: 13.20, dateUpdate: now },
    { devise: 'CAD', tauxAchat: 7.60,  tauxVente: 7.70,  tauxJour: 7.65,  dateUpdate: now },
    { devise: 'SAR', tauxAchat: 2.70,  tauxVente: 2.80,  tauxJour: 2.75,  dateUpdate: now },
    { devise: 'AED', tauxAchat: 2.80,  tauxVente: 2.90,  tauxJour: 2.85,  dateUpdate: now },
    { devise: 'CHF', tauxAchat: 11.40, tauxVente: 11.60, tauxJour: 11.50, dateUpdate: now },
    { devise: 'KWD', tauxAchat: 28.80, tauxVente: 29.20, tauxJour: 29.00, dateUpdate: now },
    { devise: 'QAR', tauxAchat: 2.40,  tauxVente: 2.46,  tauxJour: 2.43,  dateUpdate: now },
    { devise: 'BHD', tauxAchat: 23.30, tauxVente: 23.70, tauxJour: 23.50, dateUpdate: now },
  ];
  saveExchangeRates(defaults);
};

// USER (Auth)
export const getCurrentUser = (): User | null => {
  const data = localStorage.getItem('currentUser');
  if (!data) return null;
  const u = JSON.parse(data) as User;
  // Normalize legacy role 'EMPLOYEE' → 'CAISSIER'
  if ((u.role as string) === 'EMPLOYEE') u.role = 'CAISSIER';
  return u;
};

export const setCurrentUser = (user: User | null): void => {
  if (user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
  } else {
    localStorage.removeItem('currentUser');
  }
};

export const logout = (): void => {
  localStorage.removeItem('currentUser');
};

// USERS (gestion)
const USERS_KEY = 'afromoney_users';

export const getUsers = (): User[] => {
  const data = localStorage.getItem(USERS_KEY);
  if (!data) return [];
  const users = JSON.parse(data) as User[];
  // Normalize legacy roles
  return users.map((u) => ({
    ...u,
    role: (u.role as string) === 'EMPLOYEE' ? 'CAISSIER' : u.role,
  })) as User[];
};

const saveUsers = (users: User[]): void => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const initDefaultUsers = (): void => {
  if (getUsers().length > 0) return;
  const now = new Date();
  saveUsers(UTILISATEURS_TEST.map((u) => ({ ...u, dateCreation: now })));
};

export const addUser = (user: Omit<User, 'id' | 'dateCreation'>): User => {
  const users = getUsers();
  const newUser: User = {
    ...user,
    id: `USR_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    dateCreation: new Date(),
  };
  users.push(newUser);
  saveUsers(users);
  logAudit(AUDIT_ACTIONS.TX_CREATE, { action: 'USER_CREATE', id: newUser.id, nom: newUser.nom, role: newUser.role });
  return newUser;
};

export const updateUser = (id: string, updates: Partial<Pick<User, 'nom' | 'email' | 'role'>>): void => {
  saveUsers(getUsers().map((u) => (u.id === id ? { ...u, ...updates } : u)));
  logAudit(AUDIT_ACTIONS.TX_UPDATE, { action: 'USER_UPDATE', id, updates });
};

export const deleteUser = (id: string): void => {
  saveUsers(getUsers().filter((u) => u.id !== id));
  logAudit(AUDIT_ACTIONS.TX_DELETE, { action: 'USER_DELETE', id });
};

// CALCULS
export const calculateStock = (
  devise: string
): { totalAchete: number; totalVendu: number; stockActuel: number } => {
  const relevant = getTransactions().filter((t) => t.devise === devise);
  const mouvements = getMouvements().filter((m) => m.devise === devise);

  const totalAchete =
    relevant
      .filter((t) => t.type === 'ACHAT' || t.type === 'DEPOT')
      .reduce((sum, t) => sum + t.montant, 0) +
    mouvements
      .filter((m) => m.type === 'ALIMENTATION')
      .reduce((sum, m) => sum + Math.abs(m.montant), 0);

  const totalVendu =
    relevant
      .filter((t) => t.type === 'VENTE' || t.type === 'RETRAIT')
      .reduce((sum, t) => sum + t.montant, 0) +
    mouvements
      .filter((m) => m.type === 'PRELEVEMENT')
      .reduce((sum, m) => sum + Math.abs(m.montant), 0);

  return { totalAchete, totalVendu, stockActuel: totalAchete - totalVendu };
};

export const calculateCaisse = (): number =>
  filterTransactionsComptables(getTransactions()).reduce((caisse, t) => {
    if (t.type === 'DEPOT') return caisse + (t.devise === 'MAD' ? t.montant : 0);
    if (t.type === 'RETRAIT') return caisse - (t.devise === 'MAD' ? t.montant : 0);
    if (t.type === 'CHARGES') return caisse - t.montantMAD;
    return caisse;
  }, 0);

// === CLÔTURE JOURNALIÈRE ===

const CLOSURES_KEY = 'closures';
const LAST_CLOSURE_KEY = 'lastClosure';

export const getClosures = (): DailyClosure[] => {
  try {
    const data = localStorage.getItem(CLOSURES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

/** Dernière clôture validée (pour affichage solde hérité — chaîne J-1 → J). */
export const getLastClosure = (): DailyClosure | null => {
  const validated = getClosures()
    .filter((c) => c.status === 'VALIDATED')
    .sort((a, b) => b.date.localeCompare(a.date));
  if (validated.length > 0) return validated[0];
  try {
    const data = localStorage.getItem(LAST_CLOSURE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

/** Dernière clôture validée strictement avant `dateStr` (YYYY-MM-DD). */
export function getLastValidatedClosureBefore(dateStr: string): DailyClosure | null {
  const list = getClosures()
    .filter((c) => c.status === 'VALIDATED' && c.date < dateStr)
    .sort((a, b) => b.date.localeCompare(a.date));
  return list[0] ?? null;
}

export const getClosureByDate = (date: string): DailyClosure | null => {
  return getClosures().find((c) => c.date === date) ?? null;
};

export const saveClosure = (closure: DailyClosure): boolean => {
  try {
    const closures = getClosures();
    const index = closures.findIndex((c) => c.date === closure.date);
    if (index >= 0) {
      closures[index] = closure;
    } else {
      closures.push(closure);
    }
    localStorage.setItem(CLOSURES_KEY, JSON.stringify(closures));
    localStorage.setItem(LAST_CLOSURE_KEY, JSON.stringify(closure));
    if (isCloudSyncEnabled()) void cloudUpsertClosure(closure);
    emitDataChanged();
    return true;
  } catch {
    return false;
  }
};

const CLOSURE_EPS_MAD = 0.01;

export const calculateDailyClosure = (date: string): DailyClosure => {
  const transactions = getTransactions();
  const d = dayjs(date);

  const dayTransactions = filterTransactionsComptables(
    transactions.filter((t) => dayjs(t.date).format('YYYY-MM-DD') === date),
  );

  const sumMad = (type: string) =>
    dayTransactions
      .filter((t) => t.type === type)
      .reduce((acc, t) => acc + montantMadComptable(t), 0);

  const totalBuys = sumMad('ACHAT');
  const totalSells = sumMad('VENTE');
  const totalDeposits = sumMad('DEPOT');
  const totalWithdrawals = sumMad('RETRAIT');
  const totalCharges = sumMad('CHARGES');

  const prevValidated = getLastValidatedClosureBefore(date);
  let initialBalanceMAD = prevValidated?.finalBalanceMAD ?? 0;
  const initialBalance = { ...(prevValidated?.finalBalance ?? {}) };

  if (initialBalanceMAD === 0) {
    const caisseDepart = getCaisseDepartJour(date);
    if (caisseDepart != null && caisseDepart > 0) {
      initialBalanceMAD = caisseDepart;
    } else {
      const firstCaisse = dayTransactions.map((t) => t.caisseDepart).find((c) => c != null && Number(c) > 0);
      if (firstCaisse != null) initialBalanceMAD = Number(firstCaisse);
    }
  }

  /** Colonne N Excel : ventes − achats (MAD). */
  const dailyBenefit = totalSells - totalBuys;
  /** Colonne O : G + K − L − M + N */
  const theoreticalBalance =
    initialBalanceMAD + totalDeposits - totalWithdrawals - totalCharges + dailyBenefit;

  return {
    id: `closure_${date}`,
    date,
    day: d.date(),
    month: d.month() + 1,
    year: d.year(),
    employee: getCurrentUser()?.nom ?? 'Inconnu',
    manager: undefined,

    initialBalance,
    initialBalanceMAD,

    transactions: { totalBuys, totalSells, totalDeposits, totalWithdrawals, totalCharges },

    finalBalance: {},
    finalBalanceMAD: theoreticalBalance,

    dailyBenefit,
    theoreticalBalance,
    realBalance: theoreticalBalance,

    variance: 0,
    isBalanced: true,

    status: 'DRAFT',
    notes: '',
  };
};

export const detectVariance = (closure: DailyClosure, realBalance: number): DailyClosure => {
  closure.realBalance = realBalance;
  closure.variance = realBalance - closure.theoreticalBalance;
  closure.isBalanced = Math.abs(closure.variance) < CLOSURE_EPS_MAD;
  if (!closure.isBalanced) {
    closure.status = 'ERROR';
    closure.errorDetails = `Écart détecté: ${fmtMad(closure.variance)} MAD (tolérance ${CLOSURE_EPS_MAD} MAD)`;
  } else {
    closure.status = 'PENDING_VALIDATION';
    closure.errorDetails = undefined;
  }
  return closure;
};

export const validateClosure = (
  closureId: string,
  managerName: string,
  signatureDataUrl?: string,
): boolean => {
  try {
    const closures = getClosures();
    const closure = closures.find((c) => c.id === closureId);
    if (!closure || !closure.isBalanced) return false;
    if (!signatureDataUrl?.startsWith('data:image/')) return false;
    closure.status = 'VALIDATED';
    closure.manager = managerName;
    closure.validatedAt = new Date().toISOString();
    closure.signature = signatureDataUrl;
    closure.finalBalanceMAD = closure.realBalance;
    closure.errorDetails = undefined;
    const ok = saveClosure(closure);
    if (ok) {
      logAudit(AUDIT_ACTIONS.CLOSURE_VALIDATE, {
        closureId,
        date: closure.date,
        realBalance: closure.realBalance,
        manager: managerName,
      }, closure.date);
    }
    return ok;
  } catch {
    return false;
  }
};

export const inheritPreviousBalance = (date: string): { [devise: string]: number } => {
  const prev = getLastValidatedClosureBefore(date);
  return prev?.finalBalance ?? {};
};

// === RELIQUATS ===

const RELIQUATS_KEY = 'reliquats';

export const getReliquats = (): Reliquat[] => {
  try {
    const data = localStorage.getItem(RELIQUATS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveReliquats = (list: Reliquat[]): void => {
  localStorage.setItem(RELIQUATS_KEY, JSON.stringify(list));
  emitDataChanged();
};

export const addReliquat = (r: Omit<Reliquat, 'id' | 'dateMaj' | 'versements'>): Reliquat => {
  const list = getReliquats();
  const today = new Date().toISOString().slice(0, 10);
  const newR: Reliquat = {
    ...r,
    id: `RLQ_${crypto.randomUUID()}`,
    dateMaj: today,
    versements: [],
    montantRestant: r.montantInitial,
    statut: 'NON_SOLDE',
  };
  list.push(newR);
  saveReliquats(list);
  // Reliquat = traçabilité uniquement — pas d'impact caisse à la création
  // L'impact caisse arrive uniquement lors du versement (soldé)
  return newR;
};

export const ajouterVersement = (
  reliquatId: string,
  versement: Omit<Versement, 'id'>
): Reliquat | null => {
  const list = getReliquats();
  const idx = list.findIndex((r) => r.id === reliquatId);
  if (idx === -1) return null;
  const r = { ...list[idx] };
  const newV: Versement = { ...versement, id: `VRS_${crypto.randomUUID()}` };
  r.versements = [...r.versements, newV];
  r.montantRestant = Math.max(0, r.montantRestant - versement.montant);
  r.dateMaj = new Date().toISOString().slice(0, 10);
  if (r.montantRestant <= 0) {
    r.statut = 'SOLDE';
    r.montantRestant = 0;
  } else {
    r.statut = 'PARTIELLEMENT_SOLDE';
  }
  list[idx] = r;
  saveReliquats(list);
  appendMouvementReliquat(r, newV);

  // Si reliquat MAD → le versement ramène du MAD dans la caisse
  if (r.devise === 'MAD') {
    appendMouvement({
      timestamp: new Date().toISOString(),
      type: 'RELIQUAT',
      devise: 'MAD',
      montant: versement.montant, // entrée MAD dans la caisse (remboursement)
      operationRef: r.id,
      caissier: getCurrentUser()?.nom ?? 'Système',
      note: `Versement reliquat — client: ${r.client}`,
    });
  }

  return r;
};

export type ReliquatUpdatePatch = Partial<
  Pick<Reliquat, 'client' | 'categorieClient' | 'devise' | 'operationRef' | 'operationNumero' | 'note'>
> & { montantInitial?: number };

export const updateReliquat = (id: string, patch: ReliquatUpdatePatch): Reliquat | null => {
  const list = getReliquats();
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const r = { ...list[idx] };
  const today = new Date().toISOString().slice(0, 10);

  if (patch.client !== undefined) r.client = patch.client.trim();
  if (patch.categorieClient !== undefined) r.categorieClient = patch.categorieClient;
  if (patch.devise !== undefined) r.devise = patch.devise;
  if (patch.operationRef !== undefined) r.operationRef = patch.operationRef.trim();
  if (patch.operationNumero !== undefined) r.operationNumero = patch.operationNumero.trim() || undefined;
  if (patch.note !== undefined) r.note = patch.note.trim() || undefined;

  if (patch.montantInitial !== undefined) {
    const totalVerse = r.versements.reduce((s, v) => s + v.montant, 0);
    if (patch.montantInitial < totalVerse - 0.005) return null;
    r.montantInitial = patch.montantInitial;
    r.montantRestant = Math.max(0, patch.montantInitial - totalVerse);
    if (r.montantRestant <= 0) {
      r.statut = 'SOLDE';
      r.montantRestant = 0;
    } else if (totalVerse > 0) {
      r.statut = 'PARTIELLEMENT_SOLDE';
    } else {
      r.statut = 'NON_SOLDE';
    }
  }

  r.dateMaj = today;
  list[idx] = r;
  saveReliquats(list);
  return r;
};

export const deleteReliquat = (id: string): void => {
  saveReliquats(getReliquats().filter((r) => r.id !== id));
};

export const getReliquatsClient = (client: string): Reliquat[] =>
  getReliquats().filter((r) => r.client.toLowerCase() === client.toLowerCase() && r.statut !== 'SOLDE');

// === CLIENTS ===

const CLIENTS_KEY = 'clients';

export const getClients = (): Client[] => {
  try {
    const raw = localStorage.getItem(CLIENTS_KEY);
    return raw ? (JSON.parse(raw) as Client[]) : [];
  } catch {
    return [];
  }
};

const saveClients = (list: Client[]): void => {
  localStorage.setItem(CLIENTS_KEY, JSON.stringify(list));
  emitDataChanged();
};

export const addClient = (c: Omit<Client, 'id' | 'dateCreation' | 'creePar'>): Client => {
  const list = getClients();
  const newC: Client = {
    ...c,
    id: `CLI_${crypto.randomUUID()}`,
    dateCreation: new Date().toISOString().slice(0, 10),
    creePar: getCurrentUser()?.nom ?? 'Système',
  };
  list.push(newC);
  saveClients(list);
  return newC;
};

export const updateClient = (id: string, updates: Partial<Omit<Client, 'id' | 'dateCreation' | 'creePar'>>): void => {
  saveClients(getClients().map((c) => (c.id === id ? { ...c, ...updates } : c)));
};

export const deleteClient = (id: string): void => {
  saveClients(getClients().filter((c) => c.id !== id));
};

export const getClientById = (id: string): Client | null =>
  getClients().find((c) => c.id === id) ?? null;

// === MOUVEMENTS CAISSE (journal immuable) ===

const MOUVEMENTS_KEY = 'mouvements_caisse';

function emitMouvements() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('afromoney-mouvements'));
  }
}

export const getMouvements = (): MouvementCaisse[] => {
  try {
    const raw = localStorage.getItem(MOUVEMENTS_KEY);
    return raw ? (JSON.parse(raw) as MouvementCaisse[]) : [];
  } catch {
    return [];
  }
};

/** Calcule le solde courant d'une devise en sommant tous ses mouvements. */
export const getSoldeDevise = (devise: string, list?: MouvementCaisse[]): number =>
  (list ?? getMouvements())
    .filter((m) => m.devise === devise)
    .reduce((s, m) => s + m.montant, 0);

const MANUAL_CAISSE_TYPES = new Set<MouvementCaisse['type']>(['ALIMENTATION', 'PRELEVEMENT']);

/** Recalcule soldeAvant / soldeApres après suppression ou correction. */
function recomputeSoldesMouvements(list: MouvementCaisse[]): MouvementCaisse[] {
  const sorted = [...list].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id)
  );
  const balances: Record<string, number> = {};
  return sorted.map((m) => {
    const soldeAvant = balances[m.devise] ?? 0;
    const soldeApres = soldeAvant + m.montant;
    balances[m.devise] = soldeApres;
    return { ...m, soldeAvant, soldeApres, locked: true as const };
  });
}

function saveMouvements(list: MouvementCaisse[]): void {
  localStorage.setItem(MOUVEMENTS_KEY, JSON.stringify(list));
  emitMouvements();
  emitDataChanged();
}

/**
 * Supprime une alimentation ou un prélèvement (admin uniquement).
 * Les autres types restent immuables.
 */
export function deleteMouvementCaisse(id: string, role: Role): void {
  if (role !== 'ADMIN') {
    throw new Error('Seul un administrateur peut supprimer une alimentation ou un prélèvement.');
  }
  const all = getMouvements();
  const target = all.find((m) => m.id === id);
  if (!target) throw new Error('Mouvement introuvable.');
  if (!MANUAL_CAISSE_TYPES.has(target.type)) {
    throw new Error('Seules les alimentations et prélèvements peuvent être supprimés.');
  }
  const remaining = recomputeSoldesMouvements(all.filter((m) => m.id !== id));
  saveMouvements(remaining);
  logAudit(AUDIT_ACTIONS.MOUVEMENT_DELETE, {
    id: target.id,
    type: target.type,
    devise: target.devise,
    montant: target.montant,
    caissier: target.caissier,
    note: target.note,
  });
}

/** Append-only — pas de mise à jour ; suppression limitée aux alimentations/prélèvements (admin). */
function appendMouvement(
  mv: Omit<MouvementCaisse, 'id' | 'soldeAvant' | 'soldeApres' | 'locked'>
): MouvementCaisse {
  const all = getMouvements();
  const soldeAvant = getSoldeDevise(mv.devise, all);
  const soldeApres = soldeAvant + mv.montant;
  const newMv: MouvementCaisse = {
    ...mv,
    id: `MV_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    soldeAvant,
    soldeApres,
    locked: true,
  };
  all.push(newMv);
  saveMouvements(all);
  return newMv;
}

function madMouvementsForTransaction(txId: string): MouvementCaisse[] {
  return getMouvements().filter(
    (m) =>
      m.operationRef === txId &&
      m.devise === 'MAD' &&
      (m.type === 'DEPOT' || m.type === 'RETRAIT'),
  );
}

function removeMadMouvementsForTransaction(txId: string): void {
  const legs = madMouvementsForTransaction(txId);
  if (legs.length === 0) return;
  const drop = new Set(legs.map((l) => l.id));
  saveMouvements(getMouvements().filter((m) => !drop.has(m.id)));
}

/** Jambe MAD d'un DÉPÔT / RETRAIT (uniquement si statut PAYÉ). */
function appendDepotRetraitMadLeg(tx: Transaction): void {
  if (!depotRetraitMadCaisseActif(tx)) return;
  const ts = new Date().toISOString();
  const caissier = getCurrentUser()?.nom ?? 'Système';
  const ref = tx.id;
  const operationNumero = tx.numero;
  const note = tx.note || undefined;
  const mad = tx.devise === 'MAD' ? tx.montant : tx.montantMAD;
  if (tx.type === 'DEPOT') {
    appendMouvement({
      timestamp: ts,
      type: 'DEPOT',
      devise: 'MAD',
      montant: mad,
      operationRef: ref,
      operationNumero,
      caissier,
      note,
    });
  } else if (tx.type === 'RETRAIT') {
    appendMouvement({
      timestamp: ts,
      type: 'RETRAIT',
      devise: 'MAD',
      montant: -mad,
      operationRef: ref,
      operationNumero,
      caissier,
      note,
    });
  }
}

/** Quand le statut passe à PAYÉ (ou inverse), aligner le journal caisse MAD. */
function syncDepotRetraitMadMouvement(prev: Transaction, next: Transaction): void {
  if (next.type !== 'DEPOT' && next.type !== 'RETRAIT') return;
  const was = depotRetraitMadCaisseActif(prev);
  const now = depotRetraitMadCaisseActif(next);
  if (was && now) {
    removeMadMouvementsForTransaction(next.id);
    appendDepotRetraitMadLeg(next);
    return;
  }
  if (!was && now) appendDepotRetraitMadLeg(next);
  if (was && !now) removeMadMouvementsForTransaction(next.id);
}

/** Crée les mouvements correspondant à une transaction. */
function appendMouvementsTransaction(tx: Transaction): void {
  const ts = new Date().toISOString();
  const caissier = getCurrentUser()?.nom ?? 'Système';
  const ref = tx.id;
  const operationNumero = tx.numero;
  const note = tx.note || undefined;

  switch (tx.type) {
    case 'ACHAT':
      appendMouvement({ timestamp: ts, type: 'ACHAT', devise: tx.devise, montant: tx.montant, operationRef: ref, operationNumero, caissier, note });
      appendMouvement({ timestamp: ts, type: 'ACHAT', devise: 'MAD', montant: -tx.montantMAD, operationRef: ref, operationNumero, caissier, note });
      break;
    case 'VENTE': {
      appendMouvement({ timestamp: ts, type: 'VENTE', devise: tx.devise, montant: -tx.montant, operationRef: ref, operationNumero, caissier, note });
      const madRecu = tx.montantAPayer ?? tx.montantMAD;
      if (madRecu > 0) {
        appendMouvement({ timestamp: ts, type: 'VENTE', devise: 'MAD', montant: madRecu, operationRef: ref, operationNumero, caissier, note });
      }
      break;
    }
    case 'DEPOT':
      if (tx.devise === 'MAD') {
        appendDepotRetraitMadLeg(tx);
      } else {
        appendMouvement({ timestamp: ts, type: 'DEPOT', devise: tx.devise, montant: tx.montant, operationRef: ref, operationNumero, caissier, note });
        appendDepotRetraitMadLeg(tx);
      }
      break;
    case 'RETRAIT':
      if (tx.devise === 'MAD') {
        appendDepotRetraitMadLeg(tx);
      } else {
        appendMouvement({ timestamp: ts, type: 'RETRAIT', devise: tx.devise, montant: -tx.montant, operationRef: ref, operationNumero, caissier, note });
        appendDepotRetraitMadLeg(tx);
      }
      break;
    case 'CHARGES':
      appendMouvement({ timestamp: ts, type: 'CHARGES', devise: 'MAD', montant: -tx.montantMAD, operationRef: ref, operationNumero, caissier, note });
      break;
    case 'ANNULATION': {
      if (!tx.annulationRef) break;
      const origTx = getTransactions().find((t) => t.id === tx.annulationRef);
      if (!origTx) break;
      switch (origTx.type) {
        case 'ACHAT':
          appendMouvement({ timestamp: ts, type: 'ANNULATION', devise: tx.devise, montant: -tx.montant, operationRef: ref, operationNumero, caissier, note });
          appendMouvement({ timestamp: ts, type: 'ANNULATION', devise: 'MAD', montant: tx.montantMAD, operationRef: ref, operationNumero, caissier, note });
          break;
        case 'VENTE': {
          appendMouvement({ timestamp: ts, type: 'ANNULATION', devise: tx.devise, montant: tx.montant, operationRef: ref, operationNumero, caissier, note });
          const madRendu = origTx.montantAPayer ?? origTx.montantMAD;
          if (madRendu > 0) appendMouvement({ timestamp: ts, type: 'ANNULATION', devise: 'MAD', montant: -madRendu, operationRef: ref, operationNumero, caissier, note });
          break;
        }
        case 'DEPOT':
          if (origTx.devise === 'MAD') {
            if (depotRetraitMadCaisseActif(origTx)) {
              appendMouvement({ timestamp: ts, type: 'ANNULATION', devise: 'MAD', montant: -origTx.montant, operationRef: ref, operationNumero, caissier, note });
            }
          } else {
            appendMouvement({ timestamp: ts, type: 'ANNULATION', devise: origTx.devise, montant: -origTx.montant, operationRef: ref, operationNumero, caissier, note });
            if (depotRetraitMadCaisseActif(origTx)) {
              appendMouvement({ timestamp: ts, type: 'ANNULATION', devise: 'MAD', montant: -origTx.montantMAD, operationRef: ref, operationNumero, caissier, note });
            }
          }
          break;
        case 'RETRAIT':
          if (origTx.devise === 'MAD') {
            if (depotRetraitMadCaisseActif(origTx)) {
              appendMouvement({ timestamp: ts, type: 'ANNULATION', devise: 'MAD', montant: origTx.montant, operationRef: ref, operationNumero, caissier, note });
            }
          } else {
            appendMouvement({ timestamp: ts, type: 'ANNULATION', devise: origTx.devise, montant: origTx.montant, operationRef: ref, operationNumero, caissier, note });
            if (depotRetraitMadCaisseActif(origTx)) {
              appendMouvement({ timestamp: ts, type: 'ANNULATION', devise: 'MAD', montant: origTx.montantMAD, operationRef: ref, operationNumero, caissier, note });
            }
          }
          break;
        case 'CHARGES':
          appendMouvement({ timestamp: ts, type: 'ANNULATION', devise: 'MAD', montant: tx.montantMAD, operationRef: ref, operationNumero, caissier, note });
          break;
      }
      break;
    }
  }
}

/** Annule une transaction (crée une nouvelle opération inverse — l'originale reste intacte). */
export function annulerTransaction(txId: string, raison: string): Transaction {
  const allTx = getTransactions();
  const origTx = allTx.find((t) => t.id === txId);
  if (!origTx) throw new Error(`Transaction ${txId} introuvable`);
  const alreadyAnnulled = allTx.some((t) => t.type === 'ANNULATION' && t.annulationRef === txId);
  if (alreadyAnnulled) throw new Error(`Opération ${origTx.numero ?? txId} déjà annulée`);

  return addTransaction({
    date: new Date(),
    jour: new Date().getDate(),
    mois: new Date().getMonth() + 1,
    employeId: origTx.employeId,
    employeNom: origTx.employeNom,
    type: 'ANNULATION',
    operation: `ANNULATION — ${origTx.operation}`,
    devise: origTx.devise,
    montant: origTx.montant,
    taux: origTx.taux,
    montantMAD: origTx.montantMAD,
    montantAPayer: origTx.montantAPayer,
    note: raison,
    statut: 'PAYÉ',
    moment: origTx.moment,
    clientId: origTx.clientId,
    annulationRef: txId,
    annulationRaison: raison,
  });
}

/** Crée un mouvement RELIQUAT lors d'un versement. */
function appendMouvementReliquat(reliquat: Reliquat, versement: Versement): void {
  appendMouvement({
    timestamp: new Date().toISOString(),
    type: 'RELIQUAT',
    devise: reliquat.devise,
    montant: versement.montant,
    operationRef: reliquat.id,
    caissier: getCurrentUser()?.nom ?? 'Système',
    note: versement.note,
  });
}

/** Dépôt MAD manuel (ex. crédit soldé). */
export const appendDepotCaisse = (params: {
  montant: number;
  operationRef?: string;
  note?: string;
  caissier?: string;
}): MouvementCaisse =>
  appendMouvement({
    timestamp: new Date().toISOString(),
    type: 'DEPOT',
    devise: 'MAD',
    montant: Math.abs(params.montant),
    operationRef: params.operationRef,
    caissier: params.caissier ?? getCurrentUser()?.nom ?? 'Système',
    note: params.note,
  });

/** ALIMENTATION manuelle (responsable approvisionne la caisse). */
export const appendAlimentation = (params: {
  montant: number;
  devise?: string;
  note?: string;
  contexte?: ContexteCoffre;
  signature?: string;
}): MouvementCaisse =>
  appendMouvement({
    timestamp: new Date().toISOString(),
    type: 'ALIMENTATION',
    devise: params.devise ?? 'MAD',
    montant: Math.abs(params.montant),
    caissier: params.signature ?? getCurrentUser()?.nom ?? 'Système',
    note: params.note,
    contexte: params.contexte,
  });

/** PRÉLÈVEMENT manuel (responsable retire de la caisse). */
export const appendPrelevement = (params: {
  montant: number;
  devise?: string;
  note?: string;
  contexte?: ContexteCoffre;
  signature?: string;
}): MouvementCaisse =>
  appendMouvement({
    timestamp: new Date().toISOString(),
    type: 'PRELEVEMENT',
    devise: params.devise ?? 'MAD',
    montant: -Math.abs(params.montant),
    caissier: params.signature ?? getCurrentUser()?.nom ?? 'Système',
    note: params.note,
    contexte: params.contexte,
  });

// === RAPPORTS MENSUELS ===

/** Bénéfice du mois = ventes − achats − charges (opérations valides uniquement, hors annulations). */
export const calculateMonthlyReport = (month: number, year = new Date().getFullYear()) => {
  const moisKey = `${year}-${String(month).padStart(2, '0')}`;
  const r = calculRapportMensuel(getTransactions(), moisKey);
  return {
    totalAchats: r.totalAchats,
    totalVentes: r.totalVentes,
    beneficeBrut: r.beneficeBrut,
    chargesAgence: r.chargesAgence,
    beneficeNet: r.beneficeNet,
    margePercent: r.margePercent,
    nbTransactions: r.nbTransactions,
  };
};
