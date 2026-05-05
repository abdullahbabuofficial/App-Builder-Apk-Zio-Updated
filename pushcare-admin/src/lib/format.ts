// Compact number — 1.4M, 23.1k, 412
export function compact(n: number, digits = 1): string {
  if (n === 0) return "0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const fmt = (v: number, suffix: string) => {
    const fixed = v.toFixed(digits);
    const trimmed = fixed.replace(/\.?0+$/, "");
    return sign + trimmed + suffix;
  };
  if (abs >= 1_000_000_000) return fmt(abs / 1_000_000_000, "B");
  if (abs >= 1_000_000) return fmt(abs / 1_000_000, "M");
  if (abs >= 1_000) return fmt(abs / 1_000, "k");
  return sign + abs.toString();
}

// Pretty integer with thousands separators
export function commas(n: number): string {
  return n.toLocaleString("en-US");
}

// Percentage — 12.4%
export function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`;
}

// Delta with up/down arrow
export function delta(n: number, digits = 1): { sign: "up" | "down" | "flat"; label: string } {
  if (n === 0) return { sign: "flat", label: "0%" };
  const sign = n > 0 ? "up" : "down";
  const label = `${n > 0 ? "+" : ""}${n.toFixed(digits)}%`;
  return { sign, label };
}

// Relative time — "12s ago", "4m", "2h", "3d"
export function relTime(d: Date | number | string): string {
  const t = typeof d === "string" ? new Date(d).getTime() : typeof d === "number" ? d : d.getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Format date — Apr 28
export function shortDate(d: Date | number | string): string {
  const dt = typeof d === "string" ? new Date(d) : (d instanceof Date ? d : new Date(d));
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Format date+time — Apr 28, 14:32
export function dateTime(d: Date | number | string): string {
  const dt = typeof d === "string" ? new Date(d) : (d instanceof Date ? d : new Date(d));
  return dt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
}

// Bytes — "24 MB" / "1.5 KB" / "150 MB" / "512 B".
// One decimal for KB+ under 100, zero for raw bytes and values ≥100.
// Trailing ".0" is trimmed so "24.0 MB" → "24 MB" while "1.5 KB" stays.
export function bytes(n: number): string {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  const decimals = v >= 100 || i === 0 ? 0 : 1;
  const str = decimals > 0 ? v.toFixed(decimals).replace(/\.0+$/, "") : v.toFixed(0);
  return `${str} ${u[i]}`;
}

// Duration in ms → "1m 23s" / "245ms"
export function ms(n: number): string {
  if (n < 1000) return `${Math.round(n)}ms`;
  const s = n / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const r = Math.round(s - m * 60);
  return `${m}m ${r}s`;
}
