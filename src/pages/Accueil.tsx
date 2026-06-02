import { Link } from 'react-router-dom';
import { PageHero } from '@/components/PageHero';
import { Logo } from '@/components/Logo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LayoutDashboard,
  Banknote,
  ArrowLeftRight,
  ClipboardCheck,
  BarChart2,
  ArrowRight,
  Calculator,
  Shield,
} from 'lucide-react';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');
const LIENS_RAPIDES = [
  {
    to: '/dashboard',
    title: 'Synthèse',
    desc: 'Indicateurs du jour, KPIs et graphiques — tableau de bord opérationnel.',
    icon: LayoutDashboard,
  },
  {
    to: '/caisse',
    title: 'Caisse jour',
    desc: 'Suivi journalier aligné feuille CAISSE V8.',
    icon: Banknote,
  },
  {
    to: '/transactions',
    title: 'Historique & saisie',
    desc: 'Saisie et consultation des mouvements.',
    icon: ArrowLeftRight,
  },
  {
    to: '/cloture',
    title: 'Clôture',
    desc: 'Contrôle et validation de fin de journée.',
    icon: ClipboardCheck,
  },
  {
    to: '/reports',
    title: 'Bilan & TCD',
    desc: 'Rapports et exports.',
    icon: BarChart2,
  },
  {
    to: '/cotation',
    title: 'Cotation rapide',
    desc: 'Convertisseur achat / vente sans enregistrer de ligne.',
    icon: Calculator,
  },
  {
    to: '/audit',
    title: "Journal d'audit",
    desc: 'Historique des actions sensibles et export CSV.',
    icon: Shield,
  },
] as const;
export function Accueil() {
  const now = dayjs();
  return (
    <div>
      <PageHero
        title="Accueil"
        subtitle={`${now.format('dddd D MMMM YYYY')} — point d'entrée AFROMONEY · accédez à la synthèse ou aux modules ci-dessous.`}
        actions={
          <Link
            to="/dashboard"
            className="btn-gradient inline-flex items-center gap-1.5"
          >
            Ouvrir la synthèse <ArrowRight size={14} />
          </Link>
        }
      />
      <div className="page-content">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-6 flex justify-center">
            <Logo size="md" className="drop-shadow" />
          </div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-600">
            Accès rapides
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LIENS_RAPIDES.map(({ to, title, desc, icon: Icon }) => (
              <Link key={to} to={to} className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                <Card className="h-full border-zinc-200/80 bg-white/80 shadow-sm backdrop-blur-sm transition-all group-hover:border-cyan-300/50 group-hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-700">
                        <Icon size={18} strokeWidth={2} />
                      </span>
                      <CardTitle className="text-base font-semibold text-zinc-900">{title}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs leading-relaxed text-zinc-600">{desc}</p>
                    <p className="mt-3 flex items-center gap-1 text-xs font-medium text-cyan-700 group-hover:text-cyan-600">
                      Ouvrir <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
