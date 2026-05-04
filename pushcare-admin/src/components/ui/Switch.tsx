import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md";
  className?: string;
};

export function Switch({ checked, onChange, disabled, label, size = "md", className }: Props) {
  const w = size === "sm" ? "w-8 h-[18px]" : "w-10 h-[22px]";
  const knob = size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]";
  const t = size === "sm" ? (checked ? "translate-x-3.5" : "translate-x-0.5") : (checked ? "translate-x-[18px]" : "translate-x-0.5");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        w,
        checked
          ? "border-signal/40 bg-signal/30 shadow-[inset_0_0_0_1px_rgba(205,255,63,0.25)]"
          : "border-line-2 bg-ink-3",
        className
      )}
    >
      <span
        className={cn(
          "inline-block transform rounded-full transition-transform",
          knob,
          t,
          checked ? "bg-signal shadow-[0_0_8px_rgba(205,255,63,0.5)]" : "bg-bone-mid"
        )}
      />
    </button>
  );
}
