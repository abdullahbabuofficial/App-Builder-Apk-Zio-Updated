import type { LucideIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Link } from '../router';
import { cn } from '../ui/utils';

export type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; to?: string };
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/10 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <div className="relative mb-5 grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
          <span
            aria-hidden
            className="absolute inset-0 -z-10 rounded-full bg-primary/10 blur-xl"
          />
          <Icon className="h-7 w-7" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6">
          {action.to ? (
            <Link to={action.to}>
              <Button className="bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90">
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button
              onClick={action.onClick}
              className="bg-gradient-to-r from-primary to-secondary text-primary-foreground hover:opacity-90"
            >
              {action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
