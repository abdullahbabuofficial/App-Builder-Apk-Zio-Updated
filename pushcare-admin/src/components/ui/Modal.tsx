import { useEffect, type ReactNode } from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function Modal({ open, onClose, title, description, children, footer, size = "md", className }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const w = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-6 animate-fade-in">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-0/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full rounded-xl border border-line-1 bg-ink-1 shadow-modal animate-slide-up",
          w,
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-1 p-5">
          <div className="min-w-0">
            <div className="font-display text-[18px] font-semibold leading-tight">{title}</div>
            {description && <div className="mt-1 text-[13px] text-bone-mid">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-bone-low hover:bg-ink-3 hover:text-bone"
            aria-label="Close"
          >
            <Icon.X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line-1 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
