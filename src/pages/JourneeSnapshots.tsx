import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { useNavigate } from 'react-router-dom';
import { PageHero } from '@/components/PageHero';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  FileText,
  Moon,
  Scale,
  Sunrise,
} from 'lucide-react';
import { DEVISES_CAISSE_V8 } from '@/lib/constants';
import type { SnapshotType } from '@/types/stageCaisse';
import { getSnapshotMap, upsertSnapshot } from '@/lib/stageCaisse/storage';
import { useBKAMRates } from '@/hooks/useBKAMRates';
import { useNotify } from '@/hooks/useNotify';
import { TauxDuJourTable } from '@/components/TauxDuJourTable';
import { fmtNumber } from '@/lib/formatNumbers';

dayjs.locale('fr');

const CAISSE_ID = 1;
const DEVISES_SNAPSHOT = ['MAD', ...(DEVISES_CAISSE_V8 as readonly string[])] as string[];

const COLUMNS: { type: SnapshotType; label: string; editable: boolean }[] = [
  { type: 'DEPART', label: 'Départ', editable: true },
  { type: 'CLOTURE', label: 'Clôture', editable: true },
  { type: 'FINAL', label: 'Final (auto)', editable: false },
];

const fmt = (n: number) => fmtNumber(n, 4);

const CAISSE_NAV = [
  {
    Icon: Sunrise,
    title: 'OUVERTURE (8h)',
    desc: "Enregistre le solde d'ouverture",
    to: '/journal-journee',
    accent: 'border-blue-300 bg-blue-50 hover:bg-blue-100',
    btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    titleClass: 'text-blue-700',
    iconClass: 'text-blue-600',
  },
  {
    Icon: FileText,
    title: 'OPÉRATIONS (jour)',
    desc: 'Ajoute toutes les transactions',
    to: '/caisse',
    accent: 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    titleClass: 'text-emerald-700',
    iconClass: 'text-emerald-600',
  },
  {
    Icon: Moon,
    title: 'CLÔTURE (18h)',
    desc: 'Ferme la caisse du jour',
    to: '/cloture',
    accent: 'border-orange-300 bg-orange-50 hover:bg-orange-100',
    btnClass: 'bg-orange-500 hover:bg-orange-600 text-white',
    titleClass: 'text-orange-700',
    iconClass: 'text-orange-600',
  },
  {
    Icon: Scale,
    title: 'VÉRIFICATION',
    desc: "Vérifie l'argent réel vs théorique",
    to: '/reconciliation',
    accent: 'border-red-300 bg-red-50 hover:bg-red-100',
    btnClass: 'bg-red-600 hover:bg-red-700 text-white',
    titleClass: 'text-red-700',
    iconClass: 'text-red-600',
  },
] as const;

