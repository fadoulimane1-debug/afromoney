import { motion, useReducedMotion } from 'framer-motion'
import { LaptopPreview } from './LaptopPreview'

/** Fond local : affiché sans aucun filtre ni calque par-dessus. */
const HERO_IMAGE = '/hero-coins.png'

export function HeroSection() {
  const reduce = useReducedMotion()

  return (
    <section className="relative min-h-svh overflow-hidden bg-zinc-100 pt-16">
      {/* Image plein écran, nette à 100 % */}
      <div
        className="absolute inset-0 bg-cover bg-[center_52%] bg-no-repeat sm:bg-center"
        style={{ backgroundImage: `url(${HERO_IMAGE})` }}
        role="img"
        aria-label="Pièces et billets"
      />

      <div className="relative z-10 mx-auto grid max-w-7xl gap-12 px-4 pb-24 pt-12 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-10 lg:px-8 lg:pt-16">
        {/* Carte lisible sur photo : ne masque pas l’arrière-plan hors de la carte */}
        <div className="rounded-3xl border border-zinc-200/90 bg-white/95 p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] backdrop-blur-sm sm:p-8">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-900">
              Gestion bureau de change
            </span>
          </motion.div>

          <motion.h1
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-[2.35rem] font-extrabold leading-[1.02] tracking-[-0.04em] text-zinc-900 sm:text-5xl lg:text-[3.5rem] xl:text-[4rem]"
          >
            <span className="block">Change manuel</span>
            <span className="mt-1 block bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 bg-clip-text text-transparent">
              caisse, stock &amp; crédits
            </span>
          </motion.h1>

          <div className="mx-auto mt-6 h-px max-w-xs bg-gradient-to-r from-transparent via-zinc-300 to-transparent lg:mx-0" />

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.55 }}
            className="mt-6 max-w-lg text-base leading-relaxed text-zinc-600 sm:text-lg"
          >
            Une suite pensée pour la vitrine : opérations multi-devises, caisse MAD, stock
            valorisé, bilans mensuels — et une trajectoire claire vers la{' '}
            <span className="font-semibold text-zinc-900">gestion des crédits</span>, alignée
            sur vos classeurs AFROMONEY.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, duration: 0.5 }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <a
              href="#modules"
              className="group relative inline-flex items-center justify-center overflow-hidden rounded-full bg-blue-600 px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700"
            >
              <span className="relative z-10">Découvrir les modules</span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition group-hover:translate-x-full duration-700" />
            </a>
            <a
              href="#fonctionnalites"
              className="inline-flex items-center justify-center rounded-full border-2 border-zinc-300 bg-white px-8 py-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50"
            >
              Voir la démo
            </a>
          </motion.div>

          <motion.ul
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.34, duration: 0.5 }}
            className="mt-11 flex flex-wrap gap-x-10 gap-y-3 text-sm text-zinc-700"
          >
            {[
              'Multi-devises',
              'Journal & bilans',
              'Crédit client (roadmap)',
            ].map((label) => (
              <li key={label} className="flex items-center gap-2.5">
                <span className="grid h-5 w-5 place-content-center rounded-full border border-emerald-300 bg-emerald-100 text-[10px] font-bold text-emerald-800">
                  ✓
                </span>
                {label}
              </li>
            ))}
          </motion.ul>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, x: 48, rotateY: -8 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ delay: 0.1, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex justify-center lg:justify-end"
          style={{ perspective: 1200 }}
        >
          <LaptopPreview />
        </motion.div>
      </div>
    </section>
  )
}
