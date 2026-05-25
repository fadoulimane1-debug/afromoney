const SIZES = {
  sm: 'w-8 h-8',
  md: 'w-14 h-14',
  lg: 'w-28 h-28',
} as const;

interface LogoProps {
  size?: keyof typeof SIZES;
  className?: string;
}

export function Logo({ size = 'md', className = '' }: LogoProps) {
  return (
    <img
      src="/images/afromoney-logo.png"
      alt="AFROMONEY"
      className={`${SIZES[size]} object-contain ${className}`}
      draggable={false}
    />
  );
}
