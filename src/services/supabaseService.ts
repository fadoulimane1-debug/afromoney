import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Transaction,
  ReliquatDB,
  MouvementCaisseDB,
  ComptageCaisse,
  ClientDB,
  Utilisateur,
} from '../types/supabase';

function db(): SupabaseClient | null {
  return isSupabaseConfigured() ? getSupabase() : null;
}

// ============================================================
// TRANSACTIONS
// ============================================================

export interface TransactionFilters {
  dateDebut?: string;  // YYYY-MM-DD
  dateFin?: string;    // YYYY-MM-DD
  devise?: string;
  type?: Transaction['type'];
  employeId?: string;
}

export async function createTransaction(
  data: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
): Promise<Transaction | null> {
  const supabase = db();
  if (!supabase) return null;
  try {
    const { data: result, error } = await supabase
      .from('transactions')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result as Transaction;
  } catch (err) {
    console.error('[supabaseService] createTransaction:', err);
    return null;
  }
}

export async function getTransactions(
  filters?: TransactionFilters
): Promise<Transaction[]> {
  const supabase = db();
  if (!supabase) return [];
  try {
    let query = supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters?.dateDebut) query = query.gte('date', filters.dateDebut);
    if (filters?.dateFin)   query = query.lte('date', filters.dateFin);
    if (filters?.devise)    query = query.eq('devise', filters.devise);
    if (filters?.type)      query = query.eq('type', filters.type);
    if (filters?.employeId) query = query.eq('employe_id', filters.employeId);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Transaction[];
  } catch (err) {
    console.error('[supabaseService] getTransactions:', err);
    return [];
  }
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const supabase = db();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Transaction;
  } catch (err) {
    console.error('[supabaseService] getTransactionById:', err);
    return null;
  }
}

// ============================================================
// RELIQUATS
// ============================================================

export async function createReliquat(
  data: Omit<ReliquatDB, 'id' | 'created_at' | 'updated_at'>
): Promise<ReliquatDB | null> {
  const supabase = db();
  if (!supabase) return null;
  try {
    const { data: result, error } = await supabase
      .from('reliquats')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result as ReliquatDB;
  } catch (err) {
    console.error('[supabaseService] createReliquat:', err);
    return null;
  }
}

export async function updateReliquat(
  id: string,
  data: Partial<Omit<ReliquatDB, 'id' | 'created_at'>>
): Promise<ReliquatDB | null> {
  const supabase = db();
  if (!supabase) return null;
  try {
    const { data: result, error } = await supabase
      .from('reliquats')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return result as ReliquatDB;
  } catch (err) {
    console.error('[supabaseService] updateReliquat:', err);
    return null;
  }
}

export async function getReliquats(): Promise<ReliquatDB[]> {
  const supabase = db();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('reliquats')
      .select('*')
      .order('date_creation', { ascending: false });

    if (error) throw error;
    return (data ?? []) as ReliquatDB[];
  } catch (err) {
    console.error('[supabaseService] getReliquats:', err);
    return [];
  }
}

// ============================================================
// SOLDES (calcul par devise)
// ============================================================

export interface SoldeDevise {
  devise: string;
  totalAchats: number;
  totalVentes: number;
  totalCharges: number;
  benefice: number;
}

export interface SoldesResult {
  parDevise: SoldeDevise[];
  beneficeTotal: number;
}

export async function calculateSoldes(
  filters?: Pick<TransactionFilters, 'dateDebut' | 'dateFin'>
): Promise<SoldesResult | null> {
  const supabase = db();
  if (!supabase) return null;
  try {
    let query = supabase
      .from('transactions')
      .select('type, devise, montant_mad')
      .neq('type', 'ANNULATION');

    if (filters?.dateDebut) query = query.gte('date', filters.dateDebut);
    if (filters?.dateFin)   query = query.lte('date', filters.dateFin);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as Pick<Transaction, 'type' | 'devise' | 'montant_mad'>[];

    // Agrégation par devise
    const map = new Map<string, SoldeDevise>();
    for (const row of rows) {
      if (!map.has(row.devise)) {
        map.set(row.devise, {
          devise: row.devise,
          totalAchats: 0,
          totalVentes: 0,
          totalCharges: 0,
          benefice: 0,
        });
      }
      const entry = map.get(row.devise)!;
      if (row.type === 'ACHAT')   entry.totalAchats  += row.montant_mad;
      if (row.type === 'VENTE')   entry.totalVentes  += row.montant_mad;
      if (row.type === 'CHARGES') entry.totalCharges += row.montant_mad;
    }

    const parDevise: SoldeDevise[] = [];
    let beneficeTotal = 0;
    for (const entry of map.values()) {
      entry.benefice = entry.totalVentes - entry.totalAchats - entry.totalCharges;
      beneficeTotal += entry.benefice;
      parDevise.push(entry);
    }

    return { parDevise, beneficeTotal };
  } catch (err) {
    console.error('[supabaseService] calculateSoldes:', err);
    return null;
  }
}

