import { motion, useReducedMotion } from 'framer-motion'
import { LandingHeader } from '../components/home/LandingHeader'
import { HeroSection } from '../components/home/HeroSection'

const modules = [
  {
    title: 'Opérations de change',
    desc: 'Achat, vente, dépôt, retrait et charges — aligné sur vos feuilles mensuelles.',
  },
  {
    title: 'Caisse & stock',
    desc: 'Caisse départ MAD, suivi par devise, valorisation et alertes de position.',
  },
  {
    title: 'Bilans & rapports',
    desc: 'Bilan mensuel, totaux, marges et base pour transmission automatique des comptes rendus.',
  },
  {
    title: 'Crédits (phase 2)',
    desc: 'Encours client, statuts de paiement et lien avec les ventes — au-delà des simples notes.',
  },
]

export function HomePage() {
  const reduce = useReducedMotion()

  return (
    <div className="min-h-svh bg-zinc-100">
      <LandingHeader />
      <HeroSection />

      <section
        id="fonctionnalites"
        className="relative border-t border-zinc-200 bg-zinc-50 py-20"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-zinc-900 sm:text-3xl">
            Fonctionnalités prévues
          </h2>
          <p className="mt-2 max-w-2xl text-zinc-600">
            Dérivées de vos fichiers Excel AFROMONEY — même logique métier, interface moderne
            et données centralisées.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((m, i) => (
              <motion.article
                key={m.title}
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ delay: i * 0.06, duration: 0.45 }}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <h3 className="font-display font-semibold text-zinc-900">{m.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{m.desc}</p>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      <section id="modules" className="border-t border-zinc-200 bg-zinc-100 py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-zinc-600">
            Prochaine étape : import des paramètres depuis vos classeurs et écrans de saisie
            transaction.
          </p>
        </div>
      </section>

      <footer
        id="contact"
        className="border-t border-zinc-200 bg-zinc-100 py-10 text-center text-sm text-zinc-600"
      >
        <p>AFROMONEY — prototype interface · {new Date().getFullYear()}</p>
        <p id="connexion" className="mt-2">
          Espace connexion à brancher sur votre backend.
        </p>
      </footer>
    </div>
  )
}
