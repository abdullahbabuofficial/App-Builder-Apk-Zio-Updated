import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Crumb = { label: ReactNode; to?: string };

export function PageHeader({
  eyebrow,
  title,
  description,
  crumbs,
  actions,
  trailing,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 sm:mb-8", className)}>
      {(crumbs?.length || eyebrow) && (
        <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-low">
          {eyebrow && <span>{eyebrow}</span>}
          {crumbs?.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 || eyebrow ? <Icon.ChevronRight size={10} className="text-bone-dim" /> : null}
              {c.to ? (
                <Link to={c.to} className="text-bone-mid hover:text-bone">
                  {c.label}
                </Link>
              ) : (
                <span className="text-bone-mid">{c.label}</span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-bone sm:text-[34px]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-2xl text-[14px] text-bone-mid sm:text-[15px]">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {trailing}
    </div>
  );
}

export function SectionTitle({
  title,
  description,
  trailing,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div>
        <div className="font-display text-[16px] font-semibold leading-tight text-bone">{title}</div>
        {description && <div className="mt-1 text-[13px] text-bone-mid">{description}</div>}
      </div>
      {trailing}
    </div>
  );
}
