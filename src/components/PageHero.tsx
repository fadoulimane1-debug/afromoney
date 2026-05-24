import type { ReactNode } from 'react';

interface PageHeroProps {
  title: string;
  subtitle: string;
  /** Boutons / contrôles affichés en bas du hero */
  actions?: ReactNode;
  /** Hero plus haut (420px desktop) — utilisé sur le Dashboard */
  tall?: boolean;
  /**
   * URL de l'image de fond. Quand fournie, remplace le background-image CSS.
   * Préférer l'import Vite : `import img from '@/assets/devises-background.jpg'`
   * plutôt qu'un path public, pour que Vite valide l'existence à la compilation.
   */
  bgImage?: string;
}

export function PageHero({ title, subtitle, actions, tall, bgImage }: PageHeroProps) {
  return (
    <section className={tall ? 'page-hero page-hero--tall' : 'page-hero'}>
      {bgImage ? (
        <div
          className="page-hero-img"
          aria-hidden
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      ) : null}

      <div className="page-hero-body">
        <span className="page-hero-badge">✦ AFROMONEY · BUREAU DE CHANGE ✦</span>
        <h1 className="page-hero-title">{title}</h1>
        <p className="page-hero-subtitle">{subtitle}</p>
        {actions && <div className="page-hero-actions">{actions}</div>}
      </div>
    </section>
  );
}
