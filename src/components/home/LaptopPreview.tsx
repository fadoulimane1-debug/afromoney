import { motion, useReducedMotion } from 'framer-motion'
import { DISPLAY_CURRENCIES } from '../../data/currencies'

export function LaptopPreview() {
  const reduce = useReducedMotion()

  return (
    <div className="relative w-full max-w-[560px]">
      <motion.div
        initial={reduce ? false : { rotateX: 10, rotateY: -8 }}
        animate={{ rotateX: 5, rotateY: -4 }}
        transition={{ type: 'spring', stiffness: 55, damping: 16 }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative drop-shadow-[0_40px_80px_rgba(0,0,0,0.65)]"
      >
        {/* Anneau lumineux */}
        <div className="absolute -inset-[2px] rounded-t-2xl bg-gradient-to-br from-white/25 via-blue-400/20 to-transparent opacity-80 blur-[2px]" />

        <div className="relative rounded-t-2xl border border-zinc-500/90 bg-gradient-to-b from-zinc-600 via-zinc-800 to-zinc-950 p-[11px] shadow-[0_32px_100px_-20px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.12)]">
          <div className="overflow-hidden rounded-[10px] border border-zinc-700/80 bg-zinc-100 shadow-[inset_0_2px_12px_rgba(0,0,0,0.15)]">
            <div className="flex h-9 items-center gap-2 border-b border-zinc-300/90 bg-gradient-to-b from-zinc-200 to-zinc-300/90 px-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57] shadow-sm" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e] shadow-sm" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840] shadow-sm" />
              <span className="ml-2 flex-1 truncate text-center text-[11px] font-semibold tracking-tight text-zinc-600">
                AFROMONEY — Taux du jour
              </span>
            </div>

            <div className="flex min-h-[300px] bg-gradient-to-br from-white to-zinc-100 sm:min-h-[340px]">
              <aside className="hidden w-[9.5rem] shrink-0 border-r border-zinc-200/90 bg-zinc-50/95 p-2.5 sm:block">
                <div className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-2.5 py-2 text-[10px] font-bold uppercase tracking-wide text-white shadow-md shadow-blue-900/30">
                  Tableau de bord
                </div>
                <div className="mt-2 space-y-0.5 text-[10px] font-medium text-zinc-600">
                  {['Caisse', 'Transactions', 'Stock', 'Crédits', 'Rapports'].map((item) => (
                    <div
                      key={item}
                      className="rounded-md px-2 py-1.5 transition hover:bg-zinc-200/90"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </aside>

              <div className="flex-1 p-2.5 sm:p-3.5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    Cours applicables
                  </span>
                  <span className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600 shadow-sm">
                    Contre MAD
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DISPLAY_CURRENCIES.map((c, i) => (
                    <motion.div
                      key={c.code}
                      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.28 + i * 0.035, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="group rounded-xl border border-zinc-200/90 bg-white/90 p-2 shadow-[0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-black/[0.03] transition hover:shadow-md"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none drop-shadow-sm">{c.flag}</span>
                        <div className="min-w-0">
                          <div className="text-[12px] font-extrabold tracking-tight text-zinc-900">
                            {c.code}
                          </div>
                          <div className="truncate text-[9px] font-medium text-zinc-500">
                            {c.label}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-1.5 rounded-lg bg-zinc-50/90 p-1.5 text-[9px]">
                        <div>
                          <div className="font-medium text-zinc-400">Achat</div>
                          <div className="font-bold tabular-nums text-zinc-800">{c.buy}</div>
                        </div>
                        <div>
                          <div className="font-medium text-zinc-400">Vente</div>
                          <div className="font-bold tabular-nums text-emerald-700">{c.sell}</div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Base + reflet */}
        <div className="relative h-4 overflow-hidden rounded-b-xl bg-gradient-to-b from-zinc-800 to-black shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        </div>
        <div
          className="pointer-events-none mx-auto mt-3 h-16 max-w-[85%] rounded-[100%] bg-gradient-to-b from-blue-500/15 to-transparent blur-2xl"
          aria-hidden
        />
      </motion.div>
    </div>
  )
}
