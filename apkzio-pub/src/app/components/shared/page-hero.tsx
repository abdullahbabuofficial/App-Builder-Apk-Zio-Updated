import type { LucideIcon } from 'lucide-react';
import { cn } from '../ui/utils';

export type PageHeroProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  align?: 'center' | 'left';
  size?: 'sm' | 'md' | 'lg';
  children?: React.ReactNode;
  className?: string;
};

const sizeMap = {
  sm: {
    section: 'py-12 md:py-16',
    title: 'text-3xl md:text-4xl',
    description: 'text-sm md:text-base',
    iconWrap: 'h-12 w-12 rounded-xl',
    iconSize: 'h-6 w-6',
  },
  md: {
    section: 'py-16 md:py-20',
    title: 'text-4xl md:text-5xl',
    description: 'text-base md:text-lg',
    iconWrap: 'h-14 w-14 rounded-2xl',
    iconSize: 'h-7 w-7',
  },
  lg: {
    section: 'py-20 md:py-28',
    title: 'text-4xl md:text-6xl',
    description: 'text-lg md:text-xl',
    iconWrap: 'h-16 w-16 rounded-2xl',
    iconSize: 'h-8 w-8',
  },
};

export function PageHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  align = 'center',
  size = 'md',
  children,
  className,
}: PageHeroProps) {
  const tokens = sizeMap[size];
  const isCenter = align === 'center';

  return (
    <section
      className={cn(
        'relative overflow-hidden bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5',
        tokens.section,
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-accent/10 blur-3xl"
      />

      <div
        className={cn(
          'relative mx-auto max-w-5xl px-4 lg:px-6',
          isCenter ? 'text-center' : 'text-left',
        )}
      >
        {Icon && (
          <div
            className={cn(
              'mb-5 grid place-items-center bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-lg shadow-primary/20',
              tokens.iconWrap,
              isCenter && 'mx-auto',
            )}
          >
            <Icon className={tokens.iconSize} />
          </div>
        )}

        {eyebrow && (
          <span
            className={cn(
              'inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary',
              isCenter ? 'mx-auto' : '',
            )}
          >
            {eyebrow}
          </span>
        )}

        <h1
          className={cn(
            'mt-4 bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text font-semibold leading-tight tracking-tight text-transparent',
            tokens.title,
          )}
        >
          {title}
        </h1>

        {description && (
          <p
            className={cn(
              'mt-4 leading-relaxed text-muted-foreground',
              tokens.description,
              isCenter ? 'mx-auto max-w-2xl' : 'max-w-2xl',
            )}
          >
            {description}
          </p>
        )}

        {children && (
          <div className={cn('mt-6', isCenter && 'flex justify-center')}>{children}</div>
        )}
      </div>
    </section>
  );
}
