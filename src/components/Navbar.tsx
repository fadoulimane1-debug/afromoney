import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  ArrowLeftRight,
  Package,
  BarChart2,
  CreditCard,
  History,
  ChevronDown,
  Menu,
  X,
  Download,
  LogOut,
  User,
  Scale,
  CalendarRange,
  Layers,
  Sunrise,
  Moon,
  FileText,
  Calculator,
  Shield,
  ShieldCheck,
  Settings,
  Banknote,
  BookOpen,
  Users,
  Vault,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { hasMinRole } from '@/lib/permissions';
import type { Role } from '@/types';
import { cn } from '@/lib/utils';
import { MandalaMark } from '@/components/MandalaMark';
import { NotificationBell } from '@/components/NotificationBell';
import { RatesBadge } from '@/components/RatesBadge';

export type NavLeaf = {
  to: string;
  label: string;
  icon: React.ElementType;
  emoji?: string;
  description?: string;
  accentClass?: string;
  /** Minimum role required to see this item. Absent = visible to all. */
  minRole?: 'RESPONSABLE' | 'ADMIN';
};

export type NavEntry =
  | { kind: 'link'; to: string; label: string; icon: React.ElementType; minRole?: 'RESPONSABLE' | 'ADMIN' }
  | { kind: 'menu'; title: string; icon: React.ElementType; items: NavLeaf[] };

/** Barre du haut : liens simples + menus avec titres de section. */
export const NAV_STRUCTURE: NavEntry[] = [
  { kind: 'link', to: '/', label: 'Accueil', icon: Home },
  { kind: 'link', to: '/dashboard', label: 'Synthèse', icon: LayoutDashboard },
  {
    kind: 'menu',
    title: '📊 CAISSE DU JOUR',
    icon: CalendarRange,
    items: [
      {
        to: '/journal-journee',
        label: 'OUVERTURE (8h)',
        icon: Sunrise,
        emoji: '🌅',
        description: 'Enregistre le solde d\'ouverture',
        accentClass: 'text-blue-400',
      },
      {
        to: '/caisse',
        label: 'OPÉRATIONS (jour)',
        icon: FileText,
        emoji: '📝',
        description: 'Ajoute toutes les transactions',
        accentClass: 'text-green-400',
      },
      {
        to: '/cloture',
        label: 'CLÔTURE (18h)',
        icon: Moon,
        emoji: '🌙',
        description: 'Ferme la caisse du jour',
        accentClass: 'text-orange-400',
        minRole: 'RESPONSABLE',
      },
      {
        to: '/reconciliation',
        label: 'VÉRIFICATION',
        icon: Scale,
        emoji: '⚖️',
        description: 'Vérifie l\'argent réel vs théorique',
        accentClass: 'text-red-400',
      },
      {
        to: '/journal-caisse',
        label: 'JOURNAL CAISSE',
        icon: BookOpen,
        emoji: '📋',
        description: 'Mouvements immuables — audit Office des Changes',
        accentClass: 'text-purple-400',
        minRole: 'RESPONSABLE',
      },
      {
        to: '/mouvements-coffre',
        label: 'COFFRE',
        icon: Vault,
        emoji: '💰',
        description: 'Alimentations & Prélèvements coffre',
        accentClass: 'text-cyan-400',
        minRole: 'RESPONSABLE',
      },
    ],
  },
  {
    kind: 'menu',
    title: 'Opérations',
    icon: Layers,
    items: [
      {
        to: '/transactions',
        label: 'Historique & saisie',
        icon: ArrowLeftRight,
        emoji: '🔄',
        description: 'Toutes les transactions · Saisie · Filtres avancés',
        accentClass: 'text-indigo-400',
      },
      {
        to: '/stock',
        label: 'Mémoire stocks',
        icon: Package,
        emoji: '📦',
        description: 'Stocks devises · Valorisation MAD',
        accentClass: 'text-emerald-400',
      },
      {
        to: '/credits',
        label: 'Crédits',
        icon: CreditCard,
        emoji: '💳',
        description: 'Opérations à crédit · Suivi encaissements',
        accentClass: 'text-violet-400',
      },
      {
        to: '/clients',
        label: 'Clients',
        icon: Users,
        emoji: '👥',
        description: 'Base clients · Catégorie confiance · Historique',
        accentClass: 'text-blue-400',
      },
      {
        to: '/reliquats',
        label: 'Reliquats',
        icon: Banknote,
        emoji: '⚠️',
        description: 'Créances clients — opérations partielles',
        accentClass: 'text-amber-400',
      },
    ],
  },
  { kind: 'link', to: '/reports', label: 'Bilan & TCD', icon: BarChart2 },
  { kind: 'link', to: '/cotation', label: 'Cotation', icon: Calculator },
  {
    kind: 'menu',
    title: 'Contrôle',
    icon: Shield,
    items: [
      { to: '/audit-trail',  label: 'Audit Trail R1',   icon: ShieldCheck, minRole: 'RESPONSABLE', emoji: '🔍', description: 'Traçabilité complète · hash d\'intégrité', accentClass: 'text-emerald-400' },
      {
        to: '/audit',
        label: 'Journal d\'audit',
        icon: Shield,
        minRole: 'RESPONSABLE',
        emoji: '🛡️',
        description: 'Traçabilité des actions — consultation responsable',
        accentClass: 'text-slate-400',
      },
      {
        to: '/parametres',
        label: 'Paramètres',
        icon: Settings,
        minRole: 'ADMIN',
        emoji: '⚙️',
        description: 'Taux de change · Devises · Configuration agence',
        accentClass: 'text-zinc-400',
      },
      { to: '/utilisateurs', label: 'Utilisateurs',     icon: Users,     minRole: 'ADMIN', emoji: '👥', description: 'Gestion des rôles & accès', accentClass: 'text-violet-400' },
    ],
  },
  { kind: 'link', to: '/clotures-history', label: 'Historique', icon: History },
];

