import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  tone?: "default" | "danger";
  children: ReactNode;
};

// Mirrors the admin's Card: ink-1 surface, 1px line border, soft inset shadow.
// `tone="danger"` flips the border red for the destructive section.
export function Card({ tone = "default", className = "", children, ...rest }: Props) {
  const toneCls =
    tone === "danger"
      ? "border-danger/40 bg-danger/[0.04]"
      : "border-line-1 bg-ink-1";
  return (
    <div
      className={`rounded-xl border ${toneCls} shadow-panel p-5 ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  title,
  description,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 ${className}`}>
      <div className="font-display text-[16px] font-semibold leading-tight text-bone">{title}</div>
      {description ? (
        <div className="mt-1 text-[13px] leading-relaxed text-bone-mid">{description}</div>
      ) : null}
    </div>
  );
}
