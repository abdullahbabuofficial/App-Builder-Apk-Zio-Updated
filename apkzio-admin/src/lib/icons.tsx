import type { SVGProps } from "react";

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
  ...props,
});

export const Icon = {
  Bell: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  ),
  Send: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M21 3 3 11l7 2 2 7 9-17Z" />
      <path d="m10 13 5-5" />
    </svg>
  ),
  Layers: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="m3 7 9-4 9 4-9 4-9-4Z" />
      <path d="m3 12 9 4 9-4" />
      <path d="m3 17 9 4 9-4" />
    </svg>
  ),
  Phone: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <path d="M11 18h2" />
    </svg>
  ),
  Users: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="6" r="2.5" />
      <path d="M15.5 14.5c2.6 0 5 1.7 5.5 4.5" />
    </svg>
  ),
  Chart: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M3 3v18h18" />
      <path d="M7 14v3" />
      <path d="M12 9v8" />
      <path d="M17 5v12" />
    </svg>
  ),
  Trend: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  ),
  Hammer: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="m15 12-8.5 8.5a2.1 2.1 0 0 1-3-3L12 9" />
      <path d="m17.6 6.4 4 4-4 4-4-4z" />
      <path d="m12.6 11.4-2-2 7-7 4 4z" />
    </svg>
  ),
  Key: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8.5-8.5" />
      <path d="m17 6 3 3" />
      <path d="m14 9 2 2" />
    </svg>
  ),
  Cog: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  ),
  Search: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  Filter: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M3 5h18l-7 9v6l-4-2v-4L3 5Z" />
    </svg>
  ),
  Calendar: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  ),
  Plus: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  ),
  ArrowRight: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M5 12h14" />
      <path d="m13 5 7 7-7 7" />
    </svg>
  ),
  ArrowLeft: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M19 12H5" />
      <path d="m11 19-7-7 7-7" />
    </svg>
  ),
  ChevronDown: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  ChevronRight: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  Check: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  ),
  X: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  ),
  Eye: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  EyeOff: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A10.4 10.4 0 0 1 12 6c6 0 10 7 10 7a17 17 0 0 1-3 4" />
      <path d="M6.6 6.6A17 17 0 0 0 2 12s4 7 10 7c1.7 0 3.2-.4 4.5-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  ),
  Globe: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  ),
  Zap: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  ),
  Logout: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
  More: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="6" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="18" cy="12" r="1" />
    </svg>
  ),
  Copy: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  External: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  ),
  Trash: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  ),
  Edit: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  ),
  Play: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M5 3 19 12 5 21V3Z" />
    </svg>
  ),
  Pause: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  ),
  Info: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  ),
  Alert: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M10.3 3.9 1.8 18.4A2 2 0 0 0 3.5 21.5h17a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  ),
  Image: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  ),
  Code: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </svg>
  ),
  Target: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  ),
  Sparkles: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  ),
  Menu: ({ size, ...p }: IconProps) => (
    <svg {...base(size, p)}>
      <path d="M3 7h18" />
      <path d="M3 12h18" />
      <path d="M3 17h18" />
    </svg>
  ),
  Logo: ({ size = 24, ...p }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M4 12c0-4.4 3.6-8 8-8s8 3.6 8 8c0 1.6-.5 3.1-1.3 4.4l1 3.6-3.7-1.1A8 8 0 0 1 4 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  ),
};
