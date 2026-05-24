import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { runCoherenceAudit, type CoherenceIssue } from '@/lib/coherenceAudit';

function IssueIcon({ level }: { level: CoherenceIssue['level'] }) {
  if (level === 'error') return <AlertTriangle size={14} className="shrink-0 text-red-600" />;
  if (level === 'warn') return <AlertTriangle size={14} className="shrink-0 text-amber-600" />;
  return <Info size={14} className="shrink-0 text-cyan-600" />;
}

export function CoherenceAuditPanel() {
  const issues = useMemo(() => runCoherenceAudit(), []);
  const errors = issues.filter((i) => i.level === 'error');
  const warns = issues.filter((i) => i.level === 'warn');

  return (
    <Card className="border-zinc-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
          {errors.length === 0 ? (
            <CheckCircle2 size={16} className="text-emerald-600" />
          ) : (
            <AlertTriangle size={16} className="text-red-600" />
          )}
          Cohérence données
          <span className="text-xs font-normal text-zinc-500">
            stock · caisse · crédits · annulations
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {errors.length === 0 && warns.length === 0 && (
          <p className="text-xs text-emerald-700">Aucune incohérence bloquante détectée.</p>
        )}
        <ul className="space-y-1.5">
          {issues.map((issue) => (
            <li
              key={issue.code}
              className={`flex gap-2 rounded-md px-2 py-1.5 text-xs ${
                issue.level === 'error'
                  ? 'bg-red-50 text-red-900'
                  : issue.level === 'warn'
                    ? 'bg-amber-50 text-amber-900'
                    : 'bg-zinc-50 text-zinc-700'
              }`}
            >
              <IssueIcon level={issue.level} />
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