// ============================================================
// MOUVEMENTS CAISSE (journal immuable)
// ============================================================

export async function getMouvementsCaisse(filters?: {
  dateDebut?: string;
  dateFin?: string;
  devise?: string;
}): Promise<MouvementCaisseDB[]> {
  const supabase = db();
  if (!supabase) return [];
  try {
    let query = supabase
      .from('mouvements_caisse')
      .select('*')
      .order('timestamp', { ascending: false });

    if (filters?.dateDebut) query = query.gte('timestamp', filters.dateDebut);
    if (filters?.dateFin)   query = query.lte('timestamp', filters.dateFin + 'T23:59:59Z');
    if (filters?.devise)    query = query.eq('devise', filters.devise);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as MouvementCaisseDB[];
  } catch (err) {
    console.error('[supabaseService] getMouvementsCaisse:', err);
    return [];
  }
}

export async function createMouvementCaisse(
  data: Omit<MouvementCaisseDB, 'id' | 'created_at' | 'updated_at'>
): Promise<MouvementCaisseDB | null> {
  const supabase = db();
  if (!supabase) return null;
  try {
    const { data: result, error } = await supabase
      .from('mouvements_caisse')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result as MouvementCaisseDB;
  } catch (err) {
    console.error('[supabaseService] createMouvementCaisse:', err);
    return null;
  }
}

// ============================================================
// CLIENTS
// ============================================================

export async function getClients(): Promise<ClientDB[]> {
  const supabase = db();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('nom', { ascending: true });

    if (error) throw error;
    return (data ?? []) as ClientDB[];
  } catch (err) {
    console.error('[supabaseService] getClients:', err);
    return [];
  }
}

export async function createClient(
  data: Omit<ClientDB, 'id' | 'created_at' | 'updated_at'>
): Promise<ClientDB | null> {
  const supabase = db();
  if (!supabase) return null;
  try {
    const { data: result, error } = await supabase
      .from('clients')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result as ClientDB;
  } catch (err) {
    console.error('[supabaseService] createClient:', err);
    return null;
  }
}

export async function updateClient(
  id: string,
  data: Partial<Omit<ClientDB, 'id' | 'created_at'>>
): Promise<ClientDB | null> {
  const supabase = db();
  if (!supabase) return null;
  try {
    const { data: result, error } = await supabase
      .from('clients')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return result as ClientDB;
  } catch (err) {
    console.error('[supabaseService] updateClient:', err);
    return null;
  }
}

// ============================================================
// UTILISATEURS
// ============================================================

export async function getUtilisateurs(): Promise<Utilisateur[]> {
  const supabase = db();
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('utilisateurs')
      .select('*')
      .order('nom', { ascending: true });

    if (error) throw error;
    return (data ?? []) as Utilisateur[];
  } catch (err) {
    console.error('[supabaseService] getUtilisateurs:', err);
    return [];
  }
}

// ============================================================
// COMPTAGE CAISSE
// ============================================================

export async function createComptageCaisse(
  data: Omit<ComptageCaisse, 'id' | 'created_at' | 'updated_at'>
): Promise<ComptageCaisse | null> {
  const supabase = db();
  if (!supabase) return null;
  try {
    const { data: result, error } = await supabase
      .from('comptages_caisse')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return result as ComptageCaisse;
  } catch (err) {
    console.error('[supabaseService] createComptageCaisse:', err);
    return null;
  }
}

export async function getComptagesCaisse(filters?: {
  dateDebut?: string;
  dateFin?: string;
}): Promise<ComptageCaisse[]> {
  const supabase = db();
  if (!supabase) return [];
  try {
    let query = supabase
      .from('comptages_caisse')
      .select('*')
      .order('date', { ascending: false });

    if (filters?.dateDebut) query = query.gte('date', filters.dateDebut);
    if (filters?.dateFin)   query = query.lte('date', filters.dateFin);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ComptageCaisse[];
  } catch (err) {
    console.error('[supabaseService] getComptagesCaisse:', err);
    return [];
  }
}