/** Liste plate (ordre de parcours) — pied de page, tests, etc. */
export const NAV_ITEMS: NavLeaf[] = NAV_STRUCTURE.flatMap((e) =>
  e.kind === 'link' ? [{ to: e.to, label: e.label, icon: e.icon }] : e.items
);

function menuIsActive(pathname: string, items: NavLeaf[]) {
  return items.some((i) => (i.to === '/' ? pathname === '/' : pathname === i.to));
}

/* ── Logo mark ── */
function Logo() {
  return (
    <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
      <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/90 p-[2px] shadow-md shadow-black/20 ring-1 ring-white/40 sm:h-8 sm:w-8">
        <MandalaMark className="h-full w-full" plateFill={null} holeFill="#ffffff" />
      </div>
      <div className="leading-none">
        <p className="text-[12px] font-bold tracking-tight text-white sm:text-[13px]">AFROMONEY</p>
        <p className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.16em] text-white/55 sm:text-[9px]">
          Bureau de change
        </p>
      </div>
    </div>
  );
}

/* ── Desktop nav link ── */
function NavItem({ to, label, icon: Icon }: NavLeaf) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 text-[11px] font-medium transition-colors duration-150 sm:text-xs',
          'after:absolute after:bottom-0 after:left-1 after:right-1 after:h-px after:rounded-full after:transition-all after:duration-150',
          isActive
            ? 'text-white after:bg-cyan-400/90'
            : 'text-white/70 hover:text-white after:bg-transparent hover:after:bg-white/25'
        )
      }
    >
      <Icon size={12} strokeWidth={2} className="shrink-0 opacity-90" />
      <span>{label}</span>
    </NavLink>
  );
}

