import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHero } from '@/components/PageHero';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import {
  ArrowLeft,
  Pencil,
  CheckCircle,
  X,
  Star,
  UserCheck,
  Users,
  Banknote,
  ArrowLeftRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getClientById,
  updateClient,
  getTransactions,
  getReliquats,
} from '@/lib/storage';
import { logAudit, AUDIT_ACTIONS } from '@/lib/auditLog';
import type { CategorieClient, PieceType, Client, Transaction, Reliquat } from '@/types';
import { fmt } from '@/lib/formatNumbers';

dayjs.locale('fr');

// ─── config ───────────────────────────────────────────────────────────────────

const CAT_CFG: Record<CategorieClient, { label: string; badge: string; emoji: string }> = {
  STANDARD: { label: 'Standard',  badge: 'bg-zinc-100 text-zinc-600 ring-zinc-200',     emoji: '○'  },
  HABITUEL: { label: 'Habituel',  badge: 'bg-blue-100 text-blue-800 ring-blue-200',     emoji: '✅' },
  AMI:      { label: 'Ami',       badge: 'bg-amber-100 text-amber-800 ring-amber-200',  emoji: '⭐' },
};

const STATUT_RELIQUAT_LABEL: Record<string, string> = {
  NON_SOLDE:            'Non soldé',
  PARTIELLEMENT_SOLDE:  'Partiel',
  SOLDE:                'Soldé',
};

