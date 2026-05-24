import { Link } from 'react-router-dom';
import { AlertTriangle, Info, XCircle, ChevronRight } from 'lucide-react';
import { computeProAlerts, type AlertLevel, type ProAlert } from '@/lib/alerts';

const LEVEL_STYLE: Record<AlertLevel, { icon: typeof Info; ring: string; bg: string }> = {
  info: { icon: Info, ring: 'border-blue-200 bg-blue-50', bg: 'text-blue-700' },
  warning: { icon: AlertTriangle, ring: 'border-amber-200 bg-amber-50', bg: 'text-amber-800' },
  error: { icon: XCircle, ring: 'border-red-200 bg-red-50', bg: 'text-red-800' },
};

export function AlertsPanel({ max = 6 }: { max?: number }) {
  const alerts = computeProAlerts().slice(0, max);

  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
        Aucune alerte active — contrôles du jour OK.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {alerts.map((a) => (
        <AlertRow key={a.id} alert={a} />
      ))}
    </ul>
  );
}

function AlertRow({ alert }: { alert: ProAlert }) {
  const cfg = LEVEL_STYLE[alert.level];
  const Icon = cfg.icon;
  const inner = (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${cfg.ring}`}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${cfg.bg}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${cfg.bg}`}>{alert.title}</p>
        <p className="text-xs text-zinc-600">{alert.message}</p>
      </div>
      {alert.href && <ChevronRight size={16} className="shrink-0 text-zinc-400" />}
    </div>
  );

  if (alert.href) {
    return (
      <li>
        <Link to={alert.href} className="block transition-opacity hover:opacity-90">
          {inner}
        </Link>
      </li>
    );
  }
  return <li>{inner}</li>;
}
