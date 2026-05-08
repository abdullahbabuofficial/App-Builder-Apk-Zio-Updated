import type { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  flush?: boolean; // remove default padding
  raised?: boolean;
};

export function Card({ className, flush, raised, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line-1 bg-ink-1",
        raised ? "shadow-raise" : "shadow-panel",
        flush ? "" : "",
        className
      )}
      {...rest}
    />
  );
}

export function CardHeader({
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
    <div className={cn("flex items-start justify-between gap-4 border-b border-line-1 p-5 sm:p-6", className)}>
      <div className="min-w-0">
        <div className="font-display text-[18px] font-semibold leading-tight text-bone">{title}</div>
        {description && <div className="mt-1 text-[13px] text-bone-mid">{description}</div>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

export function CardBody({ className, children, padded = true }: { className?: string; children: ReactNode; padded?: boolean }) {
  return <div className={cn(padded && "p-5 sm:p-6", className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-t border-line-1 px-5 py-3.5 sm:px-6", className)}>
      {children}
    </div>
  );
}
