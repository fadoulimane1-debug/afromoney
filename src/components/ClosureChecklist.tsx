import { useEffect, useState } from 'react';
import { CheckCircle, Circle } from 'lucide-react';
import dayjs from 'dayjs';

const ITEMS = [
  { id: 'count', label: 'Comptage physique des devises effectué' },
  { id: 'mad', label: 'Solde MAD compté et saisi en clôture' },
] as const;

type ItemId = (typeof ITEMS)[number]['id'];

function storageKey(date: string) {
  return `afromoney_closure_checklist_${date}`;
}

export function ClosureChecklist({ date }: { date: string }) {
  const [checked, setChecked] = useState<Record<ItemId, boolean>>({} as Record<ItemId, boolean>);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(date));
      if (raw) setChecked(JSON.parse(raw) as Record<ItemId, boolean>);
      else setChecked({} as Record<ItemId, boolean>);
    } catch {
      setChecked({} as Record<ItemId, boolean>);
    }
  }, [date]);

  function toggle(id: ItemId) {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(storageKey(date), JSON.stringify(next));
      return next;
    });
  }

  const done = ITEMS.filter((i) => checked[i.id]).length;
  const allDone = done === ITEMS.length;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white/90 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">Check-list clôture</h3>
        <span
          className={`text-xs font-medium ${allDone ? 'text-emerald-600' : 'text-amber-600'}`}
        >
          {done}/{ITEMS.length}
        </span>
      </div>
      <ul className="space-y-2">
        {ITEMS.map((item) => {
          const on = Boolean(checked[item.id]);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-50"
              >
                {on ? (
                  <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                ) : (
                  <Circle size={18} className="mt-0.5 shrink-0 text-zinc-300" />
                )}
                <span className={on ? 'text-zinc-500 line-through' : 'text-zinc-800'}>
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-zinc-400">
        Journée {dayjs(date).format('DD/MM/YYYY')} — cochez chaque contrôle avant validation.
      </p>
    </div>
  );
}
