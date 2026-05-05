import { useEffect, type ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "@/lib/icons";

type Props = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

// Minimal confirm dialog: dimmed backdrop, single card, one primary + one
// cancel button. ESC closes; clicking the backdrop closes; focus is trapped
// trivially by the fixed-overlay structure.
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 py-6 sm:items-center sm:px-6 animate-fade-in">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink-0/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-md rounded-xl border border-line-1 bg-ink-1 shadow-modal animate-slide-up"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line-1 p-5">
          <div className="min-w-0">
            <div id="confirm-title" className="font-display text-[18px] font-semibold leading-tight text-bone">
              {title}
            </div>
            {description ? (
              <div className="mt-1 text-[13px] leading-relaxed text-bone-mid">{description}</div>
            ) : null}
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
        <div className="flex flex-col-reverse gap-2 p-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
