import type { PauseDuration } from "@/lib/api";

type Option = { key: PauseDuration; label: string };

const OPTIONS: Option[] = [
  { key: "off", label: "Off" },
  { key: "1h", label: "1 hour" },
  { key: "1d", label: "1 day" },
  { key: "1w", label: "1 week" },
  { key: "forever", label: "Forever" },
];

type Props = {
  value: PauseDuration;
  onChange: (v: PauseDuration) => void;
  disabled?: boolean;
};

// 5-option segmented control. On a 360px viewport we wrap to two rows; on
// 480px+ everything fits on one line. Keyboard navigation is just standard
// Tab — each option is a real button.
export function PauseControl({ value, onChange, disabled }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="How long to pause notifications"
      className="grid grid-cols-3 gap-1.5 sm:grid-cols-5"
    >
      {OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.key)}
            className={
              "h-10 rounded-md border px-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-1 " +
              (active
                ? "border-signal/40 bg-signal/15 text-signal"
                : "border-line-1 bg-ink-2/40 text-bone hover:border-line-2 hover:bg-ink-3")
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
