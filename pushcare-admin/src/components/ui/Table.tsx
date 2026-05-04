import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  width?: string; // e.g. "w-32" or "min-w-[140px]"
  align?: "left" | "right" | "center";
  hideBelow?: "sm" | "md" | "lg"; // hide on small screens
};

type Props<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  className?: string;
  stickyHead?: boolean;
};

export function Table<T>({ rows, columns, rowKey, onRowClick, emptyState, className, stickyHead }: Props<T>) {
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }
  const hideClass = (h?: "sm" | "md" | "lg") =>
    h === "sm" ? "hidden sm:table-cell" :
    h === "md" ? "hidden md:table-cell" :
    h === "lg" ? "hidden lg:table-cell" : "";

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-[13px]">
        <thead className={cn(stickyHead && "sticky top-0 z-10 bg-ink-1")}>
          <tr className="border-b border-line-1 text-bone-low">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
                  c.width,
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  hideClass(c.hideBelow)
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-line-1/70 last:border-b-0 transition-colors",
                onRowClick && "cursor-pointer hover:bg-ink-2/60"
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-4 py-3 align-middle text-bone",
                    c.align === "right" && "text-right tabular-nums",
                    c.align === "center" && "text-center",
                    hideClass(c.hideBelow)
                  )}
                >
                  {c.cell(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
