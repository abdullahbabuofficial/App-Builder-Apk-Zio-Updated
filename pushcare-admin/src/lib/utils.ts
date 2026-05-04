// cn — minimal className combiner (no deps)
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// Stable hash for seeded mocks
export function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return h >>> 0;
}

// Seeded RNG
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Clamp
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// Random pick
export function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Sleep (used to simulate latency in mock handlers)
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
