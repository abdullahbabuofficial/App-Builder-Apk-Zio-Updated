import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const inputBase =
  "block w-full rounded-md border border-line-1 bg-ink-2/60 text-[13px] text-bone placeholder:text-bone-low transition-colors hover:border-line-2 focus:border-signal/50 focus:bg-ink-2 focus:outline-none focus:ring-2 focus:ring-signal/15 disabled:cursor-not-allowed disabled:opacity-60";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  leading?: ReactNode;
  trailing?: ReactNode;
  invalid?: boolean;
};

export function Input({ leading, trailing, invalid, className, ...rest }: InputProps) {
  if (leading || trailing) {
    return (
      <div className={cn("relative", className)}>
        {leading && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-bone-low">
            {leading}
          </span>
        )}
        <input
          className={cn(
            inputBase,
            "h-9",
            leading ? "pl-9" : "pl-3",
            trailing ? "pr-9" : "pr-3",
            invalid && "border-danger/60 focus:border-danger/80 focus:ring-danger/20"
          )}
          {...rest}
        />
        {trailing && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-bone-low">
            {trailing}
          </span>
        )}
      </div>
    );
  }
  return (
    <input
      className={cn(
        inputBase,
        "h-9 px-3",
        invalid && "border-danger/60 focus:border-danger/80 focus:ring-danger/20",
        className
      )}
      {...rest}
    />
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export function Textarea({ className, invalid, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn(
        inputBase,
        "min-h-[88px] resize-y px-3 py-2 leading-relaxed",
        invalid && "border-danger/60 focus:border-danger/80 focus:ring-danger/20",
        className
      )}
      {...rest}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  required,
  optional,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      {label && (
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-medium text-bone">
            {label}
            {required && <span className="ml-1 text-signal">*</span>}
          </span>
          {optional && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bone-low">optional</span>
          )}
        </div>
      )}
      {children}
      {(error || hint) && (
        <div
          className={cn(
            "text-[11px]",
            error ? "text-danger" : "text-bone-low"
          )}
        >
          {error || hint}
        </div>
      )}
    </label>
  );
}
