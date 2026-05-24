import type {
  SoldeJournalierRow,
  StageOperation,
  SnapshotType,
  OperationMoment,
} from '@/types/stageCaisse';
import { newEntityId } from '@/lib/entityId';

const KEY_SNAPSHOTS = 'afromoney_solde_journalier';
const KEY_OPERATIONS = 'afromoney_stage_operations';
/** Devises affichées dans les grilles d’ajustement matin/soir (préférence navigateur). */
const KEY_AJUST_DEVISES_ACTIFS = 'afromoney_stage_ajust_devises_actifs';

function emit() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('afromoney-data'));
}

/** Ancien modèle (4 snapshots) → PDF mai 2026 (3 snapshots : DEPART / CLOTURE / FINAL). */
const LEGACY_SNAPSHOT_MAP: Record<string, SnapshotType> = {
  OUVERTURE: 'DEPART',
  CLOTURE_SOIR: 'CLOTURE',
  FINAL_SOIR: 'FINAL',
};

function mapSnapshotTypeLoose(t: string): SnapshotType {
  if (t === 'DEPART' || t === 'CLOTURE' || t === 'FINAL') return t;
  return LEGACY_SNAPSHOT_MAP[t] ?? 'DEPART';
}

function migrateSnapshotRows(rows: SoldeJournalierRow[]): { rows: SoldeJournalierRow[]; changed: boolean } {
  let changed = false;
  const filtered = rows.filter((r) => {
    const ts = r.type_solde as unknown as string;
    if (ts === 'INITIAL_MATIN') {
      changed = true;
      return false;
    }
    return true;
  });
  const mapped = filtered.map((r) => {
    const ts = r.type_solde as unknown as string;
    const nt = mapSnapshotTypeLoose(ts);
    if (nt !== r.type_solde) changed = true;
    return { ...r, type_solde: nt };
  });
  const byKey = new Map<string, SoldeJournalierRow>();
  for (const r of mapped) {
    const key = `${r.caisse_id}|${r.date_comptable}|${r.type_solde}|${r.devise_code}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, r);
      continue;
    }
    changed = true;
    const tp = new Date(prev.horodatage).getTime();
    const tr = new Date(r.horodatage).getTime();
    byKey.set(key, tr >= tp ? r : prev);
  }
  return { rows: Array.from(byKey.values()), changed };
}

function loadSnapshots(): SoldeJournalierRow[] {
  try {
    const raw = localStorage.getItem(KEY_SNAPSHOTS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SoldeJournalierRow[];
    if (!Array.isArray(arr)) return [];
    const { rows, changed } = migrateSnapshotRows(arr);
    if (changed) {
      localStorage.setItem(KEY_SNAPSHOTS, JSON.stringify(rows));
      emit();
    }
    return rows;
  } catch {
    return [];
  }
}

function saveSnapshots(rows: SoldeJournalierRow[]) {
  localStorage.setItem(KEY_SNAPSHOTS, JSON.stringify(rows));
  emit();
}

export function getAllSnapshots(): SoldeJournalierRow[] {
  return loadSnapshots();
}

export function getSnapshotsForDay(caisseId: number, dateComptable: string): SoldeJournalierRow[] {
  return loadSnapshots().filter((r) => r.caisse_id === caisseId && r.date_comptable === dateComptable);
}

export function hasSnapshotType(caisseId: number, dateComptable: string, type: SnapshotType): boolean {
  return loadSnapshots().some(
    (r) => r.caisse_id === caisseId && r.date_comptable === dateComptable && r.type_solde === type
  );
}

/** Map devise → montant pour un type de snapshot donné. */
export function getSnapshotMap(
  caisseId: number,
  dateComptable: string,
  type: SnapshotType
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of loadSnapshots()) {
    if (r.caisse_id === caisseId && r.date_comptable === dateComptable && r.type_solde === type) {
      out[r.devise_code] = r.montant;
    }
  }
  return out;
}

export function upsertSnapshot(
  caisseId: number,
  dateComptable: string,
  type: SnapshotType,
  deviseCode: string,
  montant: number
): SoldeJournalierRow {
  const rows = loadSnapshots();
  const idx = rows.findIndex(
    (r) =>
      r.caisse_id === caisseId &&
      r.date_comptable === dateComptable &&
      r.type_solde === type &&
      r.devise_code === deviseCode
  );
  const row: SoldeJournalierRow = {
    id: idx >= 0 ? rows[idx].id : newEntityId('sj'),
    caisse_id: caisseId,
    date_comptable: dateComptable,
    type_solde: type,
    devise_code: deviseCode,
    montant,
    horodatage: new Date().toISOString(),
  };
  if (idx >= 0) rows[idx] = row;
  else rows.push(row);
  saveSnapshots(rows);
  return row;
}

/** Remplace tous les snapshots d’un type pour une journée (une seule écriture). */
export function replaceSnapshotsForType(
  caisseId: number,
  dateComptable: string,
  type: SnapshotType,
  devises: string[],
  balances: Record<string, number>
): void {
  const rows = loadSnapshots().filter(
    (r) =>
      !(
        r.caisse_id === caisseId &&
        r.date_comptable === dateComptable &&
        r.type_solde === type
      )
  );
  const now = new Date().toISOString();
  for (const d of devises) {
    rows.push({
      id: newEntityId('sj'),
      caisse_id: caisseId,
      date_comptable: dateComptable,
      type_solde: type,
      devise_code: d,
      montant: balances[d] ?? 0,
      horodatage: now,
    });
  }
  saveSnapshots(rows);
}

const LEGACY_MOMENT_MAP: Record<string, OperationMoment> = {
  AJUST_MATIN: 'MATIN',
  AJUST_SOIR: 'SOIR',
  OPERATION_JOURNEE: 'JOURNEE',
};

function mapMomentLoose(m: string): OperationMoment {
  if (m === 'MATIN' || m === 'JOURNEE' || m === 'SOIR') return m;
  return LEGACY_MOMENT_MAP[m] ?? 'JOURNEE';
}

function migrateStageOperations(ops: StageOperation[]): { ops: StageOperation[]; changed: boolean } {
  let changed = false;
  const out = ops.map((o) => {
    const ms = o.moment as unknown as string;
    const nm = mapMomentLoose(ms);
    if (nm !== o.moment) changed = true;
    return { ...o, moment: nm };
  });
  return { ops: out, changed };
}

export function loadStageOperations(): StageOperation[] {
  try {
    const raw = localStorage.getItem(KEY_OPERATIONS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as StageOperation[];
    if (!Array.isArray(arr)) return [];
    const { ops, changed } = migrateStageOperations(arr);
    if (changed) {
      localStorage.setItem(KEY_OPERATIONS, JSON.stringify(ops));
      emit();
    }
    return ops;
  } catch {
    return [];
  }
}

export function addStageOperation(op: Omit<StageOperation, 'id'>): StageOperation {
  const full: StageOperation = { ...op, id: newEntityId('op') };
  const list = loadStageOperations();
  list.push(full);
  localStorage.setItem(KEY_OPERATIONS, JSON.stringify(list));
  emit();
  return full;
}

export function getStageOperationsForDay(caisseId: number, dateComptable: string): StageOperation[] {
  return loadStageOperations().filter((o) => o.caisse_id === caisseId && o.date_comptable === dateComptable);
}

/** Sous-ensemble de `allOrdered` coché pour les formulaires d’ajustement (ordre conservé). */
export function getDevisesActifsPourAjust(allOrdered: readonly string[]): string[] {
  if (typeof window === 'undefined') return [...allOrdered];
  try {
    const raw = localStorage.getItem(KEY_AJUST_DEVISES_ACTIFS);
    if (!raw) return [...allOrdered];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...allOrdered];
    const allowed = new Set(allOrdered);
    const picked = parsed.filter((x): x is string => typeof x === 'string' && allowed.has(x));
    const uniq = [...new Set(picked)];
    if (uniq.length === 0) return [...allOrdered];
    return allOrdered.filter((d) => uniq.includes(d));
  } catch {
    return [...allOrdered];
  }
}

export function setDevisesActifsPourAjust(codes: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY_AJUST_DEVISES_ACTIFS, JSON.stringify(codes));
  } catch {
    /* ignore quota / private mode */
  }
}
