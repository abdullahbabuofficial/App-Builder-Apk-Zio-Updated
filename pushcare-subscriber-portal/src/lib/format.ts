// Relative time — "12s ago", "4m ago", "2h ago", "3d ago", or short date.
export function relTime(d: Date | number | string): string {
  const t =
    typeof d === "string" ? new Date(d).getTime() : typeof d === "number" ? d : d.getTime();
  if (!Number.isFinite(t)) return "";
  const diff = (Date.now() - t) / 1000;
  if (diff < 0) {
    // future
    const future = Math.abs(diff);
    if (future < 60) return `in ${Math.floor(future)}s`;
    if (future < 3600) return `in ${Math.floor(future / 60)}m`;
    if (future < 86400) return `in ${Math.floor(future / 3600)}h`;
    if (future < 86400 * 7) return `in ${Math.floor(future / 86400)}d`;
    return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Format a date for display: "Apr 28, 14:32".
export function dateTime(d: Date | number | string): string {
  const dt = typeof d === "string" ? new Date(d) : d instanceof Date ? d : new Date(d);
  return dt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
