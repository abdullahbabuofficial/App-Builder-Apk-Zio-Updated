import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
  leading?: ReactNode;
};

// Stripped-down version of the admin Button — same look, fewer knobs.
export function Button({
  variant = "secondary",
  fullWidth,
  leading,
  className = "",
  children,
  type = "button",
  ...rest
}: Props) {
  const variantCls =
    variant === "primary"
      ? "bg-signal text-ink-0 hover:bg-signal-300 active:bg-signal-600 shadow-[0_0_0_1px_rgba(205,255,63,0.18),0_4px_16px_-4px_rgba(205,255,63,0.25)]"
      : variant === "danger"
      ? "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/15 hover:border-danger/60"
      : variant === "ghost"
      ? "text-bone-mid hover:bg-ink-3 hover:text-bone"
      : // secondary
        "border border-line-1 bg-ink-2/60 text-bone hover:border-line-2 hover:bg-ink-3";

  return (
    <button
      type={type}
      className={
        "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-[13px] font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-0 " +
        variantCls +
        (fullWidth ? " w-full" : "") +
        " " +
        className
      }
      {...rest}
    >
      {leading}
      {children}
    </button>
  );
}
