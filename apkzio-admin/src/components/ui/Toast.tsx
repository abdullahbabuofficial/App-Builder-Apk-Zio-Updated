import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/lib/icons";
import { cn } from "@/lib/utils";

export type ToastTone = "default" | "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastItem = Required<Pick<ToastInput, "title">> & {
  id: string;
  description?: string;
  tone: ToastTone;
  durationMs: number;
};

type ToastContextValue = {
  toast: (t: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_TOASTS = 5;
const DEFAULT_DURATION_MS = 4000;

const toneDot: Record<ToastTone, string> = {
  default: "bg-bone-mid",
  success: "bg-ok",
  error: "bg-danger",
  info: "bg-info",
};

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput): string => {
    const id = makeId();
    const next: ToastItem = {
      id,
      title: input.title,
      description: input.description,
      tone: input.tone ?? "default",
      durationMs: Math.max(1000, input.durationMs ?? DEFAULT_DURATION_MS),
    };
    setToasts((prev) => {
      const merged = [...prev, next];
      return merged.length > MAX_TOASTS ? merged.slice(merged.length - MAX_TOASTS) : merged;
    });
    return id;
  }, []);

  const ctx = useMemo<ToastContextValue>(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return ctx;
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-stretch gap-2",
        "sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[360px]"
      )}
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(item.durationMs);
  const startedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (paused) return;
    startedAtRef.current = Date.now();
    const handle = window.setTimeout(() => onDismiss(item.id), remainingRef.current);
    return () => {
      window.clearTimeout(handle);
      const elapsed = Date.now() - startedAtRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    };
  }, [paused, item.id, onDismiss]);

  return (
    <div
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onClick={() => onDismiss(item.id)}
      className={cn(
        "pointer-events-auto cursor-pointer rounded-lg border border-line-1 bg-ink-1 p-3.5 text-bone shadow-raise animate-fade-in",
        "flex items-start gap-3"
      )}
    >
      <span
        aria-hidden="true"
        className={cn("mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full", toneDot[item.tone])}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-tight text-bone">{item.title}</div>
        {item.description && (
          <div className="mt-1 text-[12px] leading-snug text-bone-mid">{item.description}</div>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(item.id);
        }}
        className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-bone-low hover:bg-ink-3 hover:text-bone"
      >
        <Icon.X size={14} />
      </button>
    </div>
  );
}
