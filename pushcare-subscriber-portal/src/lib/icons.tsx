import type { SVGProps } from "react";

// Tiny inline icon set. Matches the pushcare-admin "currentColor + 1.5px stroke"
// look. We deliberately avoid icon libraries — this site ships ~6 glyphs and
// every kilobyte counts on a mobile-first preferences page.

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size = 18, props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  ...props,
});

export const Icon = {
  // Brand mark — abstract bell-in-disc.
  Logo: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 11a3 3 0 1 1 6 0c0 2.5 1 3 1 3H8s1-.5 1-3Z" />
      <path d="M11 17a1 1 0 0 0 2 0" />
    </svg>
  ),
  Bell: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  ),
  BellOff: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M8.7 5.3A6 6 0 0 1 18 8c0 5 2 6 2 6h-7" />
      <path d="M6 8a6 6 0 0 1 .2-1.6L4 14h9" />
      <path d="M10 19a2 2 0 0 0 4 0" />
      <path d="m3 3 18 18" />
    </svg>
  ),
  Pause: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ),
  Trash: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M5 6h14l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6Z" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  ),
  Check: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="m4 12 5 5 11-12" />
    </svg>
  ),
  ArrowLeft: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M19 12H5" />
      <path d="m12 5-7 7 7 7" />
    </svg>
  ),
  AlertTriangle: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M12 3 2 21h20L12 3Z" />
      <path d="M12 10v5" />
      <path d="M12 18h.01" />
    </svg>
  ),
  X: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </svg>
  ),
};
