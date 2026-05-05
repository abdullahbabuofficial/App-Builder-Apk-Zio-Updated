type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string; // for screen readers
  showState?: boolean; // also render "ON"/"OFF" text alongside
};

// Self-contained switch — visually a track + knob, with optional ON/OFF
// affordance for older users who appreciate explicit state.
export function Switch({ checked, onChange, disabled, label, showState }: Props) {
  return (
    <div className="inline-flex items-center gap-2">
      {showState ? (
        <span
          className={
            "select-none text-[11px] font-medium uppercase tracking-wider " +
            (checked ? "text-signal" : "text-bone-low")
          }
          aria-hidden
        >
          {checked ? "On" : "Off"}
        </span>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={
          "relative inline-flex h-[24px] w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50 " +
          (checked
            ? "border-signal/40 bg-signal/30 shadow-[inset_0_0_0_1px_rgba(205,255,63,0.25)]"
            : "border-line-2 bg-ink-3")
        }
      >
        <span
          className={
            "inline-block h-[18px] w-[18px] transform rounded-full transition-transform " +
            (checked
              ? "translate-x-[22px] bg-signal shadow-[0_0_8px_rgba(205,255,63,0.5)]"
              : "translate-x-0.5 bg-bone-mid")
          }
        />
      </button>
    </div>
  );
}
