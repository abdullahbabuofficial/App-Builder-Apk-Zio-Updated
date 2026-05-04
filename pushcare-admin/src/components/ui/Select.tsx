import type { SelectHTMLAttributes } from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string; label: string }>;
};

export function Select({ options, className, ...rest }: Props) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="block h-9 w-full appearance-none rounded-md border border-line-1 bg-ink-2/60 px-3 pr-9 text-[13px] text-bone hover:border-line-2 focus:border-signal/50 focus:bg-ink-2 focus:outline-none focus:ring-2 focus:ring-signal/15"
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-2 text-bone">
            {o.label}
          </option>
        ))}
      </select>
      <Icon.ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-bone-low"
      />
    </div>
  );
}
