import { useEffect, useState } from 'react';
import { PageHero } from '@/components/PageHero';
import { UserPlus, X, CheckCircle, XCircle, Pencil, Trash2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUsers, addUser, updateUser, deleteUser, initDefaultUsers } from '@/lib/storage';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSION_LIST, canManageUsers } from '@/lib/permissions';
import type { User, Role } from '@/types';

// ─── constants ────────────────────────────────────────────────────────────────

const ROLE_CFG: Record<Role, { label: string; badgeClass: string; desc: string }> = {
  ADMIN:       { label: 'ADMIN',       badgeClass: 'bg-red-100 text-red-800 ring-red-200',      desc: 'Accès total — paramètres & utilisateurs' },
  RESPONSABLE: { label: 'RESPONSABLE', badgeClass: 'bg-amber-100 text-amber-800 ring-amber-200', desc: 'Taux, coffre, clôture, audit' },
  CAISSIER:    { label: 'CAISSIER',    badgeClass: 'bg-blue-100 text-blue-800 ring-blue-200',    desc: 'Opérations ACHAT/VENTE, reliquats' },
};

// ─── RoleBadge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: Role }) {
  const cfg = ROLE_CFG[role];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${cfg.badgeClass}`}>
      {cfg.label}
    </span>
  );
}

// ─── PermissionsPanel ────────────────────────────────────────────────────────

function PermissionsPanel({ user }: { user: User }) {
  return (
    <Card className="border-zinc-200">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm font-semibold text-zinc-700">
          🔒 Permissions — {user.nom}{' '}
          <RoleBadge role={user.role} />
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ul className="space-y-1.5">
          {PERMISSION_LIST.map((perm) => {
            const allowed = perm.check(user.role);
            return (
              <li key={perm.label} className="flex items-center gap-2 text-xs">
                {allowed
                  ? <CheckCircle size={13} className="shrink-0 text-emerald-500" />
                  : <XCircle   size={13} className="shrink-0 text-red-400" />
                }
                <span className={allowed ? 'text-zinc-800' : 'text-zinc-400 line-through decoration-zinc-300'}>
                  {perm.label}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─── EditModal ───────────────────────────────────────────────────────────────

interface EditForm { nom: string; email: string; role: Role; }
interface EditErrors { nom?: string; email?: string; }

function EditModal({
  user,
  currentUserId,
  onClose,
  onDone,
}: {
  user: User;
  currentUserId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [form, setForm] = useState<EditForm>({ nom: user.nom, email: user.email, role: user.role });
  const [errors, setErrors] = useState<EditErrors>({});

  function validate(): boolean {
    const e: EditErrors = {};
    if (!form.nom.trim()) e.nom = 'Nom requis';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Email valide requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    updateUser(user.id, { nom: form.nom.trim(), email: form.email.trim(), role: form.role });
    onDone();
  }

  const isSelf = user.id === currentUserId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">

        <div className="flex items-center justify-between rounded-t-xl bg-zinc-900 px-5 py-4">
          <h2 className="text-base font-bold text-white">Modifier utilisateur</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600">Nom *</label>
            <Input
              value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              className={errors.nom ? 'border-red-400' : ''}
            />
            {errors.nom && <p className="text-[10px] text-red-500">{errors.nom}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600">Email *</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={errors.email ? 'border-red-400' : ''}
            />
            {errors.email && <p className="text-[10px] text-red-500">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-600">Rôle</label>
            {isSelf && (
              <p className="flex items-center gap-1 text-[10px] text-amber-600">
                <ShieldAlert size={11} /> Vous ne pouvez pas modifier votre propre rôle
              </p>
            )}
            <div className="space-y-2">
              {(Object.entries(ROLE_CFG) as [Role, typeof ROLE_CFG[Role]][]).map(([r, cfg]) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${form.role === r ? 'border-blue-400 bg-blue-50' : 'border-zinc-200 hover:border-zinc-300'} ${isSelf ? 'pointer-events-none opacity-50' : ''}`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={form.role === r}
                    onChange={() => !isSelf && setForm((f) => ({ ...f, role: r }))}
                    disabled={isSelf}
                    className="mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold text-zinc-800">{cfg.label}</p>
                    <p className="text-[10px] text-zinc-500">{cfg.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3.5">
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" onClick={handleSave}>Sauvegarder</Button>
        </div>
      </div>
    </div>
  );
}

// ─── CreateModal ─────────────────────────────────────────────────────────────

interface CreateForm { nom: string; email: string; role: Role; }
interface CreateErrors { nom?: string; email?: string; }