export function JourneeSnapshots() {
  const navigate = useNavigate();
  const notify = useNotify();
  const { meta: ratesMeta, loading: ratesLoading, refresh: refreshRates } = useBKAMRates();
  const [day, setDay] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [tick, setTick] = useState(0);
  const [justSaved, setJustSaved] = useState(false);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const on = () => refresh();
    window.addEventListener('afromoney-data', on);
    return () => window.removeEventListener('afromoney-data', on);
  }, [refresh]);

  const maps = useMemo(() => {
    void tick;
    return {
      DEPART:  getSnapshotMap(CAISSE_ID, day, 'DEPART'),
      CLOTURE: getSnapshotMap(CAISSE_ID, day, 'CLOTURE'),
      FINAL:   getSnapshotMap(CAISSE_ID, day, 'FINAL'),
    };
  }, [day, tick]);

  const hasData = useMemo(
    () => DEVISES_SNAPSHOT.some((d) => (maps.DEPART[d] ?? maps.CLOTURE[d] ?? maps.FINAL[d]) != null),
    [maps]
  );

  function saveCell(type: SnapshotType, devise: string, raw: string) {
    const n = parseFloat(raw.replace(',', '.'));
    if (!Number.isFinite(n)) return;
    upsertSnapshot(CAISSE_ID, day, type, devise, n);
    refresh();
  }

  function handleSave() {
    refresh();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
    notify.success('Snapshots enregistrés !');
  }

  return (
    <div>
      <PageHero
        title="Journée — 3 snapshots"
        subtitle="Enregistre : Départ → Clôture → Final"
        actions={
          <label className="flex items-center gap-2 text-sm text-white/85">
            <Calendar size={14} />
            <input
              type="date"
              value={day}
              onChange={(e) => { setDay(e.target.value); setJustSaved(false); }}
              className="rounded-md border border-white/25 bg-white/12 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-400"
            />
          </label>
        }
      />

      <div className="page-content mx-auto max-w-4xl space-y-5">

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CAISSE_NAV.map((item) => (
            <div
              key={item.to}
              className={`flex flex-col gap-3 rounded-xl border-2 p-4 transition-colors cursor-pointer ${item.accent}`}
              onClick={() => navigate(item.to)}
            >
              <item.Icon size={32} strokeWidth={1.75} className={item.iconClass} aria-hidden />
              <div className="flex-1">
                <p className={`text-xs font-black uppercase leading-tight ${item.titleClass}`}>
                  {item.title}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500 leading-snug">{item.desc}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); navigate(item.to); }}
                className={`w-full rounded-lg py-1.5 text-[11px] font-bold transition-colors ${item.btnClass}`}
              >
                <span className="inline-flex items-center justify-center gap-1">
                  Accéder
                  <ArrowRight size={12} aria-hidden />
                </span>
              </button>
            </div>
          ))}
        </div>

        <TauxDuJourTable meta={ratesMeta} loading={ratesLoading} onRefresh={refreshRates} notify={notify} />

        <Card className="border-zinc-200 shadow-sm">
          <CardContent className="pt-5">
            <div className="overflow-x-auto rounded-lg border border-zinc-200">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50">
                    <th className="px-4 py-3 text-left font-semibold text-zinc-600">Devise</th>
                    {COLUMNS.map((col) => (
                      <th key={col.type} className="px-4 py-3 text-left font-semibold text-zinc-600">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEVISES_SNAPSHOT.map((devise) => (
                    <tr key={devise} className="border-b border-zinc-100 hover:bg-zinc-50/50">
                      <td className="px-4 py-2 font-mono font-bold text-zinc-900">{devise}</td>
                      {COLUMNS.map((col) =>
                        col.editable ? (
                          <td key={col.type} className="px-2 py-1.5">
                            <SnapshotCell
                              initialValue={maps[col.type][devise] ?? ''}
                              onCommit={(raw) => saveCell(col.type, devise, raw)}
                            />
                          </td>
                        ) : (
                          <td key={col.type} className="px-4 py-2 font-mono tabular-nums text-zinc-500">
                            {fmt((maps.DEPART[devise] ?? 0) + (maps.CLOTURE[devise] ?? 0))}
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <Button
            type="button"
            onClick={handleSave}
            className="bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-700"
          >
            Enregistrer snapshots
          </Button>

          <div className="flex items-center gap-2 text-sm font-medium">
            {justSaved || hasData ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-emerald-700">Snapshots enregistrés</span>
              </>
            ) : (
              <>
                <AlertTriangle size={16} className="text-amber-500" />
                <span className="text-amber-700">À remplir</span>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function SnapshotCell({
  initialValue,
  onCommit,
}: {
  initialValue: number | '';
  onCommit: (raw: string) => void;
}) {
  const [local, setLocal] = useState(
    initialValue === '' || initialValue == null ? '' : String(initialValue)
  );

  useEffect(() => {
    setLocal(initialValue === '' || initialValue == null ? '' : String(initialValue));
  }, [initialValue]);

  return (
    <Input
      className="h-8 max-w-[140px] font-mono text-sm tabular-nums"
      inputMode="decimal"
      placeholder="—"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onCommit(local)}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}
