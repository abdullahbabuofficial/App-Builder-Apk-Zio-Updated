import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  leading?: ReactNode;
  trailing?: ReactNode;
  fullWidth?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  leading,
  trailing,
  fullWidth,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-0",
        // sizes
        size === "sm" && "h-7 px-2.5 text-[12px]",
        size === "md" && "h-9 px-3.5 text-[13px]",
        size === "lg" && "h-11 px-5 text-[14px]",
        size === "icon" && "h-9 w-9 p-0",
        // variants
        variant === "primary" &&
          "bg-signal text-ink-0 hover:bg-signal-300 active:bg-signal-600 shadow-[0_0_0_1px_rgba(205,255,63,0.18),0_4px_16px_-4px_rgba(205,255,63,0.25)]",
        variant === "secondary" &&
          "border border-line-1 bg-ink-2/60 text-bone hover:border-line-2 hover:bg-ink-3",
        variant === "ghost" &&
          "text-bone-mid hover:bg-ink-3 hover:text-bone",
        variant === "danger" &&
          "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15 hover:border-danger/50",
        variant === "outline" &&
          "border border-line-2 bg-transparent text-bone hover:border-bone-low",
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {leading}
      {children}
      {trailing}
    </button>
  );
}