function CategorieBadge({ cat }: { cat: CategorieClient }) {
  const cfg = CAT_CFG[cat];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ring-1 ${cfg.badge}`}>
      <span>{cfg.emoji}</span> {cfg.label}
    </span>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

function EditModal({ client, onClose, onSaved }: { client: Client; onClose: () => void; onSaved: () => void }) {
  const [nom, setNom] = useState(client.nom);
  const [pieceType, setPieceType] = useState<PieceType>(client.pieceType);
  const [pieceNumero, setPieceNumero] = useState(client.pieceNumero);
  const [categorie, setCategorie] = useState<CategorieClient>(client.categorie);
  const [telephone, setTelephone] = useState(client.telephone ?? '');
  const [email, setEmail] = useState(client.email ?? '');
  const [error, setError] = useState('');

  function handleSave() {
    if (!nom.trim()) { setError('Nom requis'); return; }
    if (!pieceNumero.trim()) { setError('Numéro pièce requis'); return; }
    updateClient(client.id, {
      nom: nom.trim(),
      pieceType,
      pieceNumero: pieceNumero.trim().toUpperCase(),
      categorie,
      telephone: telephone.trim() || undefined,
      email: email.trim() || undefined,
    });
    logAudit(AUDIT_ACTIONS.CLIENT_UPDATE, { id: client.id, nom, categorie });
    onSaved();
    onClose();
  }

  const categories: CategorieClient[] = ['STANDARD', 'HABITUEL', 'AMI'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-zinc-300 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">Modifier le client</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
        </div>

        {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-600">Nom *</label>
            <Input value={nom} onChange={(e) => setNom(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-600">Pièce *</label>
              <select
                value={pieceType}
                onChange={(e) => setPieceType(e.target.value as PieceType)}
                className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900"
              >
                {(['CIN', 'PASSPORT', 'AUTRES'] as PieceType[]).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-600">Numéro *</label>
              <Input value={pieceNumero} onChange={(e) => setPieceNumero(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-zinc-600">Catégorie</label>
            <div className="flex gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategorie(cat)}
                  className={`flex-1 rounded-md border py-1.5 text-xs font-semibold transition-colors ${
                    categorie === cat
                      ? cat === 'STANDARD' ? 'border-zinc-400 bg-zinc-100 text-zinc-800'
                        : cat === 'HABITUEL' ? 'border-blue-400 bg-blue-100 text-blue-800'
                        : 'border-amber-400 bg-amber-100 text-amber-800'
                      : 'border-zinc-300 bg-white text-zinc-400 hover:border-zinc-400'
                  }`}
                >
                  {CAT_CFG[cat].emoji} {CAT_CFG[cat].label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-600">Téléphone</label>
              <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+212..." />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-600">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
            <CheckCircle size={14} className="mr-1" /> Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//   Page principale
// ═══════════════════════════════════════

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(() => (id ? getClientById(id) : null));
  const [showEdit, setShowEdit] = useState(false);

  function refresh() {
    if (id) setClient(getClientById(id));
  }

  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <p className="text-zinc-500 mb-4">Client introuvable.</p>
          <Button variant="outline" onClick={() => navigate('/clients')}>
            <ArrowLeft size={14} className="mr-1" /> Retour
          </Button>
        </div>
      </div>
    );
  }

  // Transactions liées (par clientId ou par nom beneficiaire)
  const allTx = getTransactions();
  const clientTx: Transaction[] = allTx.filter(
    (tx) => tx.clientId === client.id || tx.beneficiaire?.toLowerCase() === client.nom.toLowerCase()
  );

  // Reliquats liés (par nom client)
  const allReliquats = getReliquats();
  const clientReliquats: Reliquat[] = allReliquats.filter(
    (r) => r.client.toLowerCase() === client.nom.toLowerCase()
  );
  const reliquatsActifs = clientReliquats.filter((r) => r.statut !== 'SOLDE');

  const CatIcon = client.categorie === 'AMI' ? Star : client.categorie === 'HABITUEL' ? UserCheck : Users;

  return (
    <div className="min-h-screen bg-zinc-50">
      <PageHero title={client.nom} subtitle={`${client.pieceType} · ${client.pieceNumero} · Créé le ${dayjs(client.dateCreation).format('DD MMMM YYYY')}`} />

      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">

        {/* Back + actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate('/clients')}>
            <ArrowLeft size={14} className="mr-1" /> Retour
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Pencil size={14} className="mr-1" /> Modifier
          </Button>
        </div>

        {/* Client info card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-start gap-4">
              {/* Avatar */}
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl ${
                client.categorie === 'AMI' ? 'bg-amber-100' : client.categorie === 'HABITUEL' ? 'bg-blue-100' : 'bg-zinc-100'
              }`}>
                <CatIcon size={24} className={client.categorie === 'AMI' ? 'text-amber-600' : client.categorie === 'HABITUEL' ? 'text-blue-600' : 'text-zinc-400'} />
              </div>

              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold text-zinc-900">{client.nom}</h2>
                  <CategorieBadge cat={client.categorie} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-zinc-500">
                  <span><strong className="text-zinc-700">Pièce :</strong> {client.pieceType} {client.pieceNumero}</span>
                  {client.telephone && <span><strong className="text-zinc-700">Tél. :</strong> {client.telephone}</span>}
                  {client.email && <span><strong className="text-zinc-700">Email :</strong> {client.email}</span>}
                  <span><strong className="text-zinc-700">Créé par :</strong> {client.creePar}</span>
                </div>
              </div>

              {/* KPI mini */}
              <div className="flex gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-zinc-900">{clientTx.length}</p>
                  <p className="text-xs text-zinc-400">opérations</p>
                </div>
                <div>
                  <p className={`text-2xl font-bold ${reliquatsActifs.length > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{reliquatsActifs.length}</p>
                  <p className="text-xs text-zinc-400">reliquats ouverts</p>
                </div>
              </div>
            </div>

            {/* Warning STANDARD */}
            {client.categorie === 'STANDARD' && (
              <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
                ⚠️ Client <strong>STANDARD</strong> — les opérations partielles (reliquats) ne sont pas autorisées.
                Pour accorder la confiance, modifiez la catégorie en <strong>HABITUEL</strong> ou <strong>AMI</strong>.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reliquats actifs */}
        {reliquatsActifs.length > 0 && (
          <Card className="border-amber-200">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm text-amber-900">
                <Banknote size={15} className="text-amber-600" />
                Reliquats actifs ({reliquatsActifs.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="divide-y divide-amber-100 rounded-lg border border-amber-200">
                {reliquatsActifs.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-3 py-2.5 text-xs">
                    <span className="font-mono text-zinc-500">{r.operationNumero || r.operationRef}</span>
                    <span className="font-bold text-red-700">{fmt(r.montantRestant)} {r.devise}</span>
                    <span className="text-zinc-400">depuis le {dayjs(r.dateCreation).format('DD/MM/YYYY')}</span>
                    <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${
                      r.statut === 'NON_SOLDE' ? 'bg-red-100 text-red-700 ring-red-200' : 'bg-amber-100 text-amber-800 ring-amber-200'
                    }`}>
                      {STATUT_RELIQUAT_LABEL[r.statut]}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Historique transactions */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ArrowLeftRight size={15} className="text-zinc-400" />
              Opérations ({clientTx.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {clientTx.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-zinc-400">Aucune opération liée à ce client.</p>
            ) : (
              <div className="divide-y divide-zinc-100 text-xs">
                {clientTx
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-zinc-400 shrink-0">{dayjs(tx.date).format('DD/MM/YYYY')}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ring-1 ${
                        tx.type === 'ACHAT' ? 'bg-blue-100 text-blue-800 ring-blue-200'
                          : tx.type === 'VENTE' ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                          : 'bg-zinc-100 text-zinc-600 ring-zinc-200'
                      }`}>
                        {tx.type}
                      </span>
                      <span className="text-zinc-700 truncate flex-1">{tx.operation}</span>
                      <span className="shrink-0 font-mono font-semibold text-zinc-900">{fmt(tx.montantMAD)} MAD</span>
                      <span className={`shrink-0 font-semibold ${tx.statut === 'PAYÉ' ? 'text-emerald-600' : tx.statut === 'CRÉDIT' ? 'text-amber-600' : 'text-red-600'}`}>
                        {tx.statut}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tous les reliquats (y compris soldés) */}
        {clientReliquats.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm">Historique reliquats ({clientReliquats.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-zinc-100 text-xs">
                {clientReliquats.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-zinc-400 shrink-0">{dayjs(r.dateCreation).format('DD/MM/YYYY')}</span>
                    <span className="font-mono text-zinc-500 shrink-0">{r.operationNumero || r.operationRef}</span>
                    <span className="font-semibold text-zinc-900">{fmt(r.montantInitial)} {r.devise}</span>
                    <span className="text-zinc-400">→</span>
                    <span className={`font-semibold ${r.statut === 'SOLDE' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmt(r.montantRestant)} {r.devise}
                    </span>
                    <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${
                      r.statut === 'SOLDE' ? 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                        : r.statut === 'NON_SOLDE' ? 'bg-red-100 text-red-700 ring-red-200'
                        : 'bg-amber-100 text-amber-800 ring-amber-200'
                    }`}>
                      {STATUT_RELIQUAT_LABEL[r.statut]}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {showEdit && (
        <EditModal
          client={client}
          onClose={() => setShowEdit(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