function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState<CreateForm>({ nom: '', email: '', role: 'CAISSIER' });
  const [errors, setErrors] = useState<CreateErrors>({});

  function validate(): boolean {
    const e: CreateErrors = {};
    if (!form.nom.trim()) e.nom = 'Nom requis';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Email valide requis';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleCreate() {
    if (!validate()) return;
    addUser({ nom: form.nom.trim(), email: form.email.trim(), role: form.role });
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-2xl">

        <div className="flex items-center justify-between rounded-t-xl bg-blue-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <UserPlus size={16} className="text-white" />
            <h2 className="text-base font-bold text-white">Nouvel utilisateur</h2>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600">Nom *</label>
            <Input
              placeholder="Prénom Nom"
              value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              className={errors.nom ? 'border-red-400' : ''}
            />
            {errors.nom && <p className="text-[10px] text-red-500">{errors.nom}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-600">Email *</label>
            <Input
              type="email"
              placeholder="prenom@exemple.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className={errors.email ? 'border-red-400' : ''}
            />
            {errors.email && <p className="text-[10px] text-red-500">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-600">Rôle</label>
            <div className="space-y-2">
              {(Object.entries(ROLE_CFG) as [Role, typeof ROLE_CFG[Role]][]).map(([r, cfg]) => (
                <label
                  key={r}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${form.role === r ? 'border-blue-400 bg-blue-50' : 'border-zinc-200 hover:border-zinc-300'}`}
                >
                  <input
                    type="radio"
                    name="role-new"
                    value={r}
                    checked={form.role === r}
                    onChange={() => setForm((f) => ({ ...f, role: r }))}
                    className="mt-0.5 shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold text-zinc-800">{cfg.label}</p>
                    <p className="text-[10px] text-zinc-500">{cfg.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3.5">
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-white" onClick={handleCreate}>
            <UserPlus size={13} className="mr-1" /> Créer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//   Page principale
// ═══════════════════════════════════════

export function Utilisateurs() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function load() {
    initDefaultUsers();
    setUsers(getUsers());
  }

  useEffect(() => { load(); }, []);

  function handleDone() {
    load();
    setEditUser(null);
    setShowCreate(false);
    setSelected((prev) => prev ? (getUsers().find((u) => u.id === prev.id) ?? null) : null);
  }

  function handleDelete(id: string) {
    if (id === currentUser?.id) return; // protect self
    deleteUser(id);
    if (selected?.id === id) setSelected(null);
    load();
    setConfirmDelete(null);
  }

  // Guard: only ADMIN can manage users
  if (!canManageUsers(currentUser?.role ?? 'CAISSIER')) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <PageHero title="Utilisateurs" subtitle="Gestion des accès" />
        <div className="mx-auto max-w-lg py-24 text-center">
          <ShieldAlert size={40} className="mx-auto mb-4 text-red-400" />
          <p className="text-lg font-semibold text-zinc-700">Accès refusé</p>
          <p className="mt-1 text-sm text-zinc-400">Seul un ADMIN peut gérer les utilisateurs.</p>
        </div>
      </div>
    );
  }

  const roleCount = (r: Role) => users.filter((u) => u.role === r).length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <PageHero
        title="Utilisateurs"
        subtitle={`${users.length} compte${users.length !== 1 ? 's' : ''} · Rôles & Permissions`}
        actions={
          <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-white" onClick={() => setShowCreate(true)}>
            <UserPlus size={14} className="mr-1" /> Ajouter utilisateur
          </Button>
        }
      />

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">

        {/* ── KPI ── */}
        <div className="grid grid-cols-3 gap-3">
          {(['ADMIN', 'RESPONSABLE', 'CAISSIER'] as Role[]).map((r) => (
            <Card key={r} className="border-zinc-200">
              <CardContent className="px-4 py-3">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${ROLE_CFG[r].badgeClass.split(' ').find((c) => c.startsWith('text-')) ?? 'text-zinc-400'}`}>
                  {ROLE_CFG[r].label}
                </p>
                <p className="mt-0.5 text-2xl font-bold text-zinc-900">{roleCount(r)}</p>
                <p className="text-[10px] text-zinc-400">{ROLE_CFG[r].desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">

          {/* ── Table utilisateurs ── */}
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-semibold text-zinc-700">
                👥 Comptes utilisateurs
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {users.length === 0 ? (
                <p className="py-12 text-center text-sm text-zinc-400">Aucun utilisateur.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Nom</th>
                      <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Email</th>
                      <th className="px-4 py-2.5 text-left font-medium text-zinc-500">Rôle</th>
                      <th className="px-4 py-2.5 text-center font-medium text-zinc-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {users.map((u) => {
                      const isSelf = u.id === currentUser?.id;
                      const isSelected = selected?.id === u.id;
                      return (
                        <tr
                          key={u.id}
                          onClick={() => setSelected(u)}
                          className={`cursor-pointer transition-colors hover:bg-zinc-50 ${isSelected ? 'bg-blue-50/60 ring-1 ring-inset ring-blue-200' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-[11px] font-bold text-white">
                                {u.nom.charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-zinc-900">
                                {u.nom}
                                {isSelf && <span className="ml-1.5 text-[9px] text-zinc-400">(vous)</span>}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-500">{u.email}</td>
                          <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditUser(u); }}
                                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                                title="Modifier"
                              >
                                <Pencil size={13} />
                              </button>
                              {!isSelf && (
                                confirmDelete === u.id ? (
                                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => handleDelete(u.id)} className="text-[10px] font-medium text-red-500 hover:text-red-700">Oui</button>
                                    <span className="text-zinc-400">|</span>
                                    <button onClick={() => setConfirmDelete(null)} className="text-[10px] text-zinc-400 hover:text-zinc-700">Non</button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(u.id); }}
                                    className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* ── Panneau permissions ── */}
          <div>
            {selected ? (
              <PermissionsPanel user={selected} />
            ) : (
              <Card className="border-dashed border-zinc-300">
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-zinc-400">Sélectionnez un utilisateur</p>
                  <p className="mt-1 text-[10px] text-zinc-300">pour voir ses permissions</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {editUser && (
        <EditModal
          user={editUser}
          currentUserId={currentUser?.id ?? ''}
          onClose={() => setEditUser(null)}
          onDone={handleDone}
        />
      )}
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onDone={handleDone} />
      )}
    </div>
  );
}
