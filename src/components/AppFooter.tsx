import { NavLink } from 'react-router-dom';
import { ChevronUp, Share2, PlayCircle, Mail, Phone } from 'lucide-react';
import { MandalaMark } from '@/components/MandalaMark';
import { NAV_STRUCTURE } from '@/components/Navbar';

/** Textes fictifs — à remplacer par vos coordonnées réelles. */
const PLACEHOLDER_ADDRESS =
  'Adresse du bureau à compléter — ex. : avenue …, immeuble …, Casablanca';

const PLACEHOLDER_EMAIL = 'contact@exemple.ma';
const PLACEHOLDER_FIXE = '+212 (0) … … … … (à compléter)';
const PLACEHOLDER_MOBILE = '+212 (0)6 … … … … (à compléter)';

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function AppFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0c1222] text-slate-300">
      <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-5 sm:py-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-3">
          {/* Marque */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded bg-white/95 p-[1px] ring-1 ring-white/30">
                <MandalaMark className="h-full w-full" plateFill={null} holeFill="#ffffff" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-tight text-white">AFROMONEY</p>
                <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Bureau de change
                </p>
              </div>
            </div>
            <p className="text-[10px] leading-snug text-slate-400">
              Suivi caisse &amp; devises — V8 (local).
            </p>
          </div>

          {/* Adresse */}
          <div>
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              Adresse
            </h3>
            <p className="text-[11px] leading-snug text-slate-400">{PLACEHOLDER_ADDRESS}</p>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
              Contacts
            </h3>
            <ul className="space-y-1 text-[11px] leading-tight">
              <li className="flex items-start gap-1.5">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400/90" aria-hidden />
                <a
                  href={`mailto:${PLACEHOLDER_EMAIL}`}
                  className="text-cyan-300/95 transition-colors hover:text-cyan-200"
                >
                  {PLACEHOLDER_EMAIL}
                </a>
              </li>
              <li className="flex items-start gap-1.5">
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                <span>
                  <span className="text-slate-500">Fixe · </span>
                  {PLACEHOLDER_FIXE}
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                <span>
                  <span className="text-slate-500">Mobile · </span>
                  <span className="text-cyan-300/95">{PLACEHOLDER_MOBILE}</span>
                </span>
              </li>
            </ul>
          </div>

          {/* Menu — texte sur 2 colonnes pour réduire la hauteur */}
          <div className="min-w-0">
            <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">Menu</h3>
            <ul className="columns-2 gap-x-4 text-[10px] leading-tight sm:text-[11px]">
              {NAV_STRUCTURE.map((entry) =>
                entry.kind === 'link' ? (
                  <li key={entry.to} className="mb-1 break-inside-avoid">
                    <NavLink
                      to={entry.to}
                      end={entry.to === '/'}
                      className={({ isActive }) =>
                        isActive
                          ? 'font-medium text-white'
                          : 'text-cyan-300/90 transition-colors hover:text-cyan-200'
                      }
                    >
                      {entry.label}
                    </NavLink>
                  </li>
                ) : (
                  <li key={entry.title} className="mb-2 break-inside-avoid">
                    <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                      {entry.title}
                    </p>
                    <ul className="space-y-0.5 border-l border-white/10 pl-2">
                      {entry.items.map((item) => (
                        <li key={item.to}>
                          <NavLink
                            to={item.to}
                            className={({ isActive }) =>
                              isActive
                                ? 'font-medium text-white'
                                : 'text-cyan-300/90 transition-colors hover:text-cyan-200'
                            }
                          >
                            {item.label}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </li>
                )
              )}
            </ul>
          </div>
        </div>

        {/* Bas : réseaux + copyright + retour haut */}
        <div className="mt-3 flex flex-col items-center gap-2 border-t border-white/10 pt-3 sm:flex-row sm:justify-between sm:gap-3">
          <div className="flex items-center gap-2 sm:items-center">
            <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-slate-500">Suivez-nous</p>
            <div className="flex items-center gap-1.5">
              <a
                href="#"
                aria-label="Réseau social (lien à configurer)"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-400 transition-colors hover:border-cyan-400/40 hover:bg-white/10 hover:text-cyan-300"
                onClick={(e) => e.preventDefault()}
              >
                <Share2 className="h-3 w-3" strokeWidth={1.75} />
              </a>
              <a
                href="#"
                aria-label="Vidéos (lien à configurer)"
                className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/5 text-slate-400 transition-colors hover:border-cyan-400/40 hover:bg-white/10 hover:text-cyan-300"
                onClick={(e) => e.preventDefault()}
              >
                <PlayCircle className="h-3 w-3" strokeWidth={1.75} />
              </a>
            </div>
          </div>

          <p className="order-last max-w-lg text-center text-[9px] leading-snug text-slate-500 sm:order-none sm:flex-1 sm:px-2">
            © {new Date().getFullYear()} AFROMONEY — Données locales · Coordonnées à compléter.
          </p>

          <button
            type="button"
            onClick={scrollToTop}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/15 bg-white/5 text-white transition-colors hover:border-cyan-400/50 hover:bg-white/10"
            aria-label="Retour en haut de page"
          >
            <ChevronUp className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </footer>
  );
}
