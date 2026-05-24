import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHero } from '@/components/PageHero';
import {
  Plus,
  Search,
  Trash2,
  X,
  CheckCircle,
  Users,
  Star,
  UserCheck,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { getClients, addClient, deleteClient } from '@/lib/storage';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditLog';
import type { Client, CategorieClient, PieceType } from '@/types';

// ─── config ───────────────────────────────────────────────────────────────────

const CAT_CFG: Record<CategorieClient, { label: string; badge: string; icon: React.ElementType; emoji: string }> = {
  STANDARD: {
    label: 'Standard',
    badge: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
    icon: Users,
    emoji: '○',
  },
  HABITUEL: {
    label: 'Habituel',
    badge: 'bg-blue-100 text-blue-800 ring-blue-200',
    icon: UserCheck,
    emoji: '✅',
  },
  AMI: {
    label: 'Ami',
    badge: 'bg-amber-100 text-amber-800 ring-amber-200',
    icon: Star,
    emoji: '⭐',
  },
};

const PIECES: PieceType[] = ['CIN', 'PASSPORT', 'AUTRES'];
const CATEGORIES: CategorieClient[] = ['STANDARD', 'HABITUEL', 'AMI'];

// ─── helpers ─────────────────────────────────────────────────────────────────

function CategorieBadge({ cat }: { cat: CategorieClient }) {
  const cfg = CAT_CFG[cat];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${cfg.badge}`}>
      <span>{cfg.emoji}</span>
      {cfg.label}
    </span>
  );
}

function Toast({ msg, ok, onClose }: { msg: string; ok: boolean; onClose: () => void }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'}`}>
      {ok ? <CheckCircle size={15} /> : <X size={15} />}
      <span className="flex-1">{msg}</span>
      <button onClick={onClose}><X size={13} /></button>
    </div>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────

interface CreateForm {
  nom: string;
  pieceType: PieceType;
  pieceNumero: string;
  categorie: CategorieClient;
  telephone: string;
  email: string;
}

interface CreateErrors {
  nom?: string;
  pieceType?: string;
  pieceNumero?: string;
}

function emptyForm(): CreateForm {
  return { nom: '', pieceType: 'CIN', pieceNumero: '', categorie: 'STANDARD', telephone: '', email: '' };
}

function validateForm(f: CreateForm): CreateErrors {
  const e: CreateErrors = {};
  if (!f.nom.trim()) e.nom = 'Nom requis';
  if (!f.pieceNumero.trim()) e.pieceNumero = 'Numéro pièce requis';
  return e;
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-zinc-600">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function NativeSelect({ value, onChange, children, hasError = false }: { value: string; onChange: (v: string) => void; children: React.ReactNode; hasError?: boolean }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`flex h-9 w-full rounded-md border bg-white px-3 py-1 text-sm text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${hasError ? 'border-red-400' : 'border-zinc-300'}`}
    >
      {children}
    </select>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: Client) => void }) {
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [errors, setErrors] = useState<CreateErrors>({});

  function set<K extends keyof CreateForm>(k: K, v: CreateForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  }

  function handleSave() {
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const client = addClient({
      nom: form.nom.trim(),
      pieceType: form.pieceType,
      pieceNumero: form.pieceNumero.trim().toUpperCase(),
      categorie: form.categorie,
      telephone: form.telephone.trim() || undefined,
      email: form.email.trim() || undefined,
    });
    logAudit(AUDIT_ACTIONS.CLIENT_CREATE, { id: client.id, nom: client.nom, categorie: client.categorie });
    onCreated(client);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">Nouveau client</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <Field label="Nom complet *" error={errors.nom}>
            <Input
              value={form.nom}
              onChange={(e) => set('nom', e.target.value)}
              placeholder="Ex. Ahmed Ben Ahmed"
              className={errors.nom ? 'border-red-400' : ''}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type de pièce *">
              <NativeSelect value={form.pieceType} onChange={(v) => set('pieceType', v as PieceType)}>
                {PIECES.map((p) => <option key={p} value={p}>{p}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Numéro pièce *" error={errors.pieceNumero}>
              <Input
                value={form.pieceNumero}
                onChange={(e) => set('pieceNumero', e.target.value)}
                placeholder="AB123456"
                className={errors.pieceNumero ? 'border-red-400' : ''}
              />
            </Field>
          </div>

          <Field label="Catégorie de confiance">
            <div className="flex gap-2">
              {CATEGORIES.map((cat) => {
                const cfg = CAT_CFG[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => set('categorie', cat)}
                    className={`flex-1 rounded-md border py-1.5 text-xs font-semibold transition-colors ${
                      form.categorie === cat
                        ? cat === 'STANDARD'
                          ? 'border-zinc-400 bg-zinc-100 text-zinc-800'
                          : cat === 'HABITUEL'
                            ? 'border-blue-400 bg-blue-100 text-blue-800'
                            : 'border-amber-400 bg-amber-100 text-amber-800'
                        : 'border-zinc-300 bg-white text-zinc-500 hover:border-zinc-400'
                    }`}
                  >
                    {cfg.emoji} {cfg.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Téléphone">
              <Input
                value={form.telephone}
                onChange={(e) => set('telephone', e.target.value)}
                placeholder="+212 6XX XXX XXX"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="email@exemple.com"
              />
            </Field>
          </div>

          {form.categorie !== 'STANDARD' && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              ✓ Client <strong>{CAT_CFG[form.categorie].label}</strong> — opérations partielles (reliquats) autorisées.
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus size={14} className="mr-1" /> Créer le client
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//   Page principale
// ═══════════════════════════════════════

export function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>(getClients);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<CategorieClient | 'TOUS'>('TOUS');

  function refresh() { setClients(getClients()); }

  function showMsg(msg: string, ok = true) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  function handleDelete(id: string) {
    deleteClient(id);
    logAudit(AUDIT_ACTIONS.CLIENT_DELETE, { id });
    refresh();
    setConfirmDelete(null);
    showMsg('Client supprimé.');
  }

  const filtered = clients.filter((c) => {
    if (filterCat !== 'TOUS' && c.categorie !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!c.nom.toLowerCase().includes(q) && !c.pieceNumero.toLowerCase().includes(q) && !(c.telephone ?? '').includes(q)) return false;
    }
    return true;
  });

  const nbStandard = clients.filter((c) => c.categorie === 'STANDARD').length;
  const nbHabituel = clients.filter((c) => c.categorie === 'HABITUEL').length;
  const nbAmi = clients.filter((c) => c.categorie === 'AMI').length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <PageHero
        title="Base Clients"
        subtitle="Identification · Catégorie de confiance · Historique opérations"
      />

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        {toast && <Toast msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total clients', value: clients.length, color: 'text-zinc-900' },
            { label: 'Standard', value: nbStandard, color: 'text-zinc-600' },
            { label: 'Habituels', value: nbHabituel, color: 'text-blue-700' },
            { label: 'Amis', value: nbAmi, color: 'text-amber-700' },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="px-4 py-3">
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filtres + Create */}
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom, numéro pièce, téléphone..."
                  className="pl-8 text-sm"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                    <X size={12} />
                  </button>
                )}
              </div>
              <select
                value={filterCat}
                onChange={(e) => setFilterCat(e.target.value as CategorieClient | 'TOUS')}
                className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-700"
              >
                <option value="TOUS">Toutes catégories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CAT_CFG[c].label}</option>)}
              </select>
              <Button onClick={() => setShowCreate(true)} className="ml-auto bg-blue-600 hover:bg-blue-700 text-white">
                <Plus size={14} className="mr-1" /> Nouveau client
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-zinc-400">
                {clients.length === 0
                  ? 'Aucun client enregistré. Cliquez sur "Nouveau client" pour commencer.'
                  : 'Aucun client ne correspond aux filtres.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Nom</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Pièce</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">N°</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Catégorie</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Tél.</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">Créé le</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-zinc-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        className="cursor-pointer transition-colors hover:bg-blue-50/50"
                        onClick={() => navigate(`/clients/${c.id}`)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-semibold text-zinc-900">{c.nom}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-zinc-500">{c.pieceType}</td>
                        <td className="px-4 py-3 text-xs font-mono font-medium text-zinc-700">{c.pieceNumero}</td>
                        <td className="px-4 py-3">
                          <CategorieBadge cat={c.categorie} />
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{c.telephone ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-zinc-400">{c.dateCreation}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/clients/${c.id}`); }}
                              className="rounded-md p-1.5 text-zinc-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                              title="Voir détail"
                            >
                              <ChevronRight size={14} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDelete(c.id); }}
                              className="rounded-md p-1.5 text-zinc-400 hover:bg-red-100 hover:text-red-500 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirm delete */}
        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-xl border border-zinc-300 bg-white p-6 shadow-2xl">
              <h3 className="mb-2 font-semibold text-zinc-900">Supprimer ce client ?</h3>
              <p className="mb-5 text-sm text-zinc-500">
                {clients.find((c) => c.id === confirmDelete)?.nom} — cette action est irréversible.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setConfirmDelete(null)}>Annuler</Button>
                <Button onClick={() => handleDelete(confirmDelete)} className="bg-red-600 hover:bg-red-700 text-white">
                  <Trash2 size={14} className="mr-1" /> Supprimer
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { refresh(); showMsg('Client créé avec succès.'); }}
        />
      )}
    </div>
  );
}
