import { motion, useReducedMotion } from 'framer-motion'

const nav = [
  { label: 'Accueil', href: '#' },
  { label: 'Fonctionnalités', href: '#fonctionnalites' },
  { label: 'Modules', href: '#modules' },
  { label: 'Contact', href: '#contact' },
]

export function LandingHeader() {
  const reduce = useReducedMotion()

  return (
    <motion.header
      initial={reduce ? false : { y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 border-b border-zinc-200/90 bg-white/90 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a href="#" className="flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 place-content-center rounded-xl border border-zinc-300 bg-gradient-to-br from-zinc-100 via-zinc-200 to-zinc-400 text-sm font-black text-zinc-900 shadow-md"
            aria-hidden
          >
            A
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-zinc-900">
            AFROMONEY
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Principal">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#contact"
            className="hidden rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50 sm:inline-flex"
          >
            Téléchargements
          </a>
          <a
            href="#connexion"
            className="rounded-full bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:from-blue-500 hover:to-blue-600"
          >
            Connexion
          </a>
        </div>
      </div>
    </motion.header>
  )
}
