import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type PopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  align?: "left" | "right";
  width?: number;
  children: ReactNode;
};

export function Popover({
  open,
  onOpenChange,
  trigger,
  align = "right",
  width = 320,
  children,
}: PopoverProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onOpenChange(false);
      }
    };
    const onDown = (e: MouseEvent) => {
      const node = wrapRef.current;
      if (!node) return;
      if (e.target instanceof Node && !node.contains(e.target)) {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={wrapRef} className="relative inline-flex">
      {trigger}
      {open && (
        <div
          role="menu"
          style={{ width }}
          className={cn(
            "absolute top-full z-40 mt-2 rounded-lg border border-line-1 bg-ink-1 shadow-raise animate-fade-in",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
