import { useMemo } from "react";
import type { Point } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

// === Sparkline ===
export function Sparkline({
  data,
  color = "#CDFF3F",
  width = 100,
  height = 32,
  fill = true,
  className,
}: {
  data: Point[] | number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
}) {
  const series = useMemo(() => {
    return (data as any[]).map((d, i) => (typeof d === "number" ? { t: i, v: d } : d));
  }, [data]);
  if (series.length === 0) return null;
  const vMax = Math.max(...series.map((d: any) => d.v));
  const vMin = Math.min(...series.map((d: any) => d.v));
  const px = (i: number) => (i / (series.length - 1)) * width;
  const py = (v: number) => height - ((v - vMin) / Math.max(1, vMax - vMin)) * height;
  let path = "";
  for (let i = 0; i < series.length; i++) {
    const x = px(i);
    const y = py(series[i].v);
    path += i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : `L${x.toFixed(1)},${y.toFixed(1)}`;
  }
  const area = path + ` L${width},${height} L0,${height} Z`;
  const idForGrad = `sl-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("block", className)}>
      <defs>
        <linearGradient id={idForGrad} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${idForGrad})`} />}
      <path d={path} stroke={color} strokeWidth={1.25} fill="none" />
    </svg>
  );
}

// === DonutChart ===
export function DonutChart({
  segments,
  size = 160,
  thickness = 14,
  centerLabel,
  centerValue,
}: {
  segments: { value: number; color: string; label?: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;

  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1F1C16" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const len = (s.value / total) * c;
        const offset = -acc;
        acc += len;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        );
      })}
      {(centerLabel || centerValue) && (
        <g>
          {centerValue && (
            <text
              x={cx}
              y={cy + 2}
              textAnchor="middle"
              fontFamily='"Newsreader", serif'
              fontSize={Math.round(size * 0.18)}
              fontWeight={600}
              fill="#F5F1E8"
            >
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text
              x={cx}
              y={cy + Math.round(size * 0.16)}
              textAnchor="middle"
              fontFamily='"Geist Mono", monospace'
              fontSize={Math.round(size * 0.07)}
              letterSpacing="0.16em"
              fill="#7A746A"
            >
              {centerLabel.toUpperCase()}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

// === BarChart (horizontal) ===
export function BarChart({
  rows,
  height = 200,
  className,
  format = (n) => n.toLocaleString(),
}: {
  rows: { label: string; value: number; color?: string }[];
  height?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className={cn("flex flex-col", className)} style={{ minHeight: height }}>
      {rows.map((r, i) => {
        const w = (r.value / max) * 100;
        return (
          <div key={i} className="group flex items-center gap-3 py-1.5">
            <div className="w-28 truncate text-[12px] text-bone-mid">{r.label}</div>
            <div className="relative h-3.5 flex-1 overflow-hidden rounded bg-ink-3/60">
              <div
                className="h-full rounded transition-all"
                style={{ width: `${w}%`, background: r.color ?? "#CDFF3F" }}
              />
            </div>
            <div className="w-16 text-right font-mono text-[11px] tabular-nums text-bone">{format(r.value)}</div>
          </div>
        );
      })}
    </div>
  );
}
