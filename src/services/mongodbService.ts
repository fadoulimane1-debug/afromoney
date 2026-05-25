/**
 * Service MongoDB — opérations CRUD sur toutes les collections.
 *
 * ⚠️  Backend Node.js uniquement (Express / Next.js API routes).
 *     Ne pas importer dans des composants React / pages Vite.
 *
 * Corrections vs code initial :
 *  - require('mongodb') → import statique ES module en tête de fichier
 *  - filters?: any      → type Filter<Document> + interface dédiée
 *  - calculateSoldes    → devises déduites des données (pas de liste fixe)
 */

import { ObjectId } from 'mongodb';
import type { Filter, UpdateFilter } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';
import type {
  ITransaction,
  IReliquat,
  IMouvementCaisse,
  IVersement,
} from '@/types/mongodb';
import { COLLECTIONS } from '@/types/mongodb';

// ============================================================
// Types de filtres
// ============================================================

export interface TransactionFilters {
  dateDebut?: Date;
  dateFin?: Date;
  devise?: string;
  type?: ITransaction['type'];
  employeId?: string;
}

export interface SoldeDevise {
  devise: string;
  achats: number;
  ventes: number;
  net: number;
}

export interface SoldesResult {
  parDevise: SoldeDevise[];
  totalAchatsMAD: number;
  totalVentesMAD: number;
  totalCharges: number;
  benefice: number;
}

// ============================================================
// TRANSACTIONS
// ============================================================

export async function createTransaction(
  data: Omit<ITransaction, '_id' | 'createdAt' | 'updatedAt'>,
): Promise<{ insertedId: string }> {
  const db = await getDatabase();
  const doc = { ...data, createdAt: new Date(), updatedAt: new Date() };
  const result = await db.collection<ITransaction>(COLLECTIONS.TRANSACTIONS).insertOne(doc as ITransaction);
  console.log('✅ Transaction créée:', result.insertedId);
  return { insertedId: result.insertedId.toString() };
}

export async function getTransactions(
  filters?: TransactionFilters,
): Promise<ITransaction[]> {
  const db = await getDatabase();
  const query: Record<string, unknown> = {};

  if (filters?.dateDebut || filters?.dateFin) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dateDebut) dateFilter.$gte = filters.dateDebut;
    if (filters.dateFin)   dateFilter.$lte = filters.dateFin;
    query.date = dateFilter;
  }
  if (filters?.devise)    query.devise    = filters.devise;
  if (filters?.type)      query.type      = filters.type;
  if (filters?.employeId) query.employeId = filters.employeId;

  return db
    .collection<ITransaction>(COLLECTIONS.TRANSACTIONS)
    .find(query as unknown as Filter<ITransaction>)
    .sort({ date: -1, createdAt: -1 })
    .toArray();
}

export async function getTransactionById(id: string): Promise<ITransaction | null> {
  const db = await getDatabase();
  return db
    .collection<ITransaction>(COLLECTIONS.TRANSACTIONS)
    .findOne({ _id: new ObjectId(id) as unknown as string });
}

