import type { RequestHandler } from "express";

/** Fixed-window counter — simple and predictable for abuse protection. */
export function createFixedWindowLimiter(
  max: number,
  windowMs: number,
): (key: string) => boolean {
  const buckets = new Map<string, { n: number; resetAt: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now >= b.resetAt) {
      b = { n: 1, resetAt: now + windowMs };
      buckets.set(key, b);
      return true;
    }
    if (b.n >= max) return false;
    b.n += 1;
    return true;
  };
}

/**
 * Limits `POST /api/builder/builds` per IP. Disabled when
 * `APKZIO_BUILDER_RATE_LIMIT_MAX` is 0 or negative.
 */
export function createBuilderRateLimitMiddleware(): RequestHandler {
  const maxRaw = process.env.APKZIO_BUILDER_RATE_LIMIT_MAX ?? "30";
  const max = Number.parseInt(maxRaw, 10);
  if (!Number.isFinite(max) || max <= 0) {
    return (_req, _res, next) => next();
  }

  const windowRaw = process.env.APKZIO_BUILDER_RATE_LIMIT_WINDOW_MS ?? "60000";
  let windowMs = Number.parseInt(windowRaw, 10);
  if (!Number.isFinite(windowMs) || windowMs < 1000) windowMs = 60_000;

  const allow = createFixedWindowLimiter(max, windowMs);

  return (req, res, next): void => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (!allow(ip)) {
      res.status(429).json({
        ok: false,
        error: {
          code: "rate_limited",
          message: "Too many build requests. Try again later.",
        },
      });
      return;
    }
    next();
  };
}
