import { useMemo, useState, type CSSProperties } from "react";
import { compact, shortDate } from "@/lib/format";
import type { Point } from "@/lib/mock-data";

type Props = {
  data: Point[];
  height?: number;
  color?: string;
  showAxis?: boolean;
  className?: string;
  yFormat?: (v: number) => string;
};

export function AreaChart({
  data,
  height = 220,
  color = "#CDFF3F",
  showAxis = true,
  className,
  yFormat = compact,
}: Props) {
  const W = 1000;
  const H = height;
  const pad = { l: showAxis ? 44 : 4, r: 8, t: 14, b: showAxis ? 24 : 4 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const { path, area, points, vMax, vMin, ticks } = useMemo(() => {
    if (data.length === 0) return { path: "", area: "", points: [] as { x: number; y: number; p: Point }[], vMax: 0, vMin: 0, ticks: [] as number[] };
    const vMax = Math.max(...data.map((d) => d.v));
    const vMin = Math.min(...data.map((d) => d.v));
    const yScale = (v: number) => pad.t + innerH - ((v - vMin) / Math.max(1, vMax - vMin)) * innerH;
    const xScale = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * innerW;

    const points = data.map((p, i) => ({ x: xScale(i), y: yScale(p.v), p }));
    let path = "";
    let area = "";
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) {
        path += `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      } else {
        const pp = points[i - 1];
        const cx = (pp.x + p.x) / 2;
        path += ` C ${cx.toFixed(1)} ${pp.y.toFixed(1)}, ${cx.toFixed(1)} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      }
    }
    area = path + ` L ${points[points.length - 1].x.toFixed(1)} ${(pad.t + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(pad.t + innerH).toFixed(1)} Z`;

    // y ticks (5)
    const ticks: number[] = [];
    for (let i = 0; i <= 4; i++) ticks.push(vMin + ((vMax - vMin) * i) / 4);

    return { path, area, points, vMax, vMin, ticks };
  }, [data, innerH, innerW, pad.l, pad.t]);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const xRel = ((e.clientX - rect.left) / rect.width) * W;
    if (xRel < pad.l || xRel > W - pad.r || data.length === 0) {
      setHoverIdx(null);
      return;
    }
    const i = Math.round(((xRel - pad.l) / innerW) * (data.length - 1));
    setHoverIdx(Math.max(0, Math.min(data.length - 1, i)));
  };

  if (data.length === 0) {
    return <div className="h-full w-full" style={{ height }} />;
  }

  return (
    <div className={className} style={{ height, width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="ac-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {showAxis && ticks.map((v, i) => {
          const y = pad.t + innerH - (i / 4) * innerH;
          return (
            <g key={i}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={y}
                y2={y}
                stroke="#2B2820"
                strokeDasharray="2 4"
                vectorEffect="non-scaling-stroke"
                strokeWidth={1}
              />
              <text
                x={pad.l - 8}
                y={y + 4}
                fontSize="11"
                fontFamily='"Geist Mono", monospace'
                fill="#7A746A"
                textAnchor="end"
              >
                {yFormat(v)}
              </text>
            </g>
          );
        })}

        {showAxis && (
          <g>
            {[0, Math.floor(data.length / 2), data.length - 1].map((i) => {
              if (!data[i]) return null;
              const x = pad.l + (i / Math.max(1, data.length - 1)) * innerW;
              return (
                <text
                  key={i}
                  x={x}
                  y={H - 6}
                  fontSize="11"
                  fontFamily='"Geist Mono", monospace'
                  fill="#7A746A"
                  textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                >
                  {shortDate(data[i].t)}
                </text>
              );
            })}
          </g>
        )}

        <path d={area} fill="url(#ac-fill)" />
        <path d={path} stroke={color} strokeWidth={1.5} fill="none" vectorEffect="non-scaling-stroke" />

        {hoverIdx !== null && data[hoverIdx] && (
          <g>
            <line
              x1={points[hoverIdx].x}
              x2={points[hoverIdx].x}
              y1={pad.t}
              y2={pad.t + innerH}
              stroke="#54503F"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={points[hoverIdx].x}
              cy={points[hoverIdx].y}
              r={4}
              fill={color}
              stroke="#0E0D0B"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {hoverIdx !== null && data[hoverIdx] && (
        <Tooltip
          style={{
            position: "absolute",
            transform: `translate(${(points[hoverIdx].x / W) * 100}%, -100%)`,
          }}
          v={data[hoverIdx].v}
          t={data[hoverIdx].t}
          fmt={yFormat}
        />
      )}
    </div>
  );
}

function Tooltip({ v, t, fmt, style }: { v: number; t: number; fmt: (v: number) => string; style?: CSSProperties }) {
  return (
    <div
      className="pointer-events-none -translate-x-1/2 -translate-y-2 rounded-md border border-line-2 bg-ink-2 px-2.5 py-1.5 shadow-raise"
      style={{ ...style, left: 0, position: "absolute", top: 0, display: "none" }}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-low">{shortDate(t)}</div>
      <div className="font-display text-[14px] font-semibold text-bone num">{fmt(v)}</div>
    </div>
  );
}
