/**
 * Motif circulaire 8 boucles entrelacées (alternance cyan / ardoise),
 * proche du logo « mandala / nœud » demandé — pas le picto atome React classique.
 */
export function MandalaMark({
  className,
  plateFill = '#ffffff',
  holeFill = '#ffffff',
}: {
  className?: string;
  /** Fond carré arrondi (ex. blanc pour favicon / onglet). */
  plateFill?: string | null;
  /** Couleur du disque central (trou ou pastille selon le fond). */
  holeFill?: string;
}) {
  const angles = [0, 45, 90, 135, 180, 225, 270, 315] as const;
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {plateFill != null ? <rect width="32" height="32" rx="8" fill={plateFill} /> : null}
      <g transform="translate(16,16)" fill="none" strokeLinecap="round" strokeWidth="1.72">
        {angles.map((deg, i) => (
          <ellipse
            key={deg}
            rx="11.35"
            ry="4.18"
            stroke={i % 2 === 0 ? '#22d3ee' : '#1e293b'}
            transform={`rotate(${deg})`}
          />
        ))}
      </g>
      <circle cx="16" cy="16" r="4.15" fill={holeFill} />
    </svg>
  );
}