/* ── Desktop menu déroulant (titre de section + sous-liens) ── */
function NavMenuDropdown({
  entry,
  openId,
  setOpenId,
  menuId,
  pathname,
}: {
  entry: Extract<NavEntry, { kind: 'menu' }>;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  menuId: string;
  pathname: string;
}) {
  const open = openId === menuId;
  const active = menuIsActive(pathname, entry.items);
  const wrapRef = useRef<HTMLDivElement>(null);
  const Icon = entry.icon;

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpenId(null);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, setOpenId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenId(null);
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, setOpenId]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpenId(open ? null : menuId)}
        className={cn(
          'relative flex items-center gap-0.5 whitespace-nowrap rounded-md px-1 py-0.5 text-[11px] font-medium transition-colors duration-150 sm:text-xs',
          'after:absolute after:bottom-0 after:left-1 after:right-1 after:h-px after:rounded-full after:transition-all after:duration-150',
          active || open
            ? 'text-white after:bg-cyan-400/90'
            : 'text-white/70 hover:text-white after:bg-transparent hover:after:bg-white/25'
        )}
      >
        <Icon size={12} strokeWidth={2} className="shrink-0 opacity-90" />
        <span>{entry.title}</span>
        <ChevronDown size={11} className={cn('shrink-0 opacity-80 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-[1010] min-w-[20rem] rounded-lg border border-white/12 bg-slate-950/90 py-1 shadow-xl shadow-black/40 backdrop-blur-xl"
          role="menu"
        >
          <p className="border-b border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {entry.title}
          </p>
          <div className="py-1">
            {entry.items.map((item) => {
              const ItemIcon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setOpenId(null)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 transition-colors',
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-200'
                        : 'text-slate-200 hover:bg-white/8 hover:text-white'
                    )
                  }
                  role="menuitem"
                >
                  {item.emoji ? (
                    <span className="shrink-0 text-base leading-none">{item.emoji}</span>
                  ) : (
                    <ItemIcon size={14} strokeWidth={2} className="shrink-0 text-slate-400" />
                  )}
                  <div className="flex min-w-0 flex-col">
                    <span className={cn('text-[12px] font-bold', item.accentClass ?? 'text-slate-200')}>
                      {item.label}
                    </span>
                    {item.description && (
                      <span className="text-[11px] text-slate-500">{item.description}</span>
                    )}
                  </div>
                </NavLink>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── User dropdown (fixed + portal : toujours visible, pas rogné par la navbar) ── */
function UserMenu({ nom, role }: { nom: string; role: string }) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const update = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      const margin = 8;
      setPanelPos({
        top: r.bottom + margin,
        right: Math.max(margin, window.innerWidth - r.right),
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[180px] items-center gap-2 rounded-full border border-white/25 bg-white/10 px-2 py-1 text-xs transition-colors hover:bg-white/15 sm:px-2.5"
      >
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-[10px] font-bold text-white sm:h-7 sm:w-7 sm:text-xs">
          {nom.charAt(0).toUpperCase()}
        </div>
        <div className="hidden min-w-0 text-left sm:block">
          <p className="max-w-[92px] truncate text-[11px] font-semibold leading-none text-white">
            {nom}
          </p>
          <p className="mt-0.5 text-[9px] uppercase tracking-wide text-white/55">{role}</p>
        </div>
        <ChevronDown
          size={12}
          className={cn('shrink-0 text-slate-400 transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[1040]" aria-hidden onClick={() => setOpen(false)} />
            <div
              className="fixed z-[1050] w-[min(13rem,calc(100vw-1rem))] overflow-hidden rounded-xl border border-white/10 bg-slate-800 shadow-2xl shadow-black/40"
              style={{ top: panelPos.top, right: panelPos.right }}
              role="menu"
            >
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-sm font-semibold text-white">{nom}</p>
                <p className="text-xs text-slate-400">{role}</p>
              </div>
              <div className="p-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <User size={14} /> Mon profil
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                >
                  <LogOut size={14} /> Déconnexion
                </button>
              </div>
            </div>
          </>,
          document.body
        )}
    </div>
  );
}

/* ═══════════════════════════════════════
   Navbar principale
═══════════════════════════════════════ */

function filterNavForRole(nav: NavEntry[], userRole: Role): NavEntry[] {
  return nav
    .filter((e) => {
      if (e.kind === 'link') return !e.minRole || hasMinRole(userRole, e.minRole);
      return true; // menus are always shown (their items are filtered)
    })
    .map((e) => {
      if (e.kind === 'menu') {
        return { ...e, items: e.items.filter((i) => !i.minRole || hasMinRole(userRole, i.minRole)) };
      }
      return e;
    })
    .filter((e) => e.kind === 'link' || (e.kind === 'menu' && e.items.length > 0));
}

export function Navbar() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const userRole: Role = currentUser?.role ?? 'CAISSIER';
  const visibleNav = filterNavForRole(NAV_STRUCTURE, userRole);

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenuId(null);
  }, [location.pathname]);

  return (
    <header className="afro-navbar">
      <div className="mx-auto flex w-full max-w-[1600px] min-w-0 items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
        <NavLink to="/" className="shrink-0" onClick={() => setMobileOpen(false)} title="Accueil">
          <Logo />
        </NavLink>

        <nav
          className="mx-1 hidden min-w-0 flex-1 flex-wrap items-center justify-center gap-x-1.5 gap-y-1 sm:gap-x-2 lg:flex"
          aria-label="Navigation principale"
        >
          {visibleNav.map((entry, idx) =>
            entry.kind === 'link' ? (
              <NavItem key={entry.to} to={entry.to} label={entry.label} icon={entry.icon} />
            ) : (
              <NavMenuDropdown
                key={entry.title}
                entry={entry}
                openId={openMenuId}
                setOpenId={setOpenMenuId}
                menuId={`nav-dd-${idx}`}
                pathname={location.pathname}
              />
            )
          )}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          <NavLink
            to="/reports"
            title="Exports & téléchargements"
            className="hidden h-8 items-center gap-1 rounded-full border border-white/35 bg-white/5 px-2.5 text-[11px] font-semibold text-white/90 backdrop-blur-sm transition-colors hover:border-white/50 hover:bg-white/12 md:flex"
          >
            <Download size={12} strokeWidth={2} />
            <span>Exports</span>
          </NavLink>

          <RatesBadge compact className="hidden lg:flex" />

          <NotificationBell />

          <div className="hidden h-5 w-px bg-white/15 sm:block" />

          {currentUser && <UserMenu nom={currentUser.nom} role={currentUser.role} />}

          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="absolute left-0 right-0 top-full z-[1001] max-h-[min(70vh,calc(100dvh-4rem))] overflow-y-auto border-b border-white/10 bg-slate-950/90 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto flex max-w-[1600px] flex-col gap-1 px-4 py-3" aria-label="Navigation mobile">
            {visibleNav.map((entry) =>
              entry.kind === 'link' ? (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.to === '/'}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20'
                        : 'text-slate-400 hover:bg-white/5 hover:text-white'
                    )
                  }
                >
                  <entry.icon size={17} strokeWidth={2} />
                  <span>{entry.label}</span>
                </NavLink>
              ) : (
                <div key={entry.title} className="pt-2 first:pt-0">
                  <p className="flex items-center gap-2 px-4 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <entry.icon size={14} className="text-slate-500" />
                    {entry.title}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {entry.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          end={item.to === '/'}
                          onClick={() => setMobileOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-3 rounded-xl py-2.5 pl-8 pr-4 transition-colors',
                              isActive
                                ? 'bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-500/20'
                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                            )
                          }
                        >
                          {item.emoji ? (
                            <span className="shrink-0 text-base leading-none">{item.emoji}</span>
                          ) : (
                            <Icon size={16} strokeWidth={2} />
                          )}
                          <div className="flex flex-col">
                            <span className={cn('text-sm font-bold', item.accentClass ?? '')}>
                              {item.label}
                            </span>
                            {item.description && (
                              <span className="text-xs text-slate-500">{item.description}</span>
                            )}
                          </div>
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
