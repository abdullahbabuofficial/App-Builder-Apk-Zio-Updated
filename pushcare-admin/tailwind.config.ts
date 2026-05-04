import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm-dark surfaces
        ink: {
          0: "#0E0D0B",
          1: "#15130F",
          2: "#1B1814",
          3: "#221E18",
          4: "#2A251D",
        },
        line: {
          1: "#2B2820",
          2: "#3D3A30",
          3: "#54503F",
        },
        bone: {
          DEFAULT: "#F5F1E8",
          high: "#F5F1E8",
          mid: "#B8B2A0",
          low: "#7A746A",
          dim: "#52503F",
        },
        // Acid-lime brand
        signal: {
          DEFAULT: "#CDFF3F",
          50: "#F7FFE0",
          100: "#ECFFB8",
          300: "#DEFF7A",
          500: "#CDFF3F",
          600: "#B7EA20",
          700: "#9DD32A",
          800: "#7AA21E",
        },
        // Status
        ok: "#5DCFA3",
        warn: "#FFB547",
        danger: "#FF5C5C",
        info: "#7CB7FF",
        // Chart accents
        chart: {
          a: "#CDFF3F",
          b: "#7CB7FF",
          c: "#FF8A4C",
          d: "#5DCFA3",
          e: "#E280C9",
          f: "#FFB547",
        },
      },
      fontFamily: {
        display: ['"Newsreader"', "ui-serif", "Georgia", "serif"],
        sans: [
          '"Geist"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.04em" }],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        "panel": "0 1px 0 rgba(255,255,255,0.02) inset, 0 8px 24px -8px rgba(0,0,0,0.5)",
        "raise": "0 0 0 1px rgba(255,255,255,0.04), 0 12px 32px -12px rgba(0,0,0,0.6)",
        "modal": "0 0 0 1px rgba(255,255,255,0.06), 0 32px 64px -16px rgba(0,0,0,0.7), 0 8px 16px -8px rgba(0,0,0,0.5)",
        "signal-glow": "0 0 0 1px rgba(205,255,63,0.18), 0 8px 32px -4px rgba(205,255,63,0.25)",
      },
      animation: {
        "fade-in": "fade-in .4s ease-out both",
        "slide-up": "slide-up .5s cubic-bezier(.2,.8,.2,1) both",
        "pulse-ring": "pulse-ring 2.4s ease-out infinite",
        "shimmer": "shimmer 2.2s linear infinite",
        "spin-slow": "spin 8s linear infinite",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.6" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, rgba(245,241,232,0.04) 1px, transparent 1px), linear-gradient(to right, rgba(245,241,232,0.04) 1px, transparent 1px)",
        "noise":
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.96  0 0 0 0 0.94  0 0 0 0 0.91  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
      },
    },
  },
  plugins: [],
} satisfies Config;
