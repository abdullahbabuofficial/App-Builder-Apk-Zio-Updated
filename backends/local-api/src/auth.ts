/**
 * Local-API auth helpers — password hashing, HMAC-signed bearer tokens.
 *
 * The signing secret lives at `<localApiRoot>/.builds/auth.key` and is
 * generated on first use. We co-locate it with the existing `BUILDS_DIR`
 * so the dev-only filesystem state is in one place.
 *
 * Tokens are simple base64url(JSON header).base64url(JSON payload).hmac
 * triples — JWT-shaped without pulling in a dependency.
 */

import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Same parent dir we use for build artifacts (see runner.ts). */
const BUILDS_DIR = path.resolve(__dirname, "..", ".builds");
const SECRET_PATH = path.join(BUILDS_DIR, "auth.key");

const SCRYPT_KEYLEN = 64;
const DEFAULT_TTL_SECONDS = 24 * 60 * 60;

let cachedSecret: Buffer | null = null;

function loadSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  try {
    if (!existsSync(BUILDS_DIR)) {
      mkdirSync(BUILDS_DIR, { recursive: true });
    }
    if (existsSync(SECRET_PATH)) {
      const buf = readFileSync(SECRET_PATH);
      if (buf.length >= 32) {
        cachedSecret = buf;
        return buf;
      }
    }
  } catch {
    // fall through to regenerate
  }
  const fresh = randomBytes(32);
  try {
    writeFileSync(SECRET_PATH, fresh, { mode: 0o600 });
  } catch {
    // dev-only state — not fatal if disk write fails
  }
  cachedSecret = fresh;
  return fresh;
}

export type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  plan: "starter" | "pro" | "business" | "enterprise";
  email_verified: boolean;
  created_at: string;
  phone?: string;
  location?: string;
  website?: string;
  bio?: string;
};

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return { hash, salt };
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): boolean {
  let derived: Buffer;
  try {
    derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  } catch {
    return false;
  }
  let stored: Buffer;
  try {
    stored = Buffer.from(hash, "hex");
  } catch {
    return false;
  }
  if (stored.length !== derived.length) return false;
  return timingSafeEqual(derived, stored);
}

function base64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

export type TokenClaims = { user_id: string; iat: number; exp: number };

export function signToken(user_id: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const secret = loadSecret();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + Math.max(60, Math.floor(ttlSeconds));
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ user_id, iat, exp }));
  const data = `${header}.${payload}`;
  const sig = base64url(createHmac("sha256", secret).update(data).digest());
  return `${data}.${sig}`;
}

export function verifyToken(token: string): TokenClaims | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts as [string, string, string];
  const secret = loadSecret();
  const expected = base64url(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest(),
  );
  let a: Buffer;
  let b: Buffer;
  try {
    a = Buffer.from(sig);
    b = Buffer.from(expected);
  } catch {
    return null;
  }
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let claims: TokenClaims;
  try {
    claims = JSON.parse(base64urlDecode(payload).toString("utf8")) as TokenClaims;
  } catch {
    return null;
  }
  if (
    !claims ||
    typeof claims.user_id !== "string" ||
    typeof claims.exp !== "number" ||
    typeof claims.iat !== "number"
  ) {
    return null;
  }
  if (claims.exp * 1000 < Date.now()) return null;
  return claims;
}

/** Extract a Bearer token from an Express-style request `headers` map. */
export function bearerFromHeader(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  const raw = headers["authorization"] ?? headers["Authorization"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string") return null;
  const m = value.match(/^Bearer\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}