export async function updateTransaction(
  id: string,
  data: Partial<Omit<ITransaction, '_id' | 'createdAt'>>,
): Promise<{ matchedCount: number; modifiedCount: number }> {
  const db = await getDatabase();
  const update: UpdateFilter<ITransaction> = {
    $set: { ...data, updatedAt: new Date() },
  };
  const result = await db
    .collection<ITransaction>(COLLECTIONS.TRANSACTIONS)
    .updateOne({ _id: new ObjectId(id) as unknown as string }, update);
  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

export async function deleteTransaction(
  id: string,
): Promise<{ deletedCount: number }> {
  const db = await getDatabase();
  const result = await db
    .collection<ITransaction>(COLLECTIONS.TRANSACTIONS)
    .deleteOne({ _id: new ObjectId(id) as unknown as string });
  console.log('🗑️  Transaction supprimée:', id);
  return { deletedCount: result.deletedCount };
}

// ============================================================
// RELIQUATS
// ============================================================

export async function createReliquat(
  data: Omit<IReliquat, '_id' | 'createdAt' | 'updatedAt'>,
): Promise<{ insertedId: string }> {
  const db = await getDatabase();
  const doc = { ...data, createdAt: new Date(), updatedAt: new Date() };
  const result = await db.collection<IReliquat>(COLLECTIONS.RELIQUATS).insertOne(doc as IReliquat);
  console.log('✅ Reliquat créé:', result.insertedId);
  return { insertedId: result.insertedId.toString() };
}

export async function getReliquats(filters?: {
  statut?: IReliquat['statut'];
  client?: string;
}): Promise<IReliquat[]> {
  const db = await getDatabase();
  const query: Record<string, unknown> = {};
  if (filters?.statut) query.statut = filters.statut;
  if (filters?.client) query.client = { $regex: filters.client, $options: 'i' };

  return db
    .collection<IReliquat>(COLLECTIONS.RELIQUATS)
    .find(query as unknown as Filter<IReliquat>)
    .sort({ dateCreation: -1 })
    .toArray();
}

export async function updateReliquat(
  id: string,
  data: Partial<Omit<IReliquat, '_id' | 'createdAt'>>,
): Promise<{ matchedCount: number; modifiedCount: number }> {
  const db = await getDatabase();
  const result = await db
    .collection<IReliquat>(COLLECTIONS.RELIQUATS)
    .updateOne(
      { _id: new ObjectId(id) as unknown as string },
      { $set: { ...data, updatedAt: new Date() } },
    );
  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

export async function ajouterVersement(
  id: string,
  versement: Omit<IVersement, 'id'> & { id?: string },
): Promise<{ matchedCount: number; modifiedCount: number }> {
  const db = await getDatabase();
  const v: IVersement = { id: versement.id ?? new ObjectId().toHexString(), ...versement };
  const result = await db
    .collection<IReliquat>(COLLECTIONS.RELIQUATS)
    .updateOne(
      { _id: new ObjectId(id) as unknown as string },
      {
        $push: { versements: v } as UpdateFilter<IReliquat>['$push'],
        $set:  { dateMaj: new Date(), updatedAt: new Date() },
      },
    );
  return { matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
}

export async function deleteReliquat(id: string): Promise<{ deletedCount: number }> {
  const db = await getDatabase();
  const result = await db
    .collection<IReliquat>(COLLECTIONS.RELIQUATS)
    .deleteOne({ _id: new ObjectId(id) as unknown as string });
  return { deletedCount: result.deletedCount };
}

// ============================================================
// MOUVEMENTS CAISSE
// ============================================================

export async function createMouvementCaisse(
  data: Omit<IMouvementCaisse, '_id' | 'createdAt'>,
): Promise<{ insertedId: string }> {
  const db = await getDatabase();
  const doc = { ...data, createdAt: new Date() };
  const result = await db.collection<IMouvementCaisse>(COLLECTIONS.MOUVEMENTS_CAISSE).insertOne(doc as IMouvementCaisse);
  return { insertedId: result.insertedId.toString() };
}

export async function getMouvementsCaisse(filters?: {
  dateDebut?: Date;
  dateFin?: Date;
  devise?: string;
}): Promise<IMouvementCaisse[]> {
  const db = await getDatabase();
  const query: Record<string, unknown> = {};

  if (filters?.dateDebut || filters?.dateFin) {
    const tsFilter: Record<string, Date> = {};
    if (filters.dateDebut) tsFilter.$gte = filters.dateDebut;
    if (filters.dateFin)   tsFilter.$lte = filters.dateFin;
    query.timestamp = tsFilter;
  }
  if (filters?.devise) query.devise = filters.devise;

  return db
    .collection<IMouvementCaisse>(COLLECTIONS.MOUVEMENTS_CAISSE)
    .find(query as unknown as Filter<IMouvementCaisse>)
    .sort({ timestamp: -1 })
    .toArray();
}

// ============================================================
// CALCULS — Soldes par devise
//   Les devises sont déduites des données réelles (pas de liste fixe).
// ============================================================

export async function calculateSoldes(filters?: {
  dateDebut?: Date;
  dateFin?: Date;
}): Promise<SoldesResult> {
  const db = await getDatabase();
  const query: Record<string, unknown> = {};
  if (filters?.dateDebut || filters?.dateFin) {
    const dateFilter: Record<string, Date> = {};
    if (filters.dateDebut) dateFilter.$gte = filters.dateDebut;
    if (filters.dateFin)   dateFilter.$lte = filters.dateFin;
    query.date = dateFilter;
  }

  const transactions = await db
    .collection<ITransaction>(COLLECTIONS.TRANSACTIONS)
    .find(query as unknown as Filter<ITransaction>)
    .toArray();

  const deviseMap = new Map<string, SoldeDevise>();
  let totalAchatsMAD = 0;
  let totalVentesMAD = 0;
  let totalCharges   = 0;

  for (const tx of transactions) {
    const devise = tx.devise ?? 'MAD';

    if (!deviseMap.has(devise)) {
      deviseMap.set(devise, { devise, achats: 0, ventes: 0, net: 0 });
    }
    const entry = deviseMap.get(devise)!;

    if (tx.type === 'ACHAT') {
      entry.achats  += tx.montant ?? 0;
      totalAchatsMAD += tx.montantMAD ?? 0;
    } else if (tx.type === 'VENTE') {
      entry.ventes  += tx.montant ?? 0;
      totalVentesMAD += tx.montantMAD ?? 0;
    } else if (tx.type === 'CHARGES') {
      totalCharges  += tx.montantMAD ?? 0;
    }
  }

  const parDevise = [...deviseMap.values()].map((d) => ({
    ...d,
    net: d.ventes - d.achats,
  }));

  return {
    parDevise,
    totalAchatsMAD,
    totalVentesMAD,
    totalCharges,
    benefice: totalVentesMAD - totalAchatsMAD - totalCharges,
  };
}
