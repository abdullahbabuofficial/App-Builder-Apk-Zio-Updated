import { Switch } from "./Switch";

type Props = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
};

// One row in the categories list. Whole row is clickable so finger targets are
// generous on mobile.
export function CategoryToggle({ label, description, checked, onChange, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="flex w-full items-start justify-between gap-4 rounded-md p-3 text-left transition-colors hover:bg-ink-2/60 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-1"
    >
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium leading-tight text-bone">{label}</div>
        <div className="mt-1 text-[12px] leading-relaxed text-bone-mid">{description}</div>
      </div>
      <div className="pt-0.5">
        {/* Inner switch is purely visual — the parent row owns the click. */}
        <span aria-hidden>
          <Switch checked={checked} onChange={onChange} label={label} />
        </span>
      </div>
    </button>
  );
}
